// Phase 6: a player's career (or leaderboard row) from their saved match lines. Pure functions.
import type { PlayerMatch, WicketsByType } from "@/lib/stats";

/** One match as one player lived it. */
export type MatchLine = PlayerMatch & {
  matchId: string;
  when: string | null;          // ISO date of the match
  ballsPerOver: number;
  teamName: string;
  opponent: string;
  resultText: string;
  numberUsed: number | null;
};

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

export type Career = ReturnType<typeof careerOf>;

export function careerOf(lines: MatchLine[]) {
  const sorted = [...lines].sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));
  const bat = sorted.flatMap((l) => l.bat.map((b) => ({ ...b, when: l.when, matchId: l.matchId })));
  const bowl = sorted.flatMap((l) => l.bowl.map((b) => ({ ...b, bpo: l.ballsPerOver, matchId: l.matchId })));
  const outs = bat.filter((b) => b.out !== null);

  const runs = sum(bat, (b) => b.runs), balls = sum(bat, (b) => b.balls), fours = sum(bat, (b) => b.fours), sixes = sum(bat, (b) => b.sixes);
  const hs = bat.reduce<{ score: number; notOut: boolean } | null>((best, b) => (!best || b.runs > best.score || (b.runs === best.score && b.out === null && !best.notOut) ? { score: b.runs, notOut: b.out === null } : best), null);
  const sr6 = bat.filter((b) => b.balls >= 6).map((b) => (b.runs * 100) / b.balls);
  const howOut: Record<string, number> = { not_out: bat.length - outs.length };
  for (const b of outs) howOut[b.out!] = (howOut[b.out!] ?? 0) + 1;
  const bestPartnership = sorted.flatMap((l) => l.partnerships).sort((a, b) => b.runs - a.runs)[0] ?? null;
  const last5 = bat.slice(-5).map((b) => ({ runs: b.runs, out: b.out !== null, matchId: b.matchId }));

  const bBalls = sum(bowl, (b) => b.balls), bRuns = sum(bowl, (b) => b.runs), wickets = sum(bowl, (b) => b.wickets);
  const bowled = bowl.filter((b) => b.balls > 0);
  const bpo = bowl[0]?.bpo ?? 6;
  const best = bowled.reduce<{ wickets: number; runs: number } | null>((bst, b) => (!bst || b.wickets > bst.wickets || (b.wickets === bst.wickets && b.runs < bst.runs) ? { wickets: b.wickets, runs: b.runs } : bst), null);
  const ecos = bowled.filter((b) => b.balls >= b.bpo).map((b) => (b.runs * b.bpo) / b.balls);
  const byType: WicketsByType = { bowled: 0, caught: 0, caughtBowled: 0, lbw: 0, stumped: 0, hit_wicket: 0 };
  for (const b of bowl) for (const k of Object.keys(byType) as (keyof WicketsByType)[]) byType[k] += b.byType[k];

  const field = {
    catches: sum(lines, (l) => l.field.catches), caughtBowled: sum(lines, (l) => l.field.caughtBowled),
    runOuts: sum(lines, (l) => l.field.runOuts), stumpings: sum(lines, (l) => l.field.stumpings),
  };
  const fieldTotal = field.catches + field.caughtBowled + field.runOuts + field.stumpings;
  const played = lines.length;
  const won = lines.filter((l) => l.result === "win").length, lost = lines.filter((l) => l.result === "loss").length, tied = lines.filter((l) => l.result === "tie").length;
  const awards = sorted.filter((l) => l.pom);

  return {
    matches: played,
    batting: {
      innings: bat.length, notOuts: bat.length - outs.length, runs, balls, average: ratio(runs, outs.length), strikeRate: ratio(runs * 100, balls),
      highest: hs, bestStrikeRate: sr6.length ? Math.max(...sr6) : null, freeHitRuns: sum(bat, (b) => b.freeHitRuns),
      dots: sum(bat, (b) => b.dots), singles: sum(bat, (b) => b.singles), twos: sum(bat, (b) => b.twos), threes: sum(bat, (b) => b.threes), fives: sum(bat, (b) => b.fives), fours, sixes,
      boundaryRuns: fours * 4 + sixes * 6, boundaryPercent: ratio((fours * 4 + sixes * 6) * 100, runs), ballsPerBoundary: ratio(balls, fours + sixes),
      dotPercent: ratio(sum(bat, (b) => b.dots) * 100, balls),
      thirties: bat.filter((b) => b.runs >= 30).length, ducks: bat.filter((b) => b.runs === 0 && b.out !== null).length, goldenDucks: bat.filter((b) => b.golden).length,
      bestPartnership, howOut, last5,
    },
    bowling: {
      innings: bowled.length, balls: bBalls, runs: bRuns, wickets, bpo, economy: ratio(bRuns * bpo, bBalls), average: ratio(bRuns, wickets), strikeRate: ratio(bBalls, wickets),
      best, bestEconomy: ecos.length ? Math.min(...ecos) : null, worstEconomy: ecos.length ? Math.max(...ecos) : null, byType,
      dots: sum(bowl, (b) => b.dots), dotPercent: ratio(sum(bowl, (b) => b.dots) * 100, bBalls), maidens: sum(bowl, (b) => b.maidens),
      wides: sum(bowl, (b) => b.wides), noballs: sum(bowl, (b) => b.noballs), freeHits: sum(bowl, (b) => b.freeHits),
      fours: sum(bowl, (b) => b.fours), sixes: sum(bowl, (b) => b.sixes),
      twoWicketHauls: bowled.filter((b) => b.wickets >= 2).length, threeWicketHauls: bowled.filter((b) => b.wickets >= 3).length, hatTricks: bowl.filter((b) => b.hatTrick).length,
    },
    fielding: { ...field, total: fieldTotal, matchesRecorded: lines.filter((l) => l.field.catches + l.field.caughtBowled + l.field.runOuts + l.field.stumpings > 0).length },
    record: { played, won, lost, tied, winPercent: ratio((won) * 100, played) },
    awards: { count: awards.length, points: sum(awards, (l) => l.points), averagePoints: ratio(sum(lines, (l) => l.points), played), list: awards.map((l) => ({ matchId: l.matchId, points: l.points, when: l.when, opponent: l.opponent })) },
  };
}

