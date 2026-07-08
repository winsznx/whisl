// Day 0 item 5 — real deploy + approve->deposit->confirmResolution->claim on Ethereum Sepolia.
// Uses ethers (standard JSON-RPC) to avoid the tempo-forge block-deserialization bug.
// Signer derived from custos CUSTOS_WALLET_SEED (BIP39, path m/44'/60'/0'/0/0). Seed never printed.
import { ethers } from "ethers";
import fs from "node:fs";

const RPCS = ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org"];
const USDT = "0xd077a400968890eacc75cdc901f0356c943e4fdb";
const EXPECTED = "0x5C6C9e12D49e28670E00AD1C05f24243ad77Be13";

const env = fs.readFileSync("/Users/mac/custos/.env", "utf8");
const seedLine = env.split("\n").find((l) => l.startsWith("CUSTOS_WALLET_SEED="));
const seed = seedLine.slice("CUSTOS_WALLET_SEED=".length).trim().replace(/^["']|["']$/g, "");

let provider;
for (const url of RPCS) {
  try {
    const p = new ethers.JsonRpcProvider(url, 11155111, { staticNetwork: true });
    await p.getBlockNumber();
    provider = p;
    console.log("RPC:", url);
    break;
  } catch (e) {
    console.log("RPC failed, trying next:", url, "-", e.message);
  }
}
if (!provider) throw new Error("no RPC reachable");

const wallet = ethers.Wallet.fromPhrase(seed).connect(provider);
console.log("deployer:", wallet.address);
if (wallet.address.toLowerCase() !== EXPECTED.toLowerCase()) throw new Error("derived address != funded address");

const eth = await provider.getBalance(wallet.address);
console.log("ETH:", ethers.formatEther(eth));

const art = JSON.parse(fs.readFileSync("./out/WhislEscrow.sol/WhislEscrow.json", "utf8"));
const factory = new ethers.ContractFactory(art.abi, art.bytecode.object, wallet);

console.log("== deploy WhislEscrow ==");
const escrow = await factory.deploy();
await escrow.waitForDeployment();
const escrowAddr = await escrow.getAddress();
console.log("ESCROW:", escrowAddr);
console.log("  deploy tx:", escrow.deploymentTransaction().hash);

const matchId = ethers.id("NGA-vs-ARG-2026");
const condition = ethers.id("Nigeria scores");
const now = (await provider.getBlock("latest")).timestamp;
const FDL = now + 3600, RDL = now + 7200, WINDOW = 30, GRACE = 30, SWEEP = 1209600;
const MIN = 1_000_000n, MAX = 1_000_000_000n, AMT = 1_000_000n; // 1 USDT (6dp)

const hashes = { deploy: escrow.deploymentTransaction().hash };
async function step(name, txPromise) {
  const tx = await txPromise;
  const rc = await tx.wait();
  hashes[name] = tx.hash;
  console.log(`  ${name} tx:`, tx.hash, `(block ${rc.blockNumber})`);
  return rc;
}

const rc1 = await step("createPot",
  escrow.createPot(matchId, condition, USDT, wallet.address, wallet.address, MIN, MAX, FDL, RDL, WINDOW, GRACE, SWEEP));
let potId;
for (const log of rc1.logs) {
  try { const p = escrow.interface.parseLog(log); if (p && p.name === "PotCreated") potId = p.args.potId; } catch {}
}
console.log("  potId:", potId);

const usdt = new ethers.Contract(USDT, [
  "function approve(address,uint256)",
  "function balanceOf(address) view returns (uint256)",
], wallet);

const usdtBefore = await usdt.balanceOf(wallet.address);
await step("approve", usdt.approve(escrowAddr, AMT));
await step("deposit", escrow.deposit(potId, AMT));
await step("submitResolutionHash", escrow.submitResolutionHash(potId, ethers.id("Nigeria 1-0 min34"), ethers.id("sha256-frame")));
await step("confirmResolution", escrow.confirmResolution(potId));

console.log(`== waiting out ${WINDOW}s dispute window ==`);
await new Promise((r) => setTimeout(r, (WINDOW + 10) * 1000));

await step("claim", escrow.claim(potId));

const state = await escrow.potStateOf(potId);
const usdtAfter = await usdt.balanceOf(wallet.address);
console.log("== result ==");
console.log("pot state (7 = Settled):", state.toString());
console.log("USDT before/after (6dp):", usdtBefore.toString(), "/", usdtAfter.toString());
console.log("\nADDRESSES_AND_HASHES:", JSON.stringify({ escrow: escrowAddr, potId, chainId: 11155111, ...hashes }, null, 2));
