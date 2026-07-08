import Link from "next/link";
import type { Metadata } from "next";
import { readPot, ESCROW, EXPLORER, type PotView } from "@/lib/chain";
import { STATE_LABEL, PotState, usdt, shortHash } from "@/lib/pot";

type Params = { params: Promise<{ potId: string }> };

function isPotId(v: string): v is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(v);
}

async function loadPot(potId: string): Promise<PotView | null> {
  if (!isPotId(potId)) return null;
  try {
    const pot = await readPot(potId);
    return pot.state === PotState.None ? null : pot;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { potId } = await params;
  const pot = await loadPot(potId);
  if (!pot) return { title: "Receipt not found · Whisl" };
  const settled = pot.state === PotState.Settled;
  return {
    title: `${settled ? "Settled" : STATE_LABEL[pot.state]} · ${usdt(pot.totalDeposited)} USD-T · Whisl receipt`,
    description: `A referee confirmed payout of ${usdt(pot.totalDeposited)} USD-T, settled on Ethereum Sepolia.`,
  };
}

export default async function ReceiptPage({ params }: Params) {
  const { potId } = await params;
  const pot = await loadPot(potId);

  return (
    <main className="flex-1">
      <div className="shell h-24 flex items-center">
        <Link href="/" className="font-display text-3xl">WHISL</Link>
      </div>

      <div className="shell pb-24 max-w-2xl">
        {!pot ? (
          <div className="card">
            <span className="tag">RECEIPT</span>
            <h1 className="heading-secondary mt-5">Receipt not found</h1>
            <p className="text-slate mt-3">
              No pot exists for this id on Ethereum Sepolia. Check the link and try again.
            </p>
            <Link href="/dashboard" className="btn btn-primary mt-6">Open app</Link>
          </div>
        ) : (
          <div className="card-inverted p-10">
            <div className="flex items-center justify-between">
              <span className="tag">REFEREE CONFIRMED PAYOUT</span>
              <span className="mono-label text-smoke">SEPOLIA</span>
            </div>

            <div className="mono-label text-smoke mt-10">FINAL REWARD</div>
            <div className="font-display mt-2" style={{ fontSize: "clamp(56px, 12vw, 110px)", lineHeight: 0.9 }}>
              {usdt(pot.totalDeposited)}
              <span className="text-smoke text-3xl ml-3">USD-T</span>
            </div>

            <div className="mt-6">
              <span className="tag">{STATE_LABEL[pot.state]}</span>
            </div>

            <dl className="mt-10 grid sm:grid-cols-2 gap-6">
              <Row label="PAYOUT RECIPIENT" value={pot.payoutRecipient === "0x0000000000000000000000000000000000000000" ? "Split to depositors" : shortHash(pot.payoutRecipient)} />
              <Row label="DEPOSITORS FUNDED" value={`${usdt(pot.totalDeposited)} USD-T`} />
              <Row label="RESULT HASH" value={shortHash(pot.resultHash, 8, 6)} />
              <Row label="EVIDENCE HASH" value={shortHash(pot.evidenceHash, 8, 6)} />
            </dl>

            <div className="mt-10 flex flex-wrap gap-3">
              <a href={`${EXPLORER}/address/${ESCROW}`} target="_blank" rel="noreferrer" className="btn btn-mint">
                View escrow on Etherscan
              </a>
              <Link href={`/dashboard/pots/${potId}`} className="btn-ghost btn" style={{ borderColor: "#979797", color: "#e5e5e5" }}>
                Open in app
              </Link>
            </div>

            <p className="mono-label text-smoke mt-10 break-all">POT {potId}</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mono-label text-smoke">{label}</dt>
      <dd className="mt-1" style={{ fontWeight: 500 }}>{value}</dd>
    </div>
  );
}
