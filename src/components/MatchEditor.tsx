"use client";
// Phase C (UI redesign), Builder C1: Edit match. One page: the teams (locked), the format and the rules, a "What will change" panel
// (a live old-to-new list and who will be alerted) and "Manage this match" (postpone, cancel, delete).
// It posts to the SAME server action (updateMatchAction) with the SAME field names and validation as the old MatchForm (mode "edit").
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { updateMatchAction } from "@/app/actions4";
import type { FormState } from "@/app/actions";
import { IconClock } from "@/components/CrIcons";
import { IconLock, IconWarn } from "@/components/B4Icons";
import MatchManage from "@/components/MatchManage";
import { AlertBox, FormatSection, RulesSection, type Errs } from "@/components/MatchSetup";
import TeamBadge from "@/components/TeamBadge";
import "./cr.css";
import {
  SERVER_TEXT, diffRows, editEffect, entriesOf, fieldLabel, parseTooMany, resetRules, sortedErrors, thingsText, validateSetup, type SetupValues,
} from "@/lib/crSetup";
import { STATUS_LABEL, type MatchStatus } from "@/lib/matchRules";

const initial: FormState = {};

const CONTROL: Record<string, string> = {
  when: "cr-when", venue: "cr-venue", overs: "cr-overs-custom", playersPerSide: "cr-pp", umpire: "cr-ump", notes: "cr-notes",
  ballsPerOver: "cr-bpo", wideRuns: "cr-wide", noBallRuns: "cr-nb", limitMax: "cr-lmax", limitPattern: "cr-lpat",
};

type Side = { name: string; mine: boolean };

