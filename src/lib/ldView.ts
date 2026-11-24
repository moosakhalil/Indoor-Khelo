// Phase F2 (leaderboard, compare, insights, player analytics): small pure helpers that turn numbers the libraries
// already computed (career.ts, analytics.ts) into what the screens say. Nothing here changes how a statistic is computed.
import type { CompareRow, FormPoint, FormSummary } from "@/lib/analytics";
import { ordinal, type BoardRow, type Career, type StatDef } from "@/lib/career";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

/** "all_rounder" becomes "All-rounder"; nothing chosen gives null. */
export const roleLabel = (v: string | null | undefined): string | null => labelOf(PLAYING_ROLES, v);

/** The small line under a name: "#7 · Batter" (the number and the role, whichever exist). */
export function personLine(number: number | null, role: string | null | undefined): string {
  const parts = [number === null ? null : `#${number}`, roleLabel(role)].filter((x): x is string => !!x);
  return parts.join(" · ");
}

/* ---------- leaderboard ---------- */

export type RankCard =
  | { kind: "ranked"; rankText: string; of: number; tied: boolean; valueText: string; sentence: string }
  | { kind: "unranked"; reason: string; progress: string | null }
  | null;

/** What you have so far towards the minimum of a rate stat, in words. Only for stats that have a minimum. */
export function progressText(def: StatDef, c: Career): string | null {
  if (!def.qualifies) return null;
  if (def.group === "batting") return `You have ${c.batting.innings} innings and ${c.batting.balls} balls so far.`;
  if (def.group === "bowling") {
    const overs = Math.floor(c.bowling.balls / c.bowling.bpo), rest = c.bowling.balls % c.bowling.bpo;
    return `You have bowled ${overs}${rest ? `.${rest}` : ""} overs so far.`;
  }
  return `You have played ${c.matches} match${c.matches === 1 ? "" : "es"} so far.`;
}

/** The card with your place. Hidden (null) when you are not a member row or there is no data at all. */
export function rankCard(mine: BoardRow | undefined, rankedCount: number, def: StatDef, valueText: string, career: Career, hasData: boolean): RankCard {
  if (!mine) return null;
  if (!mine.ranked) {
    // With no data at all, "not ranked" would be noise: the page says everyone is listed and the numbers fill in later.
    if (!hasData) return null;
    return { kind: "unranked", reason: `${mine.note ?? "Not enough matches yet"}.`, progress: progressText(def, career) };
  }
  if (!hasData) return null;
  const rankText = ordinal(mine.rank!);
  return { kind: "ranked", rankText, of: rankedCount, tied: mine.tied, valueText, sentence: `You are ${rankText} of ${rankedCount}${mine.tied ? " (tied)" : ""}.` };
}

/** Up to three ranked members for the podium, in rank order. Zero-count members never get a podium place; no data, no podium. */
export function podiumOf(rows: BoardRow[], def: StatDef, hasData: boolean): BoardRow[] {
  if (!hasData) return [];
  return rows.filter((r) => r.ranked && (def.qualifies ? r.value !== null : r.value !== 0)).slice(0, 3);
}

/** The label of the order chip, in words. */
export function orderLabel(def: StatDef, flip: boolean): string {
  const lowFirst = (def.lowerIsBetter ?? false) !== flip;
  return lowFirst ? "Lowest first" : "Highest first";
}

/** "1 Nov 2026 to 23 Nov 2026" from two yyyy-mm-dd strings; one-sided ranges say "From" or "Until". */
export function rangeLabel(from: string | null, to: string | null): string {
  const f = (s: string) => {
    const d = new Date(`${s}T00:00:00Z`);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  };
  if (from && to) return `${f(from)} to ${f(to)}`;
  if (from) return `From ${f(from)}`;
  return `Until ${f(to!)}`;
}

/* ---------- compare ---------- */

/** The same four rows the page has always said are better when lower. */
export const LOWER_IS_BETTER_KEYS = new Set(["economy", "bowl_avg", "bowl_sr", "bat_dot"]);

export function compareScore(rows: CompareRow[]) {
  const a = rows.filter((r) => r.better === "a").length, b = rows.filter((r) => r.better === "b").length;
  return { a, b, level: rows.length - a - b, total: rows.length };
}

/** Which compare rows are the "level" ones (neither marked). */
export const levelRows = (rows: CompareRow[]) => rows.filter((r) => r.better === null);

