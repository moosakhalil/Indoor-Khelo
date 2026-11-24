"use client";
// Plan several matches, the proposed design: team picker cards, a stepper for players per side, compact match rows
// (a card on a phone, a table row from 1024 px), Duplicate and Remove on any row, "Repeat last, +7 days", and a live summary.
// It posts to the SAME server action with the SAME field names as the old SeveralForm (createSeveralAction).
import "./sv.css";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createSeveralAction } from "@/app/actions4";
import type { FormState } from "@/app/actions";
import TeamBadge from "@/components/TeamBadge";
import { SvBell, SvChevron, SvCopy, SvInfo, SvPlus, SvRepeat, SvSwap, SvTrash, SvWarn, SvCheck, SvMinus } from "@/components/C2Icons";
import { SvBanner, SvErr, TzField } from "@/components/SvBits";
import { OVERS_PRESETS, PLAYERS_DEFAULT, PLAYERS_MAX, PLAYERS_MIN, SEVERAL_MAX, VENUE_MAX } from "@/lib/matchRules";
import {
  ALERT_NOTE, LIMIT_HINT, attentionText, createLabel, duplicateAt, fmtLocal, matchesWord, newRow, playersError, removeAt, repeatLast, severalBanner, stepPlayers,
  type SevRow,
} from "@/lib/c2";
import type { PickTeam } from "@/lib/c2Data";

const initial: FormState = {};

export type Side = { teamId: string; own: boolean; name: string };
const EMPTY: Side = { teamId: "", own: false, name: "" };

const teamLine = (t: PickTeam) => `${t.squad} player${t.squad === 1 ? "" : "s"} · ${t.captain ? `Captain ${t.captain}` : "No captain yet"}`;

/** Runs a media query in the browser (false while rendering on the server and in tests without matchMedia). */
function useMedia(query: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [query]);
  return on;
}

/* ---------- one side: radio list of teams, then a collapsed card with Change ---------- */
function SidePicker({ label, side, onChange, teams, error, blocked, disabled }: {
  label: string; side: Side; onChange: (s: Side) => void; teams: PickTeam[]; error?: string; blocked?: boolean; disabled?: boolean;
}) {
  const chosen = !!side.teamId || side.own;
  const [changing, setChanging] = useState(false);
  const team = teams.find((t) => t.id === side.teamId) ?? null;
  const errId = useId();
  const pick = (s: Side) => { onChange(s); setChanging(false); };

  if (!chosen && blocked) {
    return (
      <div className="sv-side">
        <h3 className="sv-sidelabel">{label}</h3>
        <div className="sv-team sv-blocked" aria-disabled="true">
          <span className="sv-qbadge" aria-hidden="true">?</span>
          <span className="sv-tt"><b>Choose {label}</b><small>Pick Team 1 first</small></span>
          <SvChevron size={18} />
        </div>
      </div>
    );
  }
  if (chosen && !changing) {
    return (
      <div className="sv-side">
        <div className="sv-sidehead">
          <h3 className="sv-sidelabel">{label}</h3>
          <button type="button" className="sv-link" disabled={disabled} onClick={() => setChanging(true)} aria-label={`Change ${label}`}><SvSwap size={14} /> Change</button>
        </div>
        {team ? (
          <div className={`sv-team on${team.mine ? " mine" : ""}`}>
            <TeamBadge name={team.name} size="md" />
            <span className="sv-tt"><b>{team.name}</b><small>{teamLine(team)}</small></span>
            <span className="sv-dot on" aria-label="Chosen" role="img"><SvCheck size={14} /></span>
          </div>
        ) : (
          <div className="sv-team on sv-own">
            <TeamBadge name={side.name.trim() || "?"} size="md" />
            <span className="sv-tt">
              <input className={`field sv-ownname${error ? " bad" : ""}`} value={side.name} onChange={(e) => onChange({ ...side, name: e.target.value })} maxLength={40} autoComplete="off"
                placeholder="Match-only team name" aria-label={`${label}: match-only team name`} aria-invalid={!!error} aria-describedby={error ? errId : undefined} disabled={disabled} />
              <small>Match-only team. Not saved as a team.</small>
            </span>
          </div>
        )}
        <SvErr text={error} id={errId} />
      </div>
    );
  }
  return (
    <div className="sv-side">
      <div className="sv-sidehead">
        <h3 className="sv-sidelabel" id={`${errId}-l`}>{label}</h3>
        {changing && <button type="button" className="sv-link" onClick={() => setChanging(false)}>Cancel</button>}
      </div>
      <div role="radiogroup" aria-labelledby={`${errId}-l`} className="sv-teams">
        {teams.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={side.teamId === t.id} disabled={disabled} className={`sv-team${t.mine ? " mine" : ""}`} onClick={() => pick({ teamId: t.id, own: false, name: "" })}>
            <TeamBadge name={t.name} size="md" />
            <span className="sv-tt"><b>{t.name}</b><small>{teamLine(t)}</small></span>
            <span className="sv-dot" aria-hidden="true" />
          </button>
        ))}
        <button type="button" role="radio" aria-checked={side.own} disabled={disabled} className="sv-team" onClick={() => pick({ teamId: "", own: true, name: side.name })}>
          <span className="sv-qbadge plus" aria-hidden="true">+</span>
          <span className="sv-tt"><b>Match-only team</b><small>Type a name. Not saved as a team.</small></span>
          <span className="sv-dot" aria-hidden="true" />
        </button>
      </div>
      <SvErr text={error} id={errId} />
    </div>
  );
}

