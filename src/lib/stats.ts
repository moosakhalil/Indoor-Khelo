// Phase 6: statistics and Player of the Match, worked out from the ball-by-ball record of one finished match.
// Pure functions, no database: the same events always give the same figures, so a correction can simply be replayed.
import { BOWLER_WICKETS, type BallRecord, type DismissalType, type InningsState, type MatchState, type Side } from "@/lib/engine/types";

export type BatLine = {
  innings: number; runs: number; balls: number; fours: number; sixes: number;
  dots: number; singles: number; twos: number; threes: number; fives: number; freeHitRuns: number;
  out: DismissalType | null;          // how out; null means not out
  golden: boolean;                    // out first ball for no runs
};
export type WicketsByType = { bowled: number; caught: number; caughtBowled: number; lbw: number; stumped: number; hit_wicket: number };
export type BowlLine = {
  innings: number; balls: number; runs: number; wickets: number; maidens: number; dots: number;
  wides: number; noballs: number; freeHits: number; fours: number; sixes: number; byType: WicketsByType; hatTrick: boolean;
};
export type PartnershipLine = { innings: number; runs: number; balls: number; withId: string; withName: string };
export type FieldLine = { catches: number; caughtBowled: number; stumpings: number; runOuts: number };
export type MatchResultFor = "win" | "loss" | "tie" | "none";

export type PlayerMatch = {
  entryId: string;
  side: Side;
  name: string;
  result: MatchResultFor;
  bat: BatLine[];
  bowl: BowlLine[];
  field: FieldLine;
  partnerships: PartnershipLine[];
  points: number;
  pom: boolean;
};

export type PomPart = { label: string; points: number };
export type PomResult = {
  winners: string[];                                   // entry ids (more than one when shared)
  top: { entryId: string; name: string; points: number }[];
  breakdown: Record<string, PomPart[]>;
};

export const POM_POINTS = {
  run: 1, four: 1, six: 2,
  strikeRate: [[200, 10], [150, 6], [120, 3]] as [number, number][], strikeRateMinBalls: 6,
  wicket: 20, dot: 1, maiden: 8,
  economy: [[4, 12], [6, 6]] as [number, number][],   // economy at or below, bonus
  fielding: 8, win: 10, tie: 5,
};

const rate = (num: number, den: number) => (den === 0 ? 0 : num / den);

/** Only the match proper counts towards careers; a super over is shown on the scorecard but kept out of the figures. */
const regular = (m: MatchState): InningsState[] => m.innings.filter((i) => !i.superOver);

function batLines(m: MatchState, inn: InningsState, id: string): BatLine | null {
  const b = inn.batters[id];
  if (!b) return null;
  const mine = inn.balls.filter((r) => r.striker === id && r.extra !== "wide");
  let dots = 0, singles = 0, twos = 0, threes = 0, fives = 0, freeHitRuns = 0;
  for (const r of mine) {
    if (r.counted && r.batRuns === 0) dots++;
    if (r.batRuns === 1) singles++;
    else if (r.batRuns === 2) twos++;
    else if (r.batRuns === 3) threes++;
    else if (r.batRuns === 5) fives++;
    if (r.freeHit) freeHitRuns += r.batRuns;
  }
  const out = b.status === "out" ? b.dismissal?.type ?? null : null;
  return {
    innings: inn.index, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, dots, singles, twos, threes, fives, freeHitRuns,
    out, golden: b.status === "out" && b.balls === 1 && b.runs === 0,
  };
}

function bowlLine(inn: InningsState, id: string, all: BallRecord[]): BowlLine | null {
  const b = inn.bowlers[id];
  if (!b) return null;
  const mine = inn.balls.filter((r) => r.bowler === id);
  const byType: WicketsByType = { bowled: 0, caught: 0, caughtBowled: 0, lbw: 0, stumped: 0, hit_wicket: 0 };
  let dots = 0, wides = 0, noballs = 0, freeHits = 0, fours = 0, sixes = 0;
  for (const r of mine) {
    if (r.counted && r.charged === 0) dots++;
    if (r.extra === "wide") wides++;
    if (r.extra === "noball") noballs++;
    if (r.freeHit) freeHits++;
    if (r.extra === null || r.extra === "noball") { if (r.batRuns === 4) fours++; if (r.batRuns === 6) sixes++; }
    if (r.wicket && r.wicketType && BOWLER_WICKETS.includes(r.wicketType)) {
      if (r.wicketType === "caught") byType[r.fielder === id ? "caughtBowled" : "caught"]++;
      else byType[r.wicketType as keyof WicketsByType]++;
    }
  }
  // hat-trick: three wickets on three consecutive fair deliveries by the same bowler
  const fair = mine.filter((r) => r.counted);
  let hatTrick = false;
  for (let i = 2; i < fair.length; i++) {
    if ([fair[i]!, fair[i - 1]!, fair[i - 2]!].every((r) => r.wicket && r.wicketType && BOWLER_WICKETS.includes(r.wicketType))) hatTrick = true;
  }
  void all;
  return { innings: inn.index, balls: b.legalBalls, runs: b.runs, wickets: b.wickets, maidens: b.maidens, dots, wides, noballs, freeHits, fours, sixes, byType, hatTrick };
}