/** The compare page link for a chosen pair (either side may be empty). */
export function compareHref(communityId: string, a: string | null, b: string | null): string {
  const q = new URLSearchParams();
  if (a) q.set("a", a);
  if (b) q.set("b", b);
  const s = q.toString();
  return `/c/${communityId}/compare${s ? `?${s}` : ""}`;
}

export type QuickPick = { a: string; b: string; aName: string; bName: string; label: string };

/**
 * First comparisons in one tap: you against the top run scorer, then the next pairs of top run scorers.
 * Built from the careers the page already loads; nothing is stored.
 */
export function quickPicks(members: { user_id: string; name: string }[], careers: Map<string, Career>, meId: string, max = 3): QuickPick[] {
  const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;
  const byRuns = members
    .map((m) => ({ ...m, runs: careers.get(m.user_id)?.batting.runs ?? 0, played: careers.get(m.user_id)?.matches ?? 0 }))
    .filter((m) => m.played > 0)
    .sort((x, y) => y.runs - x.runs || x.name.localeCompare(y.name));
  const out: QuickPick[] = [];
  const push = (x: { user_id: string; name: string }, y: { user_id: string; name: string }, xLabel = first(x.name)) => {
    if (x.user_id === y.user_id || out.some((o) => (o.a === x.user_id && o.b === y.user_id) || (o.a === y.user_id && o.b === x.user_id))) return;
    out.push({ a: x.user_id, b: y.user_id, aName: x.name, bName: y.name, label: `${xLabel} v ${first(y.name)}` });
  };
  if (byRuns[0] && byRuns[1]) push(byRuns[0], byRuns[1]);
  const me = members.find((m) => m.user_id === meId);
  const top = byRuns.find((m) => m.user_id !== meId);
  if (me && top) push(me, top, "You");
  if (byRuns[2] && byRuns[3]) push(byRuns[2], byRuns[3]);
  if (byRuns[1] && byRuns[2]) push(byRuns[1], byRuns[2]);
  return out.slice(0, max);
}

/* ---------- player analytics ---------- */

/** The best point of a form chart, with a * when that innings was not out. */
export function bestText(points: FormPoint[], metric: "runs" | "wickets"): string | null {
  if (!points.length) return null;
  const top = points.reduce((b, p) => (p.value > b.value || (p.value === b.value && p.notOut && !b.notOut) ? p : b), points[0]!);
  return `${top.value}${metric === "runs" && top.notOut ? "*" : ""}`;
}

export type TrendBadge = { tone: "up" | "down" | "steady" | "need"; label: string };

/** The badge at the top of the form card. Under six matches it says how many are needed instead of leaving a gap. */
export function trendBadge(s: FormSummary, n: number): TrendBadge {
  if (s.direction === "up") return { tone: "up", label: "Improving" };
  if (s.direction === "down") return { tone: "down", label: "Down lately" };
  if (s.direction === "steady") return { tone: "steady", label: "Steady" };
  return { tone: "need", label: n < 6 ? "Needs 6 matches" : "No trend" };
}

const HOW_OUT: [string, string][] = [
  ["not_out", "Not out"], ["bowled", "Bowled"], ["caught", "Caught"], ["lbw", "LBW"], ["stumped", "Stumped"], ["hit_wicket", "Hit wicket"], ["run_out", "Run out"], ["retired_out", "Retired out"],
];

/** Every way of getting out (including the zeros, so the list is always the same shape) with the length of its bar. */
export function howOutRows(howOut: Record<string, number>): { key: string; label: string; count: number; pct: number }[] {
  const max = Math.max(1, ...HOW_OUT.map(([k]) => howOut[k] ?? 0));
  return HOW_OUT.map(([key, label]) => ({ key, label, count: howOut[key] ?? 0, pct: ((howOut[key] ?? 0) * 100) / max }));
}

export const f1 = (n: number) => n.toFixed(1);

/** Ball-by-ball is stored in legal balls; "a over" is ballsPerOver of them. */
export function oversText(balls: number, bpo = 6): string {
  return `${Math.floor(balls / bpo)}${balls % bpo ? `.${balls % bpo}` : ""}`;
}

/** The strike rate above which a batter v bowler row is shown in gold (named in the table header). */
export const STRIKE_RATE_HIGHLIGHT = 140;
