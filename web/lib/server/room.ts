import "server-only";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { RoomPot, RoomProposal, RoomReceipt, RoomCup, RoomFixture } from "@/lib/roomTypes";

// This instance's own Pears room peer (the state layer — there is no shared DB). The room module
// lives in the sibling `room/` package and is loaded at RUNTIME so Next never bundles Autobase's
// native deps. One local store per instance, persisted under web/.whisl-data/room.

export interface WhislRoomApi {
  ready(): Promise<WhislRoomApi>;
  append(op: Record<string, unknown>): Promise<void>;
  update(): Promise<void>;
  getPot(potId: string): Promise<RoomPot | null>;
  listPots(): Promise<RoomPot[]>;
  listProposals(potId: string): Promise<RoomProposal[]>;
  getReceipt(potId: string, txHash: string): Promise<RoomReceipt | null>;
  listCups(): Promise<RoomCup[]>;
  getCup(cupId: string): Promise<RoomCup | null>;
  listFixtures(cupId: string): Promise<RoomFixture[]>;
  keyHex: string;
}

let roomPromise: Promise<WhislRoomApi> | null = null;

export function getRoom(): Promise<WhislRoomApi> {
  if (!roomPromise) {
    roomPromise = (async () => {
      const modUrl = pathToFileURL(path.resolve(process.cwd(), "..", "room", "src", "room.js")).href;
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ modUrl)) as {
        openRoom: (dir: string) => Promise<WhislRoomApi>;
      };
      const dir = path.resolve(process.cwd(), ".whisl-data", "room");
      fs.mkdirSync(dir, { recursive: true });
      return mod.openRoom(dir);
    })();
  }
  return roomPromise;
}
