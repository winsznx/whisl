import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ESCROW, EXPLORER } from "@/lib/chain";
import { shortHash } from "@/lib/pot";
import { flag } from "@/lib/flags";

const STEPS = [
  { n: "01", t: "Fund the pot", d: "Everyone in the room commits USD₮ from their own wallet. Self-custodial, no one else ever holds it." },
  { n: "02", t: "Capture the moment", d: "Referee or host captures the scoreboard, a scorecard, or a spoken result the second it happens." },
  { n: "03", t: "Local AI reads it, the room confirms", d: "No cloud call. The required confirmer signs off, or flags it if something looks wrong." },
  { n: "04", t: "The pot pays out", d: "Once confirmed, settlement happens on-chain. Every peer sees the same receipt." },
];

const TRACKS = [
  { tag: "PEARS", d: "No server holds the room. Fixtures, results, and disputes sync peer to peer." },
  { tag: "QVAC", d: "No cloud reads the result. Match evidence is parsed on the device that captured it." },
  { tag: "WDK", d: "No custodian holds the pot. Every deposit and payout is signed by the person it belongs to." },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="shell pt-10 pb-24">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="tag">PEARS · QVAC · WDK</span>
              <h1 className="font-display text-display-xl mt-6">Turn the whistle into settlement.</h1>
              <p className="text-slate mt-6 max-w-md" style={{ fontSize: "var(--text-subheading-lg)", lineHeight: 1.4 }}>
                Whisl is a P2P football settlement room. Match events, referee confirmations, and USD₮
                payouts sync without a central server.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link href="/dashboard" className="btn btn-primary">Open Dashboard</Link>
                <Link href="#how" className="btn btn-ghost">See how GoalDrop works</Link>
              </div>
            </div>
            <Scoreboard />
          </div>
        </section>

        {/* GoalDrop / how it works */}
        <section id="how" className="shell py-20">
          <span id="goaldrop" className="tag">GOALDROP</span>
          <h2 className="heading-secondary mt-5 max-w-2xl">How GoalDrop works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            {STEPS.map((s) => (
              <div key={s.n} className="card h-full">
                <div className="mono-label text-smoke">{s.n}</div>
                <div className="font-display text-2xl mt-3" style={{ lineHeight: 1 }}>{s.t}</div>
                <p className="text-slate mt-3" style={{ fontSize: "var(--text-body-sm)" }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* This is not a bet */}
        <section className="shell py-8">
          <div className="card-inverted p-10 md:p-16">
            <span className="tag">THE MECHANIC</span>
            <h2 className="font-display text-display mt-6 max-w-3xl">This is not a bet.</h2>
            <p className="text-smoke mt-6 max-w-2xl" style={{ fontSize: "var(--text-subheading)", lineHeight: 1.5 }}>
              Nobody&apos;s money depends on someone else being wrong. Everyone pledges into one pot,
              tied to one condition, with one payout. If Nigeria scores, the pot pays the fan host,
              not the other side of a wager. There is no other side.
            </p>
          </div>
        </section>

        {/* Three-track stack */}
        <section id="stack" className="shell py-20">
          <h2 className="heading-secondary max-w-2xl">Three parts, all load-bearing</h2>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {TRACKS.map((tr) => (
              <div key={tr.tag} className="card h-full">
                <span className="tag">{tr.tag}</span>
                <p className="text-slate mt-4" style={{ fontSize: "var(--text-subheading)", lineHeight: 1.4 }}>{tr.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tournaments */}
        <section id="tournaments" className="shell py-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="tag">TOURNAMENTS</span>
              <h2 className="heading-secondary mt-5">Built for real tournaments, not just watch parties.</h2>
              <p className="text-slate mt-5 max-w-md" style={{ fontSize: "var(--text-subheading)", lineHeight: 1.45 }}>
                Create a cup, register teams, run fixtures, keep a live table, all wrapped around the
                same pot mechanic that pays out on a confirmed result.
              </p>
              <Link href="/dashboard/tournaments/new" className="btn btn-mint mt-8">Start a cup</Link>
            </div>
            <div className="card">
              <div className="mono-label text-smoke">GROUP D · STANDINGS · SAMPLE</div>
              <table className="w-full mt-4" style={{ fontSize: "var(--text-body-sm)" }}>
                <tbody>
                  {[["Nigeria", "6"], ["Argentina", "1"], ["Croatia", "1"]].map(([team, pts], i) => (
                    <tr key={team} className="border-t border-ash">
                      <td className="py-3 mono-label text-smoke w-8">{i + 1}</td>
                      <td className="py-3" style={{ fontWeight: 500 }}>{flag(team)} {team}</td>
                      <td className="py-3 text-right font-display text-2xl">{pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Live, not a demo */}
        <section className="shell py-20">
          <div className="card flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <span className="tag">LIVE, NOT A DEMO</span>
              <h2 className="heading-secondary mt-4">Every transaction here is real</h2>
              <p className="text-slate mt-3 max-w-lg" style={{ fontSize: "var(--text-body-sm)" }}>
                Signed and verifiable on Ethereum Sepolia. Nothing on this site is mocked.
              </p>
            </div>
            <a href={`${EXPLORER}/address/${ESCROW}`} target="_blank" rel="noreferrer" className="btn btn-ghost shrink-0">
              Contract {shortHash(ESCROW)}
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Scoreboard() {
  return (
    <div className="card-inverted p-8 md:p-10">
      <div className="flex items-center justify-between">
        <div className="mono-label text-smoke flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-mint-chip animate-pulse" /> LIVE · SAMPLE
        </div>
        <span className="mono-label text-smoke">67:12</span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-8">
        <div className="text-center">
          <div className="text-4xl md:text-5xl">{flag("NGA")}</div>
          <div className="font-display text-3xl md:text-4xl mt-1">NGA</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-6xl md:text-7xl text-mint-chip">1</span>
          <span className="font-display text-4xl text-smoke">–</span>
          <span className="font-display text-6xl md:text-7xl">0</span>
        </div>
        <div className="text-center">
          <div className="text-4xl md:text-5xl">{flag("CMR")}</div>
          <div className="font-display text-3xl md:text-4xl mt-1">CMR</div>
        </div>
      </div>
      <div className="mt-8">
        <span className="tag">GOALDROP · 42 USDT POT</span>
      </div>
    </div>
  );
}
