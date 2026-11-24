// Phase C (UI redesign), Builder C1: the pure rules of the new Create match wizard and the Edit match page.
// No database and no React in here. Everything that is validated is validated by the SAME functions the server action uses
// (validateSides, validateMatchDetails in matchRules.ts), so the wizard can never accept what the server would refuse.
import {
  DEFAULT_RULES, DISMISSALS, OVERS_MAX, OVERS_PRESETS, PLAYERS_DEFAULT, SIDE_NAME_MAX, bowlerLimitWarning, formatWhen, parsePattern,
  patternText, validateMatchDetails, validateSides, type BowlerLimit, type MatchStatus, type Rules,
} from "@/lib/matchRules";

/* ---------- the values of the form ---------- */

export type SideMode = "none" | "team" | "own";
export type FlagKey =
  | "widesReBowled" | "noBallsReBowled" | "byesCountAsBalls" | "legByesCountAsBalls" | "freeHit" | "overthrows"
  | "retiredCanReturn" | "sameBowlerTwoInARow" | "lastBatterAlone";

/** The nine switches, with the words the app has always used. */
export const FLAGS: { key: FlagKey; label: string; hint?: string; group: "extras" | "batbowl" }[] = [
  { key: "widesReBowled", label: "Wide is not counted, bowled again", group: "extras" },
  { key: "noBallsReBowled", label: "No ball is not counted, bowled again", group: "extras" },
  { key: "byesCountAsBalls", label: "Byes count as balls", group: "extras" },
  { key: "legByesCountAsBalls", label: "Leg-byes count as balls", group: "extras" },
  { key: "freeHit", label: "Free hit after a no ball", hint: "The batter can only be run out on a free hit.", group: "extras" },
  { key: "overthrows", label: "Overthrows allowed", group: "extras" },
  { key: "retiredCanReturn", label: "A retired batter can come back", group: "batbowl" },
  { key: "sameBowlerTwoInARow", label: "Same bowler can bowl two overs in a row", group: "batbowl" },
  { key: "lastBatterAlone", label: "Last batter can bat alone", hint: "If off, the innings ends when one batter is left.", group: "batbowl" },
];

export type LimitMode = "none" | "max" | "pattern";

export type SetupValues = {
  modeA: SideMode; teamA: string; nameA: string;
  modeB: SideMode; teamB: string; nameB: string;
  /** "YYYY-MM-DDTHH:mm" in the person's own zone, or "" (a draft). */
  when: string;
  venue: string;
  /** "6" or "custom". */
  oversPreset: string;
  oversCustom: string;
  playersPerSide: string;
  umpire: string;
  notes: string;
  innings: string;
  ballsPerOver: string;
  wideRuns: string;
  noBallRuns: string;
  flags: Record<FlagKey, boolean>;
  dismissals: string[];
  superOver: string;
  limitMode: LimitMode;
  limitMax: string;
  limitPattern: string;
};

export function rulesToValues(r: Rules): Pick<SetupValues, "innings" | "ballsPerOver" | "wideRuns" | "noBallRuns" | "flags" | "dismissals" | "superOver" | "limitMode" | "limitMax" | "limitPattern"> {
  const lim = r.bowlerLimit;
  return {
    innings: String(r.innings), ballsPerOver: String(r.ballsPerOver), wideRuns: String(r.wideRuns), noBallRuns: String(r.noBallRuns),
    flags: {
      widesReBowled: r.widesReBowled, noBallsReBowled: r.noBallsReBowled, byesCountAsBalls: r.byesCountAsBalls, legByesCountAsBalls: r.legByesCountAsBalls,
      freeHit: r.freeHit, overthrows: r.overthrows, retiredCanReturn: r.retiredCanReturn, sameBowlerTwoInARow: r.sameBowlerTwoInARow, lastBatterAlone: r.lastBatterAlone,
    },
    dismissals: [...r.dismissals], superOver: r.superOver,
    limitMode: lim.mode, limitMax: lim.mode === "max" ? String(lim.overs) : "", limitPattern: lim.mode === "pattern" ? patternText(lim.pattern) : "",
  };
}

export function defaultValues(): SetupValues {
  return {
    modeA: "none", teamA: "", nameA: "", modeB: "none", teamB: "", nameB: "",
    when: "", venue: "", oversPreset: "6", oversCustom: "", playersPerSide: String(PLAYERS_DEFAULT), umpire: "", notes: "",
    ...rulesToValues(DEFAULT_RULES),
  };
}

