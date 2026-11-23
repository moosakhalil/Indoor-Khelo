// Phase 4: pure rules for creating a match. No database in here, so every rule can be tested alone.
import { clean } from "@/lib/validation";

export const OVERS_PRESETS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20] as const;
export const OVERS_MIN = 1;
export const OVERS_MAX = 50;
export const PLAYERS_MIN = 2;
export const PLAYERS_MAX = 11;
export const PLAYERS_DEFAULT = 6;
export const VENUE_MAX = 80;
export const UMPIRE_MAX = 40;
export const NOTES_MAX = 300;
export const SIDE_NAME_MIN = 2;
export const SIDE_NAME_MAX = 40;
export const GUEST_NAME_MAX = 60;
export const SEVERAL_MAX = 10;

export const DISMISSALS = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "stumped", label: "Stumped" },
  { value: "hit_wicket", label: "Hit wicket" },
  { value: "run_out", label: "Run out" },
  { value: "retired_out", label: "Retired out" },
] as const;

export const SUPER_OVER_MODES = [
  { value: "ask", label: "Ask me when the match ends level (a tie is the default)" },
  { value: "always", label: "Always play a super over when level" },
  { value: "never", label: "Never: a level score is a tie" },
] as const;

export const MATCH_STATUSES = ["draft", "scheduled", "live", "paused", "completed", "postponed", "cancelled", "abandoned"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export const STATUS_LABEL: Record<MatchStatus, string> = {
  draft: "Draft", scheduled: "Scheduled", live: "Live", paused: "Paused", completed: "Completed",
  postponed: "Postponed", cancelled: "Cancelled", abandoned: "Abandoned",
};
/** Before the match starts: the setup can still be changed. */
export const NOT_STARTED: readonly MatchStatus[] = ["draft", "scheduled", "postponed"];

export type BowlerLimit = { mode: "none" } | { mode: "max"; overs: number } | { mode: "pattern"; pattern: number[] };

/** Rules snapshot saved with every match. Traditional defaults (section 11.1 of the plan). */
export type Rules = {
  version: 1;
  innings: 1 | 2;
  ballsPerOver: number;
  wideRuns: number;
  noBallRuns: number;
  widesReBowled: boolean;
  noBallsReBowled: boolean;
  byesCountAsBalls: boolean;
  legByesCountAsBalls: boolean;
  freeHit: boolean;
  overthrows: boolean;
  retiredCanReturn: boolean;
  sameBowlerTwoInARow: boolean;
  lastBatterAlone: boolean;
  dismissals: string[];
  superOver: "ask" | "always" | "never";
  bowlerLimit: BowlerLimit;
};

export const DEFAULT_RULES: Rules = {
  version: 1,
  innings: 2,
  ballsPerOver: 6,
  wideRuns: 1,
  noBallRuns: 1,
  widesReBowled: true,
  noBallsReBowled: true,
  byesCountAsBalls: true,
  legByesCountAsBalls: true,
  freeHit: true,
  overthrows: true,
  retiredCanReturn: true,
  sameBowlerTwoInARow: false,
  lastBatterAlone: true,
  dismissals: DISMISSALS.map((d) => d.value),
  superOver: "ask",
  bowlerLimit: { mode: "none" },
};

type Errors = Record<string, string>;
type Raw = Record<string, unknown>;

const flag = (v: unknown) => v === "on" || v === "true" || v === true || v === "1";
const wholeNumber = (v: unknown): number | null => {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  return /^\d{1,3}$/.test(s) ? Number(s) : null;
};

/** "2-1-1", "2 1 1", "2,1,1" and "2/1/1" all mean the same pattern. */
export function parsePattern(input: unknown): { ok: true; pattern: number[] } | { ok: false; error: string } {
  const text = clean(input);
  if (!text) return { ok: false, error: "Type the over pattern, for example 2-1-1." };
  const parts = text.split(/[\s,\-/+]+/).filter(Boolean);
  const nums: number[] = [];
  for (const p of parts) {
    const n = wholeNumber(p);
    if (n === null || n < 1 || n > OVERS_MAX) return { ok: false, error: `Each number in the pattern must be a whole number from 1 to ${OVERS_MAX}, for example 2-1-1.` };
    nums.push(n);
  }
  if (nums.length < 2) return { ok: false, error: "A pattern needs at least two numbers, for example 2-1-1. For one number for everyone use “Maximum per bowler”." };
  if (nums.length > PLAYERS_MAX) return { ok: false, error: `A pattern can have at most ${PLAYERS_MAX} numbers.` };
  return { ok: true, pattern: nums };
}

export const patternText = (p: number[]) => p.join("-");

/** The rule is that the limit should add up to the match overs. This is a warning, never a block. */
export function bowlerLimitWarning(limit: BowlerLimit, overs: number): string | null {
  if (limit.mode === "pattern") {
    const sum = limit.pattern.reduce((a, b) => a + b, 0);
    if (sum !== overs) return `The pattern ${patternText(limit.pattern)} adds up to ${sum} overs, but the match is ${overs} overs. Please check it.`;
  }
  return null;
}

/** Rules and bowler limit from the form. `overs` and `playersPerSide` are already checked. */
export function validateRules(raw: Raw, overs: number, playersPerSide: number): { ok: true; value: Rules; warning: string | null } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const num = (key: string, label: string, min: number, max: number, fallback: number): number => {
    const v = raw[key];
    if (v === undefined || v === null || v === "") return fallback;
    const n = wholeNumber(v);
    if (n === null || n < min || n > max) { errors[key] = `${label} must be a whole number from ${min} to ${max}.`; return fallback; }
    return n;
  };
  const innings = num("innings", "Innings", 1, 2, 2);
  const ballsPerOver = num("ballsPerOver", "Balls per over", 1, 12, 6);
  const wideRuns = num("wideRuns", "Wide runs", 0, 5, 1);
  const noBallRuns = num("noBallRuns", "No-ball runs", 0, 5, 1);

  // Checkboxes only arrive when ticked, so a form that includes the marker field reads missing ones as off.
  const has = raw.rulesForm === "1";
  const on = (key: string, fallback: boolean) => (has ? flag(raw[key]) : raw[key] === undefined ? fallback : flag(raw[key]));

  const dismissalsRaw = Array.isArray(raw.dismissals) ? raw.dismissals.map(String) : raw.dismissals === undefined ? DEFAULT_RULES.dismissals : [String(raw.dismissals)];
  const allowed = new Set<string>(DISMISSALS.map((d) => d.value));
  const dismissals = DISMISSALS.map((d) => d.value as string).filter((v) => dismissalsRaw.includes(v));
  if (dismissalsRaw.some((d) => !allowed.has(d))) errors.dismissals = "One of the ways of getting out is not on the list.";
  else if (dismissals.length < 1) errors.dismissals = "Keep at least one way of getting out switched on.";

  const so = raw.superOver === undefined || raw.superOver === "" ? "ask" : String(raw.superOver);
  if (!["ask", "always", "never"].includes(so)) errors.superOver = "Choose one of the super over options.";

  // Bowler over limit: none, one maximum for everyone, or a quota pattern such as 2-1-1.
  const mode = raw.limitMode === undefined || raw.limitMode === "" ? "none" : String(raw.limitMode);
  let bowlerLimit: BowlerLimit = { mode: "none" };
  if (!["none", "max", "pattern"].includes(mode)) errors.limitMode = "Choose a bowler limit option.";
  else if (mode === "max") {
    const n = wholeNumber(raw.limitMax);
    if (n === null || n < 1) errors.limitMax = "Type how many overs each bowler may bowl (a whole number, at least 1).";
    else if (n > overs) errors.limitMax = `A bowler cannot be limited to more than the match overs (${overs}).`;
    else if (n * playersPerSide < overs) errors.limitMax = `With ${playersPerSide} players and ${n} over${n === 1 ? "" : "s"} each, a ${overs}-over innings could never be finished. Raise the limit.`;
    else bowlerLimit = { mode: "max", overs: n };
  } else if (mode === "pattern") {
    const p = parsePattern(raw.limitPattern);
    if (!p.ok) errors.limitPattern = p.error;
    else if (p.pattern.length > playersPerSide) errors.limitPattern = `The pattern has ${p.pattern.length} bowlers but a side has only ${playersPerSide} players.`;
    else if (Math.max(...p.pattern) > overs) errors.limitPattern = `One number in the pattern is bigger than the match overs (${overs}).`;
    else bowlerLimit = { mode: "pattern", pattern: p.pattern };
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  const value: Rules = {
    version: 1,
    innings: innings as 1 | 2,
    ballsPerOver,
    wideRuns,
    noBallRuns,
    widesReBowled: on("widesReBowled", true),
    noBallsReBowled: on("noBallsReBowled", true),
    byesCountAsBalls: on("byesCountAsBalls", true),
    legByesCountAsBalls: on("legByesCountAsBalls", true),
    freeHit: on("freeHit", true),
    overthrows: on("overthrows", true),
    retiredCanReturn: on("retiredCanReturn", true),
    sameBowlerTwoInARow: on("sameBowlerTwoInARow", false),
    lastBatterAlone: on("lastBatterAlone", true),
    dismissals,
    superOver: so as Rules["superOver"],
    bowlerLimit,
  };
  return { ok: true, value, warning: bowlerLimitWarning(bowlerLimit, overs) };
}

/* ---------- date and time ---------- */

export function validTimeZone(tz: unknown): string | null {
  if (typeof tz !== "string" || !tz || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** "2026-11-28T19:30" typed in a time zone → the exact moment (UTC). Returns null when the text is not a real date and time. */
export function zonedToUtc(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const probe = new Date(asUtc);
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d || probe.getUTCHours() !== h || probe.getUTCMinutes() !== mi) return null;
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t));
    const get = (k: string) => Number(parts.find((p) => p.type === k)!.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - t;
  };
  let t = asUtc - offsetAt(asUtc);
  t = asUtc - offsetAt(t);
  return new Date(t);
}

