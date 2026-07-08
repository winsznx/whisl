import Link from "next/link";
import { getRoom } from "@/lib/server/room";
import { computeStandings } from "@/lib/standings";
import { flag } from "@/lib/flags";
import type { RoomCup, RoomFixture } from "@/lib/roomTypes";

export const dynamic = "force-dynamic";

export default async function StandingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let cup: RoomCup | null = null;
  let fixtures: RoomFixture[] = [];
  try {
    const room = await getRoom();
    [cup, fixtures] = await Promise.all([room.getCup(id), room.listFixtures(id)]);
  } catch {
    // room not available
  }
  if (!cup) return <div className="max-w-2xl"><h1 className="heading-secondary">Cup not found</h1></div>;

  const table = computeStandings(cup.teams, fixtures);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div><span className="tag">STANDINGS</span><h1 className="heading-secondary mt-4">{cup.name}</h1></div>
        <Link href={`/dashboard/tournaments/${id}/fixtures`} className="btn btn-ghost">Fixtures</Link>
      </div>

      <div className="card mt-8 overflow-x-auto">
        <table className="w-full" style={{ fontSize: "var(--text-body-sm)" }}>
          <thead>
            <tr className="mono-label text-smoke text-left">
              <th className="py-2 w-8">#</th><th className="py-2">Team</th>
              <th className="py-2 text-center">P</th><th className="py-2 text-center">W</th>
              <th className="py-2 text-center">D</th><th className="py-2 text-center">L</th>
              <th className="py-2 text-center">GD</th><th className="py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.team} className="border-t border-ash">
                <td className="py-3 mono-label text-smoke">{i + 1}</td>
                <td className="py-3" style={{ fontWeight: 500 }}>{flag(r.team)} {r.team}</td>
                <td className="py-3 text-center">{r.P}</td>
                <td className="py-3 text-center">{r.W}</td>
                <td className="py-3 text-center">{r.D}</td>
                <td className="py-3 text-center">{r.L}</td>
                <td className="py-3 text-center">{r.GD}</td>
                <td className="py-3 text-right font-display text-2xl">{r.Pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {table.length === 0 ? <p className="text-slate mt-3">Register teams to build the table.</p> : null}
      </div>
    </div>
  );
}
