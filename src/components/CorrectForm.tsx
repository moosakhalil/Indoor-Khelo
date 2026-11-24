"use client";
// Correct one ball of a finished match (Phase C3). Same fields, same rules and the same action as before (correctBallAction):
// kind of ball, runs 0 to 12, wicket, who was run out, the fielder, a reason. New: the ball is shown like a scorebook entry,
// one-tap chips and a number pad, and "What this changes" shows the new score and result BEFORE saving.
import "./lu.css";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { correctBallAction } from "@/app/actions6";
import { previewCorrectionC3, type CorrectionPreview } from "@/app/actionsC3";
import type { FormState } from "@/app/actions";
import LuIcon from "@/components/LuIcons";
import { InPanel } from "@/components/LuPanel";
import Shirt from "@/components/Shirt";
import { DISMISSALS } from "@/lib/matchRules";

export type CPlayer = { id: string; name: string; number: number | null };
export type CBall = { over: string; innings: number; text: string; runs: number; bowler: CPlayer | null; batter: CPlayer | null };

const initial: FormState = {};
export const RUNS_MESSAGE = "Runs must be a whole number from 0 to 12.";
const KINDS = [["", "Normal ball"], ["wide", "Wide"], ["noball", "No ball"], ["bye", "Bye"], ["legbye", "Leg-bye"]] as const;
const WICKETS = DISMISSALS.filter((d) => d.value !== "retired_out");
const NEEDS_FIELDER = (w: string) => w === "caught" || w === "stumped" || w === "run_out";
export const fielderLabel = (w: string) => (w === "caught" ? "Who took the catch (required)" : w === "stumped" ? "Wicket-keeper (required)" : "Fielder (required)");
export const runsOk = (s: string) => /^\d{1,2}$/.test(s) && Number(s) <= 12;

function Chips({ label, name, value, options, onPick, kind }: {
  label: string; name: string; value: string; options: readonly (readonly [string, string])[]; onPick: (v: string) => void; kind?: "wk";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="lu-chipset">
      {options.map(([v, text]) => (
        <label key={v || "none"} className={`lu-pill${kind ? " wk" : ""}${value === v ? " on" : ""}${value === v && v === "" ? " none" : ""}`}>
          <input type="radio" className="lu-sr" name={name} value={v} checked={value === v} onChange={() => onPick(v)} />
          {text}
        </label>
      ))}
    </div>
  );
}

function PlayerChips({ label, name, value, people, onPick, bad }: { label: string; name: string; value: string; people: CPlayer[]; onPick: (id: string) => void; bad: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="lu-chipset">
      {people.map((p) => (
        <label key={p.id} className={`lu-pill pl${value === p.id ? " on" : ""}${bad ? " bad" : ""}`}>
          <input type="radio" className="lu-sr" name={name} value={p.id} checked={value === p.id} aria-label={p.name} onChange={() => onPick(p.id)} />
          <Shirt number={p.number} size="small" label={p.number === null ? "Guest, no player number" : undefined} />
          {p.name}
        </label>
      ))}
    </div>
  );
}

/** "What this changes", the warning and the buttons. Shown in the page, and in the side column on very wide screens. */
function Effect({ preview, loading, changed, valid, pending, error, cancelHref, backBalls, variant }: {
  preview: CorrectionPreview | null; loading: boolean; changed: boolean; valid: boolean; pending: boolean;
  error: { text: string; lock: boolean; refused: boolean } | null; cancelHref: string; backBalls: string; variant: "inline" | "panel";
}) {
  return (
    <div className={variant === "panel" ? "lu-cside-panel" : "lu-cside-inline"}>
      <section className="card lu-preview" aria-label="What this changes">
        <div className="lu-preview-head"><b>What this changes</b><span className="lu-tag">Preview</span></div>
        {!changed || !valid ? (
          <p className="lu-quiet">{valid ? "Nothing has changed yet." : "Finish the fields above to see the effect."}</p>
        ) : loading ? <p className="lu-quiet" role="status">Working it out…</p> : preview && preview.ok ? (
          <dl className="lu-dl">
            {preview.innings && <><dt>{preview.innings.label}</dt><dd>{preview.innings.before === preview.innings.after ? `${preview.innings.after} (same)` : `${preview.innings.before} to ${preview.innings.after}`}</dd></>}
            {preview.result && <><dt>Result</dt><dd>{preview.result.before === preview.result.after ? `${preview.result.after} (same)` : `${preview.result.before || "No result"} to ${preview.result.after || "No result"}`}</dd></>}
            <dt>Player of the Match</dt><dd>Recalculated</dd>
            <dt>Stats and career</dt><dd>Recalculated</dd>
          </dl>
        ) : preview && !preview.ok ? (
          <div className="lu-note red" role="alert"><LuIcon name="alert" /><div className="grow">{preview.kind === "refused" ? `This change would break the balls after it, so it cannot be saved. ${preview.error}` : preview.error}</div></div>
        ) : null}
        <div className="lu-note gold"><LuIcon name="alert" /><div className="grow">Any member can correct a finished match. Everyone can see this change in the history.</div></div>
      </section>
      {error && (
        <div className="lu-note red" role="alert">
          <LuIcon name={error.lock ? "lock" : "alert"} />
          <div className="grow">{error.text}{error.refused && <> <Link href={backBalls} className="lu-link">Show the balls after this one</Link></>}</div>
        </div>
      )}
      <div className="lu-actions">
        <button type="submit" form="lu-cform" className="btn gold" disabled={pending || !valid || !changed}>{pending ? <><span className="lu-spin" aria-hidden="true" />Saving…</> : "Save the correction"}</button>
        <Link href={cancelHref} className="lu-cancel">Cancel</Link>
      </div>
    </div>
  );
}

