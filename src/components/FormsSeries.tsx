"use client";
// Create or edit a series (Phase F1 design). Teams are a badge row with a remove button (or a LOCKED tag when the team already has matches
// in the series), empty rows say "Add", the format is a segmented control with a stepper for best of, and a preview shows what you are building.
// It posts to the same kind of server action with the same field names (side{i}Team, side{i}Name, name, format, bestOf, startsOn, endsOn, notes)
// and the same checks: the real messages of validateSeries are shown beside the field they belong to, before and after the server answers.
import "./sr.css";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { createSeriesF1Action, updateSeriesF1Action } from "@/app/actionsF1";
import type { FormState } from "@/app/actions";
import { IconInfo, IconLock, IconMinus, IconPlus, IconTrophy, IconWarn } from "@/components/SrIcons";
import { SideBadge } from "@/components/SrParts";
import { BEST_OF_MAX, BEST_OF_MIN, SERIES_NAME_MAX, SERIES_NOTES_MAX, SERIES_SIDES_MIN, validateSeries } from "@/lib/series";
import { FORM_SLOTS, FORM_SLOTS_MAX, clampBestOf, duplicateRows, firstToText, previewLine, previewTeams, type Slot } from "@/lib/seriesView";

const initial: FormState = {};
const FIX = "Please fix the highlighted fields.";

type Team = { id: string; name: string };
export type SeriesDefaults = {
  name: string; format: "open" | "best_of"; bestOf: number | null; startsOn: string; endsOn: string; notes: string;
  sides: { teamId: string | null; name: string; locked?: boolean }[];
};

const Err = ({ text, id }: { text?: string; id?: string }) => (text ? <p className="err sr-err" role="alert" id={id}><IconWarn size={15} /><span>{text}</span></p> : null);

/** What you are building: the badges, the name and the format, as you type. */
export function SeriesPreview({ name, slots, format, bestOf }: { name: string; slots: Slot[]; format: "open" | "best_of"; bestOf: number | null }) {
  const teams = previewTeams(slots);
  return (
    <aside className="sr-preview" aria-label="Preview">
      <small className="sr-preview-h">Preview</small>
      {teams.length === 0 ? <span className="sr-preview-icon"><IconTrophy size={24} /></span> : (
        <div className="sr-preview-badges">{teams.map((t, i) => <SideBadge key={`${t.name}-${i}`} name={t.name} size="lg" />)}</div>
      )}
      <b>{name.trim() || "Series name"}</b>
      <small>{previewLine(teams.length, format, bestOf)}</small>
    </aside>
  );
}

function slotsFrom(d?: SeriesDefaults): Slot[] {
  return (d?.sides ?? []).map((s) => ({ teamId: s.teamId, name: s.name, locked: !!s.locked }));
}

