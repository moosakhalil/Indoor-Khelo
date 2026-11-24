"use client";
// Phase C (UI redesign), Builder C1: Create match as a 4-step wizard on a phone (Teams, Format, Rules, Review) and one page with
// a live summary on a desktop. It posts to the SAME server action (createMatchAction) with the SAME field names and the SAME
// validation as the old MatchForm; the steps are only a client-side way of asking. Every step stays mounted, so what was typed
// is kept when going back and forth, and after a server error.
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createMatchAction } from "@/app/actions4";
import type { FormState } from "@/app/actions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { IconBack, IconBell, IconNext } from "@/components/CrIcons";
import { IconInfo, IconLock, IconWarn } from "@/components/B4Icons";
import { FormatSection, RulesSection, TeamsSection, type Errs, type TeamOpt } from "@/components/MatchSetup";
import TeamBadge from "@/components/TeamBadge";
import "./cr.css";
import {
  STEP_NAMES, SERVER_TEXT, changeCount, changesText, defaultValues, entriesOf, fieldLabel, fmtLocal, limitSummary, oversOf, resetRules, setupWarning,
  sideName, sortedErrors, stepOf, thingsText, validateSetup, type SetupValues,
} from "@/lib/crSetup";

const initial: FormState = {};

type Props = { communityId: string; teams: TeamOpt[]; preselect?: string | null; recentVenues: string[]; lastWhen: string | null };

export function initialValues(teams: TeamOpt[], preselect?: string | null): SetupValues {
  const v = defaultValues();
  if (preselect && teams.some((t) => t.id === preselect)) return { ...v, modeA: "team", teamA: preselect };
  return v;
}