export default function MatchEditor({ communityId, matchId, status, sideA, sideB, lineup, initialValues, recentVenues, lastWhen, whenLabel, comingCount = 0 }: {
  communityId: string; matchId: string; status: MatchStatus; sideA: Side; sideB: Side;
  /** How many players each side already has in the lineup. */
  lineup: { a: number; b: number };
  initialValues: SetupValues; recentVenues: string[]; lastWhen: string | null; whenLabel: string;
  /** Members who answered "I'm in"; shown in the cancel box. */
  comingCount?: number;
}) {
  const [state, action, pending] = useActionState(updateMatchAction, initial);
  const [v, setV] = useState<SetupValues>(initialValues);
  const [tz, setTz] = useState("");
  const [server, setServer] = useState<{ v: SetupValues; state: FormState } | null>(null);
  const vRef = useRef(v);
  vRef.current = v;
  const failure = useRef<HTMLDivElement>(null);
  const title = `${sideA.name} v ${sideB.name}`;
  const base = `/c/${communityId}/matches/${matchId}`;

  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTz(""); } }, []);
  useEffect(() => {
    if (!state.error && !state.fieldErrors) return;
    setServer({ v: vRef.current, state });
  }, [state]);

  const serverActive = server !== null && server.v === v;
  const serverFields = serverActive ? server.state.fieldErrors ?? {} : {};
  const serverMsg = serverActive ? server.state.error ?? null : null;
  const clientErrors = validateSetup(v, "edit", new Map(), tz || "UTC", new Date());
  const errors: Errs = { ...serverFields, ...clientErrors };
  const list = sortedErrors(Object.fromEntries(Object.entries(errors).filter((e): e is [string, string] => !!e[1])));
  const hasErrors = list.length > 0;
  const tooMany = parseTooMany(serverFields.playersPerSide);
  // A message without field errors is a failure of the whole save (started, gone, not a member).
  const hardFailure = server && !server.state.fieldErrors ? server.state.error ?? null : null;
  useEffect(() => { if (hardFailure) try { failure.current?.scrollIntoView?.({ block: "center" }); } catch { /* old browsers */ } }, [hardFailure]);

  const set = (patch: Partial<SetupValues>) => setV((cur) => ({ ...cur, ...patch }));
  const effect = editEffect(status, initialValues.when, v.when, title);
  const rows = diffRows(initialValues, v);
  const maxLineup = Math.max(lineup.a, lineup.b);

  const submit = () => {
    if (pending || hasErrors) return;
    const fd = new FormData();
    fd.set("communityId", communityId);
    fd.set("matchId", matchId);
    fd.set("tz", tz);
    for (const [k, val] of entriesOf(v, "edit")) fd.append(k, val);
    startTransition(() => action(fd));
  };

  const fix = (key: string) => {
    const el = document.getElementById(CONTROL[key] ?? "") ?? document.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus?.();
    try { el?.scrollIntoView?.({ block: "center" }); } catch { /* old browsers */ }
  };

  const nextLabel = STATUS_LABEL[effect.nextStatus];
  const statusClass = effect.nextStatus === "postponed" ? "post" : effect.nextStatus === "draft" ? "draft" : "sched";

  return (
    <div className="cr-root cr-editor">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate aria-busy={pending}>
        {hardFailure && (
          <div className="cr-fail" role="alert" ref={failure}>
            <div className="cr-notice red">
              {hardFailure === SERVER_TEXT.gone ? <IconWarn size={18} /> : <IconLock size={18} />}
              <span><b>{hardFailure}</b>{hardFailure === SERVER_TEXT.started && <small>Open the match to follow it live.</small>}</span>
            </div>
            {hardFailure === SERVER_TEXT.started && <Link href={base} className="btn ghost cr-fail-btn">Open the match</Link>}
            {hardFailure === SERVER_TEXT.gone && <Link href={`/c/${communityId}/matches`} className="btn ghost cr-fail-btn">Back to matches</Link>}
          </div>
        )}
        {status === "postponed" && (
          <div className="cr-alert info cr-post"><IconClock size={18} /><span><b>This match is postponed.</b> Choose a new date and time to schedule it again.</span></div>
        )}

        <fieldset className="cr-fs" disabled={pending}>
          <div className="cr-grid">
            <div className="cr-main">
              <section className="cr-card" aria-labelledby="ed-teams-h">
                <h2 id="ed-teams-h">Teams <span className="cr-pill lock">Locked</span></h2>
                <div className="cr-locked">
                  <span className={sideA.mine ? "cr-mine" : undefined}><TeamBadge name={sideA.name} size="lg" label={sideA.mine ? `Team ${sideA.name}, your team` : undefined} /></span>
                  <span aria-hidden="true" className="cr-v">v</span>
                  <span className={sideB.mine ? "cr-mine" : undefined}><TeamBadge name={sideB.name} size="lg" label={sideB.mine ? `Team ${sideB.name}, your team` : undefined} /></span>
                  <b className="cr-lname">{title}</b>
                </div>
                <p className="cr-lockline"><IconLock size={14} /><span>Teams cannot be changed after the match is created. To use different teams, cancel this match and create a new one, or use Rematch.</span></p>
              </section>

              <section className="cr-card" aria-labelledby="ed-format-h">
                <h2 id="ed-format-h">Format</h2>
                <FormatSection v={v} set={set} errors={errors} mode="edit" status={status} recentVenues={recentVenues} lastWhen={lastWhen}
                  minPlayers={maxLineup > 2 ? maxLineup : undefined}
                  minPlayersWhy={<>At least {maxLineup}, because a lineup already has {maxLineup} players. <Link href={`${base}/lineup`} className="cr-link">Pick lineups</Link></>} />
              </section>

              <section className="cr-card" aria-labelledby="ed-rules-h">
                <h2 id="ed-rules-h">Rules</h2>
                <RulesSection v={v} set={set} errors={errors} onReset={() => setV(resetRules(v))} />
              </section>
            </div>

            <div className="cr-sidecol">
            <section className="cr-card cr-diff" aria-labelledby="ed-diff-h">
              <header>
                <h2 id="ed-diff-h" className="cr-eyebrow">What will change</h2>
                <span className={`cr-status ${statusClass}`}>{nextLabel}</span>
              </header>
              {rows.length === 0 && effect.nextStatus === status ? (
                <div className="cr-drow"><span>Nothing changed yet</span><b>–</b></div>
              ) : (
                <dl className="cr-rows">
                  {rows.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.from} to {r.to}</dd></div>)}
                  {effect.nextStatus !== status && <div><dt>Status</dt><dd>{STATUS_LABEL[status]} to {nextLabel}</dd></div>}
                </dl>
              )}
              {effect.warn && <div className="cr-alert gold" role="status"><IconWarn size={18} /><span>{effect.warn}</span></div>}
              {effect.alert && <AlertBox tone="info">Everyone gets an alert: “{effect.alert}”</AlertBox>}
              {effect.note && !effect.warn && <p className="cr-hint">{effect.note}</p>}
              {hasErrors && (
                <div className="cr-errsum" role="alert">
                  <IconWarn size={18} />
                  <div><b>{serverMsg ?? SERVER_TEXT.fix}</b><small>{thingsText(list.length)}</small></div>
                  <ul>
                    {list.map(([k, msg]) => (
                      <li key={k}><span><b>{fieldLabel(k)}</b><small>{msg}</small></span><button type="button" className="cr-fix" onClick={() => fix(k)} aria-label={`Fix ${fieldLabel(k)}`}>Fix</button></li>
                    ))}
                  </ul>
                </div>
              )}
              {tooMany && (
                <div className="cr-alert red" role="status">
                  <IconWarn size={18} />
                  <span>{sideA.name} has {lineup.a} in the lineup, {sideB.name} {lineup.b}. <Link href={`${base}/lineup`} className="cr-link">Pick lineups</Link></span>
                </div>
              )}
            </section>

            <section className="cr-card cr-managecard" aria-labelledby="ed-manage-h">
              <h2 id="ed-manage-h" className="cr-eyebrow">Manage this match</h2>
              <MatchManage communityId={communityId} matchId={matchId} status={status} title={title} whenLabel={whenLabel} keys={["postpone", "cancel", "delete"]} comingCount={comingCount} />
            </section>
            <div className="cr-bar">
              <Link href={base} className="btn ghost">Cancel</Link>
              <button type="submit" className="btn gold" disabled={pending || hasErrors}>{pending ? "Saving…" : "Save changes"}</button>
            </div>

            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
