import Autobase from "autobase";
import Hyperbee from "hyperbee";
import Corestore from "corestore";
import b4a from "b4a";

/** Convenience factory: open a WhislRoom backed by a Corestore at `storageDir`. */
export async function openRoom(storageDir, bootstrap = null, opts = {}) {
  const room = new WhislRoom(new Corestore(storageDir), bootstrap, opts);
  await room.ready();
  return room;
}

// High byte-order sentinel so range reads over a "prefix/" cover all ascii/hex children.
const HI = "\xff";

/**
 * WhislRoom — an Autobase-backed shared log for one P2P match room.
 *
 * The linearized view is a Hyperbee. `apply()` is the single place the PRD section 6.2
 * conflict rules are enforced; an op that violates a rule is dropped (never written to the
 * view), so every peer that replays the same writer inputs converges on the same state.
 *
 * Rules enforced (PRD 6.2):
 *  - every pot has a unique potId                       (dup `pot` ops ignored)
 *  - every proposal has a monotonic eventNumber/creator (non-increasing ignored)
 *  - every submitted result carries a resultHash        (missing => ignored)
 *  - duplicate deposits/receipts dedup by txHash        (dup ignored)
 *  - duplicate confirmations dedup by signer            (dup ignored)
 *  - a confirmed result is immutable                    (first confirm wins; later proposals ignored)
 *  - an open dispute freezes settlement                 (pot.disputeOpen flag)
 */
export class WhislRoom {
  constructor(store, bootstrap = null, { onUpdate } = {}) {
    this.store = store;
    this.onUpdate = onUpdate;
    this.base = new Autobase(store, bootstrap, {
      valueEncoding: "json",
      open: (s) => new Hyperbee(s.get("whisl-room"), { keyEncoding: "utf-8", valueEncoding: "json" }),
      apply: this.#apply.bind(this),
    });
  }

  async ready() {
    await this.base.ready();
    return this;
  }

  get key() {
    return this.base.key;
  }
  get keyHex() {
    return b4a.toString(this.base.key, "hex");
  }
  get writerKeyHex() {
    return b4a.toString(this.base.local.key, "hex");
  }
  get writable() {
    return this.base.writable;
  }
  get view() {
    return this.base.view;
  }