/** Partnerships: the same two batters together, until a wicket or until the pair changes. */
export function partnershipsOf(inn: InningsState): { a: string; b: string | null; runs: number; balls: number; endedByWicket: boolean }[] {
  const out: { a: string; b: string | null; runs: number; balls: number; endedByWicket: boolean }[] = [];
  let key = "";
  let cur: { a: string; b: string | null; runs: number; balls: number; endedByWicket: boolean } | null = null;
  for (const r of inn.balls) {
    const pair = [r.striker, r.nonStriker].filter(Boolean).sort() as string[];
    const k = pair.join("|");
    if (!cur || k !== key) {
      if (cur) out.push(cur);
      cur = { a: pair[0]!, b: pair[1] ?? null, runs: 0, balls: 0, endedByWicket: false };
      key = k;
    }
    cur.runs += r.teamRuns;
    if (r.extra !== "wide") cur.balls += 1;
    if (r.wicket) { cur.endedByWicket = true; out.push(cur); cur = null; key = ""; }
  }
  if (cur) out.push(cur);
  return out.filter((p) => p.runs > 0 || p.balls > 0);
}

/* ---------- one match, every player ---------- */
export function computeMatchStats(m: MatchState): { players: PlayerMatch[]; pom: PomResult | null } {
  const bpo = m.rules.ballsPerOver;
  const res = m.result;
  const resultFor = (side: Side): MatchResultFor => (!res || res.kind === "abandoned" || res.kind === "no_result" || res.kind === "innings" ? "none" : res.kind === "tie" ? "tie" : res.winner === side ? "win" : "loss");

  const players: PlayerMatch[] = Object.values(m.players).map((p) => {
    const bat: BatLine[] = [];
    const bowl: BowlLine[] = [];
    const field: FieldLine = { catches: 0, caughtBowled: 0, stumpings: 0, runOuts: 0 };
    const partnerships: PartnershipLine[] = [];
    for (const inn of regular(m)) {
      const bl = batLines(m, inn, p.id);
      if (bl) bat.push(bl);
      const bw = bowlLine(inn, p.id, inn.balls);
      if (bw) bowl.push(bw);
      for (const r of inn.balls) {
        if (!r.wicket || r.fielder !== p.id) continue;
        if (r.wicketType === "caught") { if (r.fielder === r.bowler) field.caughtBowled++; else field.catches++; }
        else if (r.wicketType === "stumped") field.stumpings++;
        else if (r.wicketType === "run_out") field.runOuts++;
      }
      for (const pt of partnershipsOf(inn)) {
        if (pt.a === p.id || pt.b === p.id) {
          const other = pt.a === p.id ? pt.b : pt.a;
          if (other) partnerships.push({ innings: inn.index, runs: pt.runs, balls: pt.balls, withId: other, withName: m.players[other]?.name ?? "Player" });
        }
      }
    }
    return { entryId: p.id, side: p.side, name: p.name, result: resultFor(p.side), bat, bowl, field, partnerships, points: 0, pom: false };
  });

  // Player of the Match: points from the balls scored, the same rules for everyone
  const completed = !!res && res.kind !== "abandoned" && res.kind !== "no_result";
  const breakdown: Record<string, PomPart[]> = {};
  for (const pl of players) {
    const parts: PomPart[] = [];
    const add = (label: string, points: number) => { if (points) parts.push({ label, points }); };
    const runs = pl.bat.reduce((a, b) => a + b.runs, 0);
    add(`${runs} runs`, runs * POM_POINTS.run);
    add(`boundaries (${pl.bat.reduce((a, b) => a + b.fours, 0)} fours, ${pl.bat.reduce((a, b) => a + b.sixes, 0)} sixes)`,
      pl.bat.reduce((a, b) => a + b.fours * POM_POINTS.four + b.sixes * POM_POINTS.six, 0));
    let srBonus = 0;
    for (const b of pl.bat) {
      if (b.balls < POM_POINTS.strikeRateMinBalls) continue;
      const sr = rate(b.runs * 100, b.balls);
      const hit = POM_POINTS.strikeRate.find(([min]) => sr >= min);
      if (hit) srBonus += hit[1];
    }
    add("strike rate bonus", srBonus);
    const wk = pl.bowl.reduce((a, b) => a + b.wickets, 0);
    add(`${wk} wicket${wk === 1 ? "" : "s"}`, wk * POM_POINTS.wicket);
    add("dot balls", pl.bowl.reduce((a, b) => a + b.dots, 0) * POM_POINTS.dot);
    add("maiden overs", pl.bowl.reduce((a, b) => a + b.maidens, 0) * POM_POINTS.maiden);
    let eco = 0;
    for (const b of pl.bowl) {
      if (b.balls < bpo) continue;
      const e = rate(b.runs * bpo, b.balls);
      const hit = POM_POINTS.economy.find(([max]) => e <= max);
      if (hit) eco += hit[1];
    }
    add("economy bonus", eco);
    const fld = pl.field.catches + pl.field.caughtBowled + pl.field.stumpings + pl.field.runOuts;
    add(`${fld} fielding dismissal${fld === 1 ? "" : "s"}`, fld * POM_POINTS.fielding);
    if (pl.result === "win") add("winning side", POM_POINTS.win);
    if (pl.result === "tie") add("tied match", POM_POINTS.tie);
    breakdown[pl.entryId] = parts;
    pl.points = parts.reduce((a, b) => a + b.points, 0);
  }
  if (!completed) return { players, pom: null };

  const eligible = players.filter((p) => p.bat.length > 0 || p.bowl.length > 0 || p.field.catches + p.field.caughtBowled + p.field.stumpings + p.field.runOuts > 0);
  if (!eligible.length) return { players, pom: null };
  const econ = (p: PlayerMatch) => { const b = p.bowl.reduce((a, x) => a + x.balls, 0); return b === 0 ? Infinity : rate(p.bowl.reduce((a, x) => a + x.runs, 0) * bpo, b); };
  const runsOf = (p: PlayerMatch) => p.bat.reduce((a, b) => a + b.runs, 0);
  const wktsOf = (p: PlayerMatch) => p.bowl.reduce((a, b) => a + b.wickets, 0);
  const cmp = (a: PlayerMatch, b: PlayerMatch) =>
    b.points - a.points || (b.result === "win" ? 1 : 0) - (a.result === "win" ? 1 : 0) || runsOf(b) - runsOf(a) || wktsOf(b) - wktsOf(a) || econ(a) - econ(b);
  const ranked = [...eligible].sort(cmp);
  const best = ranked[0]!;
  const winners = ranked.filter((p) => cmp(best, p) === 0);
  for (const p of players) p.pom = winners.some((w) => w.entryId === p.entryId);
  return {
    players,
    pom: { winners: winners.map((w) => w.entryId), top: ranked.slice(0, 3).map((p) => ({ entryId: p.entryId, name: p.name, points: p.points })), breakdown },
  };
}

