// Phase 8: series and tournaments. Pure rules, no database: the tally, the status in words, the points table and the form checks.
// A drawn series stays drawn: there is no tie-break and no manual winner.
import { clean } from "@/lib/validation";

export const SERIES_NAME_MIN = 2;
export const SERIES_NAME_MAX = 60;
export const SIDE_NAME_MIN = 2;
export const SIDE_NAME_MAX = 40;
export const SERIES_NOTES_MAX = 300;
export const SERIES_SIDES_MIN = 2;
export const SERIES_SIDES_MAX = 8;
export const BEST_OF_MIN = 1;
export const BEST_OF_MAX = 21;
export const POINTS = { win: 2, tie: 1, noResult: 1 } as const;

export type SeriesFormat = "open" | "best_of";
export type SeriesSide = { id?: string; name: string; teamId: string | null };

/* ---------- form rules ---------- */
export type SeriesInput = { name: string; format: SeriesFormat; bestOf: number | null; startsOn: string | null; endsOn: string | null; notes: string; sides: SeriesSide[] };
type Errors = Record<string, string>;
type Result<T> = { ok: true; value: T } | { ok: false; errors: Errors };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function realDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export type SideRaw = { teamId?: unknown; name?: unknown };

export function validateSeries(
  raw: { name?: unknown; format?: unknown; bestOf?: unknown; startsOn?: unknown; endsOn?: unknown; notes?: unknown },
  sidesRaw: SideRaw[],
  teamNames: Map<string, string>,
): Result<SeriesInput> {
  const errors: Errors = {};
  const name = clean(raw.name);
  if (name.length < SERIES_NAME_MIN) errors.name = `Give the series a name (at least ${SERIES_NAME_MIN} letters).`;
  else if (name.length > SERIES_NAME_MAX) errors.name = `The name can be at most ${SERIES_NAME_MAX} characters.`;

  const format: SeriesFormat = raw.format === "best_of" ? "best_of" : "open";
  if (raw.format !== undefined && raw.format !== "" && raw.format !== "open" && raw.format !== "best_of") errors.format = "Choose open-ended or best of.";
  let bestOf: number | null = null;
  if (format === "best_of") {
    const s = typeof raw.bestOf === "number" ? String(raw.bestOf) : typeof raw.bestOf === "string" ? raw.bestOf.trim() : "";
    const n = /^\d{1,2}$/.test(s) ? Number(s) : NaN;
    if (!Number.isInteger(n) || n < BEST_OF_MIN || n > BEST_OF_MAX) errors.bestOf = `Best of must be a whole number from ${BEST_OF_MIN} to ${BEST_OF_MAX}.`;
    else bestOf = n;
  }

  const sOn = clean(raw.startsOn), eOn = clean(raw.endsOn);
  const startsOn = sOn || null, endsOn = eOn || null;
  if (startsOn && !realDate(startsOn)) errors.startsOn = "Choose a real start date.";
  if (endsOn && !realDate(endsOn)) errors.endsOn = "Choose a real end date.";
  if (startsOn && endsOn && !errors.startsOn && !errors.endsOn && endsOn < startsOn) errors.endsOn = "The end date cannot be before the start date.";

  const notes = clean(raw.notes);
  if (notes.length > SERIES_NOTES_MAX) errors.notes = `Notes can be at most ${SERIES_NOTES_MAX} characters.`;

  // sides: blank rows are ignored; a chosen team wins over a typed name
  const sides: SeriesSide[] = [];
  for (const [i, r] of sidesRaw.entries()) {
    const teamId = typeof r.teamId === "string" ? r.teamId.trim() : "";
    const typed = clean(r.name);
    if (!teamId && !typed) continue;
    if (teamId) {
      const n = teamNames.get(teamId);
      if (!n) { errors[`side${i}`] = "That team is not part of this community."; continue; }
      sides.push({ teamId, name: n });
    } else if (typed.length < SIDE_NAME_MIN) errors[`side${i}`] = `A team name needs at least ${SIDE_NAME_MIN} letters.`;
    else if (typed.length > SIDE_NAME_MAX) errors[`side${i}`] = `A team name can be at most ${SIDE_NAME_MAX} characters.`;
    else sides.push({ teamId: null, name: typed });
  }
  if (sides.length > SERIES_SIDES_MAX) errors.sides = `A series can have at most ${SERIES_SIDES_MAX} teams.`;
  else if (!Object.keys(errors).some((k) => k.startsWith("side")) && sides.length < SERIES_SIDES_MIN) errors.sides = `Choose at least ${SERIES_SIDES_MIN} teams.`;
  const seen = new Set<string>(), teams = new Set<string>();
  for (const s of sides) {
    const k = s.name.toLowerCase();
    if (seen.has(k)) errors.sides = "Each team can be in the series only once (names are compared without capitals).";
    seen.add(k);
    if (s.teamId) { if (teams.has(s.teamId)) errors.sides = "Each team can be in the series only once."; teams.add(s.teamId); }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, format, bestOf, startsOn, endsOn, notes, sides } };
}

