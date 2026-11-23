"use client";

import { startTransition, useActionState, useState } from "react";
import { createSeriesAction, updateSeriesAction } from "@/app/actionsSeries";
import type { FormState } from "@/app/actions";
import { BEST_OF_MAX, BEST_OF_MIN, SERIES_SIDES_MIN } from "@/lib/series";

const initial: FormState = {};
const Err = ({ text }: { text?: string }) => (text ? <p className="err" role="alert">{text}</p> : null);
const SLOTS = 6;

type Team = { id: string; name: string };
export type SeriesDefaults = { name: string; format: "open" | "best_of"; bestOf: number | null; startsOn: string; endsOn: string; notes: string; sides: { teamId: string | null; name: string }[] };

/** Create or edit a series. Teams: choose a permanent team or type a match-only name. Blank rows are ignored. */
export function SeriesForm({ mode, communityId, seriesId, teams, defaults }: { mode: "create" | "edit"; communityId: string; seriesId?: string; teams: Team[]; defaults?: SeriesDefaults }) {
  const [state, action, pending] = useActionState(mode === "create" ? createSeriesAction : updateSeriesAction, initial);
  const [format, setFormat] = useState<"open" | "best_of">(defaults?.format ?? "open");
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      {seriesId && <input type="hidden" name="seriesId" value={seriesId} />}
      <label className="lb" htmlFor="s-name" style={{ marginTop: 0 }}>Series name</label>
      <input id="s-name" name="name" className={`field${fe.name ? " bad" : ""}`} defaultValue={defaults?.name} maxLength={60} placeholder="Friday showdown" autoComplete="off" />
      <Err text={fe.name} />

      <fieldset style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
        <legend className="muted small" style={{ fontWeight: 600, padding: 0 }}>Teams (at least {SERIES_SIDES_MIN})</legend>
        {Array.from({ length: SLOTS }, (_, i) => (
          <div key={i} className="two" style={{ marginTop: 8 }}>
            <select name={`side${i}Team`} className={`field${fe[`side${i}`] ? " bad" : ""}`} aria-label={`Team ${i + 1}: choose a team`} defaultValue={defaults?.sides[i]?.teamId ?? ""}>
              <option value="">Match-only team…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input name={`side${i}Name`} className={`field${fe[`side${i}`] ? " bad" : ""}`} aria-label={`Team ${i + 1}: match-only name`} defaultValue={defaults?.sides[i] && !defaults.sides[i]!.teamId ? defaults.sides[i]!.name : ""} maxLength={40} placeholder="Name (if no team chosen)" autoComplete="off" />
            <Err text={fe[`side${i}`]} />
          </div>
        ))}
        <Err text={fe.sides} />
      </fieldset>

      <label className="lb" htmlFor="s-format">Format</label>
      <select id="s-format" name="format" className={`field${fe.format ? " bad" : ""}`} value={format} onChange={(e) => setFormat(e.target.value as "open" | "best_of")}>
        <option value="open">Open-ended: no fixed number of matches</option>
        <option value="best_of">Best of a number of matches</option>
      </select>
      <Err text={fe.format} />
      {format === "best_of" && (
        <>
          <label className="lb" htmlFor="s-best">Best of ({BEST_OF_MIN} to {BEST_OF_MAX})</label>
          <input id="s-best" name="bestOf" inputMode="numeric" className={`field${fe.bestOf ? " bad" : ""}`} defaultValue={defaults?.bestOf ?? 3} maxLength={2} />
          <Err text={fe.bestOf} />
        </>
      )}
      <p className="muted small" style={{ margin: "6px 2px 0" }}>You can change the format later, for example from best of 3 to best of 5, and keep playing.</p>

      <div className="two">
        <div><label className="lb" htmlFor="s-from">Starts (optional)</label><input id="s-from" type="date" name="startsOn" className={`field${fe.startsOn ? " bad" : ""}`} defaultValue={defaults?.startsOn} /><Err text={fe.startsOn} /></div>
        <div><label className="lb" htmlFor="s-to">Ends (optional)</label><input id="s-to" type="date" name="endsOn" className={`field${fe.endsOn ? " bad" : ""}`} defaultValue={defaults?.endsOn} /><Err text={fe.endsOn} /></div>
      </div>
      <label className="lb" htmlFor="s-notes">Notes (optional)</label>
      <textarea id="s-notes" name="notes" className={`field${fe.notes ? " bad" : ""}`} defaultValue={defaults?.notes} maxLength={300} />
      <Err text={fe.notes} />
      {state.error && <Err text={state.error} />}
      <button className="btn gold" disabled={pending} style={{ marginTop: 12 }}>{pending ? "Saving…" : mode === "create" ? "Create series" : "Save changes"}</button>
    </form>
  );
}
