import Link from "next/link";
import { getRoom } from "@/lib/server/room";
import { RegisterTeam } from "@/components/cup-controls";
import { flag } from "@/lib/flags";
import type { RoomCup } from "@/lib/roomTypes";

export const dynamic = "force-dynamic";

export default async function CupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let cup: RoomCup | null = null;
  try {
    cup = await (await getRoom()).getCup(id);
  } catch {
    // room not available
  }
  if (!cup) return <NotFound />;

  return (
    <div className="max-w-2xl">
      <span className="tag">CUP</span>
      <h1 className="heading-secondary mt-4">{cup.name}</h1>

      <div className="flex flex-wrap gap-3 mt-6">
        <Link href={`/dashboard/tournaments/${id}/fixtures`} className="btn btn-ghost">Fixtures</Link>
        <Link href={`/dashboard/tournaments/${id}/standings`} className="btn btn-ghost">Standings</Link>
      </div>

      <div className="card mt-8">
        <div className="mono-label text-smoke">TEAMS</div>
        {cup.teams.length === 0 ? (
          <p className="text-slate mt-2">No teams registered yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {cup.teams.map((t) => (
              <li key={t} className="border-t border-ash pt-2" style={{ fontWeight: 500 }}>{flag(t)} {t}</li>
            ))}
          </ul>
        )}
        <RegisterTeam cupId={id} />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="max-w-2xl">
      <span className="tag">CUP</span>
      <h1 className="heading-secondary mt-4">Cup not found on this instance</h1>
      <Link href="/dashboard/tournaments" className="btn btn-primary mt-6">Back to tournaments</Link>
    </div>
  );
}