/* ---------- one match: a card on a phone, a table row on a desktop ---------- */
function MatchRow({ row, index, total, errors, onChange, onDuplicate, onRemove, canAdd, disabled }: {
  row: SevRow; index: number; total: number; errors: { when?: string; venue?: string; overs?: string };
  onChange: (patch: Partial<SevRow>, clear: "when" | "venue" | "overs") => void; onDuplicate: () => void; onRemove: () => void; canAdd: boolean; disabled: boolean;
}) {
  const n = index + 1;
  const i = index;
  return (
    <article className="sv-row" aria-label={`Match ${n}`}>
      <div className="sv-rowhead">
        <span className="sv-num" aria-hidden="true">{n}</span>
        <h3>Match {n}</h3>
        <span className="sv-rowact">
          <button type="button" className="sv-icbtn" onClick={onDuplicate} disabled={!canAdd || disabled} aria-label={`Duplicate match ${n}`}><SvCopy size={18} /></button>
          <button type="button" className="sv-icbtn" onClick={onRemove} disabled={total <= 1 || disabled} aria-label={`Remove match ${n}`}><SvTrash size={18} /></button>
        </span>
      </div>
      <div className="sv-cell sv-c-when">
        <label className="sv-fl" htmlFor={`when_${i}`}>Date and time <span className="sv-req">required</span></label>
        <input id={`when_${i}`} type="datetime-local" name={`when_${i}`} className={`field${errors.when ? " bad" : ""}`} value={row.when} aria-invalid={!!errors.when}
          onChange={(e) => onChange({ when: e.target.value }, "when")} />
        <SvErr text={errors.when} />
      </div>
      <div className="sv-cell sv-c-venue">
        <label className="sv-fl" htmlFor={`venue_${i}`}>Venue (optional)</label>
        <input id={`venue_${i}`} name={`venue_${i}`} className={`field${errors.venue ? " bad" : ""}`} value={row.venue} maxLength={VENUE_MAX + 40} placeholder="Hall name or place" aria-invalid={!!errors.venue}
          onChange={(e) => onChange({ venue: e.target.value }, "venue")} />
        <SvErr text={errors.venue} />
      </div>
      <div className="sv-cell sv-c-overs">
        <label className="sv-fl" htmlFor={`overs_${i}`}>Overs per innings</label>
        <div className="sv-oversrow">
          <select id={`overs_${i}`} name={`oversPreset_${i}`} className={`field${errors.overs ? " bad" : ""}`} value={row.preset} aria-invalid={!!errors.overs}
            onChange={(e) => onChange({ preset: e.target.value }, "overs")}>
            {OVERS_PRESETS.map((o) => <option key={o} value={o}>{o} overs</option>)}
            <option value="custom">Custom</option>
          </select>
          {row.preset === "custom" && (
            <input name={`oversCustom_${i}`} inputMode="numeric" maxLength={2} className={`field${errors.overs ? " bad" : ""}`} value={row.custom} placeholder="Overs"
              aria-label={`Custom overs for match ${n}`} onChange={(e) => onChange({ custom: e.target.value }, "overs")} />
          )}
        </div>
        <SvErr text={errors.overs} />
      </div>
    </article>
  );
}

