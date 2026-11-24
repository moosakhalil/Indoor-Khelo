// Phase F1 (UI redesign): pure helpers for the Series screens. No database in here, so every rule can be tested alone.
// The numbers (tally, status in words, points table, which matches fit) all come from `src/lib/series.ts`; nothing is counted again here.
import { SERIES_NAME_MAX, sideIndex, type SeriesFormat, type SeriesSide, type Status } from "@/lib/series";

/* ---------- series cards (list) ---------- */
export type CardSide = { name: string; teamId: string | null; mine: boolean };
export type SeriesCardItem = {
  id: string; name: string; open: boolean; format: SeriesFormat; bestOf: number | null; matchCount: number;
  sides: CardSide[];
  /** Wins of each side, in the same order as `sides`. Only for two-team series. */
  wins: [number, number] | null;
  counted: number; line: string; statusText: string; status: Status;
};

export type StateKind = "not_started" | "in_progress" | "drawn" | "won" | "closed_empty";
export type SeriesState = { kind: StateKind; label: string; tone: "" | "green" | "orange" | "gold" };

/** The state in words and shape (never colour only): Not started, In progress, Drawn, Winner: name. */
export function seriesState(open: boolean, status: Status, counted: number): SeriesState {
  if (status.winner) return { kind: "won", label: `Winner: ${status.winner}`, tone: "gold" };
  if (status.drawn) return { kind: "drawn", label: "Drawn", tone: "orange" };
  if (!counted) return open ? { kind: "not_started", label: "Not started", tone: "" } : { kind: "closed_empty", label: "No finished matches", tone: "" };
  return { kind: "in_progress", label: "In progress", tone: "green" };
}

/** The word between the two big numbers: LEVEL when the wins are equal after a finished match, otherwise SERIES. */
export const scoreWord = (wins: [number, number], counted: number) => (counted > 0 && wins[0] === wins[1] ? "LEVEL" : "SERIES");

export const matchesText = (n: number) => `${n} match${n === 1 ? "" : "es"}`;
export const teamsText = (n: number) => `${n} team${n === 1 ? "" : "s"}`;
export const formatShort = (format: SeriesFormat, bestOf: number | null) => (format === "best_of" && bestOf ? `best of ${bestOf}` : "open-ended");
export const firstToText = (bestOf: number) => { const n = Math.floor(bestOf / 2) + 1; return `first to ${n} win${n === 1 ? "" : "s"}`; };

/** Progress marks for a best-of series: one mark per match of the format, filled for each counted match. */
export function progress(format: SeriesFormat, bestOf: number | null, counted: number): { total: number | null; filled: number; text: string } {
  if (format === "best_of" && bestOf) {
    const text = counted > bestOf ? `${matchesText(counted)} played` : `${counted} of ${bestOf} ${bestOf === 1 ? "match" : "matches"} played`;
    return { total: bestOf, filled: Math.min(counted, bestOf), text };
  }
  return { total: null, filled: counted, text: `${matchesText(counted)} played` };
}

/* ---------- filter and search (list) ---------- */
export type Segment = "all" | "open" | "closed";
export function segmentCounts(items: Pick<SeriesCardItem, "open">[]): Record<Segment, number> {
  return { all: items.length, open: items.filter((s) => s.open).length, closed: items.filter((s) => !s.open).length };
}
export function filterSeries<T extends Pick<SeriesCardItem, "open" | "name" | "sides">>(items: T[], seg: Segment, q: string): T[] {
  const needle = q.trim().toLowerCase();
  return items.filter((s) => {
    if (seg === "open" && !s.open) return false;
    if (seg === "closed" && s.open) return false;
    if (!needle) return true;
    return s.name.toLowerCase().includes(needle) || s.sides.some((x) => x.name.toLowerCase().includes(needle));
  });
}

/* ---------- messages ---------- */
export const PAGE_ERRORS: Record<string, string> = {
  not_in_series: "That match is not in this series.", bad_state: "That cannot be done in the series' current state.",
  forbidden: "Only members of this community can do that.", not_found: "That could not be found.",
};
export const GROUP_ERRORS: Record<string, string> = {
  name: "Type a name of 2 to 60 characters, or leave it empty for an automatic name.", name_taken: "A series with that name already exists.",
  in_other_series: "A match can be in only one series. One of the matches you chose is already in another series.", bad_match: "Choose at least one match.",
  too_few: "A series needs at least two teams.", sides: "Those matches have too many different teams for one series.", forbidden: "Only members of this community can create a series.",
};
export const GROUP_FALLBACK = "That could not be done.";

