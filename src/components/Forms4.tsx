"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import CoinToss from "@/components/CoinToss";
import { createMatchAction, createSeveralAction, rematchAction, tossAction, updateMatchAction } from "@/app/actions4";
import type { FormState } from "@/app/actions";
import {
  DEFAULT_RULES, DISMISSALS, OVERS_PRESETS, PLAYERS_DEFAULT, PLAYERS_MAX, PLAYERS_MIN, SEVERAL_MAX, SUPER_OVER_MODES, patternText, type Rules,
} from "@/lib/matchRules";

const initial: FormState = {};

/**
 * Submit without React's automatic form reset, so a long form keeps everything the person typed when one field needs fixing.
 */
function submitWith(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}
function Err({ text }: { text?: string }) {
  return text ? <p className="err" role="alert">{text}</p> : null;
}

/** Sends the phone's time zone with the form, so "7:30 pm" means 7:30 pm where the player is. */
function TzField() {
  const [tz, setTz] = useState("");
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTz(""); } }, []);
  return <input type="hidden" name="tz" value={tz} />;
}

type Team = { id: string; name: string };

function SideFields({ prefix, label, teams, fe, defaultTeam, defaultName, readOnly }: {
  prefix: "sideA" | "sideB"; label: string; teams: Team[]; fe: Record<string, string>; defaultTeam?: string; defaultName?: string; readOnly?: string;
}) {
  if (readOnly) {
    return (
      <>
        <label className="lb">{label}</label>
        <div className="field" style={{ display: "flex", alignItems: "center" }}>{readOnly}</div>
      </>
    );
  }
  return (
    <>
      <label className="lb" htmlFor={`${prefix}-team`}>{label}</label>
      <select id={`${prefix}-team`} name={`${prefix}Team`} className={`field${fe[prefix] ? " bad" : ""}`} defaultValue={defaultTeam ?? ""} aria-invalid={!!fe[prefix]}>
        <option value="">Match-only team (type a name below)</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input name={`${prefix}Name`} className={`field${fe[prefix] ? " bad" : ""}`} defaultValue={defaultName} maxLength={40} autoComplete="off" placeholder="Match-only team name, only if no team is chosen above" aria-label={`${label}: match-only team name`} style={{ marginTop: 8 }} />
      <Err text={fe[prefix]} />
    </>
  );
}

function OversFields({ suffix = "", fe, overs }: { suffix?: string; fe: Record<string, string>; overs?: number }) {
  const preset = overs && (OVERS_PRESETS as readonly number[]).includes(overs) ? String(overs) : overs ? "custom" : "6";
  const bad = fe[`overs${suffix}`];
  return (
    <>
      <label className="lb" htmlFor={`overs${suffix}`}>Overs per innings</label>
      <div className="two">
        <select id={`overs${suffix}`} name={`oversPreset${suffix}`} className={`field${bad ? " bad" : ""}`} defaultValue={preset} aria-invalid={!!bad}>
          {OVERS_PRESETS.map((o) => <option key={o} value={o}>{o} overs</option>)}
          <option value="custom">Custom</option>
        </select>
        <input name={`oversCustom${suffix}`} inputMode="numeric" className={`field${bad ? " bad" : ""}`} defaultValue={preset === "custom" ? overs : ""} placeholder="Custom overs" aria-label="Custom overs, used only when Custom is chosen" maxLength={2} />
      </div>
      <Err text={bad} />
    </>
  );
}

function Switch({ name, label, hint, on }: { name: string; label: string; hint?: string; on: boolean }) {
  return (
    <label className="switch">
      <span><b>{label}</b>{hint && <small className="muted" style={{ display: "block" }}>{hint}</small>}</span>
      <input type="checkbox" name={name} defaultChecked={on} />
      <span className="track" aria-hidden="true" />
    </label>
  );
}

