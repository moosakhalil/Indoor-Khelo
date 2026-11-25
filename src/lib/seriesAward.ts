// Player of the Series (decided 2026-11-25). No new scoring rules: it adds up the Player of the Match points each member earned
// in the finished matches of ONE series, and the highest total wins. Equal totals share the award, exactly as Player of the Match does.
// Only members count (a guest has no profile to give the award to; a guest linked to a member counts as that member).
// Pure functions: the database part is in seriesAwardDb.ts. Nothing is stored; it is worked out whenever the page opens,
// so a corrected match, or a match added to or removed from the series, changes it by itself.

/** One member's figures from one finished match of the series. `points` is their Player of the Match points for that match. */
export type AwardLine = {
  userId: string; name: string; number: number | null; matchId: string; opponent: string;
  points: number; runs: number; wickets: number; catches: number;
};

export type AwardMatch = { matchId: string; opponent: string; points: number };
export type AwardEntry = {
  userId: string; name: string; number: number | null; points: number; matches: number;
  runs: number; wickets: number; catches: number; perMatch: AwardMatch[];
};
export type SeriesAward = {
  /** One person, or more than one when the totals are equal. */
  winners: AwardEntry[];
  /** The best three after the winners (never a winner again), for the small "next" line. */
  others: AwardEntry[];
  /** Finished matches that had at least one member line. */
  matchesCounted: number;
};

const OTHERS_SHOWN = 3;

/** The award from every member line of the series' finished matches, or null when nobody has earned any points yet. */
export function playerOfSeries(lines: AwardLine[]): SeriesAward | null {
  const by = new Map<string, AwardEntry>();
  const matches = new Set<string>();
  for (const l of lines) {
    if (!l.userId) continue;
    matches.add(l.matchId);
    const e = by.get(l.userId) ?? { userId: l.userId, name: l.name, number: l.number, points: 0, matches: 0, runs: 0, wickets: 0, catches: 0, perMatch: [] };
    e.name = l.name;           // lines come oldest first, so the name and number end as the latest ones
    e.number = l.number;
    e.points += l.points; e.matches += 1; e.runs += l.runs; e.wickets += l.wickets; e.catches += l.catches;
    e.perMatch.push({ matchId: l.matchId, opponent: l.opponent, points: l.points });
    by.set(l.userId, e);
  }
  const all = [...by.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const best = all[0]?.points ?? 0;
  if (best <= 0) return null;
  const winners = all.filter((e) => e.points === best);
  return { winners, others: all.filter((e) => e.points !== best).slice(0, OTHERS_SHOWN), matchesCounted: matches.size };
}