/** Messages after an action (the address carries ?saved, ?added, ?removed, ?status): a short snackbar, not a banner. */
export function toastFor(q: { saved?: string; added?: string; removed?: string; status?: string }, open: boolean): { message: string; tone: "success" } | null {
  if (q.saved) return { message: "Saved.", tone: "success" };
  if (q.added) return { message: `${q.added} match${q.added === "1" ? "" : "es"} added.`, tone: "success" };
  if (q.removed) return { message: "Match removed from the series. The match itself is kept.", tone: "success" };
  if (q.status) return { message: open ? "Series reopened." : "Series closed. Its record is kept.", tone: "success" };
  return null;
}

/* ---------- the form ---------- */
export type Slot = { teamId: string | null; name: string; locked: boolean };
export const FORM_SLOTS = 6;
export const FORM_SLOTS_MAX = 8;

/** Teams to show in the preview, in the order chosen. */
export const previewTeams = (slots: Slot[]) => slots.filter((s) => s.name.trim().length > 0);

export function previewLine(teams: number, format: SeriesFormat, bestOf: number | null): string {
  const f = formatShort(format, bestOf);
  return teams < 2 ? `Choose at least 2 teams · ${f}` : `${teamsText(teams)} · ${f}`;
}

/** Which rows of the team list share a name (compared without capitals), so the repeat can be marked. */
export function duplicateRows(slots: Slot[]): Set<number> {
  const seen = new Map<string, number>();
  const out = new Set<number>();
  slots.forEach((s, i) => {
    const k = s.name.trim().toLowerCase();
    if (!k) return;
    const at = seen.get(k);
    if (at !== undefined) { out.add(at); out.add(i); } else seen.set(k, i);
  });
  return out;
}

/** A team of the series is locked when a match of the series has it as a side. Aligned with `sides`. */
export function lockedFlags(sides: SeriesSide[], matches: { n1: string; t1: string | null; n2: string; t2: string | null }[]): boolean[] {
  const locked = sides.map(() => false);
  for (const m of matches) {
    for (const s of [{ name: m.n1, teamId: m.t1 }, { name: m.n2, teamId: m.t2 }]) {
      const i = sideIndex(sides, s);
      if (i >= 0) locked[i] = true;
    }
  }
  return locked;
}

export const clampBestOf = (n: number, min = 1, max = 21) => Math.min(max, Math.max(min, Math.round(n)));

/* ---------- grouping matches into a new series ---------- */
export type FreeMatch = { id: string; side1: string; team1: string | null; side2: string; team2: string | null; when: string; status: string; at: number | null };

/** The teams taken from the ticked matches, in the order the server finds them (earliest match first). */
export function teamsFromMatches(matches: FreeMatch[]): { name: string; teamId: string | null }[] {
  const sorted = [...matches].sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
  const out: { name: string; teamId: string | null }[] = [];
  const add = (n: string, t: string | null) => { if (!out.some((s) => (t && s.teamId === t) || s.name.toLowerCase() === n.trim().toLowerCase())) out.push({ name: n.trim(), teamId: t }); };
  for (const m of sorted) { add(m.side1, m.team1); add(m.side2, m.team2); }
  return out;
}

/** The automatic name rule: "Alpha v Bravo" for two teams, otherwise "Series of N matches". A typed name wins. */
export function autoName(teams: { name: string }[], matchCount: number, typed = ""): string {
  const t = typed.trim();
  if (t) return t.slice(0, SERIES_NAME_MAX);
  if (teams.length === 2) return `${teams[0]!.name} v ${teams[1]!.name}`.slice(0, SERIES_NAME_MAX);
  return matchCount > 0 ? `Series of ${matchCount} matches` : "Series name";
}

export type StatusFilter = "all" | "completed" | "scheduled" | "draft" | "other";
export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "completed", label: "Completed" }, { key: "scheduled", label: "Scheduled" }, { key: "draft", label: "Draft" }, { key: "other", label: "Other" },
];
export function statusFilterMatch(status: string, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "other") return !["completed", "scheduled", "draft"].includes(status);
  return status === f;
}

/* ---------- add matches to a series ---------- */
export type AvailItem = { id: string; side1: string; team1: string | null; side2: string; team2: string | null; when: string; status: string; fits: boolean; reason: string | null };
export type AddChip = "all" | "fit" | "nofit";
export function addCounts(items: Pick<AvailItem, "fits">[]): Record<AddChip, number> {
  return { all: items.length, fit: items.filter((m) => m.fits).length, nofit: items.filter((m) => !m.fits).length };
}
export const addFilter = <T extends Pick<AvailItem, "fits">>(items: T[], chip: AddChip) => items.filter((m) => (chip === "all" ? true : chip === "fit" ? m.fits : !m.fits));

/** The button label with the count: "Add to the series (2)". */
export const withCount = (label: string, n: number) => (n > 0 ? `${label} (${n})` : label);
