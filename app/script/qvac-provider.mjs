// QVAC provider (organizer laptop). Starts the DHT provider, pre-warms Qwen3-VL-2B, prints its
// public key, and stays alive to serve delegated inference.
import { startProvider } from "../src/delegated.js";

const { publicKey } = await startProvider({ prewarm: true });
console.log(`Provider Public Key: ${publicKey}`);
console.log("Provider ready (model pre-warmed). Ctrl+C to stop.");
process.stdin.resume();
process.on("SIGINT", () => process.exit(0));