/* ---------- the tally ---------- */
export type SeriesMatch = {
  matchId: string;
  status: string;                                   // match status
  resultKind: "win" | "tie" | "no_result" | "innings" | "abandoned" | null;
  winnerPosition: 1 | 2 | null;                     // which side of the match won
  side1: { name: string; teamId: string | null };
  side2: { name: string; teamId: string | null };
};

/** Which series team a match side is: by permanent team when both have one, otherwise by name. -1 when it is not in the series. */
export function sideIndex(sides: SeriesSide[], s: { name: string; teamId: string | null }): number {
  const byTeam = s.teamId ? sides.findIndex((x) => x.teamId === s.teamId) : -1;
  return byTeam >= 0 ? byTeam : sides.findIndex((x) => x.name.trim().toLowerCase() === s.name.trim().toLowerCase());
}

export type Row = { name: string; played: number; won: number; lost: number; tied: number; noResult: number; points: number };
export type Tally = { rows: Row[]; counted: number; tied: number; noResult: number; abandoned: number; unfinished: number };

/** Count finished matches. An abandoned match is not counted. Matches still to be played are not counted either. */
export function tally(sides: SeriesSide[], matches: SeriesMatch[]): Tally {
  const rows: Row[] = sides.map((s) => ({ name: s.name, played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0 }));
  let counted = 0, tied = 0, noResult = 0, abandoned = 0, unfinished = 0;
  for (const m of matches) {
    if (m.status === "abandoned" || m.resultKind === "abandoned") { abandoned++; continue; }
    if (m.status !== "completed" || !m.resultKind) { unfinished++; continue; }
    const a = sideIndex(sides, m.side1), b = sideIndex(sides, m.side2);
    if (a < 0 || b < 0 || a === b) continue;
    counted++;
    rows[a]!.played++; rows[b]!.played++;
    if (m.resultKind === "win" && m.winnerPosition) {
      const w = m.winnerPosition === 1 ? a : b, l = m.winnerPosition === 1 ? b : a;
      rows[w]!.won++; rows[w]!.points += POINTS.win; rows[l]!.lost++;
    } else if (m.resultKind === "tie") {
      tied++; rows[a]!.tied++; rows[b]!.tied++; rows[a]!.points += POINTS.tie; rows[b]!.points += POINTS.tie;
    } else {
      noResult++; rows[a]!.noResult++; rows[b]!.noResult++; rows[a]!.points += POINTS.noResult; rows[b]!.points += POINTS.noResult;
    }
  }
  return { rows, counted, tied, noResult, abandoned, unfinished };
}

/** Points table: points, then wins, then name. */
export function pointsTable(t: Tally): Row[] {
  return [...t.rows].sort((a, b) => b.points - a.points || b.won - a.won || a.name.localeCompare(b.name));
}

