"use client";
// Phase C (UI redesign), Builder C1: the controls shared by the Create match wizard and the Edit match page.
// Every control is a plain, controlled field; the parent holds the values (see lib/crSetup.ts) and posts them under the
// same field names the old form used.
import { useEffect, useRef, useState } from "react";
import { IconBell, IconMinus, IconPin, IconReset, IconSwap, IconTeams, IconWhistle } from "@/components/CrIcons";
import { IconCalendar, IconCheck, IconCross, IconLock, IconPlus, IconWarn } from "@/components/B4Icons";
import TeamBadge from "@/components/TeamBadge";
import {
  DISMISSALS, OVERS_PRESETS, PLAYERS_MAX, PLAYERS_MIN, SIDE_NAME_MAX, SUPER_OVER_MODES, UMPIRE_MAX, NOTES_MAX, VENUE_MAX,
  OVERS_MAX,
} from "@/lib/matchRules";
import {
  FLAGS, changeCount, limitFloor, oversOf, patternBowlers, playersOf, quickDates, setupWarning, type LimitMode, type SetupValues,
} from "@/lib/crSetup";
import { leadersText } from "@/lib/teamList";

export type Errs = Record<string, string | undefined>;
export type SetFn = (patch: Partial<SetupValues>) => void;
export type TeamOpt = { id: string; name: string; captain: string | null; vice: string | null; squad: number; mine: boolean };

/* ---------- small pieces ---------- */

export function ErrLine({ text, id }: { text?: string; id?: string }) {
  if (!text) return null;
  return <p className="cr-err" role="alert" id={id}><IconWarn size={16} /><span>{text}</span></p>;
}

export function Count({ n, max }: { n: number; max: number }) {
  return <span className={`cr-count${n > max ? " over" : ""}`} aria-label={`${n} of ${max} characters`}>{n}/{max}</span>;
}

/** A group of real radio buttons drawn as chips, a segmented bar or cards. */
export function Choice<T extends string>({ name, label, value, options, onChange, variant = "chips" }: {
  name: string; label: string; value: T; options: { value: T; label: string; sub?: string }[]; onChange: (v: T) => void; variant?: "chips" | "seg" | "cards";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`cr-choice ${variant}`}>
      {options.map((o) => (
        <label key={o.value} className={value === o.value ? "on" : ""}>
          <input type="radio" className="cr-sr" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className="cr-ctl">{variant === "cards" && <span className="cr-dot" aria-hidden="true" />}<span><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span></span>
        </label>
      ))}
    </div>
  );
}

/** A number with minus and plus buttons. The number can still be typed, so a wrong one shows the real message. */
export function Stepper({ id, label, value, onChange, min, max, unit, error, hint, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; min: number; max: number; unit?: string; error?: string; hint?: React.ReactNode; placeholder?: string;
}) {
  const n = /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : null;
  const clamp = (x: number) => Math.min(max, Math.max(min, x));
  return (
    <div className="cr-stepper-wrap">
      <div className={`cr-stepper${error ? " bad" : ""}`}>
        <button type="button" className="cr-sb" aria-label={`Fewer: ${label}`} onClick={() => onChange(String(n === null ? min : clamp(n - 1)))} disabled={n !== null && n <= min}><IconMinus /></button>
        <input id={id} className="cr-num" inputMode="numeric" value={value} placeholder={placeholder ?? "–"} maxLength={3} autoComplete="off" aria-label={label} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="cr-sb" aria-label={`More: ${label}`} onClick={() => onChange(String(n === null ? min : clamp(n + 1)))} disabled={n !== null && n >= max}><IconPlus size={20} /></button>
        {unit && <span className="cr-unit">{unit}</span>}
      </div>
      {hint && <p className="cr-hint">{hint}</p>}
      <ErrLine text={error} />
    </div>
  );
}

function IconField({ id, icon, label, value, onChange, max, placeholder, error, hintId }: {
  id: string; icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; max: number; placeholder: string; error?: string; hintId?: string;
}) {
  return (
    <>
      <div className={`cr-if${error ? " bad" : ""}`}>
        <span className="cr-ifi">{icon}</span>
        <input id={id} className="cr-input" value={value} placeholder={placeholder} autoComplete="off" aria-invalid={!!error} aria-describedby={hintId} onChange={(e) => onChange(e.target.value)} />
        <Count n={value.length} max={max} />
      </div>
      <ErrLine text={error} />
    </>
  );
}

