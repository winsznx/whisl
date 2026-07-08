import "server-only";
import WalletManagerEvm, { type WalletAccountEvm } from "@tetherto/wdk-wallet-evm";
import { ethers } from "ethers";
import { whislEscrowAbi } from "@/lib/whislEscrowAbi";
import { ESCROW, USDT, RPC, CHAIN_ID } from "@/lib/chain";

// This participant's own local WDK wallet. One instance per participant (local-first): the seed
// lives on this machine only, in WHISL_WALLET_SEED, and never reaches the browser. There is no
// shared server wallet — the app is the UI on top of your own node.
const SEED = process.env.WHISL_WALLET_SEED;
const escrowIface = new ethers.Interface(whislEscrowAbi);

let cached: { account: WalletAccountEvm; address: string } | null = null;

export function walletConfigured(): boolean {
  return typeof SEED === "string" && SEED.trim().length > 0;
}

export async function getWallet(): Promise<{ account: WalletAccountEvm; address: string }> {
  if (!SEED) throw new Error("This instance has no wallet. Set WHISL_WALLET_SEED to your own BIP39 seed.");
  if (cached) return cached;
  const manager = new WalletManagerEvm(SEED, { provider: RPC, chainId: CHAIN_ID });
  const account = await manager.getAccount(0);
  cached = { account, address: account.address };
  return cached;
}

async function sendEscrow(fn: string, args: readonly unknown[]): Promise<string> {
  const { account } = await getWallet();
  const data = escrowIface.encodeFunctionData(fn, args as unknown[]) as `0x${string}`;
  const res = await account.sendTransaction({ to: ESCROW, value: 0, data, chainId: CHAIN_ID });
  return res.hash;
}

export async function walletAddress(): Promise<string> {
  return (await getWallet()).address;
}

export async function createPotTx(args: {
  matchId: string;
  conditionHash: string;
  requiredConfirmer: string;
  payoutRecipient: string;
  minTotalDeposit: bigint;
  maxTotalDeposit: bigint;
  fundingDeadline: number;
  resolutionDeadline: number;
  disputeWindowSeconds: number;
  disputeGraceSeconds: number;
  unclaimedSweepSeconds: number;
}): Promise<string> {
  return sendEscrow("createPot", [
    args.matchId,
    args.conditionHash,
    USDT,
    args.requiredConfirmer,
    args.payoutRecipient,
    args.minTotalDeposit,
    args.maxTotalDeposit,
    args.fundingDeadline,
    args.resolutionDeadline,
    args.disputeWindowSeconds,
    args.disputeGraceSeconds,
    args.unclaimedSweepSeconds,
  ]);
}

// approve then deposit — two separate signed steps (never a hidden approve).
export async function approveTx(amount: bigint): Promise<string> {
  const { account } = await getWallet();
  const res = await account.approve({ token: USDT, spender: ESCROW, amount });
  return res.hash;
}
export async function depositTx(potId: string, amount: bigint): Promise<string> {
  return sendEscrow("deposit", [potId, amount]);
}
export async function submitResolutionTx(potId: string, resultHash: string, evidenceHash: string): Promise<string> {
  return sendEscrow("submitResolutionHash", [potId, resultHash, evidenceHash]);
}
export async function confirmTx(potId: string): Promise<string> {
  return sendEscrow("confirmResolution", [potId]);
}
export async function openDisputeTx(potId: string): Promise<string> {
  return sendEscrow("openDispute", [potId]);
}
export async function resolveDisputeTx(potId: string, approvePayout: boolean): Promise<string> {
  return sendEscrow("resolveDispute", [potId, approvePayout]);
}
export async function claimTx(potId: string): Promise<string> {
  return sendEscrow("claim", [potId]);
}
export async function refundTx(potId: string): Promise<string> {
  return sendEscrow("refund", [potId]);
}

type MinimalReceipt = { status: number | null; logs: readonly { topics: readonly string[]; data: string }[] };

async function waitReceiptObj(hash: string): Promise<MinimalReceipt> {
  const { account } = await getWallet();
  const start = Date.now();
  for (;;) {
    const rc = (await account.getTransactionReceipt(hash)) as MinimalReceipt | null;
    if (rc) return rc;
    if (Date.now() - start > 150000) throw new Error(`receipt timeout ${hash}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export async function waitReceipt(hash: string): Promise<number> {
  const rc = await waitReceiptObj(hash);
  return Number(rc.status);
}

// createPot then resolve the new potId from the PotCreated event in the mined receipt.
export async function createPotAndId(args: Parameters<typeof createPotTx>[0]): Promise<{ potId: string; txHash: string }> {
  const txHash = await createPotTx(args);
  const rc = await waitReceiptObj(txHash);
  for (const log of rc.logs) {
    try {
      const parsed = escrowIface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "PotCreated") return { potId: parsed.args.potId as string, txHash };
    } catch {
      // not our event
    }
  }
  throw new Error("PotCreated event not found in receipt");
}
