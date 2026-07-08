import type { RoomFixture } from "./roomTypes";

export type Standing = { team: string; P: number; W: number; D: number; L: number; GF: number; GA: number; GD: number; Pts: number };

export function computeStandings(teams: string[], fixtures: RoomFixture[]): Standing[] {
  const t: Record<string, Standing> = {};
  for (const team of teams) t[team] = { team, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
  for (const fx of fixtures) {
    if (!fx.result || !t[fx.home] || !t[fx.away]) continue;
    const { homeScore: hs, awayScore: as } = fx.result;
    const h = t[fx.home];
    const a = t[fx.away];
    h.P++; a.P++; h.GF += hs; h.GA += as; a.GF += as; a.GA += hs;
    if (hs > as) { h.W++; a.L++; h.Pts += 3; }
    else if (hs < as) { a.W++; h.L++; a.Pts += 3; }
    else { h.D++; a.D++; h.Pts += 1; a.Pts += 1; }
  }
  for (const team of teams) t[team].GD = t[team].GF - t[team].GA;
  return Object.values(t).sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.team.localeCompare(y.team));
}