/* ---------- step 1: the two sides ---------- */

function TeamRow({ t, selected, bad, onPick }: { t: TeamOpt; selected?: boolean; bad?: boolean; onPick?: () => void }) {
  const inner = (
    <>
      <span className={t.mine ? "cr-mine" : undefined}><TeamBadge name={t.name} size="md" label={t.mine ? `Team ${t.name}, your team` : undefined} /></span>
      <span className="cr-tx"><b>{t.name}</b><small>{t.squad} player{t.squad === 1 ? "" : "s"} · {leadersText(t)}</small></span>
      <span className={`cr-radio${selected ? " on" : ""}`} aria-hidden="true" />
    </>
  );
  if (selected) return <div className={`cr-team sel${bad ? " bad" : ""}`}>{inner}</div>;
  return <button type="button" className={`cr-team${bad ? " bad" : ""}`} onClick={onPick}>{inner}</button>;
}

function SidePick({ side, label, v, set, teams, error, locked, other }: {
  side: "A" | "B"; label: string; v: SetupValues; set: SetFn; teams: TeamOpt[]; error?: string; locked?: boolean; other: { mode: string; team: string };
}) {
  const mode = side === "A" ? v.modeA : v.modeB;
  const team = side === "A" ? v.teamA : v.teamB;
  const name = side === "A" ? v.nameA : v.nameB;
  const patch = (m: SetupValues["modeA"], t: string, n: string): Partial<SetupValues> => (side === "A" ? { modeA: m, teamA: t, nameA: n } : { modeB: m, teamB: t, nameB: n });
  const chosen = teams.find((t) => t.id === team);
  const dup = mode === "team" && other.mode === "team" && other.team === team;
  const nameRef = useRef<HTMLInputElement>(null);
  const prev = useRef(mode);
  useEffect(() => { if (prev.current !== "own" && mode === "own") nameRef.current?.focus(); prev.current = mode; }, [mode]);
  return (
    <section className={`cr-side${error ? " bad" : ""}`} aria-label={label}>
      <div className="cr-sidehead">
        <h3>{label}</h3>
        {mode === "team" && <button type="button" className="cr-mini" onClick={() => set(patch("none", "", ""))}><IconSwap size={16} /> Change</button>}
        {mode === "own" && <button type="button" className="cr-mini" onClick={() => set(patch("none", "", ""))}><IconTeams size={16} /> Use a community team</button>}
      </div>
      {locked ? (
        <div className="cr-team wait" aria-disabled="true">
          <span className="cr-q" aria-hidden="true">?</span>
          <span className="cr-tx"><b>Choose {label}</b><small>Pick Team 1 first</small></span>
        </div>
      ) : mode === "none" ? (
        <div className="cr-list" role="group" aria-label={`Choose ${label}`}>
          {teams.map((t) => <TeamRow key={t.id} t={t} onPick={() => set(patch("team", t.id, ""))} />)}
          <button type="button" className="cr-team own" onClick={() => set(patch("own", "", name))}>
            <span className="cr-q plus" aria-hidden="true">+</span>
            <span className="cr-tx"><b>Match-only team</b><small>Type a name. Not saved as a team.</small></span>
            <span className="cr-radio" aria-hidden="true" />
          </button>
        </div>
      ) : mode === "team" && chosen ? (
        <TeamRow t={chosen} selected bad={dup || !!error} />
      ) : (
        <div className={`cr-own-edit${error ? " bad" : ""}`}>
          <TeamBadge name={name.trim() || "?"} size="sm" label="Badge preview" />
          <input ref={nameRef} id={`cr-name-${side}`} className="cr-input" value={name} placeholder="Team name" autoComplete="off" aria-label={`${label}: match-only team name`} aria-invalid={!!error}
            onChange={(e) => set(patch("own", "", e.target.value))} />
          <Count n={name.length} max={SIDE_NAME_MAX} />
        </div>
      )}
      {mode === "own" && <p className="cr-hint">Match-only teams are not saved as community teams. Stats still count for the players.</p>}
      <ErrLine text={error} />
    </section>
  );
}

