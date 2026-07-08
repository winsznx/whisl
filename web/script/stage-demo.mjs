// Pre-stage a demo pot so recording starts at the capture moment (no funding waits on camera).
// Creates + funds a pot to Ready with a short 15s dispute window, and writes its metadata into
// the local room the server reads. Run this BEFORE starting the server.
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { openRoom } from "../../room/src/room.js";

const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;
const USDT = "0xd077a400968890eacc75cdc901f0356c943e4fdb";
const dep = JSON.parse(fs.readFileSync(new URL("../lib/deployments.json", import.meta.url))).sepolia;
const ESCROW = dep.whislEscrow;
const abi = JSON.parse(fs.readFileSync(new URL("../../contracts/out/WhislEscrow.sol/WhislEscrow.json", import.meta.url))).abi;
const iface = new ethers.Interface(abi);

const env = fs.readFileSync("/Users/mac/custos/.env", "utf8");
const seed = env.split("\n").find((l) => l.startsWith("CUSTOS_WALLET_SEED=")).slice("CUSTOS_WALLET_SEED=".length).trim().replace(/^["']|["']$/g, "");

const manager = new WalletManagerEvm(seed, { provider: RPC, chainId: CHAIN_ID });
const account = await manager.getAccount(0);
const me = account.address;
console.log("wallet:", me);

async function waitReceipt(hash) {
  for (;;) {
    const rc = await account.getTransactionReceipt(hash);
    if (rc) return rc;
    await new Promise((r) => setTimeout(r, 3000));
  }
}
async function send(fn, args) {
  const res = await account.sendTransaction({ to: ESCROW, value: 0, data: iface.encodeFunctionData(fn, args), chainId: CHAIN_ID });
  await waitReceipt(res.hash);
  return res.hash;
}

const MATCH = "Nigeria vs Cameroon";
const CONDITION = "Nigeria scores";
const now = Math.floor(Date.now() / 1000);

console.log("creating pot…");
const createRes = await account.sendTransaction({
  to: ESCROW, value: 0, chainId: CHAIN_ID,
  data: iface.encodeFunctionData("createPot", [
    ethers.id(MATCH), ethers.id(CONDITION), USDT, me, me,
    1_000_000n, 1_000_000_000n, now + 3600, now + 7200, 15, 300, 1_209_600,
  ]),
});
const rc = await waitReceipt(createRes.hash);
let potId;
for (const log of rc.logs) { try { const p = iface.parseLog({ topics: [...log.topics], data: log.data }); if (p?.name === "PotCreated") potId = p.args.potId; } catch {} }
console.log("potId:", potId);

console.log("approving + depositing 5 USD-T to reach Ready…");
const ap = await account.approve({ token: USDT, spender: ESCROW, amount: 5_000_000n });
await waitReceipt(ap.hash);
await send("deposit", [potId, 5_000_000n]);

console.log("writing pot metadata into the room…");
const roomDir = path.resolve(process.cwd(), ".whisl-data", "room");
fs.mkdirSync(roomDir, { recursive: true });
const room = await openRoom(roomDir);
await room.append({ type: "pot", potId, matchId: MATCH, condition: CONDITION, payoutRecipient: me, createdBy: me });
await room.update();
await new Promise((r) => setTimeout(r, 500));

console.log("\nDEMO_POT_READY");
console.log("URL: http://localhost:3939/dashboard/pots/" + potId);
process.exit(0);
