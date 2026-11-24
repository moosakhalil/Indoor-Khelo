// Phase B (UI redesign), Builder 4: the pure rules of the matches list. No database in here, so the page, the cards and the
// tests all use the same plain data. Dates are turned into words on the server and sent as text.
import { NOT_STARTED, formatWhen, type MatchStatus } from "@/lib/matchRules";

export type MatchItem = {
  id: string;
  status: MatchStatus;
  side1: string;
  side2: string;
  /** The viewer plays for this side's community team (gold ring on the badge). */
  mine1: boolean;
  mine2: boolean;
  when: string;
  venue: string;
  overs: number;
  /** Only the viewer's own reply. The list card never carries the counts. */
  myAnswer: "in" | "out" | null;
  /** Live: "47/2". Completed or abandoned: "72/4 · 68/6". */
  score: string | null;
  /** Live: "4.2 ov". */
  scoreSub: string | null;
  /** Live second innings: "Panthers need 12 from 10". */
  chase: string | null;
  /** Completed: "Thunder Strikers won by 6 runs". */
  result: string | null;
  /** Starts within the next 7 days (or today). */
  thisWeek: boolean;
  /** Created by "Plan several" just now. */
  isNew: boolean;
  /** Sort key for the upcoming group (milliseconds, null = no date). */
  at: number | null;
};

export type Segment = "all" | "live" | "upcoming" | "past";
export type ChipKey = "reply" | "mine" | "drafts" | "week";

export const GROUP_OF: Record<MatchStatus, "live" | "upcoming" | "past"> = {
  live: "live", paused: "live",
  draft: "upcoming", scheduled: "upcoming", postponed: "upcoming",
  completed: "past", abandoned: "past", cancelled: "past",
};

export const isNotStarted = (s: MatchStatus) => (NOT_STARTED as readonly string[]).includes(s);

/** "Needs my reply": no reply yet for a draft, scheduled or postponed match. */
export const needsReply = (m: Pick<MatchItem, "status" | "myAnswer">) => isNotStarted(m.status) && !m.myAnswer;

export const titleOf = (m: Pick<MatchItem, "side1" | "side2">) => `${m.side1} v ${m.side2}`;

export function counts(items: MatchItem[]): Record<Segment, number> {
  const c: Record<Segment, number> = { all: items.length, live: 0, upcoming: 0, past: 0 };
  for (const m of items) c[GROUP_OF[m.status]]++;
  return c;
}

export function chipCounts(items: MatchItem[]): Record<ChipKey, number> {
  return {
    reply: items.filter(needsReply).length,
    mine: items.filter((m) => m.mine1 || m.mine2).length,
    drafts: items.filter((m) => m.status === "draft").length,
    week: items.filter((m) => m.thisWeek && GROUP_OF[m.status] === "upcoming").length,
  };
}

export function filterMatches(items: MatchItem[], f: { segment: Segment; query: string; chips: ChipKey[] }): MatchItem[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((m) => {
    if (f.segment !== "all" && GROUP_OF[m.status] !== f.segment) return false;
    if (q && !`${m.side1} ${m.side2} ${m.venue}`.toLowerCase().includes(q)) return false;
    if (f.chips.includes("reply") && !needsReply(m)) return false;
    if (f.chips.includes("mine") && !(m.mine1 || m.mine2)) return false;
    if (f.chips.includes("drafts") && m.status !== "draft") return false;
    if (f.chips.includes("week") && !(m.thisWeek && GROUP_OF[m.status] === "upcoming")) return false;
    return true;
  });
}

/** Live first, then upcoming (new ones, then soonest, no date last), then past (newest first). */
export function groupMatches(items: MatchItem[]): { key: "live" | "upcoming" | "past"; title: string; items: MatchItem[] }[] {
  const live = items.filter((m) => GROUP_OF[m.status] === "live");
  const upcoming = items.filter((m) => GROUP_OF[m.status] === "upcoming")
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || (a.at ?? Infinity) - (b.at ?? Infinity));
  const past = items.filter((m) => GROUP_OF[m.status] === "past").sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  return [
    { key: "live" as const, title: "Live now", items: live },
    { key: "upcoming" as const, title: "Upcoming", items: upcoming },
    { key: "past" as const, title: "Past", items: past },
  ].filter((g) => g.items.length > 0);
}

/** "3 matches planned" / "1 match planned". */
export const plannedHeadline = (n: number) => `${n} match${n === 1 ? "" : "es"} planned`;
export const PLANNED_EXPLAIN = "Each one is separate, with its own replies and lineup.";

export const WEEK_MS = 7 * 24 * 3600 * 1000;

/** The actions in a match's menu. Only what the match page can already do, in the states it can do it. */
export function menuFor(status: MatchStatus): { key: "open" | "lineup" | "edit" | "rematch" | "postpone" | "cancel" | "delete"; label: string; danger?: boolean }[] {
  const out: { key: "open" | "lineup" | "edit" | "rematch" | "postpone" | "cancel" | "delete"; label: string; danger?: boolean }[] = [{ key: "open", label: "Open match" }];
  if (isNotStarted(status)) {
    out.push({ key: "lineup", label: "Pick lineups" }, { key: "edit", label: "Edit match" });
  }
  out.push({ key: "rematch", label: "Rematch" });
  if (status === "scheduled" || status === "draft") out.push({ key: "postpone", label: "Postpone…" });
  if (isNotStarted(status)) out.push({ key: "cancel", label: "Cancel match…", danger: true });
  if (isNotStarted(status) || status === "cancelled") out.push({ key: "delete", label: "Delete match…", danger: true });
  return out;
}

type RowLike = {
  id: string; status: MatchStatus; scheduled_at: Date | null; venue: string; overs: number;
  side1_name: string; side1_team: string | null; side2_name: string; side2_team: string | null;
  my_answer: "in" | "out" | null; created_at?: Date;
};

/** One database row (and what the server worked out for it) as plain data for the list. */
export function toMatchItem(
  m: RowLike,
  tz: string,
  extra: { myTeams?: ReadonlySet<string>; summary?: { score: string | null; scoreSub: string | null; chase: string | null; result: string | null }; isNew?: boolean; now?: Date } = {},
): MatchItem {
  const now = (extra.now ?? new Date()).getTime();
  const at = m.scheduled_at ? m.scheduled_at.getTime() : null;
  return {
    id: m.id, status: m.status, side1: m.side1_name, side2: m.side2_name,
    mine1: !!(m.side1_team && extra.myTeams?.has(m.side1_team)),
    mine2: !!(m.side2_team && extra.myTeams?.has(m.side2_team)),
    when: formatWhen(m.scheduled_at, tz), venue: m.venue, overs: m.overs, myAnswer: m.my_answer,
    score: extra.summary?.score ?? null, scoreSub: extra.summary?.scoreSub ?? null, chase: extra.summary?.chase ?? null, result: extra.summary?.result ?? null,
    thisWeek: at !== null && at >= now - 12 * 3600 * 1000 && at <= now + WEEK_MS,
    isNew: !!extra.isNew, at,
  };
}
