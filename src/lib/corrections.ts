// Phase D3: the history of corrections to a finished match, rebuilt from the stored log. Nothing new is saved:
// a correction is one "edit" row in match_event (who: actor_name, when: client_at, why: reason, which ball: payload.target,
// what: payload.patch). The figures before and after are found by replaying the log up to that row and up to the one
// before it, with the same engine the app always uses. Pure functions, no database.
import { buildState, effectiveEvents } from "@/lib/engine/engine";
import type { BallPayload, BallRecord, ExtraKind, MatchState, ScoreEvent } from "@/lib/engine/types";
import { computeMatchStats } from "@/lib/stats";

export type CorrectionChange = { label: string; from: string; to: string };
export type CorrectionScore = { label: string; before: string; after: string };

export type CorrectionRecord = {
  /** The id of the correction row itself. */
  eventId: string;
  by: string | null;
  /** When it was saved (ISO text), or null when the row has no time. */
  at: string | null;
  reason: string | null;
  /** The ball that was corrected. */
  ballId: string;
  inningsLabel: string | null;
  /** The ball as the commentary wrote it after the correction, for example "0.4 Kamran Baig to Ali Raza: Four runs." */
  ballText: string | null;
  /** Short plain descriptions of the ball before and after. */
  before: string;
  after: string;
  /** Only the parts that changed (runs, extra, wicket). */
  changes: CorrectionChange[];
  /** Innings totals that moved because of it. */
  scores: CorrectionScore[];
  resultBefore: string | null;
  resultAfter: string | null;
  pomBefore: string | null;
  pomAfter: string | null;
};

const EXTRA: Record<ExtraKind, string> = { wide: "wide", noball: "no ball", bye: "bye", legbye: "leg-bye" };
const WICKET: Record<string, string> = { bowled: "bowled", caught: "caught", lbw: "lbw", stumped: "stumped", hit_wicket: "hit wicket", run_out: "run out" };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function nameOf(m: MatchState, id: string | null | undefined): string {
  return id ? m.players[id]?.name ?? "a player" : "";
}

function wicketText(m: MatchState, w: NonNullable<BallPayload["wicket"]>): string {
  const how = WICKET[w.type] ?? w.type;
  const extra: string[] = [];
  if (w.fielder) extra.push(`fielder ${nameOf(m, w.fielder)}`);
  if (w.type === "run_out" && w.out) extra.push(`${nameOf(m, w.out)} out`);
  return `wicket, ${how}${extra.length ? ` (${extra.join(", ")})` : ""}`;
}

/** One ball in plain words, from what was entered: "wide and 1 run", "4 runs", "dot ball", "4 runs, wicket (run out)". */
export function describeBall(m: MatchState, p: BallPayload): string {
  const runs = p.runs ?? 0;
  const parts: string[] = [];
  if (p.extra) parts.push(runs > 0 ? `${EXTRA[p.extra]} and ${plural(runs, "run")}` : EXTRA[p.extra]);
  else parts.push(runs > 0 ? plural(runs, "run") : "dot ball");
  if (p.wicket) parts.push(wicketText(m, p.wicket));
  return parts.join(", ");
}

function findBall(m: MatchState, id: string): { rec: BallRecord; innings: string } | null {
  for (const inn of m.innings) {
    const rec = inn.balls.find((b) => b.eventId === id);
    if (rec) return { rec, innings: inn.superOver ? `Super over: ${m.sides[inn.batting - 1]}` : `Innings ${inn.index + 1}: ${m.sides[inn.batting - 1]}` };
  }
  return null;
}

const scoreOf = (m: MatchState) => m.innings.map((i) => ({ label: i.superOver ? `Super over, ${m.sides[i.batting - 1]}` : `${m.sides[i.batting - 1]}, innings ${i.index + 1}`, text: `${i.runs}/${i.wickets}` }));

function pomNames(m: MatchState): string | null {
  const { pom } = computeMatchStats(m);
  if (!pom || !pom.winners.length) return null;
  return pom.winners.map((id) => m.players[id]?.name ?? "a player").join(" and ");
}

/**
 * Every correction still standing in the log, oldest first. Corrections that were undone are not listed (the engine drops them).
 * `events` is the whole stored log in order (the same list the report is built from).
 */
export function correctionsOf(events: ScoreEvent[]): CorrectionRecord[] {
  const eff = effectiveEvents(events);
  if (!eff.ok) return [];
  const list = eff.list;
  const out: CorrectionRecord[] = [];
  list.forEach((ev, k) => {
    if (ev.type !== "edit") return;
    const target = list.find((e) => e.id === ev.payload.target);
    if (!target || target.type !== "ball") return;
    // the ball as it stood just before this correction: as entered, with the earlier corrections laid on top
    let beforePayload: BallPayload = { ...(target.payload as BallPayload) };
    for (let j = 0; j < k; j++) {
      const e = list[j]!;
      if (e.type === "edit" && e.payload.target === ev.payload.target) beforePayload = { ...beforePayload, ...e.payload.patch };
    }
    const afterPayload: BallPayload = { ...beforePayload, ...ev.payload.patch };
    const a = buildState(list.slice(0, k));
    const b = buildState(list.slice(0, k + 1));
    if (!a.ok || !b.ok) return;
    const ms = b.state, ma = a.state;
    const found = findBall(ms, ev.payload.target);
    const changes: CorrectionChange[] = [];
    const sameRuns = (beforePayload.runs ?? 0) === (afterPayload.runs ?? 0);
    if (!sameRuns) changes.push({ label: "Runs", from: String(beforePayload.runs ?? 0), to: String(afterPayload.runs ?? 0) });
    if ((beforePayload.extra ?? null) !== (afterPayload.extra ?? null)) {
      changes.push({ label: "Extra", from: beforePayload.extra ? EXTRA[beforePayload.extra] : "none", to: afterPayload.extra ? EXTRA[afterPayload.extra] : "none" });
    }
    const wb = beforePayload.wicket ?? null, wa = afterPayload.wicket ?? null;
    if (JSON.stringify(wb ? { t: wb.type, o: wb.out ?? null, f: wb.fielder ?? null } : null) !== JSON.stringify(wa ? { t: wa.type, o: wa.out ?? null, f: wa.fielder ?? null } : null)) {
      changes.push({ label: "Wicket", from: wb ? wicketText(ma, wb) : "no wicket", to: wa ? wicketText(ms, wa) : "no wicket" });
    }
    const sb = scoreOf(ma), sa = scoreOf(ms);
    const scores: CorrectionScore[] = [];
    sa.forEach((s, i) => { const o = sb[i]; if (o && o.text !== s.text) scores.push({ label: s.label, before: o.text, after: s.text }); });
    out.push({
      eventId: ev.id,
      by: ev.by ?? null,
      at: ev.at ?? null,
      reason: ev.reason?.trim() ? ev.reason.trim() : null,
      ballId: ev.payload.target,
      inningsLabel: found?.innings ?? null,
      ballText: found?.rec.text ?? null,
      before: describeBall(ma, beforePayload),
      after: describeBall(ms, afterPayload),
      changes,
      scores,
      resultBefore: ma.result?.text ?? null,
      resultAfter: ms.result?.text ?? null,
      pomBefore: pomNames(ma),
      pomAfter: pomNames(ms),
    });
  });
  return out;
}
