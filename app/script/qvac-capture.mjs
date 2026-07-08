// Step 4 — QVAC capture pipeline: capture frame -> local Qwen3-VL-2B parse -> structured result
// + evidence hash. Also exercises the required manual-entry fallback.
import { ethers } from "ethers";
import { makeScoreboard } from "./make-scoreboard.mjs";
import { loadVisionModel, unloadVisionModel, parseFrame, manualEntry, QVAC_MODEL } from "../src/qvac.js";

const IMG = process.env.SCRATCH ? `${process.env.SCRATCH}/whisl-scoreboard.png` : "/tmp/whisl-scoreboard.png";
const CONDITION = "Nigeria scores";

console.log("== capture: generating scoreboard frame ==");
await makeScoreboard(IMG, { home: "NIGERIA", away: "ARGENTINA", hs: 1, as: 0 });
console.log("frame:", IMG);

console.log("== loading Qwen3-VL-2B + mmproj (local, first load can take a while) ==");
const t0 = Date.now();
const modelId = await loadVisionModel({ ctxSize: 4096 });
console.log(`model loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

console.log("== local QVAC parse ==");
const tp = Date.now();
const result = await parseFrame(modelId, IMG, { condition: CONDITION });
console.log(`parsed in ${((Date.now() - tp) / 1000).toFixed(1)}s`);
console.log("raw model text:", JSON.stringify(result.rawText));
console.log("parsed:", JSON.stringify(result.parsedResult));
console.log("evidenceHash(sha256):", result.evidenceHash);
console.log("ok (parsed + confidence>=0.5):", result.ok);

// resultHash the Pears room / escrow would carry (bytes32)
const proposal = result.ok ? result : manualEntry(IMG, { home_team: "NIGERIA", away_team: "ARGENTINA", home_score: 1, away_score: 0, event: "goal", confidence: 1 });
if (!result.ok) console.log("== parse failed/low-confidence -> MANUAL FALLBACK (image kept as evidence) ==");
const resultHash = ethers.id(JSON.stringify(proposal.parsedResult ?? {}));

console.log("\nSTEP4_RESULT:", JSON.stringify({
  model: QVAC_MODEL,
  parserDevice: proposal.parserDevice,
  evidenceType: proposal.evidenceType,
  evidenceHash: proposal.evidenceHash,
  parsedResult: proposal.parsedResult,
  resultHash,
  conditionMet: proposal.parsedResult?.home_score > 0,
}, null, 2));

await unloadVisionModel(modelId);