/** The values of an existing match (edit page). The sides are not editable, so they stay empty. */
export function valuesFromMatch(m: { when: string; venue: string; overs: number; playersPerSide: number; rules: Rules; umpire: string; notes: string }): SetupValues {
  const preset = (OVERS_PRESETS as readonly number[]).includes(m.overs);
  return {
    ...defaultValues(),
    when: m.when, venue: m.venue, oversPreset: preset ? String(m.overs) : "custom", oversCustom: preset ? "" : String(m.overs),
    playersPerSide: String(m.playersPerSide), umpire: m.umpire, notes: m.notes,
    ...rulesToValues(m.rules),
  };
}

/** Back to the traditional rules (players per side and overs are format, not rules, so they stay). */
export function resetRules(v: SetupValues): SetupValues {
  return { ...v, ...rulesToValues(DEFAULT_RULES) };
}

/* ---------- what is posted: the SAME field names the old form used ---------- */

export function entriesOf(v: SetupValues, mode: "create" | "edit"): [string, string][] {
  const out: [string, string][] = [];
  if (mode === "create") {
    out.push(["sideATeam", v.modeA === "team" ? v.teamA : ""], ["sideAName", v.modeA === "own" ? v.nameA : ""]);
    out.push(["sideBTeam", v.modeB === "team" ? v.teamB : ""], ["sideBName", v.modeB === "own" ? v.nameB : ""]);
  }
  out.push(
    ["when", v.when], ["venue", v.venue], ["oversPreset", v.oversPreset], ["oversCustom", v.oversCustom], ["rulesForm", "1"],
    ["playersPerSide", v.playersPerSide], ["innings", v.innings], ["ballsPerOver", v.ballsPerOver], ["wideRuns", v.wideRuns], ["noBallRuns", v.noBallRuns],
  );
  for (const f of FLAGS) if (v.flags[f.key]) out.push([f.key, "on"]);
  for (const d of v.dismissals) out.push(["dismissals", d]);
  out.push(["superOver", v.superOver], ["limitMode", v.limitMode], ["limitMax", v.limitMax], ["limitPattern", v.limitPattern], ["umpire", v.umpire], ["notes", v.notes]);
  return out;
}

/** Same shape as `rawOf(fd)` in actions4.ts (dismissals can arrive several times). */
export function rawOf(v: SetupValues): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [k, val] of entriesOf(v, "edit")) {
    if (k === "dismissals") raw.dismissals = [...((raw.dismissals as string[] | undefined) ?? []), val];
    else raw[k] = val;
  }
  if (raw.dismissals === undefined) raw.dismissals = [];
  return raw;
}

/* ---------- validation (client side, with the server's own functions) ---------- */

export function validateSetup(v: SetupValues, mode: "create" | "edit", teamNames: Map<string, string>, tz: string, now: Date): Record<string, string> {
  const errors: Record<string, string> = {};
  if (mode === "create") {
    const e = Object.fromEntries(entriesOf(v, "create"));
    const sides = validateSides({ teamId: e.sideATeam, name: e.sideAName }, { teamId: e.sideBTeam, name: e.sideBName }, teamNames);
    if (!sides.ok) Object.assign(errors, sides.errors);
  }
  const d = validateMatchDetails(rawOf(v), tz, now);
  if (!d.ok) Object.assign(errors, d.errors);
  return errors;
}

/** 1 Teams, 2 Format, 3 Rules. */
export function stepOf(key: string): 1 | 2 | 3 {
  if (key === "sideA" || key === "sideB") return 1;
  if (["when", "venue", "overs", "playersPerSide", "umpire", "notes"].includes(key)) return 2;
  return 3;
}

export const STEP_NAMES = ["Teams", "Format", "Rules", "Review"] as const;

const LABELS: Record<string, string> = {
  sideA: "Teams: first team", sideB: "Teams: second team",
  when: "Format: date and time", venue: "Format: venue", overs: "Format: overs", playersPerSide: "Format: players per side", umpire: "Format: umpire", notes: "Format: notes",
  innings: "Rules: innings", ballsPerOver: "Rules: balls per over", wideRuns: "Rules: wide runs", noBallRuns: "Rules: no-ball runs",
  dismissals: "Rules: ways of getting out", superOver: "Rules: if the match ends level",
  limitMode: "Rules: bowler limit", limitMax: "Rules: bowler limit", limitPattern: "Rules: bowler limit",
};
export const fieldLabel = (key: string) => LABELS[key] ?? "Match";

/** The order problems are listed in: the order of the steps. */
export const ERROR_ORDER = Object.keys(LABELS);
export function sortedErrors(errors: Record<string, string>): [string, string][] {
  return Object.entries(errors).sort((a, b) => (ERROR_ORDER.indexOf(a[0]) + 1 || 99) - (ERROR_ORDER.indexOf(b[0]) + 1 || 99));
}

export const thingsText = (n: number) => `${n} thing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`;

