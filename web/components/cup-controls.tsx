"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerTeamAction, addFixtureAction, recordResultAction } from "@/app/dashboard/actions";
import { flag } from "@/lib/flags";

export function RegisterTeam({ cupId }: { cupId: string }) {
  const router = useRouter();
  const [team, setTeam] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-3 mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!team.trim()) return;
        setBusy(true);
        await registerTeamAction(cupId, team.trim());
        setTeam("");
        setBusy(false);
        router.refresh();
      }}
    >
      <label><span className="mono-label text-smoke">TEAM NAME</span><input className="field mt-1" value={team} onChange={(e) => setTeam(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Register team"}</button>
    </form>
  );
}

export function AddFixture({ cupId, teams }: { cupId: string; teams: string[] }) {
  const router = useRouter();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-3 mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!home || !away || home === away) return;
        setBusy(true);
        await addFixtureAction(cupId, home, away);
        setBusy(false);
        router.refresh();
      }}
    >
      <label><span className="mono-label text-smoke">HOME</span>
        <select className="field mt-1" value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">Select</option>{teams.map((t) => <option key={t} value={t}>{flag(t)} {t}</option>)}
        </select></label>
      <label><span className="mono-label text-smoke">AWAY</span>
        <select className="field mt-1" value={away} onChange={(e) => setAway(e.target.value)}>
          <option value="">Select</option>{teams.map((t) => <option key={t} value={t}>{flag(t)} {t}</option>)}
        </select></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add fixture"}</button>
    </form>
  );
}

export function RecordResult({ cupId, fixtureId }: { cupId: string; fixtureId: string }) {
  const router = useRouter();
  const [h, setH] = useState("");
  const [a, setA] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await recordResultAction(cupId, fixtureId, Number(h), Number(a));
        setBusy(false);
        router.refresh();
      }}
    >
      <input className="field" style={{ width: 60 }} type="number" min="0" value={h} onChange={(e) => setH(e.target.value)} placeholder="H" />
      <input className="field" style={{ width: 60 }} type="number" min="0" value={a} onChange={(e) => setA(e.target.value)} placeholder="A" />
      <button className="btn btn-mint" disabled={busy || h === "" || a === ""}>{busy ? "…" : "Record"}</button>
    </form>
  );
}