/* ---------- the recap ---------- */
function Summary({ a, b, teams, rows, pp, pending, errCount, formId, serverFlag }: {
  a: Side; b: Side; teams: PickTeam[]; rows: SevRow[]; pp: string; pending: boolean; errCount: number; formId: string; serverFlag: boolean;
}) {
  const nameOf = (s: Side, fallback: string) => (s.teamId ? teams.find((t) => t.id === s.teamId)?.name : s.own ? s.name.trim() : "") || fallback;
  const mineOf = (s: Side) => !!s.teamId && !!teams.find((t) => t.id === s.teamId)?.mine;
  const n1 = nameOf(a, "Team 1");
  const n2 = nameOf(b, "Team 2");
  const badge = (nm: string, mine: boolean) => (
    <span className={mine ? "sv-mine" : undefined}>{nm === "Team 1" || nm === "Team 2" ? <span className="sv-qbadge lg" aria-hidden="true">?</span> : <TeamBadge name={nm} size="lg" />}</span>
  );
  return (
    <section className="sv-sum" aria-label="Summary">
      <div className="sv-vs">
        {badge(n1, mineOf(a))}<span className="sv-v" aria-hidden="true">v</span>{badge(n2, mineOf(b))}
      </div>
      <h3 className="sv-sumtitle">{n1} v {n2}</h3>
      <p className="sv-sumsub">{rows.length} separate match{rows.length === 1 ? "" : "es"}, {pp.trim() || "?"} players a side</p>
      <ul className="sv-sumlist">
        {rows.map((r, i) => (
          <li key={r.id}><span>Match {i + 1}</span><b>{fmtLocal(r.when) || "No date yet"}</b></li>
        ))}
      </ul>
      <p className="sv-note green"><SvBell size={16} /><span>{ALERT_NOTE}</span></p>
      {serverFlag && errCount > 0 && (
        <div className="sv-banner red" role="alert"><SvWarn size={18} /><div><b>Please fix the highlighted fields.</b><span>{attentionText(errCount)}</span></div></div>
      )}
      <button type="submit" form={formId} className="btn gold sv-go" disabled={pending}>{pending ? "Creating…" : createLabel(rows.length)}</button>
    </section>
  );
}

