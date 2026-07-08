import test from "node:test";
import assert from "node:assert/strict";
import { computeStandings } from "../lib/standings.ts";
import { usdt, shortHash, STATE_LABEL, PotState } from "../lib/pot.ts";
import type { RoomFixture } from "../lib/roomTypes.ts";

function fx(home: string, away: string, hs: number | null, as: number | null): RoomFixture {
  return { fixtureId: `${home}-${away}`, home, away, potId: null, result: hs === null ? null : { homeScore: hs, awayScore: as! } };
}

test("standings: points, goal difference, ordering", () => {
  const teams = ["Nigeria", "Argentina", "Croatia"];
  const table = computeStandings(teams, [
    fx("Nigeria", "Argentina", 1, 0),
    fx("Argentina", "Croatia", 2, 2),
    fx("Nigeria", "Croatia", 3, 1),
  ]);
  assert.equal(table[0].team, "Nigeria");
  assert.equal(table[0].Pts, 6);
  assert.equal(table[0].GD, 3);
  assert.equal(table[1].team, "Argentina"); // 1 pt, GD -1
  assert.equal(table[2].team, "Croatia"); // 1 pt, GD -2
});

test("standings ignores unplayed fixtures", () => {
  const table = computeStandings(["A", "B"], [fx("A", "B", null, null)]);
  assert.equal(table[0].P, 0);
  assert.equal(table[0].Pts, 0);
});

test("usdt formats 6-decimal base units", () => {
  assert.equal(usdt(1_000_000n), "1");
  assert.equal(usdt(1_500_000n), "1.5");
  assert.equal(usdt(42_000_000n), "42");
  assert.equal(usdt(0n), "0");
});

test("state labels match the escrow state model", () => {
  assert.equal(STATE_LABEL[PotState.Settled], "Settled");
  assert.equal(STATE_LABEL[PotState.Funding], "Funding open");
  assert.equal(STATE_LABEL[PotState.ResolutionFinal], "Ready to claim");
});

test("shortHash truncates", () => {
  const h = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  assert.match(shortHash(h), /^0x123456…cdef$/);
});
