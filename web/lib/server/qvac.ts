import "server-only";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// QVAC capture bridge — loads the sibling app/src/qvac.js at runtime (Qwen3-VL-2B local parse).
// Same reason as the room: keep @qvac native prebuilds out of the Next bundle.

export type ParseResult = {
  ok: boolean;
  evidenceHash: string;
  model: string | null;
  parserDevice: string;
  parsedResult: Record<string, unknown> | null;
  confidence: number;
  rawText: string;
};

interface QvacApi {
  loadVisionModel(opts?: { ctxSize?: number }): Promise<string>;
  parseFrame(modelId: string, imagePath: string, opts?: { condition?: string }): Promise<ParseResult>;
}

let modPromise: Promise<QvacApi> | null = null;
let modelIdPromise: Promise<string> | null = null;

function loadMod(): Promise<QvacApi> {
  if (!modPromise) {
    const url = pathToFileURL(path.resolve(process.cwd(), "..", "app", "src", "qvac.js")).href;
    modPromise = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<QvacApi>;
  }
  return modPromise;
}

async function modelId(): Promise<string> {
  if (!modelIdPromise) {
    modelIdPromise = loadMod().then((m) => m.loadVisionModel({ ctxSize: 4096 }));
  }
  return modelIdPromise;
}

// Pre-warm: load the local model into this server process so the first on-camera capture is fast.
export async function warmup(): Promise<string> {
  return modelId();
}

import { createHash } from "node:crypto";

// Parse a base64 data URL (captured frame) on device and return the structured result + hash.
// If the local model is not available on this instance, degrade to ok:false with the real
// evidence hash so the UI offers manual entry — the photo still stands as proof.
export async function parseCapturedFrame(dataUrl: string, condition: string): Promise<ParseResult> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  const evidenceHash = createHash("sha256").update(bytes).digest("hex");
  const file = path.join(os.tmpdir(), `whisl-cap-${Date.now()}.png`);
  fs.writeFileSync(file, bytes);
  try {
    const [m, id] = await Promise.all([loadMod(), modelId()]);
    return await m.parseFrame(id, file, { condition });
  } catch {
    return { ok: false, evidenceHash, model: null, parserDevice: "local", parsedResult: null, confidence: 0, rawText: "" };
  } finally {
    try {
      fs.unlinkSync(file);
    } catch {
      // best effort cleanup
    }
  }
}