/** "Alpha 2 – Bravo 1 (1 tied)" for two teams; a short line for more. */
export function tallyLine(t: Tally): string {
  if (t.rows.length === 2) {
    const [a, b] = t.rows as [Row, Row];
    const extra = [t.tied ? `${t.tied} tied` : "", t.noResult ? `${t.noResult} no result` : ""].filter(Boolean).join(", ");
    return `${a.name} ${a.won} – ${b.name} ${b.won}${extra ? ` (${extra})` : ""}`;
  }
  const top = pointsTable(t).slice(0, 3).map((r) => `${r.name} ${r.points}`).join(" · ");
  return t.counted ? `Points: ${top}` : "No finished matches yet";
}

export type Status = { text: string; winner: string | null; drawn: boolean; clinched: boolean; inProgress: boolean };

/**
 * The series in words. Best of N: the first team to win more than half of N has won it. A closed series is decided by the tally.
 * A level tally is shown as drawn: the app never forces a winner.
 */
export function seriesStatus(format: SeriesFormat, bestOf: number | null, closed: boolean, t: Tally): Status {
  const rows = t.rows;
  if (rows.length < 2) return { text: "Not set up yet", winner: null, drawn: false, clinched: false, inProgress: !closed };
  const byWins = [...rows].sort((a, b) => b.won - a.won);
  const top = byWins[0]!, second = byWins[1]!;
  const twoTeams = rows.length === 2;
  const need = format === "best_of" && bestOf ? Math.floor(bestOf / 2) + 1 : null;

  if (need !== null && top.won >= need && top.won > second.won) {
    return { text: `${top.name} won the series ${top.won}–${second.won} (best of ${bestOf})${closed ? "" : ". It is still open, so more matches can be played."}`, winner: top.name, drawn: false, clinched: true, inProgress: false };
  }
  const level = twoTeams ? top.won === second.won : (() => { const p = pointsTable(t); return p.length > 1 && p[0]!.points === p[1]!.points; })();
  const leader = twoTeams ? (top.won > second.won ? top : null) : (() => { const p = pointsTable(t); return p[0]!.points > (p[1]?.points ?? -1) ? p[0]! : null; })();

  if (closed) {
    if (!t.counted) return { text: "Closed with no finished matches", winner: null, drawn: false, clinched: false, inProgress: false };
    if (level || !leader) return { text: `Drawn${twoTeams ? ` ${top.won}–${second.won}` : ""}${t.tied ? ` (${t.tied} tied)` : ""}`, winner: null, drawn: true, clinched: false, inProgress: false };
    return { text: twoTeams ? `${leader.name} won ${leader.won}–${rows.find((r) => r !== leader)!.won}` : `${leader.name} won on points`, winner: leader.name, drawn: false, clinched: false, inProgress: false };
  }
  const prefix = format === "best_of" && bestOf ? `Best of ${bestOf}: ` : "";
  if (!t.counted) return { text: `${prefix}no finished matches yet`, winner: null, drawn: false, clinched: false, inProgress: true };
  if (level || !leader) return { text: `${prefix}level${twoTeams ? ` at ${top.won}–${second.won}` : ""}`, winner: null, drawn: false, clinched: false, inProgress: true };
  return { text: `${prefix}${leader.name} leads${twoTeams ? ` ${leader.won}–${rows.find((r) => r !== leader)!.won}` : ""}`, winner: null, drawn: false, clinched: false, inProgress: true };
}

/** A match can join a series only when both of its sides are teams of that series, and they are two different teams. */
export function sidesFit(sides: SeriesSide[], m: Pick<SeriesMatch, "side1" | "side2">): { ok: true } | { ok: false; reason: string } {
  const a = sideIndex(sides, m.side1), b = sideIndex(sides, m.side2);
  if (a < 0 || b < 0) {
    const missing = [a < 0 ? m.side1.name : null, b < 0 ? m.side2.name : null].filter(Boolean).join(" and ");
    return { ok: false, reason: `${missing} ${a < 0 && b < 0 ? "are" : "is"} not a team of this series. Add the team to the series first.` };
  }
  return { ok: true };
}

export const FORMAT_TEXT = (format: SeriesFormat, bestOf: number | null) => (format === "best_of" && bestOf ? `Best of ${bestOf}` : "Open-ended: no fixed number of matches");
