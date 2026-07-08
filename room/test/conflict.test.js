import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Corestore from "corestore";
import { WhislRoom } from "../src/room.js";

async function freshRoom(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "whisl-room-"));
  const room = new WhislRoom(new Corestore(dir));
  await room.ready();
  t.after(async () => {
    try {
      await room.close();
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return room;
}
async function apply(room, op) {
  await room.append(op);
  await room.update();
}

const POT = "0xpot1";
const potOp = { type: "pot", potId: POT, matchId: "m1", condition: "Nigeria scores", createdBy: "0xorg" };

test("unique potId — duplicate pot op is ignored", async (t) => {
  const room = await freshRoom(t);
  await apply(room, potOp);
  await apply(room, { ...potOp, condition: "TAMPERED" });
  const pot = await room.getPot(POT);
  assert.equal(pot.condition, "Nigeria scores");
});

test("monotonic eventNumber per creator — non-increasing proposals dropped", async (t) => {
  const room = await freshRoom(t);
  await apply(room, potOp);
  const base = { type: "proposal", potId: POT, creator: "0xref", resultHash: "0xR", evidenceHash: "0xE" };
  await apply(room, { ...base, eventNumber: 1 }); // accept
  await apply(room, { ...base, eventNumber: 1, resultHash: "0xDUP" }); // reject: not > 1
  await apply(room, { ...base, eventNumber: 2 }); // accept
  const proposals = await room.listProposals(POT);
  assert.equal(proposals.length, 2);
  assert.deepEqual(proposals.map((p) => p.eventNumber), [1, 2]);
});

test("every result carries a resultHash — proposal without one is dropped", async (t) => {
  const room = await freshRoom(t);
  await apply(room, potOp);
  await apply(room, { type: "proposal", potId: POT, creator: "0xref", eventNumber: 1 }); // no resultHash
  assert.equal((await room.listProposals(POT)).length, 0);
});

test("dedup confirmations by signer — second confirmation from same signer ignored", async (t) => {
  const room = await freshRoom(t);
  await apply(room, potOp);
  await apply(room, { type: "confirmation", potId: POT, signer: "0xref", role: "referee", decision: "confirm", resultHash: "0xR" });
  await apply(room, { type: "confirmation", potId: POT, signer: "0xref", role: "referee", decision: "reject", resultHash: "0xR" });
  const conf = await room.getConfirmation(POT, "0xref");
  assert.equal(conf.decision, "confirm");
});

test("confirmed result is immutable — later conflicting proposal ignored", async (t) => {
  const room = await freshRoom(t);
  await apply(room, potOp);
  await apply(room, { type: "proposal", potId: POT, creator: "0xref", eventNumber: 1, resultHash: "0xA", evidenceHash: "0xE" });
  await apply(room, { type: "confirmation", potId: POT, signer: "0xref", role: "referee", decision: "confirm", resultHash: "0xA" });
  assert.equal((await room.getPot(POT)).confirmedResultHash, "0xA");
  await apply(room, { type: "proposal", potId: POT, creator: "0xref", eventNumber: 2, resultHash: "0xB", evidenceHash: "0xE" });
  const proposals = await room.listProposals(POT);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].resultHash, "0xA");
});

test("open dispute freezes settlement — pot flagged disputeOpen", async (t) => {
  const room = await freshRoom(t);
  await apply(room, potOp);
  assert.equal((await room.getPot(POT)).disputeOpen, false);
  await apply(room, { type: "dispute", potId: POT, raisedBy: "0xalice", reason: "wrong frame" });
  assert.equal((await room.getPot(POT)).disputeOpen, true);
});

test("dedup receipts by txHash — duplicate receipt ignored", async (t) => {
  const room = await freshRoom(t);
  await apply(room, potOp);
  await apply(room, { type: "receipt", potId: POT, txHash: "0xTX", chain: "sepolia", finalAmount: "1000000", recipient: "0xr" });
  await apply(room, { type: "receipt", potId: POT, txHash: "0xTX", chain: "sepolia", finalAmount: "999", recipient: "0xEVIL" });
  const r = await room.getReceipt(POT, "0xTX");
  assert.equal(r.finalAmount, "1000000");
});

test("proposal for an unknown pot is dropped", async (t) => {
  const room = await freshRoom(t);
  await apply(room, { type: "proposal", potId: "0xghost", creator: "0xref", eventNumber: 1, resultHash: "0xR" });
  assert.equal((await room.listProposals("0xghost")).length, 0);
});