export function TeamsSection({ v, set, teams, errors }: { v: SetupValues; set: SetFn; teams: TeamOpt[]; errors: Errs }) {
  const swap = () => set({ modeA: v.modeB, teamA: v.teamB, nameA: v.nameB, modeB: v.modeA, teamB: v.teamA, nameB: v.nameA });
  const lockB = v.modeA === "none" && v.modeB === "none" && !errors.sideB;
  return (
    <>
      <SidePick side="A" label="Team 1" v={v} set={set} teams={teams} error={errors.sideA} other={{ mode: v.modeB, team: v.teamB }} />
      <div className="cr-swapwrap">
        <button type="button" className="cr-mini" onClick={swap} disabled={v.modeA === "none" && v.modeB === "none"}><IconSwap size={16} /> Swap teams</button>
      </div>
      <SidePick side="B" label="Team 2" v={v} set={set} teams={teams} error={errors.sideB} locked={lockB} other={{ mode: v.modeA, team: v.teamA }} />
    </>
  );
}

/* ---------- step 2: the format ---------- */

export function FormatSection({ v, set, errors, mode, status, recentVenues, lastWhen, minPlayers, minPlayersWhy }: {
  v: SetupValues; set: SetFn; errors: Errs; mode: "create" | "edit"; status?: string; recentVenues: string[]; lastWhen: string | null; minPlayers?: number; minPlayersWhy?: React.ReactNode;
}) {
  const [quick, setQuick] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => { setQuick(quickDates(new Date(), lastWhen)); }, [lastWhen]);
  const dateHint = mode === "create" ? "Leave empty to save as a draft. Nobody is told until the match has a date."
    : status === "scheduled" ? "Clearing the date turns a scheduled match back into a draft."
    : status === "postponed" ? "Choose a date to schedule it again. Leave empty to keep it postponed."
    : "Leave empty to keep it as a draft. Nobody is told until the match has a date.";
  const floor = Math.max(PLAYERS_MIN, minPlayers ?? PLAYERS_MIN);
  return (
    <>
      <label className="lb" htmlFor="cr-when">Date and time</label>
      <div className={`cr-if date${errors.when ? " bad" : ""}`}>
        <span className="cr-ifi"><IconCalendar size={18} /></span>
        <input id="cr-when" type="datetime-local" className="cr-input" value={v.when} aria-invalid={!!errors.when} aria-describedby="cr-when-h" onChange={(e) => set({ when: e.target.value })} />
      </div>
      <p className="cr-hint" id="cr-when-h">{dateHint}</p>
      <ErrLine text={errors.when} />
      {quick.length > 0 && (
        <div className="cr-quick" role="group" aria-label="Quick dates">
          {quick.map((q) => <button key={q.value} type="button" className={`cr-qchip${v.when === q.value ? " on" : ""}`} onClick={() => set({ when: q.value })}>{q.label}</button>)}
        </div>
      )}

      <label className="lb" htmlFor="cr-venue">Venue (optional)</label>
      <IconField id="cr-venue" icon={<IconPin />} label="Venue" value={v.venue} max={VENUE_MAX} placeholder="Hall name or place" error={errors.venue} onChange={(x) => set({ venue: x })} />
      {recentVenues.filter((x) => x !== v.venue.trim()).length > 0 && (
        <div className="cr-quick" role="group" aria-label="Recent venues">
          {recentVenues.filter((x) => x !== v.venue.trim()).map((x) => <button key={x} type="button" className="cr-qchip" onClick={() => set({ venue: x })}><IconPin size={14} /> {x}</button>)}
        </div>
      )}

      <label className="lb" id="cr-overs-l">Overs per innings</label>
      <Choice name="cr-overs" label="Overs per innings" variant="chips" value={v.oversPreset}
        options={[...OVERS_PRESETS.map((o) => ({ value: String(o), label: String(o) })), { value: "custom", label: "Custom" }]}
        onChange={(x) => set({ oversPreset: x })} />
      {v.oversPreset === "custom" && (
        <div className={`cr-custom${errors.overs ? " bad" : ""}`}>
          <input id="cr-overs-custom" className="cr-input" inputMode="numeric" maxLength={2} value={v.oversCustom} placeholder="Custom overs" autoComplete="off" aria-label="Custom overs" aria-invalid={!!errors.overs}
            onChange={(e) => set({ oversCustom: e.target.value })} />
          <span className="cr-unit">overs</span>
        </div>
      )}
      <ErrLine text={errors.overs} />

      <label className="lb" htmlFor="cr-pp">Players per side</label>
      <Stepper id="cr-pp" label="Players per side" value={v.playersPerSide} onChange={(x) => set({ playersPerSide: x })} min={floor} max={PLAYERS_MAX} unit="players" error={errors.playersPerSide}
        hint={<>From {PLAYERS_MIN} to {PLAYERS_MAX}. Six by default.{minPlayers && minPlayers > PLAYERS_MIN ? <> {minPlayersWhy}</> : null}</>} />

      <label className="lb" htmlFor="cr-ump">Umpire (optional)</label>
      <IconField id="cr-ump" icon={<IconWhistle />} label="Umpire" value={v.umpire} max={UMPIRE_MAX} placeholder="A name, for the scorecard only" error={errors.umpire} hintId="cr-ump-h" onChange={(x) => set({ umpire: x })} />
      <p className="cr-hint" id="cr-ump-h">A label only. Any member of the community can score the match.</p>

      <label className="lb" htmlFor="cr-notes">Notes (optional)</label>
      <div className={`cr-notes${errors.notes ? " bad" : ""}`}>
        <textarea id="cr-notes" className="cr-input" value={v.notes} placeholder="Anything people should know" aria-invalid={!!errors.notes} onChange={(e) => set({ notes: e.target.value })} />
        <Count n={v.notes.length} max={NOTES_MAX} />
      </div>
      <ErrLine text={errors.notes} />
      {mode === "create" && <p className="cr-hint">You can pick the lineups now, later, or on match day. A match can exist with no lineup at all.</p>}
    </>
  );
}

