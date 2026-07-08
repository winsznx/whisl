"use server";

import { ethers } from "ethers";
import { revalidatePath } from "next/cache";
import { getRoom } from "@/lib/server/room";
import { parseCapturedFrame, type ParseResult } from "@/lib/server/qvac";
import * as wdk from "@/lib/server/wdk";
import { ADDR_ZERO } from "@/lib/pot";

function toBaseUnits(usdt: string): bigint {
  const n = Number(usdt);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a positive amount");
  return BigInt(Math.round(n * 1_000_000));
}

export type CreatePotInput = {
  match: string;
  condition: string;
  requiredConfirmer: string;
  payoutRecipient: string; // "" => split pro-rata
  minUsdt: string;
  maxUsdt: string;
  fundingMinutes: string;
  resolutionMinutes: string;
  disputeWindowSeconds: string;
  disputeGraceSeconds: string;
  sweepDays: string;
};

export async function createPotAction(input: CreatePotInput): Promise<{ potId: string; txHash: string }> {
  const me = await wdk.walletAddress();
  const now = Math.floor(Date.now() / 1000);
  const confirmer = ethers.isAddress(input.requiredConfirmer) ? input.requiredConfirmer : me;
  const recipient = input.payoutRecipient && ethers.isAddress(input.payoutRecipient) ? input.payoutRecipient : ADDR_ZERO;

  const { potId, txHash } = await wdk.createPotAndId({
    matchId: ethers.id(input.match || "match"),
    conditionHash: ethers.id(input.condition),
    requiredConfirmer: confirmer,
    payoutRecipient: recipient,
    minTotalDeposit: toBaseUnits(input.minUsdt),
    maxTotalDeposit: toBaseUnits(input.maxUsdt),
    fundingDeadline: now + Math.max(1, Number(input.fundingMinutes)) * 60,
    resolutionDeadline: now + Math.max(2, Number(input.resolutionMinutes)) * 60,
    disputeWindowSeconds: Math.max(1, Number(input.disputeWindowSeconds)),
    disputeGraceSeconds: Math.max(1, Number(input.disputeGraceSeconds)),
    unclaimedSweepSeconds: Math.max(1, Number(input.sweepDays)) * 86400,
  });

  const room = await getRoom();
  await room.append({
    type: "pot",
    potId,
    matchId: input.match,
    condition: input.condition,
    payoutRecipient: recipient === ADDR_ZERO ? null : recipient,
    createdBy: me,
  });
  revalidatePath("/dashboard");
  return { potId, txHash };
}

export async function fundPotAction(potId: string, amountUsdt: string): Promise<{ approveTx: string; depositTx: string }> {
  const amount = toBaseUnits(amountUsdt);
  const approveTx = await wdk.approveTx(amount);
  await wdk.waitReceipt(approveTx);
  const depositTx = await wdk.depositTx(potId, amount);
  await wdk.waitReceipt(depositTx);
  revalidatePath(`/dashboard/pots/${potId}`);
  return { approveTx, depositTx };
}

export async function captureAction(potId: string, dataUrl: string, condition: string): Promise<ParseResult> {
  return parseCapturedFrame(dataUrl, condition);
}

export async function submitResolutionAction(
  potId: string,
  proposal: { parsedResult: Record<string, unknown> | null; evidenceHash: string; parserDevice: string; model: string | null },
): Promise<{ txHash: string; resultHash: string }> {
  const resultHash = ethers.id(JSON.stringify(proposal.parsedResult ?? {}));
  const evidenceHash = proposal.evidenceHash.startsWith("0x") ? proposal.evidenceHash : `0x${proposal.evidenceHash}`;
  const txHash = await wdk.submitResolutionTx(potId, resultHash, evidenceHash);
  const me = await wdk.walletAddress();
  const room = await getRoom();
  await room.append({
    type: "proposal",
    potId,
    creator: me,
    eventNumber: 1,
    evidenceType: "image",
    evidenceHash: proposal.evidenceHash,
    model: proposal.model,
    parserDevice: proposal.parserDevice,
    parsedResult: proposal.parsedResult,
    resultHash,
  });
  revalidatePath(`/dashboard/pots/${potId}`);
  return { txHash, resultHash };
}

export async function confirmAction(potId: string, resultHash: string): Promise<{ txHash: string }> {
  const txHash = await wdk.confirmTx(potId);
  const me = await wdk.walletAddress();
  const room = await getRoom();
  await room.append({ type: "confirmation", potId, signer: me, role: "organizer", decision: "confirm", resultHash });
  revalidatePath(`/dashboard/pots/${potId}`);
  return { txHash };
}

export async function disputeAction(potId: string, reason: string): Promise<{ txHash: string }> {
  const txHash = await wdk.openDisputeTx(potId);
  const me = await wdk.walletAddress();
  const room = await getRoom();
  await room.append({ type: "dispute", potId, raisedBy: me, reason });
  revalidatePath(`/dashboard/pots/${potId}`);
  return { txHash };
}

export async function resolveAction(potId: string, approvePayout: boolean): Promise<{ txHash: string }> {
  const txHash = await wdk.resolveDisputeTx(potId, approvePayout);
  revalidatePath(`/dashboard/pots/${potId}`);
  return { txHash };
}

export async function claimAction(potId: string): Promise<{ txHash: string }> {
  const txHash = await wdk.claimTx(potId);
  const me = await wdk.walletAddress();
  const room = await getRoom();
  await room.append({ type: "receipt", potId, txHash, chain: "sepolia", finalAmount: "", recipient: me });
  revalidatePath(`/dashboard/pots/${potId}`);
  revalidatePath(`/receipt/${potId}`);
  return { txHash };
}

// --- tournament (Pears-synced) ---
export async function createCupAction(name: string): Promise<{ cupId: string }> {
  const me = await wdk.walletAddress().catch(() => "local");
  const cupId = ethers.id(`${name}:${Date.now()}`).slice(2, 14);
  const room = await getRoom();
  await room.append({ type: "cup", cupId, name, createdBy: me });
  revalidatePath("/dashboard/tournaments");
  return { cupId };
}

export async function registerTeamAction(cupId: string, team: string): Promise<void> {
  const room = await getRoom();
  await room.append({ type: "team", cupId, team });
  revalidatePath(`/dashboard/tournaments/${cupId}`);
}

export async function addFixtureAction(cupId: string, home: string, away: string, potId?: string): Promise<void> {
  const room = await getRoom();
  const fixtureId = ethers.id(`${home}:${away}:${Date.now()}`).slice(2, 14);
  await room.append({ type: "fixture", cupId, fixtureId, home, away, potId: potId ?? null });
  revalidatePath(`/dashboard/tournaments/${cupId}/fixtures`);
}

export async function recordResultAction(
  cupId: string,
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  potId?: string,
): Promise<void> {
  const room = await getRoom();
  await room.append({ type: "result", cupId, fixtureId, homeScore, awayScore, potId: potId ?? null });
  revalidatePath(`/dashboard/tournaments/${cupId}/standings`);
  revalidatePath(`/dashboard/tournaments/${cupId}/fixtures`);
}