/* ---------- small derived facts ---------- */

const whole = (s: string): number | null => (/^\d{1,3}$/.test(s.trim()) ? Number(s.trim()) : null);

export function oversOf(v: SetupValues): number | null {
  const n = v.oversPreset === "custom" ? whole(v.oversCustom) : whole(v.oversPreset);
  return n !== null && n >= 1 && n <= OVERS_MAX ? n : null;
}
export const playersOf = (v: SetupValues): number | null => whole(v.playersPerSide);

/** The fewest overs each bowler needs so a side can finish the innings. */
export const limitFloor = (overs: number, players: number) => Math.max(1, Math.ceil(overs / Math.max(1, players)));

export function limitOf(v: SetupValues): BowlerLimit {
  if (v.limitMode === "max") {
    const n = whole(v.limitMax);
    return n && n >= 1 ? { mode: "max", overs: n } : { mode: "none" };
  }
  if (v.limitMode === "pattern") {
    const p = parsePattern(v.limitPattern);
    return p.ok ? { mode: "pattern", pattern: p.pattern } : { mode: "none" };
  }
  return { mode: "none" };
}

/** The same sentence the match page shows today ("The pattern 2-1-1 adds up to 4 overs ..."), but before saving. */
export function setupWarning(v: SetupValues): string | null {
  const overs = oversOf(v);
  if (overs === null || v.limitMode !== "pattern") return null;
  return bowlerLimitWarning(limitOf(v), overs);
}

export function patternBowlers(v: SetupValues): { text: string; sum: number } | null {
  if (v.limitMode !== "pattern") return null;
  const p = parsePattern(v.limitPattern);
  return p.ok ? { text: p.pattern.map((n, i) => `Bowler ${i + 1}: ${n}`).join(", "), sum: p.pattern.reduce((a, b) => a + b, 0) } : null;
}

export function limitSummary(v: SetupValues): string {
  if (v.limitMode === "max") return v.limitMax.trim() ? `${v.limitMax.trim()} over${v.limitMax.trim() === "1" ? "" : "s"} per bowler` : "No limit";
  if (v.limitMode === "pattern") return v.limitPattern.trim() ? `Pattern ${v.limitPattern.trim()}` : "No limit";
  return "No limit";
}

/** How many rule controls differ from the traditional defaults. */
export function changeCount(v: SetupValues): number {
  const d = rulesToValues(DEFAULT_RULES);
  let n = 0;
  if (v.innings !== d.innings) n++;
  if (v.ballsPerOver.trim() !== d.ballsPerOver) n++;
  if (v.wideRuns.trim() !== d.wideRuns) n++;
  if (v.noBallRuns.trim() !== d.noBallRuns) n++;
  for (const f of FLAGS) if (v.flags[f.key] !== d.flags[f.key]) n++;
  const all = DISMISSALS.map((x) => x.value as string);
  if (all.some((x) => !v.dismissals.includes(x))) n++;
  if (v.superOver !== d.superOver) n++;
  if (v.limitMode !== "none") n++;
  return n;
}
export const changesText = (n: number) => (n === 0 ? "Traditional" : `${n} change${n === 1 ? "" : "s"}`);

export function sideName(v: SetupValues, side: "A" | "B", teams: { id: string; name: string }[]): string {
  const mode = side === "A" ? v.modeA : v.modeB;
  const id = side === "A" ? v.teamA : v.teamB;
  const name = side === "A" ? v.nameA : v.nameB;
  if (mode === "team") return teams.find((t) => t.id === id)?.name ?? "";
  if (mode === "own") return name.trim().replace(/\s+/g, " ");
  return "";
}

export const SIDE_MAX = SIDE_NAME_MAX;

/* ---------- dates: all in the person's own zone, as plain text ---------- */

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-28T20:00" -> "Sat 28 Nov, 8:00 pm" (no zone maths: the text is already in the person's zone). */
export function fmtLocal(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return "No date yet";
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  return formatWhen(new Date(Date.UTC(y, mo - 1, d, h, mi)), "UTC");
}

const clock = (h: number, mi: number) => `${((h + 11) % 12) + 1}:${pad(mi)} ${h < 12 ? "am" : "pm"}`;
const localValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * One-tap dates: Tonight, Tomorrow and the next day the community usually plays (the weekday and time of its latest match,
 * or Saturday 8:00 pm when there is none). `now` is the phone's own clock, so they are in the person's zone.
 */
