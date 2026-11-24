// Phase C (UI redesign), Builder C2: pure rules for "Plan several matches" and "Rematch". No database, no React in here.
import { DEFAULT_RULES, PLAYERS_DEFAULT, PLAYERS_MAX, PLAYERS_MIN, SEVERAL_MAX, patternText, type Rules } from "@/lib/matchRules";

/* ---------- local date text (what a datetime-local field holds, "2026-11-28T20:00") ---------- */
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseLocal(s: string): { y: number; mo: number; d: number; h: number; mi: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d || t.getUTCHours() !== h || t.getUTCMinutes() !== mi) return null;
  return { y, mo, d, h, mi };
}

const clock = (h: number, mi: number) => `${h % 12 === 0 ? 12 : h % 12}:${String(mi).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;

/** "2026-11-28T20:00" becomes "Sat 28 Nov, 8:00 pm" (empty when it is not a real date and time). */
export function fmtLocal(s: string): string {
  const p = parseLocal(s);
  if (!p) return "";
  const wd = WD[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]!;
  return `${wd} ${p.d} ${MON[p.mo - 1]}, ${clock(p.h, p.mi)}`;
}

/** The same moment written for a datetime-local field, N days later on the wall clock. */
export function addDaysLocal(s: string, days: number): string {
  const p = parseLocal(s);
  if (!p) return "";
  const t = new Date(Date.UTC(p.y, p.mo - 1, p.d + days, p.h, p.mi));
  return localString(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes());
}

const two = (n: number) => String(n).padStart(2, "0");
const localString = (y: number, mo: number, d: number, h: number, mi: number) => `${y}-${two(mo)}-${two(d)}T${two(h)}:${two(mi)}`;

/** A moment as the viewer's own clock shows it (the browser's zone), in datetime-local form. */
export const toLocalString = (d: Date) => localString(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes());

/** A moment in a named time zone, "Sat 22 Nov, 8:00 pm" (or just "Sat 22 Nov" with dayOnly). */
export function fmtInstant(d: Date, tz: string, dayOnly = false): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = `${g("weekday")} ${g("day")} ${g("month")}`;
  return dayOnly ? day : `${day}, ${g("hour")}:${g("minute")} ${g("dayPeriod").toLowerCase()}`;
}

/** The chips under the rematch date: same time next week (the usual case) and tomorrow at the same time of day. */
export function quickDates(sourceIso: string | null, now: Date): { nextWeek: { value: string; label: string } | null; tomorrow: { value: string; label: string } } {
  const src = sourceIso ? new Date(sourceIso) : null;
  const has = !!src && !Number.isNaN(src.getTime());
  const h = has ? src!.getHours() : 18;
  const mi = has ? src!.getMinutes() : 0;
  let nextWeek: { value: string; label: string } | null = null;
  if (has) {
    let t = new Date(src!.getFullYear(), src!.getMonth(), src!.getDate() + 7, h, mi);
    while (t.getTime() < now.getTime()) t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 7, h, mi);
    const value = toLocalString(t);
    nextWeek = { value, label: `Next week, same time: ${fmtLocal(value)}` };
  }
  const tm = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, mi);
  const tv = toLocalString(tm);
  return { nextWeek, tomorrow: { value: tv, label: `Tomorrow, ${clock(h, mi)}` } };
}

/* ---------- plan several: the rows ---------- */
export type SevRow = { id: string; when: string; venue: string; preset: string; custom: string };
export const newRow = (id: string, over: Partial<SevRow> = {}): SevRow => ({ id, when: "", venue: "", preset: "6", custom: "", ...over });

export const matchesWord = (n: number) => `${n} match${n === 1 ? "" : "es"}`;
export const createLabel = (n: number) => `Create ${matchesWord(n)}`;
export const LIMIT_HINT = `Up to ${SEVERAL_MAX} at a time. You can plan more any time.`;
export const ALERT_NOTE = "Everyone gets one alert per match: “New match: … Are you coming?”";

/** Copy of a row for "Duplicate" (the copy sits right after it). */
export function duplicateAt(rows: SevRow[], index: number, id: string): SevRow[] {
  if (rows.length >= SEVERAL_MAX || !rows[index]) return rows;
  const copy = { ...rows[index]!, id };
  return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
}

/** "Repeat last, +7 days": the next weekly fixture with the same venue and overs. */
export function repeatLast(rows: SevRow[], id: string): SevRow[] {
  if (rows.length >= SEVERAL_MAX) return rows;
  const last = rows[rows.length - 1];
  if (!last) return [...rows, newRow(id)];
  return [...rows, { ...last, id, when: last.when ? addDaysLocal(last.when, 7) : "" }];
}

export function removeAt(rows: SevRow[], index: number): SevRow[] {
  if (rows.length <= 1) return rows;
  return rows.filter((_, i) => i !== index);
}

export const clampPlayers = (n: number) => Math.min(PLAYERS_MAX, Math.max(PLAYERS_MIN, n));
export function stepPlayers(current: string, by: 1 | -1): string {
  const n = Number.parseInt(current, 10);
  return String(clampPlayers(Number.isNaN(n) ? PLAYERS_DEFAULT : n + by));
}

/** Errors the server sent for one row (the server numbers rows from 0, in the order they were sent). */
export function rowErrors(fe: Record<string, string>, index: number): { when?: string; venue?: string; overs?: string } {
  return { when: fe[`when_${index}`], venue: fe[`venue_${index}`], overs: fe[`overs_${index}`] };
}

/** Players per side is checked once per dated row on the server; show it once. */
export function playersError(fe: Record<string, string>): string | undefined {
  if (fe.playersPerSide) return fe.playersPerSide;
  const k = Object.keys(fe).find((x) => x.startsWith("playersPerSide_"));
  return k ? fe[k] : undefined;
}

/** How many separate things need a fix (players per side counts once). */
export function attentionCount(fe: Record<string, string>): number {
  const keys = new Set(Object.keys(fe).map((k) => (k.startsWith("playersPerSide_") ? "playersPerSide" : k)));
  return keys.size;
}
export const attentionText = (n: number) => `${n} thing${n === 1 ? "" : "s"} ${n === 1 ? "needs" : "need"} attention.`;

/* ---------- banners for the failures the server can send ---------- */
export const NO_ZONE = "We could not read your phone's time zone. Please reload the page and try again.";
export type FailBanner = { icon: "lock" | "warn"; headline: string; detail?: string; next?: "plan" | "retry" };

function zoneBanner(): FailBanner {
  const i = NO_ZONE.indexOf(". ");
  return { icon: "warn", headline: NO_ZONE.slice(0, i + 1), detail: NO_ZONE.slice(i + 2) };
}

export function severalBanner(error: string | undefined): FailBanner | null {
  if (!error || error === "Please fix the highlighted fields.") return null;
  if (error === NO_ZONE) return zoneBanner();
  if (error === "Only members of this community can create matches.") return { icon: "lock", headline: error };
  return { icon: "warn", headline: error };
}

export function rematchBanner(error: string | undefined, hasFieldErrors: boolean): FailBanner | null {
  if (!error || hasFieldErrors) return null;
  if (error === NO_ZONE) return zoneBanner();
  if (error === "Only members of this community can create matches.") return { icon: "lock", headline: error };
  if (error === "The original match no longer exists.") return { icon: "warn", headline: error, next: "plan" };
  if (error === "The rematch could not be created.") return { icon: "warn", headline: error, detail: "Try again in a moment.", next: "retry" };
  return { icon: "warn", headline: error };
}

/* ---------- rematch: what is copied ---------- */
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function isTraditional(rules: Rules): boolean {
  const def = DEFAULT_RULES as unknown as Record<string, unknown>;
  const r = rules as unknown as Record<string, unknown>;
  return Object.keys(def).every((k) => {
    if (k === "bowlerLimit") return true;
    if (k === "dismissals") return sameValue([...(r[k] as string[] ?? [])].sort(), [...(def[k] as string[])].sort());
    return sameValue(r[k], def[k]);
  });
}

export function limitText(rules: Rules): string {
  const l = rules.bowlerLimit;
  if (!l || l.mode === "none") return "no bowler limit";
  if (l.mode === "max") return `at most ${l.overs} over${l.overs === 1 ? "" : "s"} per bowler`;
  return `over pattern ${patternText(l.pattern)}`;
}

export const rulesHint = (rules: Rules, playersPerSide: number) =>
  `${isTraditional(rules) ? "Traditional rules" : "Custom rules"}, ${limitText(rules)}, ${playersPerSide} players a side.`;

export const lineupTitle = (n: number) => `${n} player${n === 1 ? "" : "s"} copied into the lineups`;
export const LINEUP_HINT = "You can change them before the match: swap players, add a guest, or use someone from another team.";
export const LINEUP_EMPTY_HINT = "The first match had no lineup, so the rematch starts with none. Pick them later, even on match day.";
export const SEPARATE_NOTE = "It is a separate match. Replies, toss and scores are not copied.";

export function teamsHint(permanent1: boolean, permanent2: boolean): string {
  if (permanent1 && permanent2) return "The permanent squads stay exactly as they are.";
  if (!permanent1 && !permanent2) return "Match-only teams are copied by name.";
  return "The permanent squad stays exactly as it is. The match-only team is copied by name.";
}

export const rematchButton = (inOpenSeries: boolean, makeSeries: boolean, pending: boolean) =>
  pending ? "Creating…" : inOpenSeries ? "Play another match in this series" : makeSeries ? "Create rematch and series" : "Create rematch";
