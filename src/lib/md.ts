// Phase D (UI redesign), Builder D1: the plain rules behind the Match details page and the toss card.
// No database and no React in here, so every rule can be tested on its own. The server still decides everything that matters.
import { NOT_STARTED, PLAYERS_MIN, STATUS_LABEL, type MatchStatus } from "@/lib/matchRules";

const notStarted = (s: string) => (NOT_STARTED as readonly string[]).includes(s);

/* ---------- status badge in the hero ---------- */
export type BadgeTone = "gold" | "green" | "red" | "orange" | "mute";
export function statusBadge(status: MatchStatus): { label: string; tone: BadgeTone } {
  const tone: Record<MatchStatus, BadgeTone> = {
    draft: "mute", scheduled: "gold", live: "red", paused: "orange", completed: "green", postponed: "orange", cancelled: "red", abandoned: "red",
  };
  return { label: STATUS_LABEL[status], tone: tone[status] };
}

/* ---------- the one big button ---------- */
export type Primary = { kind: "score" | "pad" | "watch" | "report"; label: string; href: string; hint: string | null } | null;

/** One primary action per status. Cancelled and postponed matches have nothing to score, so no button. */
export function primaryAction(base: string, status: MatchStatus, o: { iHoldTheLock: boolean; scorerName: string | null }): Primary {
  if (status === "completed" || status === "abandoned") return { kind: "report", label: "Match report", href: `${base}/report`, hint: null };
  if (status === "cancelled" || status === "postponed") return null;
  if (status === "live" || status === "paused") {
    const hint = o.scorerName ? `Scoring now: ${o.scorerName}` : null;
    return o.iHoldTheLock
      ? { kind: "pad", label: "Open the scoring pad", href: `${base}/score`, hint }
      : { kind: "watch", label: "Watch live or take over", href: `${base}/score`, hint };
  }
  return { kind: "score", label: "Start scoring", href: `${base}/score`, hint: null };
}

/** A side with fewer than two players cannot be scored well; the page says so above Start scoring. It never blocks. */
export function lineupGap(status: MatchStatus, counts: [number, number]): string | null {
  if (status !== "draft" && status !== "scheduled") return null;
  if (counts[0] >= PLAYERS_MIN && counts[1] >= PLAYERS_MIN) return null;
  return `Each side needs at least ${PLAYERS_MIN} players before scoring can start.`;
}

/* ---------- lineup progress ---------- */
export function pickedText(picked: number, needed: number): string {
  return `${picked} of ${needed} picked`;
}
export function pickedPercent(picked: number, needed: number): number {
  if (needed <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((picked / needed) * 100)));
}

/* ---------- "Are you coming?" bar ---------- */
export function replyBar(inn: number, out: number, noReply: number): { inPct: number; outPct: number; nonePct: number } {
  const total = inn + out + noReply;
  if (total <= 0) return { inPct: 0, outPct: 0, nonePct: 100 };
  const inPct = Math.round((inn / total) * 100);
  const outPct = Math.round((out / total) * 100);
  return { inPct, outPct, nonePct: Math.max(0, 100 - inPct - outPct) };
}

/* ---------- banners after an action ---------- */
export type Banner = { tone: "green" | "mute"; text: string; links: { href: string; label: string }[] };

/** The green line after ?created=1, ?saved=1 and ?rematch=1 (with &series= or &seriesnote=1). Words as today, plus the next step. */
export function createdBanners(q: { created?: string; saved?: string; rematch?: string; series?: string; seriesnote?: string }, base: string, canEdit: boolean): Banner[] {
  const out: Banner[] = [];
  if (q.created) out.push({ tone: "green", text: "Match created. Everyone in the community was told and can reply.", links: canEdit ? [{ href: `${base}/lineup`, label: "Pick lineups" }] : [] });
  if (q.saved) out.push({ tone: "green", text: "Changes saved.", links: [] });
  if (q.rematch) {
    out.push({
      tone: "green",
      text: `Rematch created. Lineups were copied: change them below if you need to.${q.series ? " It is part of the series." : ""}`,
      links: canEdit ? [{ href: `${base}/lineup`, label: "Review lineups" }, { href: `${base}/edit`, label: "Edit" }] : [],
    });
    if (q.seriesnote) out.push({ tone: "mute", text: "The rematch was created, but it could not be added to a series. You can add it from the series page.", links: [] });
  } else if (q.seriesnote) {
    out.push({ tone: "mute", text: "The match was created, but it could not be added to a series. You can add it from the series page.", links: [] });
  }
  return out;
}

/** After postpone or cancel the page says where the match went. */
export function afterActionLink(code: string | undefined, communityId: string): { href: string; label: string } | null {
  if (code === "postponed" || code === "cancelled") return { href: `/c/${communityId}/matches`, label: "View in Matches" };
  return null;
}

/* ---------- toss ---------- */
export type TossFacts = { winner: 1 | 2 | null; decision: "bat" | "bowl" | null; battingFirst: 1 | 2 | null };

export function tossSummary(t: TossFacts, names: [string, string]): { line: string; batting: string; battingSide: 1 | 2 } | null {
  if (!t.winner || !t.decision) return null;
  const batting = (t.battingFirst ?? (t.decision === "bat" ? t.winner : t.winner === 1 ? 2 : 1)) as 1 | 2;
  return { line: `${names[t.winner - 1]} won the toss and chose to ${t.decision}.`, batting: `${names[batting - 1]} bats first.`, battingSide: batting };
}

/** Who bats first for a toss that is being typed or flipped (the server works it out the same way). */
export function battingFirstOf(winner: 1 | 2, decision: "bat" | "bowl"): 1 | 2 {
  return decision === "bat" ? winner : winner === 1 ? 2 : 1;
}

/** The server's validation messages (lib/matchRules.ts validateToss and tossAction), mapped to the field that is wrong. */
export type TossProblem = { field: "winner" | "decision" | null; locked: boolean; text: string };
export function tossProblem(error: string | undefined): TossProblem | null {
  if (!error) return null;
  if (/choose which team won/i.test(error)) return { field: "winner", locked: false, text: error };
  if (/choose what the toss winner/i.test(error)) return { field: "decision", locked: false, text: error };
  if (/already started/i.test(error)) return { field: null, locked: true, text: error };
  return { field: null, locked: false, text: error };
}

/** The four steps of the coin flow, in order. The current step is gold, the steps before it are green. */
export const TOSS_STEPS = ["Who calls", "Call", "Toss", "Choose"] as const;
export function tossStep(o: { call: boolean; phase: "ready" | "flipping" | "result" }): 0 | 1 | 2 | 3 {
  if (o.phase === "result") return 3;
  if (o.phase === "flipping") return 2;
  return o.call ? 2 : 0;
}