/* ---------- the summary (Review step on a phone, the right-hand column on a desktop) ---------- */
export function Summary({ v, teams, errors, serverError, onFix, onGoRules }: {
  v: SetupValues; teams: TeamOpt[]; errors: Errs; serverError?: string | null; onFix?: (key: string) => void; onGoRules?: () => void;
}) {
  const a = sideName(v, "A", teams) || "Team 1";
  const b = sideName(v, "B", teams) || "Team 2";
  const title = `${a} v ${b}`;
  const draft = !v.when.trim();
  const overs = oversOf(v);
  const warn = setupWarning(v);
  const list = sortedErrors(Object.fromEntries(Object.entries(errors).filter((e): e is [string, string] => !!e[1])));
  const n = changeCount(v);
  const rows: [string, string][] = [
    ["When", draft ? "No date yet" : fmtLocal(v.when)],
    ["Venue", v.venue.trim() || "Not set"],
    ["Overs", overs === null ? "Not set" : `${overs} per innings`],
    ["Players per side", v.playersPerSide.trim() || "Not set"],
    ["Rules", changesText(n)],
    ["Bowler limit", limitSummary(v)],
  ];
  if (v.umpire.trim()) rows.push(["Umpire", v.umpire.trim()]);
  if (v.notes.trim()) rows.push(["Notes", v.notes.trim().length > 60 ? `${v.notes.trim().slice(0, 60)}…` : v.notes.trim()]);
  return (
    <>
      {serverError && !list.length && (
        <div className="cr-errsum" role="alert">
          {serverError.startsWith("Only members") ? <IconLock size={18} /> : <IconWarn size={18} />}
          <div><b>{serverError}</b>{serverError.startsWith("Only members") && <small>Ask an admin to approve you again.</small>}</div>
        </div>
      )}
      {list.length > 0 && (
        <div className="cr-errsum" role="alert" id="cr-errsum" tabIndex={-1}>
          <IconWarn size={18} />
          <div><b>{SERVER_TEXT.fix}</b><small>{thingsText(list.length)}</small></div>
          <ul>
            {list.map(([k, msg]) => (
              <li key={k}>
                <span><b>{fieldLabel(k)}</b><small>{msg}</small></span>
                <button type="button" className="cr-fix" onClick={() => onFix?.(k)} aria-label={`Fix ${fieldLabel(k)}`}>{stepOf(k) === 1 ? "Go to the Teams step" : "Fix"}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="cr-sum-head">
        <div className="cr-sum-badges"><TeamBadge name={a} size="lg" /><span aria-hidden="true">v</span><TeamBadge name={b} size="lg" /></div>
        <h3>{title}</h3>
        <span className={`cr-status ${draft ? "draft" : "sched"}`}>{draft ? "Draft" : "Scheduled"}</span>
      </div>
      <dl className="cr-rows">
        {rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
      </dl>
      {warn && (
        <div className="cr-alert gold" role="status"><IconWarn size={18} /><span>{warn}{onGoRules && <> <button type="button" className="cr-link" onClick={onGoRules}>Check the bowler limit</button></>}</span></div>
      )}
      {draft ? (
        <div className="cr-alert info"><IconInfo size={18} /><span>No date: it is saved as a draft and nobody is told yet.</span></div>
      ) : (
        <div className="cr-alert green"><IconBell size={18} /><span>Everyone in the community gets an alert: “New match: {title}. Are you coming?”</span></div>
      )}
    </>
  );
}

/* ---------- the wizard ---------- */
export default function MatchWizard({ communityId, teams, preselect, recentVenues, lastWhen }: Props) {
  const [state, action, pending] = useActionState(createMatchAction, initial);
  const [v, setV] = useState<SetupValues>(() => initialValues(teams, preselect));
  const [step, setStep] = useState(1);
  const [attempted, setAttempted] = useState<number[]>([]);
  const [tried, setTried] = useState(false);
  const [tz, setTz] = useState("");
  const [server, setServer] = useState<{ v: SetupValues; state: FormState } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const vRef = useRef(v);
  vRef.current = v;
  const moved = useRef(false);

  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTz(""); } }, []);

  const teamNames = new Map(teams.map((t) => [t.id, t.name]));
  const clientErrors = validateSetup(v, "create", teamNames, tz || "UTC", new Date());
  const serverActive = server !== null && server.v === v;
  const serverFields = serverActive ? server.state.fieldErrors ?? {} : {};
  const serverMsg = serverActive ? server.state.error ?? null : null;
  const visible: Errs = { ...serverFields };
  for (const [k, msg] of Object.entries(clientErrors)) if (attempted.includes(stepOf(k))) visible[k] = msg;
  const allErrors: Errs = { ...serverFields, ...(tried ? clientErrors : {}) };

  const set = (patch: Partial<SetupValues>) => setV((cur) => ({ ...cur, ...patch }));

  // A server failure (it should be rare, the same checks ran here first): back to the Review step with every value kept.
  useEffect(() => {
    if (!state.error && !state.fieldErrors) return;
    setServer({ v: vRef.current, state });
    setTried(true);
    setStep(4);
  }, [state]);

  // After a step change: move focus to the step heading (or to the first faulty control).
  const focusTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    const want = focusTarget.current;
    focusTarget.current = null;
    const el = (want ? root.current?.querySelector<HTMLElement>(`#cr-step-${step} ${want}`) : null) ?? root.current?.querySelector<HTMLElement>(`#cr-step-${step}-h`) ?? null;
    el?.focus({ preventScroll: false });
    try { el?.scrollIntoView?.({ block: "center" }); } catch { /* old browsers */ }
  }, [step]);

  const invalidSel = '[aria-invalid="true"], .cr-side.bad';
  const stepKeys = (s: number) => Object.keys(clientErrors).filter((k) => stepOf(k) === s);
  const isWide = () => typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 1024px)").matches;

  const focusFirst = (s: number) => setTimeout(() => {
    const el = root.current?.querySelector<HTMLElement>(`#cr-step-${s} ${invalidSel}`);
    el?.focus?.();
    try { el?.scrollIntoView?.({ block: "center" }); } catch { /* old browsers */ }
  }, 20);

  const next = () => {
    const keys = stepKeys(step);
    if (keys.length) {
      setAttempted((a) => (a.includes(step) ? a : [...a, step]));
      focusFirst(step);
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const fix = (key: string) => {
    const s = stepOf(key);
    focusTarget.current = invalidSel;
    setAttempted((a) => (a.includes(s) ? a : [...a, s]));
    if (step === s) focusFirst(s); else setStep(s);
  };

  const submit = (asDraft = false) => {
    const values = asDraft ? { ...v, when: "" } : v;
    if (asDraft) setV(values);
    const errs = validateSetup(values, "create", teamNames, tz || "UTC", new Date());
    if (Object.keys(errs).length) {
      setTried(true);
      setAttempted([1, 2, 3]);
      const first = Math.min(...Object.keys(errs).map(stepOf));
      if (!isWide()) { setStep(4); }
      focusFirst(first);
      return;
    }
    const fd = new FormData();
    fd.set("communityId", communityId);
    fd.set("tz", tz);
    for (const [k, val] of entriesOf(values, "create")) fd.append(k, val);
    startTransition(() => action(fd));
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (step === 4 || isWide()) submit(); else next();
  };

  const [askDraft, setAskDraft] = useState(false);
  const stepInvalid = stepKeys(step).length > 0;
  const draft = !v.when.trim();
  const createLabel = pending ? "Saving…" : draft ? "Save as draft" : "Create match";
  const warnRules = () => { setStep(3); };

  return (
    <div className="cr-root cr-wizard" ref={root} data-step={step}>
      <form onSubmit={onFormSubmit} noValidate aria-busy={pending}>
        <p className="cr-sr" aria-live="polite">Step {step} of 4: {STEP_NAMES[step - 1]}</p>
        <ol className="cr-prog" aria-label="Progress">
          {STEP_NAMES.map((nm, i) => {
            const s = i + 1;
            const cls = s < step ? "done" : s === step ? "now" : "";
            return (
              <li key={nm} className={cls} aria-current={s === step ? "step" : undefined}>
                {s < step ? <button type="button" onClick={() => setStep(s)} disabled={pending} aria-label={`Go back to step ${s}, ${nm}`}>{s}. {nm}</button> : <span>{s}. {nm}</span>}
              </li>
            );
          })}
        </ol>

        <fieldset className="cr-fs" disabled={pending}>
          <div className="cr-grid">
            <div className="cr-main">
              <section id="cr-step-1" className="cr-card cr-step" hidden={step !== 1} aria-labelledby="cr-step-1-h">
                <h2 id="cr-step-1-h" tabIndex={-1}><span className="cr-num-badge">1</span> Teams</h2>
                <TeamsSection v={v} set={set} teams={teams} errors={visible} />
              </section>
              <section id="cr-step-2" className="cr-card cr-step" hidden={step !== 2} aria-labelledby="cr-step-2-h">
                <h2 id="cr-step-2-h" tabIndex={-1}><span className="cr-num-badge">2</span> Format</h2>
                <FormatSection v={v} set={set} errors={visible} mode="create" recentVenues={recentVenues} lastWhen={lastWhen} />
              </section>
              <section id="cr-step-3" className="cr-card cr-step" hidden={step !== 3} aria-labelledby="cr-step-3-h">
                <h2 id="cr-step-3-h" tabIndex={-1}><span className="cr-num-badge">3</span> Rules</h2>
                <RulesSection v={v} set={set} errors={visible} onReset={() => setV(resetRules(v))} />
              </section>
            </div>

            <div className="cr-sidecol">
            <section id="cr-step-4" className="cr-card cr-summary" hidden={step !== 4} aria-labelledby="cr-step-4-h">
              <h2 id="cr-step-4-h" tabIndex={-1} className="cr-sum-h"><span className="cr-num-badge">4</span> Review</h2>
              <Summary v={v} teams={teams} errors={allErrors} serverError={serverMsg} onFix={fix} onGoRules={warnRules} />
            </section>

            <div className="cr-nav">
              <Link href={`/c/${communityId}/matches`} className="btn ghost cr-cancel" hidden={step !== 1}>Cancel</Link>
              <button type="button" className="btn ghost cr-back" onClick={back} hidden={step === 1} disabled={pending}><IconBack /> Back</button>
              <button type="button" className={`btn gold cr-next${stepInvalid ? " dim" : ""}`} onClick={next} hidden={step === 4} aria-disabled={stepInvalid || undefined}>
                Next: {STEP_NAMES[step] ?? ""} <IconNext />
              </button>
              <button type="button" className="btn gold cr-create" onClick={() => submit()} hidden={step !== 4} disabled={pending}>{createLabel}</button>
              {!draft && <button type="button" className="btn ghost cr-draft" onClick={() => setAskDraft(true)} hidden={step !== 4} disabled={pending}>Save as draft instead</button>}
            </div>
            </div>
          </div>
        </fieldset>
      </form>
      <ConfirmDialog
        open={askDraft}
        title="Save as a draft?"
        body={<>A draft has no date, so nobody is asked if they are coming. The date you typed{v.when.trim() ? ` (${fmtLocal(v.when)})` : ""} will be removed from this match.</>}
        confirmLabel="Save as draft"
        onClose={() => setAskDraft(false)}
        onConfirm={() => { setAskDraft(false); submit(true); }}
      />
    </div>
  );
}