export default function SeveralPlan({ communityId, teams, panelId = "sv-panel" }: { communityId: string; teams: PickTeam[]; panelId?: string }) {
  const [state, action, pending] = useActionState(createSeveralAction, initial);
  const [a, setA] = useState<Side>(EMPTY);
  const [b, setB] = useState<Side>(EMPTY);
  const [pp, setPp] = useState(String(PLAYERS_DEFAULT));
  const [rows, setRows] = useState<SevRow[]>(() => [0, 1, 2].map((i) => newRow(`r${i}`)));
  const idSeq = useRef(3);
  const [sent, setSent] = useState<string[]>([]);
  const [cleared, setCleared] = useState<{ state: FormState; keys: string[] }>({ state: initial, keys: [] });
  const formId = useId();
  const root = useRef<HTMLDivElement>(null);
  const wide = useMedia("(min-width: 1360px)");
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(wide ? document.getElementById(panelId) : null); }, [wide, panelId]);

  const fe = state.fieldErrors ?? {};
  const isCleared = (k: string) => cleared.state === state && cleared.keys.includes(k);
  const clear = (k: string) => setCleared((c) => ({ state, keys: c.state === state ? [...c.keys, k] : [k] }));

  // What is still wrong, as the person sees it: the server numbers rows by the order they were sent.
  const vis: Record<string, string> = {};
  for (const k of ["sideA", "sideB"] as const) if (fe[k] && !isCleared(k)) vis[k] = fe[k]!;
  const pe = playersError(fe);
  if (pe && !isCleared("pp")) vis.pp = pe;
  const rowErr = (r: SevRow) => {
    const i = sent.indexOf(r.id);
    const out: { when?: string; venue?: string; overs?: string } = {};
    if (i < 0) return out;
    for (const f of ["when", "venue", "overs"] as const) {
      const m = fe[`${f}_${i}`];
      if (m && !isCleared(`${r.id}.${f}`)) { out[f] = m; vis[`${r.id}.${f}`] = m; }
    }
    return out;
  };
  const rowErrors = rows.map(rowErr);
  const errCount = Object.keys(vis).length;
  const serverFlag = state.error === "Please fix the highlighted fields.";
  const banner = severalBanner(state.error);

  useEffect(() => {
    if (!state.error) return;
    const t = requestAnimationFrame(() => {
      const el = root.current?.querySelector<HTMLElement>("[data-sv-err]");
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(t);
  }, [state]);

  const nextId = () => `r${idSeq.current++}`;
  const canAdd = rows.length < SEVERAL_MAX;
  const patchRow = (id: string, patch: Partial<SevRow>, field: "when" | "venue" | "overs") => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    clear(`${id}.${field}`);
  };
  const swap = () => { setA(b); setB(a); };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    setSent(rows.map((r) => r.id));
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };

  const sum = <Summary a={a} b={b} teams={teams} rows={rows} pp={pp} pending={pending} errCount={errCount} formId={formId} serverFlag={serverFlag} />;
  const atMax = rows.length >= SEVERAL_MAX;

  return (
    <div className="sv" ref={root}>
      <form id={formId} onSubmit={submit} noValidate>
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="count" value={rows.length} />
        <input type="hidden" name="sideATeam" value={a.teamId} />
        <input type="hidden" name="sideAName" value={a.own ? a.name : ""} />
        <input type="hidden" name="sideBTeam" value={b.teamId} />
        <input type="hidden" name="sideBName" value={b.own ? b.name : ""} />
        <TzField />
        <fieldset className="sv-fs" disabled={pending}>
          {banner && <SvBanner banner={banner} />}

          <section className="sv-card" aria-labelledby={`${formId}-tp`}>
            <h2 id={`${formId}-tp`} className="sv-h">Teams and players</h2>
            <SidePicker label="Team 1" side={a} onChange={(s) => { setA(s); clear("sideA"); }} teams={teams} error={vis.sideA} disabled={pending} />
            {(a.teamId || a.own || b.teamId || b.own) && (
              <div className="sv-swaprow"><button type="button" className="btn ghost small sv-swap" onClick={swap}><SvSwap /> Swap teams</button></div>
            )}
            <SidePicker label="Team 2" side={b} onChange={(s) => { setB(s); clear("sideB"); }} teams={teams} error={vis.sideB} blocked={!(a.teamId || a.own)} disabled={pending} />

            <div className="sv-pps">
              <label className="sv-fl" htmlFor={`${formId}-pp`}>Players per side</label>
              <div className="sv-step">
                <button type="button" className="sv-stepbtn" onClick={() => { setPp((v) => stepPlayers(v, -1)); clear("pp"); }} aria-label="Fewer players per side"><SvMinus /></button>
                <input id={`${formId}-pp`} name="playersPerSide" inputMode="numeric" maxLength={2} value={pp} className={`sv-ppin${vis.pp ? " bad" : ""}`} aria-invalid={!!vis.pp}
                  aria-describedby={`${formId}-pph`} onChange={(e) => { setPp(e.target.value); clear("pp"); }} />
                <button type="button" className="sv-stepbtn" onClick={() => { setPp((v) => stepPlayers(v, 1)); clear("pp"); }} aria-label="More players per side"><SvPlus /></button>
                <span className="sv-unit">players</span>
              </div>
              <p id={`${formId}-pph`} className="sv-help">From {PLAYERS_MIN} to {PLAYERS_MAX}. Applies to every match below. Lineups are picked per match.</p>
              <SvErr text={vis.pp} />
            </div>
          </section>

          <section className="sv-card" aria-labelledby={`${formId}-ml`}>
            <h2 id={`${formId}-ml`} className="sv-h">Matches <span className={`sv-count${atMax ? " max" : ""}`}>{rows.length} of {SEVERAL_MAX}</span></h2>
            <p className="sv-help">Each match is separate, with its own date, time, venue and overs. Rules start as traditional and can be changed per match afterwards.</p>
            <div className="sv-thead" aria-hidden="true"><span /><span>Date and time</span><span>Venue</span><span>Overs</span><span /></div>
            <div className="sv-rows">
              {rows.map((r, i) => (
                <MatchRow key={r.id} row={r} index={i} total={rows.length} errors={rowErrors[i]!} canAdd={canAdd} disabled={pending}
                  onChange={(patch, field) => patchRow(r.id, patch, field)}
                  onDuplicate={() => setRows((rs) => duplicateAt(rs, i, nextId()))}
                  onRemove={() => setRows((rs) => removeAt(rs, i))} />
              ))}
            </div>
            <div className="sv-adds">
              <button type="button" className="btn ghost small sv-add" disabled={atMax} onClick={() => setRows((rs) => (rs.length >= SEVERAL_MAX ? rs : [...rs, newRow(nextId())]))}><SvPlus /> Add another match</button>
              <button type="button" className="btn ghost small" disabled={atMax} onClick={() => setRows((rs) => repeatLast(rs, nextId()))}><SvRepeat /> Repeat last, +7 days</button>
            </div>
            {atMax && <p className="sv-limit"><SvInfo size={16} /><span>{LIMIT_HINT}</span></p>}
          </section>

          {!(wide && slot) && <div className="sv-inline">{sum}</div>}

          <div className="sv-sticky">
            {errCount > 0 && serverFlag && <p className="sv-stickyerr"><SvWarn size={14} /> {attentionText(errCount)}</p>}
            <button type="submit" className="btn gold" disabled={pending}>{pending ? "Creating…" : createLabel(rows.length)}</button>
          </div>
        </fieldset>
      </form>
      {wide && slot && createPortal(<div className="sv-panelbox">{sum}</div>, slot)}
      <span className="sv-sr" aria-live="polite">{matchesWord(rows.length)} in the plan.</span>
    </div>
  );
}
