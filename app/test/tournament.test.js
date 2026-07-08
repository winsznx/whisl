import test from "node:test";
import assert from "node:assert/strict";
import { createCup, registerTeam, addFixture, recordResult, standings } from "../src/tournament.js";

function groupD() {
  const cup = createCup("World Cup — Group D");
  for (const t of ["Nigeria", "Argentina", "Croatia"]) registerTeam(cup, t);
  return cup;
}

test("standings: wins, draws, goal difference, ordering", () => {
  const cup = groupD();
  const f1 = addFixture(cup, "Nigeria", "Argentina", { potId: "0xpotA" });
  const f2 = addFixture(cup, "Argentina", "Croatia");
  const f3 = addFixture(cup, "Nigeria", "Croatia");
  recordResult(cup, f1.id, { homeScore: 1, awayScore: 0 }); // Nigeria win
  recordResult(cup, f2.id, { homeScore: 2, awayScore: 2 }); // draw
  recordResult(cup, f3.id, { homeScore: 3, awayScore: 1 }); // Nigeria win

  const table = standings(cup);
  assert.equal(table[0].team, "Nigeria");
  assert.equal(table[0].Pts, 6);
  assert.equal(table[0].GD, 3);
  assert.equal(table[1].team, "Argentina"); // 1 pt, GD -1
  assert.equal(table[1].Pts, 1);
  assert.equal(table[2].team, "Croatia"); // 1 pt, GD -2
  assert.equal(table[2].Pts, 1);
});

test("a fixture binds to a GoalDrop pot", () => {
  const cup = groupD();
  const f = addFixture(cup, "Nigeria", "Argentina");
  recordResult(cup, f.id, { homeScore: 1, awayScore: 0, potId: "0xsettledPot" });
  assert.equal(cup.fixtures[0].potId, "0xsettledPot");
});

test("results are immutable once recorded", () => {
  const cup = groupD();
  const f = addFixture(cup, "Nigeria", "Argentina");
  recordResult(cup, f.id, { homeScore: 1, awayScore: 0 });
  assert.throws(() => recordResult(cup, f.id, { homeScore: 9, awayScore: 0 }), /already recorded/);
});

test("guards: unknown teams, self-play, duplicate registration", () => {
  const cup = groupD();
  assert.throws(() => addFixture(cup, "Nigeria", "Brazil"), /registered/);
  assert.throws(() => addFixture(cup, "Nigeria", "Nigeria"), /itself/);
  assert.throws(() => registerTeam(cup, "Nigeria"), /already registered/);
});
