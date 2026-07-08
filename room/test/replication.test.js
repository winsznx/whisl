import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Corestore from "corestore";
import { WhislRoom } from "../src/room.js";

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "whisl-room-"));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function waitFor(cond, { rooms = [], timeout = 20000 } = {}) {
  const start = Date.now();
  for (;;) {
    for (const r of rooms) await r.update();
    if (await cond()) return;
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await sleep(50);
  }
}

test("two peers: peer B is added as writer, writes a proposal, both peers converge", async (t) => {
  const dirA = tmpdir(), dirB = tmpdir();
  const roomA = new WhislRoom(new Corestore(dirA));
  await roomA.ready();
  const roomB = new WhislRoom(new Corestore(dirB), roomA.key);
  await roomB.ready();

  const s1 = roomA.replicate(true);
  const s2 = roomB.replicate(false);
  s1.pipe(s2).pipe(s1);
  s1.on("error", () => {});
  s2.on("error", () => {});

  t.after(async () => {
    s1.destroy();
    s2.destroy();
    try {
      await roomA.close();
      await roomB.close();
    } catch {}
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  });

  // A creates the pot and adds B as a writer
  const POT = "0xpotP2P";
  await roomA.append({ type: "pot", potId: POT, matchId: "m", condition: "Nigeria scores", createdBy: "0xA" });
  await roomA.addWriter(roomB.writerKeyHex);

  // B becomes writable once the addWriter op replicates + applies
  await waitFor(() => roomB.writable, { rooms: [roomA, roomB] });

  // both peers see the pot A created
  await waitFor(async () => (await roomB.getPot(POT)) !== null, { rooms: [roomA, roomB] });
  assert.equal((await roomB.getPot(POT)).condition, "Nigeria scores");

  // B (the referee device) writes a proposal
  await roomB.append({
    type: "proposal",
    potId: POT,
    creator: "0xB",
    eventNumber: 1,
    resultHash: "0xRESULT",
    evidenceHash: "0xEVID",
    parserDevice: "local",
  });

  // A sees B's proposal — convergence in both directions
  await waitFor(async () => (await roomA.listProposals(POT)).length === 1, { rooms: [roomA, roomB] });

  const fromA = await roomA.listProposals(POT);
  const fromB = await roomB.listProposals(POT);
  assert.equal(fromA.length, 1);
  assert.equal(fromB.length, 1);
  assert.equal(fromA[0].resultHash, "0xRESULT");
  assert.deepEqual(fromA[0], fromB[0]); // identical linearized state on both peers
});
