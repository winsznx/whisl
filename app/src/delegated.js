import {
  startQVACProvider,
  stopQVACProvider,
  loadModel,
  QWEN3VL_2B_MULTIMODAL_Q4_K,
  MMPROJ_QWEN3VL_2B_MULTIMODAL_Q4_K,
} from "@qvac/sdk";
import { loadVisionModel, parseFrame } from "./qvac.js";

// Delegated inference (PRD §6.3 / step 7): a weak phone offloads the frame parse to a nearby
// laptop running a QVAC provider. First DHT connect is slow (15–45s) so the consumer uses a
// >=60s timeout and falls back to a local parse if the handshake fails.

/** Organizer laptop: start the provider and PRE-WARM the vision model so it's resident. */
export async function startProvider({ prewarm = true } = {}) {
  const res = await startQVACProvider({});
  const prewarmId = prewarm ? await loadVisionModel({ ctxSize: 4096 }) : null;
  return { publicKey: res.publicKey, prewarmId, stop: () => stopQVACProvider() };
}

/**
 * Phone consumer: load the vision model via delegation and parse the frame on the provider.
 * `fallbackToLocal` lets a failed handshake silently parse locally instead of erroring.
 */
export async function delegatedParse(providerPublicKey, imagePath, { timeout = 60_000, fallbackToLocal = true, condition } = {}) {
  const t0 = Date.now();
  const modelId = await loadModel({
    modelSrc: QWEN3VL_2B_MULTIMODAL_Q4_K,
    modelConfig: { ctx_size: 4096, projectionModelSrc: MMPROJ_QWEN3VL_2B_MULTIMODAL_Q4_K },
    delegate: { providerPublicKey, timeout, fallbackToLocal },
  });
  const connectMs = Date.now() - t0;
  const result = await parseFrame(modelId, imagePath, { condition });
  return { modelId, connectMs, result };
}
