import Link from "next/link";
import { getRoom } from "@/lib/server/room";
import { readPotState } from "@/lib/chain";
import { shortHash } from "@/lib/pot";
import { flagInText } from "@/lib/flags";
import { StateBadge } from "@/components/state-badge";
import type { RoomPot } from "@/lib/roomTypes";

export const dynamic = "force-dynamic";

const TERMINAL = new Set([7, 9, 10, 11]); // Settled, Refunded, Swept, Cancelled

async function loadHistory(): Promise<Array<RoomPot & { state: number }>> {
  try {
    const room = await getRoom();
    const pots = await room.listPots();
    const withState = await Promise.all(
      pots.map(async (p) => ({ ...p, state: await readPotState(p.potId as `0x${string}`).catch(() => 0) })),
    );
    return withState.filter((p) => TERMINAL.has(p.state));
  } catch {
    return [];
  }
}

export default async function HistoryPage() {
  const past = await loadHistory();
  return (
    <div>
      <span className="tag">HISTORY</span>
      <h1 className="heading-secondary mt-4">Finished pots</h1>

      {past.length === 0 ? (
        <div className="card mt-8"><p className="text-slate">Nothing has finished yet. Settled and refunded pots show up here.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5 mt-8">
          {past.map((p) => (
            <div key={p.potId} className="card">
              <div className="flex items-center justify-between gap-3">
                <div className="mono-label text-smoke">{p.matchId || "MATCH"}</div>
                <StateBadge state={p.state} />
              </div>
              <div className="font-display text-2xl mt-3">{flagInText(p.condition)} {p.condition || "Condition"}</div>
              <div className="flex flex-wrap gap-3 mt-4">
                <Link href={`/dashboard/pots/${p.potId}`} className="btn btn-ghost">Open</Link>
                {p.state === 7 ? <Link href={`/receipt/${p.potId}`} className="btn btn-mint">Receipt</Link> : null}
              </div>
              <div className="mono-label text-smoke mt-4">POT {shortHash(p.potId)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