/* ---------- leaderboards ---------- */
export type StatDef = {
  key: string; label: string; group: "batting" | "bowling" | "fielding" | "awards" | "matches";
  value: (c: Career) => number | null;
  lowerIsBetter?: boolean;
  /** Rate stats need a minimum before a player is ranked. */
  qualifies?: (c: Career) => boolean;
  rule?: string;
  decimals?: number;
  suffix?: string;
};

const batQ = (c: Career) => c.batting.innings >= 3 && c.batting.balls >= 20;
const bowlQ = (c: Career) => c.bowling.balls >= 3 * c.bowling.bpo;
const matchQ = (c: Career) => c.matches >= 3;
const BAT_RULE = "Needs at least 3 innings and 20 balls faced";
const BOWL_RULE = "Needs at least 3 overs bowled";

export const STATS: StatDef[] = [
  { key: "runs", label: "Runs", group: "batting", value: (c) => c.batting.runs },
  { key: "bat_avg", label: "Batting average", group: "batting", value: (c) => c.batting.average, qualifies: batQ, rule: BAT_RULE, decimals: 2 },
  { key: "bat_sr", label: "Strike rate", group: "batting", value: (c) => c.batting.strikeRate, qualifies: batQ, rule: BAT_RULE, decimals: 1 },
  { key: "hs", label: "Highest score", group: "batting", value: (c) => c.batting.highest?.score ?? 0 },
  { key: "fours", label: "Fours", group: "batting", value: (c) => c.batting.fours },
  { key: "sixes", label: "Sixes", group: "batting", value: (c) => c.batting.sixes },
  { key: "thirties", label: "Scores of 30 or more", group: "batting", value: (c) => c.batting.thirties },
  { key: "bat_dot", label: "Dot ball percentage (batting)", group: "batting", value: (c) => c.batting.dotPercent, qualifies: batQ, rule: BAT_RULE, decimals: 1, suffix: "%", lowerIsBetter: true },
  { key: "wickets", label: "Wickets", group: "bowling", value: (c) => c.bowling.wickets },
  { key: "economy", label: "Economy", group: "bowling", value: (c) => c.bowling.economy, qualifies: bowlQ, rule: BOWL_RULE, decimals: 2, lowerIsBetter: true },
  { key: "bowl_avg", label: "Bowling average", group: "bowling", value: (c) => c.bowling.average, qualifies: bowlQ, rule: BOWL_RULE, decimals: 2, lowerIsBetter: true },
  { key: "bowl_sr", label: "Bowling strike rate", group: "bowling", value: (c) => c.bowling.strikeRate, qualifies: bowlQ, rule: BOWL_RULE, decimals: 1, lowerIsBetter: true },
  { key: "bowl_dots", label: "Dot balls bowled", group: "bowling", value: (c) => c.bowling.dots },
  { key: "maidens", label: "Maidens", group: "bowling", value: (c) => c.bowling.maidens },
  { key: "threew", label: "3-wicket hauls", group: "bowling", value: (c) => c.bowling.threeWicketHauls },
  { key: "best", label: "Best bowling (wickets)", group: "bowling", value: (c) => c.bowling.best?.wickets ?? 0 },
  { key: "catches", label: "Catches", group: "fielding", value: (c) => c.fielding.catches + c.fielding.caughtBowled },
  { key: "runouts", label: "Run-outs", group: "fielding", value: (c) => c.fielding.runOuts },
  { key: "stumpings", label: "Stumpings", group: "fielding", value: (c) => c.fielding.stumpings },
  { key: "dismissals", label: "All dismissals", group: "fielding", value: (c) => c.fielding.total },
  { key: "pom", label: "Player of the Match awards", group: "awards", value: (c) => c.awards.count },
  { key: "pom_points", label: "Player of the Match points", group: "awards", value: (c) => c.awards.points },
  { key: "played", label: "Matches played", group: "matches", value: (c) => c.matches },
  { key: "win_pct", label: "Win percentage", group: "matches", value: (c) => c.record.winPercent, qualifies: matchQ, rule: "Needs at least 3 matches", decimals: 1, suffix: "%" },
];

