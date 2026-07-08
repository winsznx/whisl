import { ethers } from "ethers";
import { waitReceipt, SEPOLIA } from "./wdk.js";

// GoalDrop orchestration: every state change is BOTH a WDK-signed escrow transaction (the money
// truth) AND a Pears room op (the shared-state mirror). The escrow's on-chain timers are
// authoritative; the room mirrors them for display and cross-peer visibility.

function iface(abi) {
  return new ethers.Interface(abi);
}

async function sendCall(account, { escrow, abi, fn, args, chainId = SEPOLIA.chainId }) {
  const data = iface(abi).encodeFunctionData(fn, args);
  const res = await account.sendTransaction({ to: escrow, value: 0, data, chainId });
  const rc = await waitReceipt(account, res.hash);
  return { hash: res.hash, status: Number(rc.status), logs: rc.logs };
}

/** Submit the QVAC/manual proposal on-chain and mirror it into the room. */
export async function submitResolution(account, { escrow, abi, room, potId, proposal }) {
  const tx = await sendCall(account, { escrow, abi, fn: "submitResolutionHash", args: [potId, proposal.resultHash, "0x" + proposal.evidenceHash] });
  await room.append({
    type: "proposal",
    potId,
    creator: account.address,
    eventNumber: proposal.eventNumber ?? 1,
    evidenceType: proposal.evidenceType,
    evidenceHash: proposal.evidenceHash,
    model: proposal.model ?? null,
    parserDevice: proposal.parserDevice,
    parsedResult: proposal.parsedResult,
    resultHash: proposal.resultHash,
  });
  return tx;
}

/** Required-confirmer signs off: on-chain confirmResolution + room confirmation op. */
export async function confirm(account, { escrow, abi, room, potId, resultHash, role = "organizer" }) {
  const tx = await sendCall(account, { escrow, abi, fn: "confirmResolution", args: [potId] });
  await room.append({ type: "confirmation", potId, signer: account.address, role, decision: "confirm", resultHash });
  return tx;
}

/** Any depositor flags a dispute within the window: on-chain openDispute + room dispute op. */
export async function dispute(account, { escrow, abi, room, potId, reason }) {
  const tx = await sendCall(account, { escrow, abi, fn: "openDispute", args: [potId] });
  await room.append({ type: "dispute", potId, raisedBy: account.address, reason: reason ?? "" });
  return tx;
}

/** Required-confirmer resolves the dispute: on-chain resolveDispute + room op. */
export async function resolveDispute(account, { escrow, abi, room, potId, approvePayout }) {
  const tx = await sendCall(account, { escrow, abi, fn: "resolveDispute", args: [potId, approvePayout] });
  await room.append({ type: "confirmation", potId, signer: account.address, role: "organizer", decision: approvePayout ? "confirm" : "reject", resultHash: approvePayout ? "resolved" : null });
  return tx;
}

/** Claim settlement + write the receipt hash back to the room (Step 6). */
export async function claimAndReceipt(account, { escrow, abi, room, potId, recipient, finalAmount }) {
  const tx = await sendCall(account, { escrow, abi, fn: "claim", args: [potId] });
  await room.append({ type: "receipt", potId, txHash: tx.hash, chain: "sepolia", finalAmount: String(finalAmount ?? ""), recipient });
  return tx;
}

/** Read the on-chain dispute window deadline for a confirmed pot (surfaced to the room timer). */
export async function disputeDeadline(provider, escrow, abi, potId) {
  const c = new ethers.Contract(escrow, abi, provider);
  const p = await c.getPot(potId);
  const confirmedAt = Number(p.confirmedAt);
  if (!confirmedAt) return null;
  return confirmedAt + Number(p.disputeWindowSeconds);
}