export default function CorrectForm({ communityId, matchId, ballId, bat, field, current, ball, cancelHref }: {
  communityId: string; matchId: string; ballId: string; bat: CPlayer[]; field: CPlayer[];
  current: { extra: string; runs: number; wicket: string; out: string; fielder: string };
  ball: CBall; cancelHref: string;
}) {
  const [state, action, pending] = useActionState(correctBallAction, initial);
  const [seen, setSeen] = useState<FormState | null>(null);
  const [extra, setExtra] = useState(current.extra);
  const [runs, setRuns] = useState(String(current.runs));
  const [wk, setWk] = useState(current.wicket === "retired_out" ? "" : current.wicket);
  const [out, setOut] = useState(current.wicket === "run_out" ? current.out : "");
  const [fielder, setFielder] = useState(current.fielder);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<CorrectionPreview | null>(null);
  const [loading, setLoading] = useState(false);

  const touch = () => setSeen(state);
  const shown = state !== seen ? state : null;
  const fe = shown?.fieldErrors ?? {};

  const rOk = runsOk(runs);
  const needF = NEEDS_FIELDER(wk);
  const fieldBad = needF && !fielder;
  const outBad = wk === "run_out" && !out;
  const valid = rOk && !fieldBad && !outBad;
  const changed = extra !== current.extra || runs !== String(current.runs) || wk !== current.wicket
    || (wk === "run_out" && out !== current.out) || (needF && fielder !== current.fielder);

  // Ask the server what the correction would do (nothing is saved), a moment after the last tap.
  useEffect(() => {
    if (!valid || !changed) { setPreview(null); setLoading(false); return; }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      previewCorrectionC3({ communityId, matchId, ballId, extra, runs: Number(runs), wicket: wk, out: wk === "run_out" ? out : "", fielder: needF ? fielder : "" })
        .then((r) => { if (live) { setPreview(r); setLoading(false); } })
        .catch(() => { if (live) { setPreview(null); setLoading(false); } });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [valid, changed, communityId, matchId, ballId, extra, runs, wk, out, fielder, needF]);

  const error = shown?.error
    ? { text: shown.error, lock: shown.error.startsWith("Only members of this community"), refused: shown.error.startsWith("This change would break") }
    : null;
  const runsMsg = !rOk ? RUNS_MESSAGE : fe.runs;

  const effect = (variant: "inline" | "panel") => (
    <Effect preview={preview} loading={loading} changed={changed} valid={valid} pending={pending} error={error} cancelHref={cancelHref} backBalls={cancelHref} variant={variant} />
  );

  return (
    <>
      <form
        id="lu-cform" className="stack" noValidate
        onSubmit={(e) => { e.preventDefault(); if (!valid) return; const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}
      >
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="ballId" value={ballId} />
        <input type="hidden" name="extra" value={extra} />
        <input type="hidden" name="wicket" value={wk} />
        {wk === "run_out" && <input type="hidden" name="out" value={out} />}
        {needF && <input type="hidden" name="fielder" value={fielder} />}

        <section className="card lu-ball" aria-label="The ball as recorded">
          <div className="lu-ball-top"><span className="lu-h">The ball as recorded</span><span className="lu-h">Over {ball.over}</span></div>
          <div className="lu-ball-people">
            {ball.bowler ? (
              <div className="lu-person"><Shirt number={ball.bowler.number} size="normal" /><span><b>{ball.bowler.name}</b><small>bowled to</small></span></div>
            ) : <span />}
            {ball.batter ? (
              <div className="lu-person right"><span><b>{ball.batter.name}</b><small>batter</small></span><Shirt number={ball.batter.number} size="normal" /></div>
            ) : <span />}
          </div>
          <div className="lu-ball-line"><span className="lu-runchip" aria-label={`${ball.runs} as recorded`}>{ball.runs}</span><span>Innings {ball.innings} · {ball.text}</span></div>
          <p className="lu-fine"><LuIcon name="history" size={16} /><span>The original ball stays in the record. Your name is saved with the change, and the scorecard, stats and Player of the Match are worked out again.</span></p>
        </section>

        <section className="card">
          <h2 style={{ fontSize: "1rem", marginBottom: 14 }}>Correct this ball</h2>
          <fieldset className="lu-fieldset" disabled={pending}>
            <span className="lu-lb">Kind of ball</span>
            <Chips label="Kind of ball" name="kind-ui" value={extra} options={KINDS} onPick={(v) => { touch(); setExtra(v); }} />

            <span className="lu-lb" id="lu-runs-l">Runs</span>
            <div className="lu-pad" role="group" aria-labelledby="lu-runs-l">
              {Array.from({ length: 13 }, (_, n) => (
                <button key={n} type="button" className={`lu-pill${runs === String(n) ? " on" : ""}`} aria-pressed={runs === String(n)} onClick={() => { touch(); setRuns(String(n)); }}>{n}</button>
              ))}
            </div>
            <p className="lu-hint">{wk === "run_out" ? "Runs completed before the run out. 0 to 12." : "Off the bat, byes, extra runs run, or runs completed before a run out. 0 to 12."}</p>
            <div className="lu-typed">
              <label className="lu-lb" htmlFor="lu-runs" style={{ marginTop: 0 }}>Or type the runs</label>
              <input id="lu-runs" name="runs" className={`field${runsMsg ? " bad" : ""}`} inputMode="numeric" maxLength={2} value={runs} aria-invalid={!!runsMsg} aria-describedby={runsMsg ? "lu-runs-e" : undefined}
                onChange={(e) => { touch(); setRuns(e.target.value.replace(/[^\d]/g, "")); }} />
              {runsMsg && <p id="lu-runs-e" className="lu-err" role="alert"><LuIcon name="alert" size={16} /><span>{runsMsg}</span></p>}
            </div>

            <span className="lu-lb">Wicket</span>
            <Chips label="Wicket" name="wicket-ui" value={wk} options={[["", "No wicket"], ...WICKETS.map((d) => [d.value, d.label] as const)]} kind="wk"
              onPick={(v) => { touch(); setWk(v); if (v !== "run_out") setOut(""); if (!NEEDS_FIELDER(v)) setFielder(""); }} />

            {wk === "run_out" && (
              <>
                <span className={`lu-lb${outBad ? " req" : ""}`}>Who was run out</span>
                <PlayerChips label="Who was run out" name="out-ui" value={out} people={bat} bad={outBad} onPick={(id) => { touch(); setOut(id); }} />
                {outBad && <p className="lu-err" role="alert"><LuIcon name="alert" size={16} /><span>{fe.out ?? "Choose who was run out."}</span></p>}
              </>
            )}
            {needF && (
              <>
                <span className={`lu-lb${fieldBad ? " req" : ""}`}>{fielderLabel(wk)}</span>
                <PlayerChips label={fielderLabel(wk)} name="fielder-ui" value={fielder} people={field} bad={fieldBad} onPick={(id) => { touch(); setFielder(id); }} />
                {fieldBad && <p className="lu-err" role="alert"><LuIcon name="alert" size={16} /><span>{fe.fielder ?? "Choose the fielder."}</span></p>}
              </>
            )}

            <label className="lu-lb" htmlFor="lu-why">Reason (optional)</label>
            <div className="lu-input">
              <LuIcon name="pencil" />
              <input id="lu-why" name="reason" className="field" maxLength={200} placeholder="For the match history" value={reason} onChange={(e) => { touch(); setReason(e.target.value); }} />
            </div>
            <p className="lu-hint">Saved in the match history with your name.</p>
          </fieldset>
        </section>

        {effect("inline")}
      </form>
      <InPanel>{effect("panel")}</InPanel>
    </>
  );
}