function RulesFields({ rules, fe, playersPerSide = PLAYERS_DEFAULT }: { rules: Rules; fe: Record<string, string>; playersPerSide?: number }) {
  const limit = rules.bowlerLimit;
  const ruleError = ["innings", "ballsPerOver", "wideRuns", "noBallRuns", "dismissals", "superOver", "limitMode", "limitMax", "limitPattern"].some((k) => fe[k]);
  return (
    <details open={ruleError || undefined} className="card" style={{ marginTop: 14 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Rules and settings <small className="muted" style={{ fontWeight: 500 }}>(traditional defaults, tap to change)</small></summary>
      <input type="hidden" name="rulesForm" value="1" />
      <p className="muted small" style={{ margin: "8px 0 0" }}>These rules are saved with this match only. Changing them later never changes old matches.</p>

      <label className="lb" htmlFor="r-pp">Players per side</label>
      <input id="r-pp" name="playersPerSide" inputMode="numeric" className={`field${fe.playersPerSide ? " bad" : ""}`} defaultValue={String(playersPerSide)} maxLength={2} aria-describedby="r-pp-h" />
      <p id="r-pp-h" className="muted small" style={{ margin: "4px 0 0" }}>From {PLAYERS_MIN} to {PLAYERS_MAX}. Six by default.</p>
      <Err text={fe.playersPerSide} />

      <label className="lb" htmlFor="r-inn">Innings per team</label>
      <select id="r-inn" name="innings" className="field" defaultValue={String(rules.innings)}>
        <option value="2">Two innings in total (each team bats once)</option>
        <option value="1">One innings</option>
      </select>
      <Err text={fe.innings} />

      <label className="lb" htmlFor="r-bpo">Balls per over</label>
      <input id="r-bpo" name="ballsPerOver" inputMode="numeric" className={`field${fe.ballsPerOver ? " bad" : ""}`} defaultValue={String(rules.ballsPerOver)} maxLength={2} />
      <Err text={fe.ballsPerOver} />

      <div className="two">
        <div>
          <label className="lb" htmlFor="r-wide">Wide runs</label>
          <input id="r-wide" name="wideRuns" inputMode="numeric" className={`field${fe.wideRuns ? " bad" : ""}`} defaultValue={String(rules.wideRuns)} maxLength={1} />
          <Err text={fe.wideRuns} />
        </div>
        <div>
          <label className="lb" htmlFor="r-nb">No-ball runs</label>
          <input id="r-nb" name="noBallRuns" inputMode="numeric" className={`field${fe.noBallRuns ? " bad" : ""}`} defaultValue={String(rules.noBallRuns)} maxLength={1} />
          <Err text={fe.noBallRuns} />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Switch name="widesReBowled" label="Wide is not counted, bowled again" on={rules.widesReBowled} />
        <Switch name="noBallsReBowled" label="No ball is not counted, bowled again" on={rules.noBallsReBowled} />
        <Switch name="byesCountAsBalls" label="Byes count as balls" on={rules.byesCountAsBalls} />
        <Switch name="legByesCountAsBalls" label="Leg-byes count as balls" on={rules.legByesCountAsBalls} />
        <Switch name="freeHit" label="Free hit after a no ball" hint="The batter can only be run out on a free hit." on={rules.freeHit} />
        <Switch name="overthrows" label="Overthrows allowed" on={rules.overthrows} />
        <Switch name="retiredCanReturn" label="A retired batter can come back" on={rules.retiredCanReturn} />
        <Switch name="sameBowlerTwoInARow" label="Same bowler can bowl two overs in a row" on={rules.sameBowlerTwoInARow} />
        <Switch name="lastBatterAlone" label="Last batter can bat alone" hint="If off, the innings ends when one batter is left." on={rules.lastBatterAlone} />
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
        <legend className="muted small" style={{ fontWeight: 600, padding: 0 }}>Ways of getting out</legend>
        <div className="row wrap" style={{ marginTop: 6 }}>
          {DISMISSALS.map((d) => (
            <label key={d.value} className="chip" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="dismissals" value={d.value} defaultChecked={rules.dismissals.includes(d.value)} style={{ accentColor: "var(--gold)" }} /> {d.label}
            </label>
          ))}
        </div>
        <Err text={fe.dismissals} />
      </fieldset>

      <label className="lb" htmlFor="r-so">If the match ends level</label>
      <select id="r-so" name="superOver" className="field" defaultValue={rules.superOver}>
        {SUPER_OVER_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Err text={fe.superOver} />

      <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
        <legend className="muted small" style={{ fontWeight: 600, padding: 0 }}>Bowler over limit</legend>
        <p className="muted small" style={{ margin: "4px 0 6px" }}>Once chosen, the limit is locked: a bowler who used their overs cannot be picked.</p>
        <label className="check" style={{ marginBottom: 8 }}><input type="radio" name="limitMode" value="none" defaultChecked={limit.mode === "none"} /> <span>No limit</span></label>
        <label className="check" style={{ marginBottom: 8 }}><input type="radio" name="limitMode" value="max" defaultChecked={limit.mode === "max"} /> <span>Maximum overs per bowler</span></label>
        <input name="limitMax" inputMode="numeric" className={`field${fe.limitMax ? " bad" : ""}`} defaultValue={limit.mode === "max" ? limit.overs : ""} placeholder="For example 2" aria-label="Maximum overs per bowler" maxLength={2} />
        <Err text={fe.limitMax} />
        <label className="check" style={{ margin: "10px 0 8px" }}><input type="radio" name="limitMode" value="pattern" defaultChecked={limit.mode === "pattern"} /> <span>Pattern, for example 2-1-1 in a 4-over match</span></label>
        <input name="limitPattern" className={`field${fe.limitPattern ? " bad" : ""}`} defaultValue={limit.mode === "pattern" ? patternText(limit.pattern) : ""} placeholder="2-1-1" aria-label="Over pattern" maxLength={40} />
        <Err text={fe.limitPattern} />
        <Err text={fe.limitMode} />
      </fieldset>
    </details>
  );
}

/* ---------- create or edit one match ---------- */
export type MatchDefaults = {
  when: string; venue: string; overs: number; playersPerSide: number; rules: Rules; umpire: string; notes: string;
  sideAName: string; sideBName: string;
};

export function MatchForm({ mode, communityId, matchId, teams, defaults }: {
  mode: "create" | "edit"; communityId: string; matchId?: string; teams: Team[]; defaults?: MatchDefaults;
}) {
  const [state, action, pending] = useActionState(mode === "create" ? createMatchAction : updateMatchAction, initial);
  const fe = state.fieldErrors ?? {};
  const rules = defaults?.rules ?? DEFAULT_RULES;
  return (
    <form onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      {matchId && <input type="hidden" name="matchId" value={matchId} />}
      <TzField />
      {mode === "create" ? (
        <>
          <SideFields prefix="sideA" label="Team 1" teams={teams} fe={fe} />
          <SideFields prefix="sideB" label="Team 2" teams={teams} fe={fe} />
        </>
      ) : (
        <>
          <label className="lb" style={{ marginTop: 0 }}>Teams</label>
          <div className="field" style={{ display: "flex", alignItems: "center" }}>{defaults?.sideAName} v {defaults?.sideBName}</div>
          <p className="muted small" style={{ margin: "6px 2px 0" }}>Teams cannot be changed after the match is created. To use different teams, cancel this match and create a new one, or use Rematch.</p>
        </>
      )}

      <label className="lb" htmlFor="m-when">Date and time {mode === "create" && <span style={{ fontWeight: 400 }}>(leave empty to save as a draft)</span>}</label>
      <input id="m-when" type="datetime-local" name="when" className={`field${fe.when ? " bad" : ""}`} defaultValue={defaults?.when} aria-invalid={!!fe.when} />
      <Err text={fe.when} />

      <label className="lb" htmlFor="m-venue">Venue (optional)</label>
      <input id="m-venue" name="venue" className={`field${fe.venue ? " bad" : ""}`} defaultValue={defaults?.venue} maxLength={80} placeholder="Hall name or place" />
      <Err text={fe.venue} />

      <OversFields fe={fe} overs={defaults?.overs} />

      <RulesFields rules={rules} fe={fe} playersPerSide={defaults?.playersPerSide} />

      <label className="lb" htmlFor="m-ump">Umpire (optional)</label>
      <input id="m-ump" name="umpire" className={`field${fe.umpire ? " bad" : ""}`} defaultValue={defaults?.umpire} maxLength={40} placeholder="A name, for the scorecard only" />
      <p className="muted small" style={{ margin: "4px 2px 0" }}>A label only. Any member of the community can score the match.</p>
      <Err text={fe.umpire} />

      <label className="lb" htmlFor="m-notes">Notes (optional)</label>
      <textarea id="m-notes" name="notes" className={`field${fe.notes ? " bad" : ""}`} defaultValue={defaults?.notes} maxLength={300} placeholder="Anything people should know" />
      <Err text={fe.notes} />

      <p className="muted small" style={{ margin: "10px 2px" }}>You can pick the lineups now, later, or on match day. A match can exist with no lineup at all.</p>
      {state.error && !state.fieldErrors && <Err text={state.error} />}
      {state.error && state.fieldErrors && <Err text={state.error} />}
      <button className="btn gold" disabled={pending} style={{ marginTop: 8 }}>{pending ? "Saving…" : mode === "create" ? "Create match" : "Save changes"}</button>
    </form>
  );
}

/* ---------- several matches at once ---------- */
export function SeveralForm({ communityId, teams }: { communityId: string; teams: Team[] }) {
  const [state, action, pending] = useActionState(createSeveralAction, initial);
  const [count, setCount] = useState(3);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="count" value={count} />
      <TzField />
      <SideFields prefix="sideA" label="Team 1" teams={teams} fe={fe} />
      <SideFields prefix="sideB" label="Team 2" teams={teams} fe={fe} />
      <label className="lb" htmlFor="s-pp">Players per side</label>
      <input id="s-pp" name="playersPerSide" inputMode="numeric" className={`field${fe.playersPerSide ? " bad" : ""}`} defaultValue={String(PLAYERS_DEFAULT)} maxLength={2} />
      <Err text={fe.playersPerSide} />
      <p className="muted small" style={{ margin: "10px 2px 0" }}>Each match below is separate, with its own date, time, venue and overs. Rules start as the traditional defaults and each match can be changed afterwards. Lineups are picked per match.</p>
      {Array.from({ length: count }, (_, i) => (
        <section key={i} className="card" style={{ marginTop: 12 }}>
          <b>Match {i + 1}</b>
          <label className="lb" htmlFor={`when_${i}`}>Date and time</label>
          <input id={`when_${i}`} type="datetime-local" name={`when_${i}`} className={`field${fe[`when_${i}`] ? " bad" : ""}`} />
          <Err text={fe[`when_${i}`]} />
          <label className="lb" htmlFor={`venue_${i}`}>Venue (optional)</label>
          <input id={`venue_${i}`} name={`venue_${i}`} className={`field${fe[`venue_${i}`] ? " bad" : ""}`} maxLength={80} />
          <Err text={fe[`venue_${i}`]} />
          <OversFields suffix={`_${i}`} fe={fe} />
        </section>
      ))}
      <div className="two" style={{ marginTop: 12 }}>
        <button type="button" className="btn ghost" disabled={count >= SEVERAL_MAX} onClick={() => setCount((n) => Math.min(SEVERAL_MAX, n + 1))}>Add another match</button>
        <button type="button" className="btn ghost" disabled={count <= 1} onClick={() => setCount((n) => Math.max(1, n - 1))}>Remove the last one</button>
      </div>
      {count >= SEVERAL_MAX && <p className="muted small" style={{ margin: "6px 2px 0" }}>Up to {SEVERAL_MAX} at a time. You can plan more any time.</p>}
      {state.error && <Err text={state.error} />}
      <button className="btn gold" disabled={pending} style={{ marginTop: 12 }}>{pending ? "Creating…" : `Create ${count} match${count === 1 ? "" : "es"}`}</button>
    </form>
  );
}

/* ---------- toss ---------- */
export function TossForm({ communityId, matchId, sideNames, winner, decision }: {
  communityId: string; matchId: string; sideNames: [string, string]; winner: number | null; decision: string | null;
}) {
  const [state, action, pending] = useActionState(tossAction, initial);
  const [w, setW] = useState(winner ? String(winner) : "");
  const [d, setD] = useState(decision ?? "");
  const [coin, setCoin] = useState(false);
  return (
    <form onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="matchId" value={matchId} />
      {coin ? (
        <>
          <CoinToss sides={sideNames} onDone={(r) => { setW(String(r.winner)); setD(r.decision); }} />
          <button type="button" className="chip" style={{ margin: "8px 0" }} onClick={() => setCoin(false)}>Close the coin</button>
        </>
      ) : (
        <button type="button" className="btn ghost" style={{ marginBottom: 10 }} onClick={() => setCoin(true)}>Toss the coin</button>
      )}
      <label className="lb" htmlFor="t-win" style={{ marginTop: 0 }}>Who won the toss?</label>
      <select id="t-win" name="winner" className="field" value={w} onChange={(e) => setW(e.target.value)}>
        <option value="">Not decided yet</option>
        <option value="1">{sideNames[0]}</option>
        <option value="2">{sideNames[1]}</option>
      </select>
      <label className="lb" htmlFor="t-dec">The winner chose to</label>
      <select id="t-dec" name="decision" className="field" value={d} onChange={(e) => setD(e.target.value)}>
        <option value="">Not decided yet</option>
        <option value="bat">Bat first</option>
        <option value="bowl">Bowl first</option>
      </select>
      <p className="muted small" style={{ margin: "8px 2px" }}>Use the coin, or type a toss that was done in real life. Who bats first follows from the toss. Choose “Not decided yet” in both to clear it.</p>
      {state.error && <Err text={state.error} />}
      <button className="btn gold" disabled={pending}>{pending ? "Saving…" : "Save toss"}</button>
    </form>
  );
}

/* ---------- rematch ---------- */
export function RematchForm({ communityId, matchId }: { communityId: string; matchId: string }) {
  const [state, action, pending] = useActionState(rematchAction, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="matchId" value={matchId} />
      <TzField />
      <label className="lb" htmlFor="rm-when" style={{ marginTop: 0 }}>Date and time of the rematch</label>
      <input id="rm-when" type="datetime-local" name="when" className={`field${fe.when ? " bad" : ""}`} aria-invalid={!!fe.when} />
      <Err text={fe.when} />
      {state.error && !state.fieldErrors && <Err text={state.error} />}
      <button className="btn gold" disabled={pending} style={{ marginTop: 12 }}>{pending ? "Creating…" : "Create rematch"}</button>
    </form>
  );
}
