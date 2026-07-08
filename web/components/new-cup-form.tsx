"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCupAction } from "@/app/dashboard/actions";
import { friendlyError } from "@/lib/friendly";

export function NewCupForm() {
  const router = useRouter();
  const [name, setName] = useState("World Cup Group E");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="max-w-xl">
      <span className="tag">NEW CUP</span>
      <h1 className="heading-secondary mt-4">Create a cup</h1>
      <form
        className="card mt-8 grid gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const { cupId } = await createCupAction(name.trim() || "Cup");
            router.push(`/dashboard/tournaments/${cupId}`);
          } catch (e2) {
            setErr(friendlyError(e2));
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span className="mono-label text-smoke">CUP NAME</span>
          <input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {err ? <p className="mono-label" style={{ color: "#b00020" }}>{err}</p> : null}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create cup"}</button>
      </form>
    </div>
  );
}
