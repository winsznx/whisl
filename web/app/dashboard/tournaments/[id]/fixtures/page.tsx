import Link from "next/link";
import { getRoom } from "@/lib/server/room";
import { AddFixture, RecordResult } from "@/components/cup-controls";
import { shortHash } from "@/lib/pot";
import { flag } from "@/lib/flags";
import type { RoomCup, RoomFixture } from "@/lib/roomTypes";

export const dynamic = "force-dynamic";

export default async function FixturesPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div><span className="tag">FIXTURES</span><h1 className="heading-secondary mt-4">{cup.name}</h1></div>
        <Link href={`/dashboard/tournaments/${id}/standings`} className="btn btn-ghost">Standings</Link>
      </div>

      <div className="card mt-8">
        {fixtures.length === 0 ? (
          <p className="text-slate">No fixtures yet.</p>
        ) : (
          <ul className="grid gap-3">
            {fixtures.map((f) => (
              <li key={f.fixtureId} className="border-t border-ash pt-3 flex flex-wrap items-center justify-between gap-3">
                <span style={{ fontWeight: 500 }}>
                  {flag(f.home)} {f.home} <span className="text-smoke">vs</span> {flag(f.away)} {f.away}
                  {f.potId ? <span className="mono-label text-smoke ml-2">POT {shortHash(f.potId)}</span> : null}
                </span>
                {f.result ? (
                  <span className="font-display text-2xl">{f.result.homeScore} – {f.result.awayScore}</span>
                ) : (
                  <RecordResult cupId={id} fixtureId={f.fixtureId} />
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6">
          <div className="mono-label text-smoke">ADD A FIXTURE</div>
          <AddFixture cupId={id} teams={cup.teams} />
        </div>
      </div>
    </div>
  );
}
