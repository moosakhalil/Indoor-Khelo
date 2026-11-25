// Phase B (UI redesign), Builder 4: pure rules for the Teams screens. No database in here.

export type Result = "win" | "loss" | "tie" | "none";
export const MIN_PLAYERS = 2;

export type TeamItem = {
  id: string;
  name: string;
  captain: string | null;
  vice: string | null;
  squad: number;
  /** I captain, vice-captain or play for this team. */
  mine: boolean;
  /** How many matches use this team (a team with matches cannot be deleted). */
  matches: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  /** Last five finished matches, oldest first. */
  form: { result: Result; opponent: string }[];
  /** The viewer may delete this team: they added it, or they are an Admin (lib/ownerRule.ts). Missing means yes. */
  canDelete?: boolean;
};

export type TableRow = { id: string; name: string; rank: number; played: number; won: number; lost: number; tied: number; winPercent: number | null; totalRuns: number; mine: boolean };

export const RESULT_LETTER: Record<Result, string> = { win: "W", loss: "L", tie: "T", none: "–" };
export const RESULT_WORD: Record<Result, string> = { win: "Won", loss: "Lost", tie: "Tied", none: "No result" };

export const matchesText = (n: number) => `${n} match${n === 1 ? "" : "es"}`;
export const playersText = (n: number) => `${n} player${n === 1 ? "" : "s"}`;

/** The same rule the server applies when it refuses to delete a team that has matches. */
export const deleteBlockedText = (n: number) => `This team has ${matchesText(n)}, so it cannot be deleted. Its matches keep their record. You can still edit the team or change its squad.`;

/** "Needs 1 more player to play. A match needs at least 2 players on each side." (null when the squad is big enough). */
export function needsPlayersText(count: number): string | null {
  if (count >= MIN_PLAYERS) return null;
  const more = MIN_PLAYERS - count;
  return `Needs ${more} more player${more === 1 ? "" : "s"} to play. A match needs at least ${MIN_PLAYERS} players on each side.`;
}

export function filterTeams(items: TeamItem[], query: string): TeamItem[] {
  const q = query.trim().toLowerCase();
  return q ? items.filter((t) => t.name.toLowerCase().includes(q)) : items;
}

export function sortTeams(items: TeamItem[], by: "az" | "record"): TeamItem[] {
  const copy = [...items];
  if (by === "az") return copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return copy.sort((a, b) => b.won - a.won || b.played - a.played || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Who is captain and vice-captain, in one line. */
export const leadersText = (t: { captain: string | null; vice: string | null }) => `${t.captain ? `Captain ${t.captain}` : "No captain yet"}${t.vice ? ` · Vice ${t.vice}` : ""}`;

/** What the form guide key says: "W = won v Hawks". */
export const formKey = (f: { result: Result; opponent: string }) => `${RESULT_LETTER[f.result]} = ${RESULT_WORD[f.result].toLowerCase()} v ${f.opponent}`;

/** Changes on the squad editor: who was taken out and who was put in, against what was saved. */
export function squadChanges(saved: string[], now: string[]): { added: string[]; removed: string[] } {
  const a = new Set(saved), b = new Set(now);
  return { added: now.filter((id) => !a.has(id)), removed: saved.filter((id) => !b.has(id)) };
}