/* ---------- the match report ---------- */
export type OverSummary = { innings: number; over: number; bowler: string; runs: number; wickets: number; balls: number };

export function oversSummary(m: MatchState): OverSummary[] {
  const out: OverSummary[] = [];
  for (const inn of m.innings) {
    const byOver = new Map<number, OverSummary>();
    for (const r of inn.balls) {
      const o = byOver.get(r.over) ?? { innings: inn.index, over: r.over, bowler: r.bowler, runs: 0, wickets: 0, balls: 0 };
      o.runs += r.teamRuns;
      if (r.wicket) o.wickets++;
      if (r.counted) o.balls++;
      byOver.set(r.over, o);
    }
    out.push(...Array.from(byOver.values()).sort((a, b) => a.over - b.over));
  }
  return out;
}

export function matchFigures(m: MatchState) {
  const inns = regular(m);
  const balls = inns.flatMap((i) => i.balls);
  const legal = balls.filter((b) => b.counted);
  const bat = balls.filter((b) => b.extra === null || b.extra === "noball");
  const parts = inns.flatMap((i) => partnershipsOf(i).map((p) => ({ ...p, innings: i.index }))).sort((a, b) => b.runs - a.runs);
  const stats = computeMatchStats(m).players;
  return {
    fours: bat.filter((b) => b.batRuns === 4).length,
    sixes: bat.filter((b) => b.batRuns === 6).length,
    dotPercent: legal.length ? Math.round((legal.filter((b) => b.teamRuns === 0).length * 100) / legal.length) : 0,
    extras: inns.reduce((a, i) => ({ wide: a.wide + i.extras.wide, noball: a.noball + i.extras.noball, bye: a.bye + i.extras.bye, legbye: a.legbye + i.extras.legbye, penalty: a.penalty + i.extras.penalty }), { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 }),
    bestPartnerships: parts.slice(0, 3),
    topBatters: [...stats].filter((p) => p.bat.length).sort((a, b) => b.bat.reduce((x, y) => x + y.runs, 0) - a.bat.reduce((x, y) => x + y.runs, 0)).slice(0, 3),
    topBowlers: [...stats].filter((p) => p.bowl.length).sort((a, b) => b.bowl.reduce((x, y) => x + y.wickets, 0) - a.bowl.reduce((x, y) => x + y.wickets, 0) || a.bowl.reduce((x, y) => x + y.runs, 0) - b.bowl.reduce((x, y) => x + y.runs, 0)).slice(0, 3),
  };
}