export function SeriesForm({ mode, communityId, seriesId, teams, defaults }: { mode: "create" | "edit"; communityId: string; seriesId?: string; teams: Team[]; defaults?: SeriesDefaults }) {
  const [state, action, pending] = useActionState(mode === "create" ? createSeriesF1Action : updateSeriesF1Action, initial);
  const [name, setName] = useState(defaults?.name ?? "");
  const [slots, setSlots] = useState<Slot[]>(() => slotsFrom(defaults));
  const [format, setFormat] = useState<"open" | "best_of">(defaults?.format ?? "open");
  const [bestOf, setBestOf] = useState(String(defaults?.bestOf ?? 3));
  const [startsOn, setStartsOn] = useState(defaults?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(defaults?.endsOn ?? "");
  const [notes, setNotes] = useState(defaults?.notes ?? "");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [adding, setAdding] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const uid = useId();
  const typedRef = useRef<HTMLInputElement>(null);

  // The server's answer (name taken, a team that cannot be taken out, ...) is shown beside the field. Nothing typed is lost: all values live here.
  useEffect(() => {
    if (state.fieldErrors || state.error) { setErrs(state.fieldErrors ?? {}); setBanner(state.error); }
  }, [state]);

  const maxRows = Math.min(FORM_SLOTS_MAX, Math.max(FORM_SLOTS, slots.length));
  const rows = Math.min(maxRows, Math.max(4, slots.length + 1));
  const dups = errs.sides ? duplicateRows(slots) : new Set<number>();
  const chosenTeams = new Set(slots.map((s) => s.teamId).filter(Boolean));
  const free = teams.filter((t) => !chosenTeams.has(t.id));
  const n = Number(bestOf);
  const bestOk = /^\d{1,2}$/.test(bestOf.trim()) && n >= BEST_OF_MIN && n <= BEST_OF_MAX;

  const touchTeams = () => setErrs((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("side"))));
  const addSlot = (s: Slot) => { setSlots((v) => (v.length >= FORM_SLOTS_MAX ? v : [...v, s])); setAdding(null); setTyped(""); touchTeams(); };
  const removeAt = (i: number) => { setSlots((v) => v.filter((_, k) => k !== i)); touchTeams(); };
  const commitTyped = () => { const t = typed.trim(); if (t) addSlot({ teamId: null, name: t, locked: false }); };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // the same checks the server makes, so the person sees every problem at once without waiting
    const sidesRaw = slots.map((s) => ({ teamId: s.teamId ?? "", name: s.teamId ? "" : s.name }));
    const v = validateSeries({ name, format, bestOf, startsOn, endsOn, notes }, sidesRaw, new Map(teams.map((t) => [t.id, t.name])));
    if (!v.ok) { setErrs(v.errors); setBanner(FIX); return; }
    setErrs({}); setBanner(undefined);
    startTransition(() => action(fd));
  };

  const lockedNames = slots.filter((s) => s.locked).map((s) => s.name);
  return (
    <div className="sr-formwrap"><div className="sr-formgrid">
      <form onSubmit={submit} noValidate className="sr-form">
        <input type="hidden" name="communityId" value={communityId} />
        {seriesId && <input type="hidden" name="seriesId" value={seriesId} />}
        {banner && <div className="banner red sr-banner" role="alert"><IconWarn /><span>{banner}</span></div>}

        <section className="card sr-fcard">
          <label className="lb" htmlFor={`${uid}-name`} style={{ marginTop: 0 }}>Series name</label>
          <div className="sr-count-wrap">
            <input id={`${uid}-name`} name="name" className={`field${errs.name ? " bad" : ""}`} value={name} onChange={(e) => { setName(e.target.value); setErrs((x) => ({ ...x, name: "" })); }} maxLength={SERIES_NAME_MAX + 20} placeholder="Friday showdown" autoComplete="off" aria-invalid={!!errs.name} aria-describedby={errs.name ? `${uid}-name-e` : undefined} />
            <span className="sr-count" aria-hidden="true">{name.length}/{SERIES_NAME_MAX}</span>
          </div>
          <Err text={errs.name} id={`${uid}-name-e`} />

          <fieldset className="sr-teams">
            <legend className="muted small">Teams (at least {SERIES_SIDES_MIN}, up to {maxRows} here)</legend>
            {Array.from({ length: rows }, (_, i) => {
              const s = slots[i];
              if (s) {
                const bad = !!errs[`side${i}`] || dups.has(i) || (!!errs.sides && s.locked && errs.sides.toLowerCase().includes(s.name.toLowerCase()));
                return (
                  <div key={`f${i}`} className={`sr-slot filled${bad ? " bad" : ""}${s.locked ? " locked" : ""}`}>
                    <SideBadge name={s.name} size="md" />
                    <div className="sr-slot-t">
                      <b>{s.name}</b>
                      <small>{s.teamId ? "Team of this community" : "Match-only team"}{s.locked ? " · has matches in this series" : ""}</small>
                      <Err text={errs[`side${i}`]} />
                    </div>
                    {s.locked
                      ? <span className="sr-locked"><IconLock size={14} />Locked</span>
                      : <button type="button" className="sr-x" aria-label={`Remove ${s.name}`} onClick={() => removeAt(i)}>×</button>}
                  </div>
                );
              }
              if (adding === i) {
                return (
                  <div key={`a${i}`} className="sr-slot adding">
                    <span className="sr-num" aria-hidden="true">{i + 1}</span>
                    <div className="sr-adder">
                      {free.length > 0 && (
                        <select className="field" aria-label={`Team ${i + 1}: choose a team`} value="" onChange={(e) => { const t = teams.find((x) => x.id === e.target.value); if (t) addSlot({ teamId: t.id, name: t.name, locked: false }); }}>
                          <option value="">Choose a team of this community…</option>
                          {free.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                      <div className="sr-typed">
                        <input ref={typedRef} className="field" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTyped(); } }} maxLength={60} placeholder="Or type a match-only name" aria-label={`Team ${i + 1}: match-only name`} autoComplete="off" />
                        <button type="button" className="btn gold small" onClick={commitTyped} disabled={!typed.trim()}>Add team</button>
                      </div>
                      <button type="button" className="sr-cancel" onClick={() => { setAdding(null); setTyped(""); }}>Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={`e${i}`} className="sr-slot empty">
                  <span className="sr-num" aria-hidden="true">{i + 1}</span>
                  <span className="sr-slot-t"><small>Team {i + 1}: pick a team or type a match-only name</small></span>
                  <button type="button" className="sr-add" onClick={() => { setAdding(i); setTyped(""); }} aria-label={`Add team ${i + 1}`}><IconPlus size={15} />Add</button>
                </div>
              );
            })}
            <Err text={errs.sides} />
            <p className="muted small sr-hint">Choose a team of this community or type a match-only name. Each team once.</p>
          </fieldset>
          {slots.map((s, i) => (
            <span key={`h${i}`} hidden>
              <input type="hidden" name={`side${i}Team`} value={s.teamId ?? ""} />
              <input type="hidden" name={`side${i}Name`} value={s.teamId ? "" : s.name} />
            </span>
          ))}

          <div className="sr-field">
            <span className="lb" id={`${uid}-fmt`}>Format</span>
            <div className="sr-segf" role="radiogroup" aria-labelledby={`${uid}-fmt`}>
              <button type="button" role="radio" aria-checked={format === "open"} className={format === "open" ? "on" : undefined} onClick={() => setFormat("open")}>Open-ended</button>
              <button type="button" role="radio" aria-checked={format === "best_of"} className={format === "best_of" ? "on" : undefined} onClick={() => setFormat("best_of")}>Best of a number</button>
            </div>
            <input type="hidden" name="format" value={format} />
            <Err text={errs.format} />
            {format === "open" ? <p className="muted small sr-hint">No fixed number of matches. Ranked on points.</p> : (
              <div className="sr-step">
                <button type="button" className="sr-stepbtn" aria-label="Fewer matches" onClick={() => setBestOf(String(clampBestOf((bestOk ? n : 3) - 1, BEST_OF_MIN, BEST_OF_MAX)))} disabled={bestOk && n <= BEST_OF_MIN}><IconMinus /></button>
                <input name="bestOf" inputMode="numeric" className={`field${errs.bestOf ? " bad" : ""}`} value={bestOf} onChange={(e) => { setBestOf(e.target.value.replace(/[^\d]/g, "").slice(0, 2)); setErrs((x) => ({ ...x, bestOf: "" })); }} aria-label={`Best of (${BEST_OF_MIN} to ${BEST_OF_MAX})`} maxLength={2} />
                <button type="button" className="sr-stepbtn" aria-label="More matches" onClick={() => setBestOf(String(clampBestOf((bestOk ? n : 3) + 1, BEST_OF_MIN, BEST_OF_MAX)))} disabled={bestOk && n >= BEST_OF_MAX}><IconPlus /></button>
                <span className="sr-steptext">matches ({BEST_OF_MIN} to {BEST_OF_MAX}){bestOk ? `: ${firstToText(n)}` : ""}</span>
              </div>
            )}
            <Err text={errs.bestOf} />
            <p className="muted small sr-hint">You can change the format later, for example from best of 3 to best of 5, and keep playing.</p>
          </div>

          <div className="two sr-dates">
            <div>
              <label className="lb" htmlFor={`${uid}-from`}>Starts (optional)</label>
              <input id={`${uid}-from`} type="date" name="startsOn" className={`field${errs.startsOn ? " bad" : ""}`} value={startsOn} onChange={(e) => { setStartsOn(e.target.value); setErrs((x) => ({ ...x, startsOn: "", endsOn: "" })); }} />
              <Err text={errs.startsOn} />
            </div>
            <div>
              <label className="lb" htmlFor={`${uid}-to`}>Ends (optional)</label>
              <input id={`${uid}-to`} type="date" name="endsOn" className={`field${errs.endsOn ? " bad" : ""}`} value={endsOn} onChange={(e) => { setEndsOn(e.target.value); setErrs((x) => ({ ...x, endsOn: "" })); }} />
              <Err text={errs.endsOn} />
            </div>
          </div>
          <p className="muted small sr-hint">The dates are shown on the series page. They do not stop a match from being added. The end cannot be before the start.</p>

          <label className="lb" htmlFor={`${uid}-notes`}>Notes (optional)</label>
          <div className="sr-count-wrap">
            <textarea id={`${uid}-notes`} name="notes" className={`field${errs.notes ? " bad" : ""}`} value={notes} onChange={(e) => { setNotes(e.target.value); setErrs((x) => ({ ...x, notes: "" })); }} maxLength={SERIES_NOTES_MAX + 50} placeholder="Prize, rules, anything to remember" />
            <span className="sr-count" aria-hidden="true">{notes.length}/{SERIES_NOTES_MAX}</span>
          </div>
          <Err text={errs.notes} />
        </section>

        {mode === "edit" && (
          <div className="sr-note" role="note">
            <IconInfo />
            <span><b>A team with matches stays.</b> A team that already has matches in this series cannot be taken out{lockedNames.length ? ` (${lockedNames.join(", ")})` : ""}. Changing the format never changes the record.</span>
          </div>
        )}

        <div className="sr-actions">
          <Link href={mode === "edit" && seriesId ? `/c/${communityId}/series/${seriesId}` : `/c/${communityId}/series`} className="btn ghost sr-cancelbtn">Cancel</Link>
          <button className="btn gold" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create series" : "Save changes"}</button>
        </div>
      </form>
      <SeriesPreview name={name} slots={slots} format={format} bestOf={format === "best_of" && bestOk ? n : null} />
    </div></div>
  );
}
