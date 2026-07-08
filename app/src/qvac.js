import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  loadModel,
  unloadModel,
  completion,
  QWEN3VL_2B_MULTIMODAL_Q4_K,
  MMPROJ_QWEN3VL_2B_MULTIMODAL_Q4_K,
} from "@qvac/sdk";

export const QVAC_MODEL = "qwen3-vl-2b-q4";

/** Load Qwen3-VL-2B + its matching mmproj projection model locally (PRD §6.3). */
export async function loadVisionModel({ ctxSize = 4096 } = {}) {
  return loadModel({
    modelSrc: QWEN3VL_2B_MULTIMODAL_Q4_K,
    modelConfig: { ctx_size: ctxSize, projectionModelSrc: MMPROJ_QWEN3VL_2B_MULTIMODAL_Q4_K },
  });
}

export function unloadVisionModel(modelId) {
  return unloadModel({ modelId });
}

export function sha256File(path) {
  return createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}

const PROMPT = `You are a football match referee assistant. Read this scoreboard image and report the match state.
Respond with ONLY a JSON object and nothing else:
{"home_team": string, "away_team": string, "home_score": number, "away_score": number, "event": string, "confidence": number}
confidence is your certainty from 0 to 1.`;

/**
 * Capture -> local QVAC parse. Reads one frame file, returns a structured result plus the
 * sha256 evidence hash of the exact bytes parsed. `ok:false` (parse failed / low confidence)
 * is the signal to fall back to manualEntry — never a fabricated "always works" result.
 */
export async function parseFrame(modelId, imagePath, { condition } = {}) {
  const res = completion({
    modelId,
    history: [
      {
        role: "user",
        content: PROMPT + (condition ? `\nTrigger condition to evaluate: "${condition}".` : ""),
        attachments: [{ path: imagePath }],
      },
    ],
    stream: true,
  });

  let text = "";
  for await (const token of res.tokenStream) text += token;
  let stats = {};
  try {
    stats = await res.stats;
  } catch {}

  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim(); // Qwen3 hybrid-reasoning
  const parsed = extractJson(cleaned);
  const evidenceHash = sha256File(imagePath);
  const confidence = parsed && typeof parsed.confidence === "number" ? parsed.confidence : 0;
  const ok = !!parsed && confidence >= 0.5;

  return {
    ok,
    evidenceType: "image",
    evidenceHash,
    model: QVAC_MODEL,
    parserDevice: "local",
    parsedResult: parsed,
    confidence,
    rawText: cleaned,
    stats,
  };
}

/** Required manual fallback (PRD §6.3): referee enters the result; the frame stays as evidence. */
export function manualEntry(imagePath, result) {
  return {
    ok: true,
    evidenceType: "image",
    evidenceHash: sha256File(imagePath),
    model: null,
    parserDevice: "manual",
    parsedResult: result,
    confidence: 1,
  };
}

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