/* ---------- step 3: the rules ---------- */

function SwitchRow({ f, on, onChange }: { f: (typeof FLAGS)[number]; on: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="switch cr-sw">
      <span><b>{f.label}</b>{f.hint && <small className="muted">{f.hint}</small>}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
    </label>
  );
}

const LIMIT_OPTIONS: { value: LimitMode; label: string }[] = [
  { value: "none", label: "No limit" }, { value: "max", label: "Max per bowler" }, { value: "pattern", label: "Pattern" },
];

export function RulesSection({ v, set, errors, onReset }: { v: SetupValues; set: SetFn; errors: Errs; onReset: () => void }) {
  const n = changeCount(v);
  const overs = oversOf(v);
  const players = playersOf(v);
  const warn = setupWarning(v);
  const bowlers = patternBowlers(v);
  const flagGroup = (g: "extras" | "batbowl") => FLAGS.filter((f) => f.group === g).map((f) => (
    <SwitchRow key={f.key} f={f} on={v.flags[f.key]} onChange={(b) => set({ flags: { ...v.flags, [f.key]: b } })} />
  ));
  const toggleDismissal = (d: string) => set({ dismissals: v.dismissals.includes(d) ? v.dismissals.filter((x) => x !== d) : [...v.dismissals, d] });
  return (
    <>
      <p className="cr-hint first">Traditional indoor rules. Saved with this match only; changing them later never changes old matches.</p>
      <div className="cr-badges">
        <span className={`cr-pill ${n === 0 ? "green" : "orange"}`}>{n === 0 ? "Traditional rules" : `${n} change${n === 1 ? "" : "s"} from traditional`}</span>
        <button type="button" className="cr-mini" onClick={onReset} disabled={n === 0}><IconReset size={16} /> Reset to traditional</button>
      </div>

      <h4 className="cr-gh">Innings per team</h4>
      <Choice name="cr-innings" label="Innings per team" variant="seg" value={v.innings} onChange={(x) => set({ innings: x })}
        options={[{ value: "2", label: "Each team bats once" }, { value: "1", label: "One innings" }]} />
      <ErrLine text={errors.innings} />

      <h4 className="cr-gh"><label htmlFor="cr-bpo">Balls per over</label></h4>
      <Stepper id="cr-bpo" label="Balls per over" value={v.ballsPerOver} onChange={(x) => set({ ballsPerOver: x })} min={1} max={12} unit="balls" error={errors.ballsPerOver} hint="1 to 12. Six is traditional." />
      <h4 className="cr-gh"><label htmlFor="cr-wide">Wide runs</label></h4>
      <Stepper id="cr-wide" label="Wide runs" value={v.wideRuns} onChange={(x) => set({ wideRuns: x })} min={0} max={5} unit="run" error={errors.wideRuns} hint="0 to 5." />
      <h4 className="cr-gh"><label htmlFor="cr-nb">No-ball runs</label></h4>
      <Stepper id="cr-nb" label="No-ball runs" value={v.noBallRuns} onChange={(x) => set({ noBallRuns: x })} min={0} max={5} unit="run" error={errors.noBallRuns} hint="0 to 5." />

      <h4 className="cr-gh">Extras</h4>
      <div className="cr-switches">{flagGroup("extras")}</div>
      <h4 className="cr-gh">Batting and bowling</h4>
      <div className="cr-switches">{flagGroup("batbowl")}</div>

      <h4 className="cr-gh">Bowler over limit</h4>
      <Choice name="cr-limit" label="Bowler over limit" variant="seg" value={v.limitMode} onChange={(x) => set({ limitMode: x })} options={LIMIT_OPTIONS} />
      {v.limitMode === "max" && (
        <>
          <label className="lb" htmlFor="cr-lmax">Maximum overs per bowler</label>
          <Stepper id="cr-lmax" label="Maximum overs per bowler" value={v.limitMax} onChange={(x) => set({ limitMax: x })} min={1} max={overs ?? OVERS_MAX} unit="overs" error={errors.limitMax}
            hint={overs !== null && players !== null ? `At least ${limitFloor(overs, players)} over${limitFloor(overs, players) === 1 ? "" : "s"} each, so ${players} players can finish a ${overs}-over innings. Never more than ${overs}.` : undefined} />
        </>
      )}
      {v.limitMode === "pattern" && (
        <>
          <label className="lb" htmlFor="cr-lpat">Over pattern</label>
          <input id="cr-lpat" className={`field cr-pat${errors.limitPattern ? " bad" : ""}`} value={v.limitPattern} placeholder="2-1-1" maxLength={40} autoComplete="off" aria-invalid={!!errors.limitPattern} aria-describedby="cr-lpat-h" onChange={(e) => set({ limitPattern: e.target.value })} />
          <p className="cr-hint" id="cr-lpat-h">Type 2-1-1, 2 1 1, 2,1,1 or 2/1/1. They all mean the same.</p>
          <ErrLine text={errors.limitPattern} />
          {bowlers && (
            <p className="cr-preview" aria-live="polite"><b>{bowlers.text}.</b> <span>Total {bowlers.sum}{overs !== null ? ` of ${overs} overs` : ""}.</span></p>
          )}
          {warn && <p className="cr-warn" role="status"><IconWarn size={16} /><span>{warn}</span></p>}
        </>
      )}
      <ErrLine text={errors.limitMode} />
      <p className="cr-lock"><IconLock size={14} /><span>Once chosen, the limit is locked: a bowler who used their overs cannot be picked.</span></p>

      <h4 className="cr-gh">Ways of getting out</h4>
      <div className="cr-dis" role="group" aria-label="Ways of getting out">
        {DISMISSALS.map((d) => {
          const on = v.dismissals.includes(d.value);
          return (
            <label key={d.value} className={`cr-d ${on ? "on" : "off"}`}>
              <input type="checkbox" className="cr-sr" checked={on} onChange={() => toggleDismissal(d.value)} />
              <span>{on ? <IconCheck size={16} /> : <IconCross size={16} />}<span className="w">{d.label}</span><span className="cr-sr">{on ? " (on)" : " (off)"}</span></span>
            </label>
          );
        })}
      </div>
      <p className="cr-hint">Keep at least one.</p>
      <ErrLine text={errors.dismissals} />

      <h4 className="cr-gh">If the match ends level</h4>
      <Choice name="cr-so" label="If the match ends level" variant="cards" value={v.superOver} onChange={(x) => set({ superOver: x })}
        options={SUPER_OVER_MODES.map((m) => { const [a, b] = m.label.split(/ \((.*)\)$/); return { value: m.value, label: a!, sub: b ? b.charAt(0).toUpperCase() + b.slice(1) : undefined }; })} />
      <ErrLine text={errors.superOver} />
    </>
  );
}

/* ---------- what is posted, as one small bell box ---------- */
export function AlertBox({ tone, children }: { tone: "info" | "green" | "red" | "gold"; children: React.ReactNode }) {
  return <div className={`cr-alert ${tone}`}>{tone === "red" ? <IconWarn size={18} /> : tone === "gold" ? <IconWarn size={18} /> : <IconBell size={18} />}<span>{children}</span></div>;
}