export function quickDates(now: Date, last?: string | null): { label: string; value: string }[] {
  let h = 20, mi = 0, weekday = 6;
  const m = last ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(last) : null;
  if (m) {
    h = Number(m[4]); mi = Number(m[5]);
    weekday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  }
  const at = (dayOffset: number) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, h, mi); return d; };
  const out: { label: string; value: string }[] = [];
  const tonight = at(0);
  if (tonight.getTime() > now.getTime()) out.push({ label: `Tonight ${clock(h, mi)}`, value: localValue(tonight) });
  out.push({ label: `Tomorrow ${clock(h, mi)}`, value: localValue(at(1)) });
  for (let i = 2; i <= 8; i++) {
    const d = at(i);
    if (d.getDay() === weekday) { out.push({ label: `${SHORT_DAY[d.getDay()]} ${d.getDate()} ${SHORT_MONTH[d.getMonth()]} ${clock(h, mi)}`, value: localValue(d) }); break; }
  }
  return out;
}

/* ---------- the edit page: what will change ---------- */

export type EditEffect = {
  nextStatus: MatchStatus;
  /** The exact alert text members get (null when nobody is told). */
  alert: string | null;
  /** A gold warning (clearing the date of a scheduled match). */
  warn: string | null;
  /** A plain explanation of the status. */
  note: string | null;
};

/** Mirrors updateMatch in lib/matches.ts: what the status becomes and who is alerted. */
export function editEffect(status: MatchStatus, origWhen: string, newWhen: string, title: string): EditEffect {
  if (newWhen.trim()) {
    const moved = origWhen !== newWhen;
    const alert = moved ? (status === "draft" ? `New match: ${title}. Are you coming?` : `${title} has a new date or time.`) : null;
    const note = status === "postponed"
      ? (moved ? "Setting a date moves it to Scheduled and tells everyone." : "Saving with a date moves it to Scheduled. Nobody is told because the date did not change.")
      : null;
    return { nextStatus: "scheduled", alert, warn: null, note };
  }
  if (status === "postponed") return { nextStatus: "postponed", alert: null, warn: null, note: "Stays postponed until a date is set." };
  const warn = status === "scheduled" ? "Clearing the date turns this match back into a draft. Replies and lineups are kept. Nobody is told." : null;
  return { nextStatus: "draft", alert: null, warn, note: null };
}

export type DiffRow = { label: string; from: string; to: string };

export function diffRows(a: SetupValues, b: SetupValues): DiffRow[] {
  const rows: DiffRow[] = [];
  const oversText = (v: SetupValues) => { const o = oversOf(v); return o === null ? "?" : `${o} over${o === 1 ? "" : "s"}`; };
  if (a.when !== b.when) rows.push({ label: "When", from: a.when ? fmtLocal(a.when) : "no date", to: b.when ? fmtLocal(b.when) : "no date" });
  if (a.venue.trim() !== b.venue.trim()) rows.push({ label: "Venue", from: a.venue.trim() || "Not set", to: b.venue.trim() || "Not set" });
  if (oversText(a) !== oversText(b)) rows.push({ label: "Overs", from: oversText(a), to: oversText(b) });
  if (a.playersPerSide.trim() !== b.playersPerSide.trim()) rows.push({ label: "Players per side", from: a.playersPerSide.trim() || "?", to: b.playersPerSide.trim() || "?" });
  if (a.umpire.trim() !== b.umpire.trim()) rows.push({ label: "Umpire", from: a.umpire.trim() || "Not set", to: b.umpire.trim() || "Not set" });
  if (a.notes.trim() !== b.notes.trim()) rows.push({ label: "Notes", from: a.notes.trim() ? "Written" : "None", to: b.notes.trim() ? "Changed" : "Cleared" });
  const ruleKey = (v: SetupValues) => JSON.stringify([v.innings, v.ballsPerOver.trim(), v.wideRuns.trim(), v.noBallRuns.trim(), FLAGS.map((f) => v.flags[f.key]), [...v.dismissals].sort(), v.superOver, v.limitMode, v.limitMode === "max" ? v.limitMax.trim() : v.limitMode === "pattern" ? v.limitPattern.trim() : ""]);
  if (ruleKey(a) !== ruleKey(b)) rows.push({ label: "Rules", from: changesText(changeCount(a)), to: changesText(changeCount(b)) });
  return rows;
}

/** "Thunder Strikers already has more than 4 players in the lineup. Take some out first." -> side and max. */
export function parseTooMany(text: string | undefined): { side: string; max: number } | null {
  const m = text ? /^(.*) already has more than (\d+) players in the lineup\./.exec(text) : null;
  return m ? { side: m[1]!, max: Number(m[2]) } : null;
}

export const SERVER_TEXT = {
  fix: "Please fix the highlighted fields.",
  started: "This match has already started, so its setup can no longer be changed here.",
  gone: "That match no longer exists.",
  notMember: "Only members of this community can change matches.",
  notMemberCreate: "Only members of this community can create matches.",
} as const;