  async #apply(nodes, view, host) {
    for (const node of nodes) {
      const op = node.value;
      if (!op || typeof op !== "object") continue;
      if (op.type === "addWriter") {
        await host.addWriter(b4a.from(op.key, "hex"), { indexer: true });
        continue;
      }
      await this.#applyOp(op, view);
    }
    if (this.onUpdate) this.onUpdate();
  }

  async #applyOp(op, view) {
    const potKey = op.potId ? `pot/${op.potId}` : null;
    const getPot = async () => (await view.get(potKey))?.value;

    switch (op.type) {
      case "join":
        await view.put(`roster/${op.address}`, {
          address: op.address,
          deviceId: op.deviceId ?? null,
          role: op.role ?? "participant",
        });
        return;

      case "pot": {
        if (await view.get(potKey)) return; // unique potId
        await view.put(potKey, {
          potId: op.potId,
          matchId: op.matchId ?? null,
          condition: op.condition ?? null,
          payoutRecipient: op.payoutRecipient ?? null,
          createdBy: op.createdBy ?? null,
          confirmedResultHash: null,
          disputeOpen: false,
        });
        return;
      }

      case "proposal": {
        const pot = await getPot();
        if (!pot) return; // proposal for an unknown pot
        if (pot.confirmedResultHash) return; // confirmed result is immutable
        if (!op.resultHash) return; // every result carries a resultHash
        const maxKey = `pot/${op.potId}/maxEvent/${op.creator}`;
        const prev = (await view.get(maxKey))?.value?.n ?? 0;
        if (!(op.eventNumber > prev)) return; // monotonic per creator device
        await view.put(maxKey, { n: op.eventNumber });
        await view.put(`pot/${op.potId}/proposal/${op.creator}/${pad(op.eventNumber)}`, op);
        return;
      }

      case "confirmation": {
        const pot = await getPot();
        if (!pot) return;
        const cKey = `pot/${op.potId}/confirm/${op.signer}`;
        if (await view.get(cKey)) return; // dedup by signer
        await view.put(cKey, op);
        if (op.decision === "confirm" && op.resultHash && !pot.confirmedResultHash) {
          pot.confirmedResultHash = op.resultHash; // first confirm wins, then immutable
          await view.put(potKey, pot);
        }
        return;
      }

      case "dispute": {
        const pot = await getPot();
        if (!pot) return;
        await view.put(`pot/${op.potId}/dispute/${op.raisedBy}`, op);
        pot.disputeOpen = true; // freezes settlement
        await view.put(potKey, pot);
        return;
      }

      case "receipt": {
        const pot = await getPot();
        if (!pot) return;
        const rKey = `pot/${op.potId}/receipt/${op.txHash}`;
        if (await view.get(rKey)) return; // dedup by txHash
        await view.put(rKey, op);
        return;
      }

      // --- tournament substrate (PRD §8.9), synced in the same P2P log ---
      case "cup": {
        const k = `cup/${op.cupId}`;
        if (await view.get(k)) return; // unique cupId
        await view.put(k, { cupId: op.cupId, name: op.name ?? null, createdBy: op.createdBy ?? null, teams: [] });
        return;
      }
      case "team": {
        const k = `cup/${op.cupId}`;
        const cup = (await view.get(k))?.value;
        if (!cup) return;
        if (cup.teams.includes(op.team)) return; // dedup team
        cup.teams.push(op.team);
        await view.put(k, cup);
        return;
      }
      case "fixture": {
        const cup = (await view.get(`cup/${op.cupId}`))?.value;
        if (!cup || !cup.teams.includes(op.home) || !cup.teams.includes(op.away) || op.home === op.away) return;
        await view.put(`cup/${op.cupId}/fixture/${op.fixtureId}`, {
          fixtureId: op.fixtureId, home: op.home, away: op.away, potId: op.potId ?? null, result: null,
        });
        return;
      }
      case "result": {
        const fk = `cup/${op.cupId}/fixture/${op.fixtureId}`;
        const fx = (await view.get(fk))?.value;
        if (!fx || fx.result) return; // immutable once recorded
        fx.result = { homeScore: op.homeScore, awayScore: op.awayScore };
        if (op.potId) fx.potId = op.potId;
        await view.put(fk, fx);
        return;
      }
    }
  }

  // --- writes ---
  append(op) {
    return this.base.append(op);
  }
  addWriter(writerKeyHex) {
    return this.base.append({ type: "addWriter", key: writerKeyHex });
  }
  async update() {
    if (typeof this.base.update === "function") await this.base.update();
  }

  // --- reads (materialized view) ---
  async getPot(potId) {
    return (await this.base.view.get(`pot/${potId}`))?.value ?? null;
  }
  async getRoster() {
    return this.#collect("roster/");
  }
  async listPots() {
    const out = [];
    for await (const { key, value } of this.base.view.createReadStream({ gte: "pot/", lt: "pot/" + HI })) {
      if (/^pot\/0x[0-9a-fA-F]{64}$/.test(key)) out.push(value);
    }
    return out;
  }
  async listCups() {
    const out = [];
    for await (const { key, value } of this.base.view.createReadStream({ gte: "cup/", lt: "cup/" + HI })) {
      if (/^cup\/[^/]+$/.test(key)) out.push(value);
    }
    return out;
  }
  async getCup(cupId) {
    return (await this.base.view.get(`cup/${cupId}`))?.value ?? null;
  }
  async listFixtures(cupId) {
    return this.#collect(`cup/${cupId}/fixture/`);
  }
  async listProposals(potId) {
    return this.#collect(`pot/${potId}/proposal/`);
  }
  async getConfirmation(potId, signer) {
    return (await this.base.view.get(`pot/${potId}/confirm/${signer}`))?.value ?? null;
  }
  async getReceipt(potId, txHash) {
    return (await this.base.view.get(`pot/${potId}/receipt/${txHash}`))?.value ?? null;
  }

  async #collect(prefix) {
    const out = [];
    for await (const { value } of this.base.view.createReadStream({ gte: prefix, lt: prefix + HI })) {
      out.push(value);
    }
    return out;
  }

  // --- p2p ---
  replicate(isInitiatorOrStream) {
    return this.store.replicate(isInitiatorOrStream);
  }
  async whenWritable(timeoutMs = 15000) {
    const start = Date.now();
    while (!this.base.writable) {
      if (Date.now() - start > timeoutMs) throw new Error("timed out waiting to become writable");
      await this.update();
      await sleep(50);
    }
  }
  close() {
    return this.base.close();
  }
}

function pad(n) {
  return String(n).padStart(12, "0"); // lexicographic ordering of eventNumber
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
