// Step 3 — WDK wallet + deposit flow against the deployed Sepolia escrow, with real tx hashes.
// Creates a fresh pot (WDK-signed), then funds it via WDK approve + WDK deposit (two visible steps).
import fs from "node:fs";
import { ethers } from "ethers";
import { loadWallet, createWallet, waitReceipt, approveAndDeposit, SEPOLIA } from "../src/wdk.js";

const dep = JSON.parse(fs.readFileSync(new URL("../../deployments.json", import.meta.url))).sepolia;
const ESCROW = dep.whislEscrow;
const artifact = JSON.parse(fs.readFileSync(new URL("../../contracts/out/WhislEscrow.sol/WhislEscrow.json", import.meta.url)));
const escrowIface = new ethers.Interface(artifact.abi);

// funded custos WDK wallet (seed never printed)
const env = fs.readFileSync("/Users/mac/custos/.env", "utf8");
const seed = env.split("\n").find((l) => l.startsWith("CUSTOS_WALLET_SEED=")).slice("CUSTOS_WALLET_SEED=".length).trim().replace(/^["']|["']$/g, "");

const { account, address } = await loadWallet(seed);
console.log("WDK wallet:", address);
console.log("ETH:", ethers.formatEther(await account.getBalance()));

// demonstrate fresh per-participant wallet creation (PRD §6.4) — address only, no funds
const fresh = await createWallet();
console.log("fresh participant wallet:", fresh.address, "(created via WDK, unfunded)");

// 1) create a fresh pot, WDK-signed
const now = Math.floor(Date.now() / 1000);
const createData = escrowIface.encodeFunctionData("createPot", [
  ethers.id("NGA-vs-ARG-STEP3"), ethers.id("Nigeria scores"),
  SEPOLIA.usdt, address, address,
  1_000_000n, 1_000_000_000n,
  now + 3600, now + 7200, 30, 30, 1_209_600,
]);
const createRes = await account.sendTransaction({ to: ESCROW, value: 0, data: createData, chainId: SEPOLIA.chainId });
const createRc = await waitReceipt(account, createRes.hash);
let potId;
for (const log of createRc.logs) {
  try { const p = escrowIface.parseLog(log); if (p?.name === "PotCreated") potId = p.args.potId; } catch {}
}
console.log("createPot tx:", createRes.hash, "| potId:", potId);

// 2) WDK approve then WDK deposit — two visible steps
const AMT = 1_000_000n; // 1 USDT
const res = await approveAndDeposit(account, { escrow: ESCROW, potId, amount: AMT });
console.log("approve tx:", res.approveTx, "(status", res.approveStatus + ")");
console.log("deposit tx:", res.depositTx, "(status", res.depositStatus + ")");

// 3) verify on-chain via a read-only provider
const provider = new ethers.JsonRpcProvider(SEPOLIA.rpc, SEPOLIA.chainId, { staticNetwork: true });
const escrow = new ethers.Contract(ESCROW, artifact.abi, provider);
const deposited = await escrow.depositOf(potId, address);
const state = await escrow.potStateOf(potId);
console.log("on-chain depositOf:", deposited.toString(), "| pot state (2=Ready):", state.toString());

console.log("\nSTEP3_RESULT:", JSON.stringify({
  escrow: ESCROW, potId, wallet: address,
  createPot: createRes.hash, approve: res.approveTx, deposit: res.depositTx,
  depositedBaseUnits: deposited.toString(), state: Number(state),
}, null, 2));
