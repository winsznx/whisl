import Link from "next/link";
import { getRoom } from "@/lib/server/room";
import type { RoomCup } from "@/lib/roomTypes";

export const dynamic = "force-dynamic";

async function loadCups(): Promise<RoomCup[]> {
  try {
    return await (await getRoom()).listCups();
  } catch {
    return [];
  }
}

export default async function TournamentsPage() {
  const cups = await loadCups();
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="tag">TOURNAMENTS</span>
          <h1 className="heading-secondary mt-4">Cups on this instance</h1>
        </div>
        <Link href="/dashboard/tournaments/new" className="btn btn-primary">Create a cup</Link>
      </div>

      {cups.length === 0 ? (
        <div className="card mt-8"><p className="text-slate">No cups yet. Create one to run fixtures and a live table.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5 mt-8">
          {cups.map((c) => (
            <Link key={c.cupId} href={`/dashboard/tournaments/${c.cupId}`} className="card">
              <div className="font-display text-3xl">{c.name}</div>
              <div className="mono-label text-smoke mt-3">{c.teams.length} TEAMS</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
