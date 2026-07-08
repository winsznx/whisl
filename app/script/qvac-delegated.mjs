// Step 7 composite — spawn a provider, wait for its public key (pre-warm), then run the phone
// consumer's delegated parse over the DHT. Also demonstrates fallback-to-local on a bad handshake.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { makeScoreboard } from "./make-scoreboard.mjs";
import { delegatedParse } from "../src/delegated.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH = process.env.SCRATCH || "/tmp";
const IMG = `${SCRATCH}/whisl-scoreboard-deleg.png`;
const PROVIDER_TIMEOUT = 90_000;

await makeScoreboard(IMG, { home: "NIGERIA", away: "ARGENTINA", hs: 1, as: 0 });

console.log("== spawning provider (pre-warming model, cold DHT can take 15–45s) ==");
const provider = spawn("node", [path.join(__dirname, "qvac-provider.mjs")], { stdio: ["pipe", "pipe", "inherit"] });

const publicKey = await new Promise((resolve, reject) => {
  let out = "";
  const timer = setTimeout(() => reject(new Error("provider did not emit public key in time")), PROVIDER_TIMEOUT);
  provider.stdout.on("data", (c) => {
    out += c.toString();
    process.stdout.write(c);
    const m = out.match(/Provider Public Key: ([a-f0-9]+)/i);
    if (m) { clearTimeout(timer); resolve(m[1]); }
  });
  provider.on("close", (code) => { clearTimeout(timer); reject(new Error(`provider exited (${code})`)); });
});

// give the provider a moment to finish pre-warming after printing its key
await new Promise((r) => setTimeout(r, 3000));

let delegated = null, fallback = null, error = null;
try {
  console.log("\n== consumer: delegated parse (timeout 60s) ==");
  const d = await delegatedParse(publicKey, IMG, { timeout: 60_000, fallbackToLocal: true, condition: "Nigeria scores" });
  console.log(`delegated connect+load: ${(d.connectMs / 1000).toFixed(1)}s | parsed:`, JSON.stringify(d.result.parsedResult), "| ok:", d.result.ok);
  delegated = { connectMs: d.connectMs, parsed: d.result.parsedResult, ok: d.result.ok };

  console.log("\n== fallback demo: bogus provider key + fallbackToLocal (short timeout) ==");
  const bogus = "0".repeat(64);
  const f = await delegatedParse(bogus, IMG, { timeout: 8_000, fallbackToLocal: true, condition: "Nigeria scores" });
  console.log("fell back to local, parsed:", JSON.stringify(f.result.parsedResult), "| ok:", f.result.ok);
  fallback = { ok: f.result.ok, parsed: f.result.parsedResult };
} catch (e) {
  error = e.message;
  console.error("delegation error:", e.message);
} finally {
  provider.kill("SIGTERM");
}

console.log("\nSTEP7_RESULT:", JSON.stringify({ providerPublicKey: publicKey, delegated, fallback, error }, null, 2));
process.exit(error ? 1 : 0);
