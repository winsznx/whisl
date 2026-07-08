"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PotState } from "@/lib/pot";
import {
  fundPotAction,
  captureAction,
  submitResolutionAction,
  confirmAction,
  disputeAction,
  resolveAction,
  claimAction,
} from "@/app/dashboard/actions";
import type { ParseResult } from "@/lib/server/qvac";

type RunFn = (label: string, fn: () => Promise<string | void>) => Promise<void>;

type Props = {
  potId: string;
  state: number;
  isConfirmer: boolean;
  isSplit: boolean;
  condition: string;
  confirmedResultHash: string | null;
  confirmedAt: number;
  disputeWindowSeconds: number;
  nowSec: number;
  latestResultHash: string | null;
};

export function PotActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label);
    setErr(null);
    setNote(null);
    try {
      const msg = await fn();
      if (typeof msg === "string") setNote(msg);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const s = props.state;

  return (
    <div className="card-inverted p-8 mt-6">
      {(s === PotState.Funding || s === PotState.Ready) && (
        <FundPanel potId={props.potId} busy={busy} run={run} />
      )}

      {s === PotState.Ready && props.isConfirmer && (
        <CapturePanel {...props} busy={busy} run={run} />
      )}

      {s === PotState.ResolutionSubmitted && (
        <div>
          <Head>Result submitted</Head>
          <p className="text-smoke mt-2">Waiting for the required confirmer to sign it off.</p>
          {props.isConfirmer && props.latestResultHash && (
            <button className="btn btn-mint mt-5" disabled={!!busy}
              onClick={() => run("confirm", () => confirmAction(props.potId, props.latestResultHash!).then((r) => `Confirmed. Tx ${r.txHash}`))}>
              {busy === "confirm" ? "Signing…" : "Confirm this result"}
            </button>
          )}
        </div>
      )}

      {s === PotState.Confirmed && (
        <ConfirmedPanel {...props} busy={busy} run={run} />
      )}

      {s === PotState.Disputed && props.isConfirmer && (
        <div>
          <Head>Under review</Head>
          <p className="text-smoke mt-2">Resolve the dispute within the grace period.</p>
          <div className="flex flex-wrap gap-3 mt-5">
            <button className="btn btn-mint" disabled={!!busy}
              onClick={() => run("approve", () => resolveAction(props.potId, true).then((r) => `Payout approved. Tx ${r.txHash}`))}>
              {busy === "approve" ? "Signing…" : "Uphold result, allow payout"}
            </button>
            <button className="btn" style={{ background: "#fff", color: "#000" }} disabled={!!busy}
              onClick={() => run("reject", () => resolveAction(props.potId, false).then((r) => `Moved to refund. Tx ${r.txHash}`))}>
              {busy === "reject" ? "Signing…" : "Overturn, refund everyone"}
            </button>
          </div>
        </div>
      )}

      {s === PotState.Disputed && !props.isConfirmer && (
        <div><Head>Under review</Head><p className="text-smoke mt-2">The confirmer is resolving the dispute.</p></div>
      )}

      {s === PotState.ResolutionFinal && (
        <div>
          <Head>Ready to claim</Head>
          <p className="text-smoke mt-2">{props.isSplit ? "Each depositor claims their share." : "The payout recipient can claim the pot."}</p>
          <button className="btn btn-mint mt-5" disabled={!!busy}
            onClick={() => run("claim", () => claimAction(props.potId).then((r) => `Claimed. Tx ${r.txHash}`))}>
            {busy === "claim" ? "Signing…" : "Claim the payout"}
          </button>
        </div>
      )}

      {s === PotState.Settled && <div><Head>Settled</Head><p className="text-smoke mt-2">The reward has paid out. The receipt is shared with every peer.</p></div>}
      {s === PotState.RefundPending && (
        <div>
          <Head>Refund available</Head>
          <p className="text-smoke mt-2">Deposits can be returned.</p>
        </div>
      )}
      {(s === PotState.Refunded || s === PotState.Swept || s === PotState.Cancelled) && (
        <div><Head>Closed</Head><p className="text-smoke mt-2">This pot is finished.</p></div>
      )}

      {note && <p className="mono-label text-mint-chip mt-5 break-all">{note}</p>}
      {err && <p className="mono-label mt-5" style={{ color: "#ff8a80" }}>{err}</p>}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <div className="font-display text-3xl">{children}</div>;
}

function FundPanel({ potId, busy, run }: { potId: string; busy: string | null; run: RunFn }) {
  const [amount, setAmount] = useState("1");
  return (
    <div className="pb-2">
      <Head>Fund the pot</Head>
      <p className="text-smoke mt-2">Commit USD-T from your own wallet. You approve, then you deposit. Two signed steps.</p>
      <div className="flex flex-wrap items-end gap-3 mt-5">
        <label className="block">
          <span className="mono-label text-smoke">AMOUNT (USD-T)</span>
          <input className="field mt-2" style={{ maxWidth: 160 }} type="number" min="0" step="0.1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <button className="btn btn-mint" disabled={!!busy}
          onClick={() => run("fund", () => fundPotAction(potId, amount).then((r) => `Approved ${r.approveTx.slice(0, 10)}… then deposited ${r.depositTx.slice(0, 10)}…`))}>
          {busy === "fund" ? "Approving then depositing…" : "Approve and deposit"}
        </button>
      </div>
    </div>
  );
}

function CapturePanel(props: Props & { busy: string | null; run: (l: string, fn: () => Promise<string | void>) => Promise<void> }) {
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [reading, setReading] = useState(false);
  const [manual, setManual] = useState({ home: "", away: "" });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true);
    setParsed(null);
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    });
    try {
      const result = await captureAction(props.potId, dataUrl, props.condition);
      setParsed(result);
    } finally {
      setReading(false);
    }
  }

  const submit = (parsedResult: Record<string, unknown> | null, evidenceHash: string, parserDevice: string, model: string | null) =>
    props.run("submit", () => submitResolutionAction(props.potId, { parsedResult, evidenceHash, parserDevice, model }).then((r) => `Submitted. Tx ${r.txHash}`));

  return (
    <div className="mt-8 pt-8" style={{ borderTop: "1px solid #2f2f2f" }}>
      <Head>Capture the moment</Head>
      <p className="text-smoke mt-2">Snap the scoreboard. It is read on this device, no cloud. If it is unsure, type it in.</p>

      <label className="btn btn-mint mt-5 inline-flex cursor-pointer">
        {reading ? "Reading on device…" : "Capture a frame"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} disabled={reading || !!props.busy} />
      </label>

      {parsed && (
        <div className="mt-5">
          <div className="mono-label text-smoke">READ RESULT · CONFIDENCE {Math.round((parsed.confidence ?? 0) * 100)}%</div>
          <pre className="mt-2 overflow-x-auto" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{JSON.stringify(parsed.parsedResult, null, 2)}</pre>
          {parsed.ok ? (
            <button className="btn btn-mint mt-3" disabled={!!props.busy}
              onClick={() => submit(parsed.parsedResult, parsed.evidenceHash, "local", parsed.model)}>
              {props.busy === "submit" ? "Signing…" : "Submit this result"}
            </button>
          ) : (
            <div className="mt-4">
              <p className="text-smoke">The read was not confident. Enter the result manually. The photo stays as proof.</p>
              <div className="flex flex-wrap items-end gap-3 mt-3">
                <label><span className="mono-label text-smoke">HOME</span><input className="field mt-1" style={{ maxWidth: 90 }} value={manual.home} onChange={(e) => setManual((m) => ({ ...m, home: e.target.value }))} /></label>
                <label><span className="mono-label text-smoke">AWAY</span><input className="field mt-1" style={{ maxWidth: 90 }} value={manual.away} onChange={(e) => setManual((m) => ({ ...m, away: e.target.value }))} /></label>
                <button className="btn btn-mint" disabled={!!props.busy}
                  onClick={() => submit({ home_score: Number(manual.home), away_score: Number(manual.away), source: "manual" }, parsed.evidenceHash, "manual", null)}>
                  Submit manual result
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmedPanel(props: Props & { busy: string | null; run: (l: string, fn: () => Promise<string | void>) => Promise<void> }) {
  const deadline = props.confirmedAt + props.disputeWindowSeconds;
  const [left, setLeft] = useState(Math.max(0, deadline - props.nowSec));

  useEffect(() => {
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const open = left > 0;
  return (
    <div>
      <Head>{open ? "Dispute window open" : "Window closed"}</Head>
      <p className="text-smoke mt-2">
        {open ? `Anyone in the room can flag this result. ${left}s left.` : "No dispute. The pot is ready to settle."}
      </p>
      <div className="flex flex-wrap gap-3 mt-5">
        {open && (
          <button className="btn" style={{ background: "#fff", color: "#000" }} disabled={!!props.busy}
            onClick={() => props.run("dispute", () => disputeAction(props.potId, "flagged from dashboard").then((r) => `Dispute opened. Tx ${r.txHash}`))}>
            {props.busy === "dispute" ? "Signing…" : "Flag this result"}
          </button>
        )}
        {!open && (
          <button className="btn btn-mint" disabled={!!props.busy}
            onClick={() => props.run("claim", () => claimAction(props.potId).then((r) => `Claimed. Tx ${r.txHash}`))}>
            {props.busy === "claim" ? "Signing…" : "Settle and claim"}
          </button>
        )}
      </div>
    </div>
  );
}
