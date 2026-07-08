// Steps 5 & 6 — confirm/dispute logic + claim/receipt, wired across escrow (on-chain) and the
// Pears room. One funded wallet plays organizer+confirmer+depositor+recipient so the full
// submit -> confirm -> dispute -> resolve -> claim path runs on real Sepolia with room mirroring.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ethers } from "ethers";
import { loadWallet, waitReceipt, SEPOLIA } from "../src/wdk.js";
import * as gd from "../src/goaldrop.js";
import { openRoom } from "../../room/src/room.js";

const dep = JSON.parse(fs.readFileSync(new URL("../../deployments.json", import.meta.url))).sepolia;
const ESCROW = dep.whislEscrow;
const abi = JSON.parse(fs.readFileSync(new URL("../../contracts/out/WhislEscrow.sol/WhislEscrow.json", import.meta.url))).abi;
const escrowIface = new ethers.Interface(abi);

const env = fs.readFileSync("/Users/mac/custos/.env", "utf8");
const seed = env.split("\n").find((l) => l.startsWith("CUSTOS_WALLET_SEED=")).slice("CUSTOS_WALLET_SEED=".length).trim().replace(/^["']|["']$/g, "");
const { account, address } = await loadWallet(seed);
console.log("wallet:", address);

// real QVAC output from Step 4 (Nigeria 1-0 Argentina, conf 0.95)
const proposal = {
  eventNumber: 1,
  evidenceType: "image",
  evidenceHash: "12e957ab3046ad8a57ab12af5a29a23107713e8a72110e28b89489ab9e4691b9",
  model: "qwen3-vl-2b-q4",
  parserDevice: "local",
  parsedResult: { home_team: "Nigeria", away_team: "Argentina", home_score: 1, away_score: 0 },
  resultHash: "0xea586e8ee8327bb325c93e5024eaaa728241742f62be599b955a1c68c9fecb15",
};

// local room mirror
const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), "whisl-gd-"));
const room = await openRoom(roomDir);

// 1) create + fund a fresh pot (WDK-signed)
const now = Math.floor(Date.now() / 1000);
const createData = escrowIface.encodeFunctionData("createPot", [
  ethers.id("NGA-ARG-STEP5"), ethers.id("Nigeria scores"), SEPOLIA.usdt, address, address,
  1_000_000n, 1_000_000_000n, now + 3600, now + 7200, 60, 300, 1_209_600,
]);
const createRes = await account.sendTransaction({ to: ESCROW, value: 0, data: createData, chainId: SEPOLIA.chainId });
const createRc = await waitReceipt(account, createRes.hash);
let potId;
for (const log of createRc.logs) { try { const p = escrowIface.parseLog(log); if (p?.name === "PotCreated") potId = p.args.potId; } catch {} }
console.log("createPot:", createRes.hash, "potId:", potId);
await room.append({ type: "pot", potId, matchId: "NGA-ARG", condition: "Nigeria scores", createdBy: address });

const approve = await account.approve({ token: SEPOLIA.usdt, spender: ESCROW, amount: 1_000_000n });
await waitReceipt(account, approve.hash);
const depData = escrowIface.encodeFunctionData("deposit", [potId, 1_000_000n]);
const depRes = await account.sendTransaction({ to: ESCROW, value: 0, data: depData, chainId: SEPOLIA.chainId });
await waitReceipt(account, depRes.hash);
console.log("approve:", approve.hash, "deposit:", depRes.hash);

// 2) submit (QVAC proposal) -> confirm -> dispute -> resolve -> claim, each mirrored to the room
const ctx = { escrow: ESCROW, abi, room, potId };
const submitTx = await gd.submitResolution(account, { ...ctx, proposal });
console.log("submitResolutionHash:", submitTx.hash);
const confirmTx = await gd.confirm(account, { ...ctx, resultHash: proposal.resultHash, role: "organizer" });
console.log("confirmResolution:", confirmTx.hash);

const provider = new ethers.JsonRpcProvider(SEPOLIA.rpc, SEPOLIA.chainId, { staticNetwork: true });
console.log("dispute window deadline (unix):", await gd.disputeDeadline(provider, ESCROW, abi, potId));

const disputeTx = await gd.dispute(account, { ...ctx, reason: "double-check the frame" });
console.log("openDispute:", disputeTx.hash);
const resolveTx = await gd.resolveDispute(account, { ...ctx, approvePayout: true });
console.log("resolveDispute(approve):", resolveTx.hash);
const claimTx = await gd.claimAndReceipt(account, { ...ctx, recipient: address, finalAmount: 1_000_000 });
console.log("claim:", claimTx.hash);

// 3) verify: on-chain state + room mirror
const escrow = new ethers.Contract(ESCROW, abi, provider);
const state = Number(await escrow.potStateOf(potId));
const potRoom = await room.getPot(potId);
const proposalsRoom = await room.listProposals(potId);
const receiptRoom = await room.getReceipt(potId, claimTx.hash);
await room.close();
fs.rmSync(roomDir, { recursive: true, force: true });

console.log("\nSTEP5_6_RESULT:", JSON.stringify({
  potId,
  onchain_state: state, // 7 = Settled
  room: { confirmedResultHash: potRoom?.confirmedResultHash, disputeOpen: potRoom?.disputeOpen, proposals: proposalsRoom.length, receiptTx: receiptRoom?.txHash },
  txs: { create: createRes.hash, deposit: depRes.hash, submit: submitTx.hash, confirm: confirmTx.hash, dispute: disputeTx.hash, resolve: resolveTx.hash, claim: claimTx.hash },
}, null, 2));
