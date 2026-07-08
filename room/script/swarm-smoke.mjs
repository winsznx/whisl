// Real Hyperswarm smoke test: two peers over the actual DHT converge on the same room state.
// Exercises PRD Day-0 item 4 (cold-start timing). Prints the cold-start duration it observed.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Corestore from "corestore";
import { WhislRoom } from "../src/room.js";
import { joinRoom } from "../src/swarm.js";

const t0 = Date.now();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "whisl-swarm-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dirA = tmp(), dirB = tmp();

const roomA = new WhislRoom(new Corestore(dirA));
await roomA.ready();
const roomB = new WhislRoom(new Corestore(dirB), roomA.key);
await roomB.ready();

let connected = false;
const swA = joinRoom(roomA, { onPeer: () => { connected = true; } });
const swB = joinRoom(roomB, { onPeer: () => { connected = true; } });

console.log("joining DHT (cold start can take 15–45s)...");
await Promise.all([swA.flushed(), swB.flushed()]);

const CONNECT_TIMEOUT = 60000;
while (!connected) {
  if (Date.now() - t0 > CONNECT_TIMEOUT) {
    console.log("NO_PEER_CONNECTION within 60s (DHT unreachable in this environment)");
    await cleanup();
    process.exit(2);
  }
  await sleep(200);
}
console.log(`peer connected after ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const POT = "0xswarmpot";
await roomA.append({ type: "pot", potId: POT, matchId: "m", condition: "Nigeria scores", createdBy: "0xA" });
await roomA.addWriter(roomB.writerKeyHex);

async function waitFor(cond, timeout = 30000) {
  const s = Date.now();
  for (;;) {
    await roomA.update();
    await roomB.update();
    if (await cond()) return true;
    if (Date.now() - s > timeout) return false;
    await sleep(100);
  }
}

const becameWritable = await waitFor(() => roomB.writable);
if (!becameWritable) { console.log("FAIL: B never became writable"); await cleanup(); process.exit(1); }

await roomB.append({ type: "proposal", potId: POT, creator: "0xB", eventNumber: 1, resultHash: "0xR", evidenceHash: "0xE" });
const converged = await waitFor(async () => (await roomA.listProposals(POT)).length === 1);

if (converged) {
  const p = (await roomA.listProposals(POT))[0];
  console.log("CONVERGED: A sees B's proposal over real Hyperswarm ->", JSON.stringify({ resultHash: p.resultHash }));
  await cleanup();
  process.exit(0);
} else {
  console.log("FAIL: did not converge");
  await cleanup();
  process.exit(1);
}

async function cleanup() {
  swA.destroy();
  swB.destroy();
  try { await roomA.close(); await roomB.close(); } catch {}
  fs.rmSync(dirA, { recursive: true, force: true });
  fs.rmSync(dirB, { recursive: true, force: true });
}