const HOUR = 3_600_000;
/** Typing the wrong year is the usual mistake, so: not more than 12 hours ago and not more than a year ahead. */
export function checkWhen(when: Date, now: Date): string | null {
  if (when.getTime() < now.getTime() - 12 * HOUR) return "That date and time is in the past. Choose today or a later day.";
  if (when.getTime() > now.getTime() + 366 * 24 * HOUR) return "That date is more than a year away. Please check the year.";
  return null;
}

export function formatWhen(d: Date | null, tz: string): string {
  if (!d) return "No date yet";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

/** Value for a datetime-local input, in the viewer's own zone. */
export function toLocalInput(d: Date | null, tz: string): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (k: string) => parts.find((p) => p.type === k)!.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/* ---------- the whole match form ---------- */

export type SideInput = { teamId: string | null; name: string };
export type MatchInput = {
  sides: [SideInput, SideInput];
  scheduledAt: Date | null;
  venue: string;
  overs: number;
  playersPerSide: number;
  rules: Rules;
  umpire: string;
  notes: string;
  warning: string | null;
};

export type SideRaw = { teamId?: unknown; name?: unknown };

/** What the setup form is allowed to say; teamNames lets us fill a permanent team's name. */
export function validateSides(a: SideRaw, b: SideRaw, teamNames: Map<string, string>): { ok: true; value: [SideInput, SideInput] } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const side = (raw: SideRaw, key: string, label: string): SideInput => {
    const id = typeof raw.teamId === "string" ? raw.teamId.trim() : "";
    if (id) {
      const n = teamNames.get(id);
      if (!n) { errors[key] = `${label} is not a team of this community.`; return { teamId: null, name: "" }; }
      return { teamId: id, name: n };
    }
    const name = clean(raw.name);
    if (!name) { errors[key] = `Choose ${label} or type a match-only team name.`; return { teamId: null, name: "" }; }
    if (name.length < SIDE_NAME_MIN) errors[key] = `A team name needs at least ${SIDE_NAME_MIN} letters.`;
    else if (name.length > SIDE_NAME_MAX) errors[key] = `A team name can be at most ${SIDE_NAME_MAX} characters.`;
    return { teamId: null, name };
  };
  const sa = side(a, "sideA", "the first team");
  const sb = side(b, "sideB", "the second team");
  if (!errors.sideA && !errors.sideB) {
    if (sa.teamId && sa.teamId === sb.teamId) errors.sideB = "The two sides must be different teams.";
    else if (sa.name.toLowerCase() === sb.name.toLowerCase()) errors.sideB = "The two sides need different names.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: [sa, sb] };
}

export function validateMatchDetails(raw: Raw, tz: string, now: Date): { ok: true; value: Omit<MatchInput, "sides"> } | { ok: false; errors: Errors } {
  const errors: Errors = {};

  const when = clean(raw.when);
  let scheduledAt: Date | null = null;
  if (when) {
    const d = zonedToUtc(when, tz);
    if (!d) errors.when = "Choose a real date and time.";
    else {
      const bad = checkWhen(d, now);
      if (bad) errors.when = bad;
      else scheduledAt = d;
    }
  }

  const venue = clean(raw.venue);
  if (venue.length > VENUE_MAX) errors.venue = `The venue can be at most ${VENUE_MAX} characters.`;
  const umpire = clean(raw.umpire);
  if (umpire.length > UMPIRE_MAX) errors.umpire = `The umpire name can be at most ${UMPIRE_MAX} characters.`;
  const notes = clean(raw.notes);
  if (notes.length > NOTES_MAX) errors.notes = `Notes can be at most ${NOTES_MAX} characters.`;

  // Overs: a preset, or "custom" with a number typed in.
  let overs = 0;
  const preset = typeof raw.oversPreset === "string" ? raw.oversPreset : "";
  const custom = preset === "custom" || preset === "";
  const oversValue = custom ? wholeNumber(raw.oversCustom) : wholeNumber(preset);
  if (oversValue === null || oversValue < OVERS_MIN || oversValue > OVERS_MAX) errors.overs = `Overs must be a whole number from ${OVERS_MIN} to ${OVERS_MAX}.`;
  else overs = oversValue;

  const ppRaw = raw.playersPerSide === undefined || raw.playersPerSide === "" ? PLAYERS_DEFAULT : wholeNumber(raw.playersPerSide);
  let playersPerSide = PLAYERS_DEFAULT;
  if (ppRaw === null || ppRaw < PLAYERS_MIN || ppRaw > PLAYERS_MAX) errors.playersPerSide = `Players per side must be a whole number from ${PLAYERS_MIN} to ${PLAYERS_MAX}.`;
  else playersPerSide = ppRaw;

  let rules: Rules = DEFAULT_RULES;
  let warning: string | null = null;
  if (!errors.overs && !errors.playersPerSide) {
    const r = validateRules(raw, overs, playersPerSide);
    if (!r.ok) Object.assign(errors, r.errors);
    else { rules = r.value; warning = r.warning; }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { scheduledAt, venue, overs, playersPerSide, rules, umpire, notes, warning } };
}

/** Guest: a name only. */
export function validateGuestName(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const name = clean(input);
  if (!name) return { ok: false, error: "Type the guest's name." };
  if (name.length > GUEST_NAME_MAX) return { ok: false, error: `A guest name can be at most ${GUEST_NAME_MAX} characters.` };
  return { ok: true, value: name };
}

/** Toss: winner and decision go together; a batting side follows from them. */
export function validateToss(winner: unknown, decision: unknown): { ok: true; value: { winnerSide: 1 | 2 | null; decision: "bat" | "bowl" | null; battingFirst: 1 | 2 | null } } | { ok: false; error: string } {
  const w = winner === "1" || winner === "2" ? (Number(winner) as 1 | 2) : null;
  const d = decision === "bat" || decision === "bowl" ? decision : null;
  if (!w && !d && (winner === "" || winner === undefined || winner === null) && (decision === "" || decision === undefined || decision === null)) {
    return { ok: true, value: { winnerSide: null, decision: null, battingFirst: null } };
  }
  if (!w) return { ok: false, error: "Choose which team won the toss." };
  if (!d) return { ok: false, error: "Choose what the toss winner decided: bat or bowl." };
  const battingFirst = d === "bat" ? w : ((w === 1 ? 2 : 1) as 1 | 2);
  return { ok: true, value: { winnerSide: w, decision: d, battingFirst } };
}
