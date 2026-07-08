"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPotAction, type CreatePotInput } from "@/app/dashboard/actions";
import { friendlyError } from "@/lib/friendly";

const DEFAULTS: CreatePotInput = {
  match: "Nigeria vs Cameroon",
  condition: "Nigeria scores",
  requiredConfirmer: "",
  payoutRecipient: "",
  minUsdt: "1",
  maxUsdt: "100",
  fundingMinutes: "60",
  resolutionMinutes: "120",
  disputeWindowSeconds: "120",
  disputeGraceSeconds: "300",
  sweepDays: "14",
};

export function NewPotForm() {
  const router = useRouter();
  const [form, setForm] = useState<CreatePotInput>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreatePotInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { potId } = await createPotAction(form);
      router.push(`/dashboard/pots/${potId}`);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <span className="tag">NEW POT</span>
      <h1 className="heading-secondary mt-4">Start a GoalDrop</h1>
      <p className="text-slate mt-3" style={{ fontSize: "var(--text-body-sm)" }}>
        Everyone pledges into one pot tied to one condition. Signed by your own wallet.
      </p>

      <form onSubmit={onSubmit} className="card mt-8 grid gap-5">
        <Field label="Match"><input className="field" value={form.match} onChange={set("match")} /></Field>
        <Field label="Condition (for example, Nigeria scores)"><input className="field" value={form.condition} onChange={set("condition")} required /></Field>
        <Field label="Who confirms the result (leave blank to confirm it yourself)"><input className="field" placeholder="0x… or blank" value={form.requiredConfirmer} onChange={set("requiredConfirmer")} /></Field>
        <Field label="Who gets paid (leave blank to split back to everyone)"><input className="field" placeholder="0x… or blank" value={form.payoutRecipient} onChange={set("payoutRecipient")} /></Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Minimum pot (USD-T)"><input className="field" type="number" min="0" step="0.1" value={form.minUsdt} onChange={set("minUsdt")} /></Field>
          <Field label="Maximum pot (USD-T)"><input className="field" type="number" min="0" step="0.1" value={form.maxUsdt} onChange={set("maxUsdt")} /></Field>
          <Field label="Funding open for (minutes)"><input className="field" type="number" min="1" value={form.fundingMinutes} onChange={set("fundingMinutes")} /></Field>
          <Field label="Result deadline (minutes)"><input className="field" type="number" min="2" value={form.resolutionMinutes} onChange={set("resolutionMinutes")} /></Field>
          <Field label="Dispute window (seconds)"><input className="field" type="number" min="1" value={form.disputeWindowSeconds} onChange={set("disputeWindowSeconds")} /></Field>
          <Field label="Dispute grace (seconds)"><input className="field" type="number" min="1" value={form.disputeGraceSeconds} onChange={set("disputeGraceSeconds")} /></Field>
          <Field label="Return unclaimed after (days)"><input className="field" type="number" min="1" value={form.sweepDays} onChange={set("sweepDays")} /></Field>
        </div>

        {error ? <p className="mono-label" style={{ color: "#b00020" }}>{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing and creating…" : "Create pot"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono-label text-smoke">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
