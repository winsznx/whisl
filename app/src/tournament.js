// Tournament substrate wrapping the GoalDrop pot mechanic (PRD §8.9). A fixture can bind to a
// pot (potId); the pot's referee-confirmed settlement supplies the result that feeds standings.
// This is the layer that makes Whisl durable past a single watch party, without being the pitch.

export function createCup(name, { pointsWin = 3, pointsDraw = 1 } = {}) {
  return { name, pointsWin, pointsDraw, teams: [], fixtures: [], _fx: 0 };
}

export function registerTeam(cup, team) {
  if (cup.teams.includes(team)) throw new Error(`team already registered: ${team}`);
  cup.teams.push(team);
  return cup;
}

export function addFixture(cup, home, away, { potId = null } = {}) {
  if (!cup.teams.includes(home) || !cup.teams.includes(away)) throw new Error("both teams must be registered");
  if (home === away) throw new Error("a team cannot play itself");
  const fixture = { id: `fx${++cup._fx}`, home, away, potId, result: null };
  cup.fixtures.push(fixture);
  return fixture;
}

/** Record a fixture result (immutable once set, like a confirmed pot). */
export function recordResult(cup, fixtureId, { homeScore, awayScore, potId = null }) {
  const fx = cup.fixtures.find((f) => f.id === fixtureId);
  if (!fx) throw new Error("no such fixture");
  if (fx.result) throw new Error("result already recorded");
  fx.result = { homeScore, awayScore };
  if (potId) fx.potId = potId;
  return fx;
}

/** League table, sorted by points, then goal difference, then goals for, then name. */
export function standings(cup) {
  const t = {};
  for (const team of cup.teams) t[team] = { team, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
  for (const fx of cup.fixtures) {
    if (!fx.result) continue;
    const { homeScore: hs, awayScore: as } = fx.result;
    const h = t[fx.home], a = t[fx.away];
    h.P++; a.P++; h.GF += hs; h.GA += as; a.GF += as; a.GA += hs;
    if (hs > as) { h.W++; a.L++; h.Pts += cup.pointsWin; }
    else if (hs < as) { a.W++; h.L++; a.Pts += cup.pointsWin; }
    else { h.D++; a.D++; h.Pts += cup.pointsDraw; a.Pts += cup.pointsDraw; }
  }
  for (const team of cup.teams) t[team].GD = t[team].GF - t[team].GA;
  return Object.values(t).sort(
    (x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.team.localeCompare(y.team),
  );
}
