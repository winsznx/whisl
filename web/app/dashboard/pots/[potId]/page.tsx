import Link from "next/link";
import { readPot, EXPLORER } from "@/lib/chain";
import { PotState, STATE_LABEL, usdt, shortHash, ADDR_ZERO } from "@/lib/pot";
import { flagInText } from "@/lib/flags";
import { StateBadge } from "@/components/state-badge";
import { PotActions } from "@/components/pot-actions";
import { getRoom } from "@/lib/server/room";
import { walletAddress, walletConfigured } from "@/lib/server/wdk";
import type { RoomPot, RoomProposal } from "@/lib/roomTypes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ potId: string }> };

export default async function PotPage({ params }: Params) {
  const { potId } = await params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(potId)) return <NotFound />;

  const pot = await readPot(potId as `0x${string}`).catch(() => null);
  if (!pot || pot.state === PotState.None) return <NotFound />;

  let meta: RoomPot | null = null;
  let proposals: RoomProposal[] = [];
  let me = "";
  try {
    const room = await getRoom();
    [meta, proposals] = await Promise.all([room.getPot(potId), room.listProposals(potId)]);
  } catch {
    // room not available on this instance
  }
  const ready = walletConfigured();
  if (ready) me = await walletAddress().catch(() => "");

  const isConfirmer = me !== "" && me.toLowerCase() === pot.requiredConfirmer.toLowerCase();
  const isSplit = pot.payoutRecipient === ADDR_ZERO;
  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="tag">{meta?.matchId || "GOALDROP"}</span>
        <StateBadge state={pot.state} />
      </div>
      <h1 className="heading-secondary mt-4">{flagInText(meta?.condition)} {meta?.condition || "Referee-confirmed pot"}</h1>

      <div className="card mt-6 grid sm:grid-cols-3 gap-6">
        <Stat label="POT SO FAR" value={`${usdt(pot.totalDeposited)} USD-T`} />
        <Stat label="MINIMUM" value={`${usdt(pot.minTotalDeposit)} USD-T`} />
        <Stat label="PAYOUT" value={isSplit ? "Split to depositors" : shortHash(pot.payoutRecipient)} />
      </div>

      <PotActions
        potId={potId}
        state={pot.state}
        ready={ready}
        isConfirmer={isConfirmer}
        isSplit={isSplit}
        condition={meta?.condition ?? ""}
        confirmedResultHash={meta?.confirmedResultHash ?? null}
        confirmedAt={Number(pot.confirmedAt)}
        disputeWindowSeconds={Number(pot.disputeWindowSeconds)}
        nowSec={nowSec}
        latestResultHash={proposals.at(-1)?.resultHash ?? null}
      />

      <div className="card mt-6">
        <div className="mono-label text-smoke">ON CHAIN</div>
        <div className="mt-2 grid gap-1" style={{ fontSize: "var(--text-body-sm)" }}>
          <Row k="State" v={STATE_LABEL[pot.state]} />
          <Row k="Result hash" v={shortHash(pot.resultHash, 8, 6)} />
          <Row k="Evidence hash" v={shortHash(pot.evidenceHash, 8, 6)} />
          <Row k="Required confirmer" v={shortHash(pot.requiredConfirmer)} />
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <a href={`${EXPLORER}/address/${pot.token}`} target="_blank" rel="noreferrer" className="btn btn-ghost">Token on Etherscan</a>
          {pot.state === PotState.Settled ? (
            <Link href={`/receipt/${potId}`} className="btn btn-mint">View receipt</Link>
          ) : null}
        </div>
      </div>

      {proposals.length > 0 ? (
        <div className="card mt-6">
          <div className="mono-label text-smoke">CAPTURED RESULT</div>
          <pre className="mt-2 overflow-x-auto" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {JSON.stringify(proposals.at(-1)?.parsedResult, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono-label text-smoke">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-ash py-2">
      <span className="text-smoke">{k}</span>
      <span style={{ fontWeight: 500 }}>{v}</span>
    </div>
  );
}
function NotFound() {
  return (
    <div className="max-w-2xl">
      <span className="tag">POT</span>
      <h1 className="heading-secondary mt-4">Pot not found</h1>
      <p className="text-slate mt-3">No pot with this id exists on Sepolia yet.</p>
      <Link href="/dashboard" className="btn btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
