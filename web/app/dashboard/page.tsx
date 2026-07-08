import Link from "next/link";
import { getRoom } from "@/lib/server/room";
import { walletConfigured, walletAddress } from "@/lib/server/wdk";
import { readPotState, readUsdtBalance } from "@/lib/chain";
import { usdt, shortHash, STATE_LABEL } from "@/lib/pot";
import { flagInText } from "@/lib/flags";
import { StateBadge } from "@/components/state-badge";
import type { RoomPot, RoomCup } from "@/lib/roomTypes";

export const dynamic = "force-dynamic";

async function loadPots(): Promise<Array<RoomPot & { state: number }>> {
  try {
    const room = await getRoom();
    const pots = await room.listPots();
    return Promise.all(
      pots.map(async (p) => ({ ...p, state: await readPotState(p.potId as `0x${string}`).catch(() => 0) })),
    );
  } catch {
    return [];
  }
}

async function loadCups(): Promise<RoomCup[]> {
  try {
    return await (await getRoom()).listCups();
  } catch {
    return [];
  }
}

export default async function Overview() {
  const [pots, cups] = await Promise.all([loadPots(), loadCups()]);

  let balance = "0";
  let configured = walletConfigured();
  if (configured) {
    try {
      balance = usdt(await readUsdtBalance((await walletAddress()) as `0x${string}`));
    } catch {
      configured = false;
    }
  }

  const active = pots.filter((p) => p.state >= 1 && p.state <= 6);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="tag">DASHBOARD</span>
          <h1 className="heading-secondary mt-4">Your room</h1>
        </div>
        <Link href="/dashboard/pots/new" className="btn btn-primary">Create a pot</Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-5 mt-8">
        <Link href="/dashboard/wallet" className="card">
          <div className="mono-label text-smoke">WALLET</div>
          <div className="font-display text-4xl mt-2">{configured ? `${balance}` : "—"}</div>
          <div className="mono-label text-smoke mt-1">{configured ? "USD-T AVAILABLE" : "NO WALLET SET"}</div>
        </Link>
        <div className="card">
          <div className="mono-label text-smoke">ACTIVE POTS</div>
          <div className="font-display text-4xl mt-2">{active.length}</div>
        </div>
        <Link href="/dashboard/tournaments" className="card">
          <div className="mono-label text-smoke">TOURNAMENTS</div>
          <div className="font-display text-4xl mt-2">{cups.length}</div>
        </Link>
      </div>

      <h2 className="heading-secondary mt-12" style={{ fontSize: "var(--text-heading-sm)" }}>Active pots</h2>
      {active.length === 0 ? (
        <div className="card mt-4">
          <p className="text-slate">No active pots yet. Create one to start a GoalDrop.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5 mt-4">
          {active.map((p) => (
            <Link key={p.potId} href={`/dashboard/pots/${p.potId}`} className="card">
              <div className="flex items-center justify-between gap-3">
                <div className="mono-label text-smoke">{p.matchId || "MATCH"}</div>
                <StateBadge state={p.state} />
              </div>
              <div className="font-display text-2xl mt-3">{flagInText(p.condition)} {p.condition || "Condition"}</div>
              <div className="mono-label text-smoke mt-3">POT {shortHash(p.potId)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