export const GROUPS: { key: StatDef["group"]; label: string }[] = [
  { key: "batting", label: "Batting" }, { key: "bowling", label: "Bowling" }, { key: "fielding", label: "Fielding" }, { key: "awards", label: "Awards" }, { key: "matches", label: "Matches" },
];

export type BoardRow = { userId: string; name: string; number: number | null; value: number | null; ranked: boolean; rank: number | null; tied: boolean; note: string | null };

/** Every member is listed. Ranked members come first; rate stats below the minimum are listed last with a note. Ties share a rank. */
export function buildBoard(
  members: { userId: string; name: string; number: number | null; career: Career }[], def: StatDef, flip = false,
): BoardRow[] {
  const lowFirst = (def.lowerIsBetter ?? false) !== flip;
  const rows = members.map((m) => {
    const v = def.value(m.career);
    const ranked = def.qualifies ? def.qualifies(m.career) && v !== null : true;
    return { userId: m.userId, name: m.name, number: m.number, value: v ?? (def.qualifies ? null : 0), ranked, rank: null as number | null, tied: false, note: ranked ? null : def.rule ?? "No data yet" };
  });
  const rankedRows = rows.filter((r) => r.ranked).sort((a, b) => (lowFirst ? a.value! - b.value! : b.value! - a.value!) || a.name.localeCompare(b.name));
  let rank = 0;
  rankedRows.forEach((r, i) => {
    if (i === 0 || r.value !== rankedRows[i - 1]!.value) rank = i + 1;
    r.rank = rank;
  });
  for (const r of rankedRows) r.tied = rankedRows.filter((x) => x.rank === r.rank).length > 1;
  const rest = rows.filter((r) => !r.ranked).sort((a, b) => a.name.localeCompare(b.name));
  return [...rankedRows, ...rest];
}

export function fmt(v: number | null, def: Pick<StatDef, "decimals" | "suffix">): string {
  if (v === null) return "–";
  return `${def.decimals ? v.toFixed(def.decimals) : Math.round(v)}${def.suffix ?? ""}`;
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
