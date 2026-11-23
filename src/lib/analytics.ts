// Phase 8: analytics worked out from the stored ball-by-ball record. Pure functions, no database in here,
// so every figure can be tested alone and traced back to real deliveries.
import { STATS, fmt, type Career, type MatchLine } from "@/lib/career";
import { BOWLER_WICKETS, type BallRecord, type InningsState, type MatchState, type Side } from "@/lib/engine/types";
import { partnershipsOf } from "@/lib/stats";

/** One finished match with its full ball-by-ball state. */
export type StateRow = {
  matchId: string;
  when: string | null;
  sides: [string, string];
  teamIds: [string | null, string | null];
  state: MatchState;
};

const regular = (s: MatchState): InningsState[] => s.innings.filter((i) => !i.superOver);
const userOf = (s: MatchState, entryId: string | null | undefined): string | null => (entryId ? s.players[entryId]?.userId ?? null : null);
const wicketForBowler = (r: BallRecord) => r.wicket && !!r.wicketType && BOWLER_WICKETS.includes(r.wicketType);
const byWhen = (a: { when: string | null }, b: { when: string | null }) => (a.when ?? "").localeCompare(b.when ?? "");

/* ---------- 1. form over time ---------- */
export type FormPoint = { matchId: string; when: string | null; value: number; notOut: boolean; opponent: string };

/** The last matches in order: runs (or wickets) in each. Matches where the player did not bat (or bowl) are left out of that chart. */
export function formSeries(lines: MatchLine[], metric: "runs" | "wickets", limit = 10): FormPoint[] {
  const out: FormPoint[] = [];
  for (const l of [...lines].sort(byWhen)) {
    if (metric === "runs") {
      if (l.bat.length === 0) continue;
      out.push({ matchId: l.matchId, when: l.when, value: l.bat.reduce((a, b) => a + b.runs, 0), notOut: l.bat.every((b) => b.out === null), opponent: l.opponent });
    } else {
      if (l.bowl.reduce((a, b) => a + b.balls, 0) === 0) continue;
      out.push({ matchId: l.matchId, when: l.when, value: l.bowl.reduce((a, b) => a + b.wickets, 0), notOut: false, opponent: l.opponent });
    }
  }
  return out.slice(-limit);
}

export type FormSummary = { average: number | null; best: number | null; recent: number | null; before: number | null; direction: "up" | "down" | "steady" | null };

/** Is the player improving? Compares the last three matches with the ones before them (needs at least six). */
export function formSummary(points: FormPoint[]): FormSummary {
  if (!points.length) return { average: null, best: null, recent: null, before: null, direction: null };
  const avg = (xs: FormPoint[]) => xs.reduce((a, p) => a + p.value, 0) / xs.length;
  const recent = points.length >= 6 ? avg(points.slice(-3)) : null;
  const before = points.length >= 6 ? avg(points.slice(0, -3)) : null;
  const direction = recent === null || before === null ? null : recent > before * 1.1 + 0.05 ? "up" : recent < before * 0.9 - 0.05 ? "down" : "steady";
  return { average: avg(points), best: Math.max(...points.map((p) => p.value)), recent, before, direction };
}

/* ---------- 2. compare two players ---------- */
export const COMPARE_KEYS = ["played", "runs", "bat_avg", "bat_sr", "hs", "fours", "sixes", "bat_dot", "wickets", "economy", "bowl_avg", "bowl_sr", "best", "catches", "runouts", "stumpings", "pom", "win_pct"] as const;
export type CompareRow = { key: string; label: string; group: string; a: number | null; b: number | null; fa: string; fb: string; better: "a" | "b" | null; lowSample: boolean };

/** Side by side. The better number is marked; a tie marks neither. Rate stats from a small sample are flagged. */
export function compareCareers(a: Career, b: Career): CompareRow[] {
  return COMPARE_KEYS.map((k) => STATS.find((s) => s.key === k)!).map((def) => {
    const va = def.value(a), vb = def.value(b);
    let better: "a" | "b" | null = null;
    if (va !== null && vb !== null && va !== vb) better = (def.lowerIsBetter ?? false) ? (va < vb ? "a" : "b") : va > vb ? "a" : "b";
    const lowSample = !!def.qualifies && (!def.qualifies(a) || !def.qualifies(b));
    return { key: def.key, label: def.label, group: def.group, a: va, b: vb, fa: fmt(va, def), fb: fmt(vb, def), better, lowSample };
  });
}

/* ---------- 3. batter v bowler ---------- */
export type DuelRow = { opponentUserId: string; name: string; balls: number; runs: number; dismissals: number; dots: number; strikeRate: number | null };

/** How a batter does against each bowler (members only; guests have no career). Only balls faced count; a wide is not a ball faced. */
export function batterVsBowler(rows: StateRow[], userId: string): DuelRow[] {
  const by = new Map<string, DuelRow>();
  for (const row of rows) {
    const s = row.state;
    for (const inn of regular(s)) {
      for (const r of inn.balls) {
        if (userOf(s, r.striker) !== userId || r.extra === "wide") continue;
        const bu = userOf(s, r.bowler);
        if (!bu) continue;
        const d = by.get(bu) ?? { opponentUserId: bu, name: s.players[r.bowler]!.name, balls: 0, runs: 0, dismissals: 0, dots: 0, strikeRate: null };
        d.balls++;
        d.runs += r.batRuns;
        if (r.counted && r.batRuns === 0) d.dots++;
        if (wicketForBowler(r) && r.out === r.striker) d.dismissals++;
        by.set(bu, d);
      }
    }
  }
  return finish(by);
}

/** The reverse: how a bowler does against each batter. */
export function bowlerVsBatters(rows: StateRow[], userId: string): DuelRow[] {
  const by = new Map<string, DuelRow>();
  for (const row of rows) {
    const s = row.state;
    for (const inn of regular(s)) {
      for (const r of inn.balls) {
        if (userOf(s, r.bowler) !== userId || r.extra === "wide") continue;
        const bu = userOf(s, r.striker);
        if (!bu) continue;
        const d = by.get(bu) ?? { opponentUserId: bu, name: s.players[r.striker]!.name, balls: 0, runs: 0, dismissals: 0, dots: 0, strikeRate: null };
        d.balls++;
        d.runs += r.batRuns;
        if (r.counted && r.batRuns === 0) d.dots++;
        if (wicketForBowler(r) && r.out === r.striker) d.dismissals++;
        by.set(bu, d);
      }
    }
  }
  return finish(by);
}

function finish(by: Map<string, DuelRow>): DuelRow[] {
  const list = Array.from(by.values());
  for (const d of list) d.strikeRate = d.balls ? (d.runs * 100) / d.balls : null;
  return list.sort((a, b) => b.balls - a.balls || a.name.localeCompare(b.name));
}

/* ---------- 4. where the runs come from ---------- */
export type RunSources = {
  runs: number; balls: number; singles: number; running: number; fours: number; sixes: number; other: number;
  share: { singles: number; running: number; fours: number; sixes: number; other: number };
  extrasWhileOnStrike: number;
};

/** Share of a batter's bat runs that are singles, running (2, 3 or 5), fours and sixes. Extras the team gained while he faced are kept apart. */
export function runSources(rows: StateRow[], userId: string): RunSources {
  const out: RunSources = { runs: 0, balls: 0, singles: 0, running: 0, fours: 0, sixes: 0, other: 0, share: { singles: 0, running: 0, fours: 0, sixes: 0, other: 0 }, extrasWhileOnStrike: 0 };
  for (const row of rows) {
    for (const inn of regular(row.state)) {
      for (const r of inn.balls) {
        if (userOf(row.state, r.striker) !== userId) continue;
        out.extrasWhileOnStrike += r.teamRuns - r.batRuns;
        if (r.extra === "wide") continue;
        out.balls++;
        const n = r.batRuns;
        out.runs += n;
        if (n === 1) out.singles += 1;
        else if (n === 2 || n === 3 || n === 5) out.running += n;
        else if (n === 4) out.fours += 4;
        else if (n === 6) out.sixes += 6;
        else if (n > 0) out.other += n;
      }
    }
  }
  const pct = (v: number) => (out.runs ? (v * 100) / out.runs : 0);
  out.share = { singles: pct(out.singles), running: pct(out.running), fours: pct(out.fours), sixes: pct(out.sixes), other: pct(out.other) };
  return out;
}

/* ---------- 7. team form ---------- */
export type HistoryItem = { matchId: string; when: Date | string | null; opponent: string; result: "win" | "loss" | "tie" | "none"; runsFor: number | null; runsAgainst: number | null };

/** The last few results, oldest first, so the strip reads left to right. */
export function teamForm(history: HistoryItem[], n = 5): { strip: HistoryItem[]; wins: number; losses: number; ties: number } {
  const strip = history.slice(-n);
  return { strip, wins: strip.filter((h) => h.result === "win").length, losses: strip.filter((h) => h.result === "loss").length, ties: strip.filter((h) => h.result === "tie").length };
}
/** The team's own score in each match, oldest first. */
export const scoresSeries = (history: HistoryItem[]): { matchId: string; value: number; against: number | null; result: HistoryItem["result"]; opponent: string }[] =>
  history.filter((h) => h.runsFor !== null).map((h) => ({ matchId: h.matchId, value: h.runsFor!, against: h.runsAgainst, result: h.result, opponent: h.opponent }));

/* ---------- 9. partnership pairs ---------- */
export type PairRow = { userIdA: string; nameA: string; userIdB: string; nameB: string; runs: number; balls: number; partnerships: number; best: number; bestMatchId: string };

/** Which two batters score the most together, across all finished matches (members only). */
export function partnershipPairs(rows: StateRow[]): PairRow[] {
  const by = new Map<string, PairRow>();
  for (const row of rows) {
    const s = row.state;
    for (const inn of regular(s)) {
      for (const p of partnershipsOf(inn)) {
        const ua = userOf(s, p.a), ub = userOf(s, p.b);
        if (!ua || !ub || ua === ub) continue;
        const [x, y] = ua < ub ? [p.a, p.b!] : [p.b!, p.a];
        const ux = ua < ub ? ua : ub, uy = ua < ub ? ub : ua;
        const key = `${ux}|${uy}`;
        const e = by.get(key) ?? { userIdA: ux, nameA: s.players[x]!.name, userIdB: uy, nameB: s.players[y]!.name, runs: 0, balls: 0, partnerships: 0, best: 0, bestMatchId: row.matchId };
        e.runs += p.runs; e.balls += p.balls; e.partnerships++;
        if (p.runs > e.best) { e.best = p.runs; e.bestMatchId = row.matchId; }
        by.set(key, e);
      }
    }
  }
  return Array.from(by.values()).sort((a, b) => b.runs - a.runs || b.best - a.best || a.nameA.localeCompare(b.nameA));
}

/* ---------- 10. community records ---------- */
export type RecordLine = { title: string; holder: string | null; userId: string | null; figure: string; detail: string; matchId: string | null };

/** Balls faced by a batter to reach 50 bat runs in one innings, or null. A wide is not a ball faced. */
export function ballsToFifty(inn: InningsState, entryId: string): number | null {
  let runs = 0, faced = 0;
  for (const r of inn.balls) {
    if (r.striker !== entryId || r.extra === "wide") continue;
    faced++;
    runs += r.batRuns;
    if (runs >= 50) return faced;
  }
  return null;
}

export function communityRecords(rows: StateRow[]): { lines: RecordLine[]; streaks: { team: string; length: number }[] } {
  let high: { runs: number; balls: number; notOut: boolean; name: string; userId: string; matchId: string; opp: string } | null = null;
  let bowl: { wickets: number; runs: number; balls: number; name: string; userId: string; matchId: string } | null = null;
  let fifty: { balls: number; runs: number; name: string; userId: string; matchId: string } | null = null;
  let sixes: { n: number; name: string; userId: string; matchId: string } | null = null;
  const results = new Map<string, { name: string; list: ("win" | "loss" | "tie")[] }>();

  for (const row of [...rows].sort(byWhen)) {
    const s = row.state;
    const sixesIn = new Map<string, number>();
    for (const inn of regular(s)) {
      for (const b of Object.values(inn.batters)) {
        const uid = userOf(s, b.id);
        if (!uid) continue;
        const name = s.players[b.id]!.name;
        const opp = s.sides[inn.bowling - 1];
        if (!high || b.runs > high.runs || (b.runs === high.runs && b.balls < high.balls)) high = { runs: b.runs, balls: b.balls, notOut: b.status !== "out", name, userId: uid, matchId: row.matchId, opp };
        const f = ballsToFifty(inn, b.id);
        if (f !== null && (!fifty || f < fifty.balls)) fifty = { balls: f, runs: b.runs, name, userId: uid, matchId: row.matchId };
        sixesIn.set(uid, (sixesIn.get(uid) ?? 0) + b.sixes);
      }
      for (const w of Object.values(inn.bowlers)) {
        const uid = userOf(s, w.id);
        if (!uid || w.legalBalls === 0) continue;
        if (!bowl || w.wickets > bowl.wickets || (w.wickets === bowl.wickets && w.runs < bowl.runs)) bowl = { wickets: w.wickets, runs: w.runs, balls: w.legalBalls, name: s.players[w.id]!.name, userId: uid, matchId: row.matchId };
      }
    }
    for (const [uid, n] of sixesIn) {
      if (n > 0 && (!sixes || n > sixes.n)) {
        const name = Object.values(s.players).find((p) => p.userId === uid)!.name;
        sixes = { n, name, userId: uid, matchId: row.matchId };
      }
    }
    // unbeaten runs per team (a permanent team by id, a match-only team by name); a no result neither breaks nor extends a run
    const res = s.result;
    if (res && (res.kind === "win" || res.kind === "tie")) {
      for (const side of [1, 2] as Side[]) {
        const key = row.teamIds[side - 1] ?? `n:${row.sides[side - 1].toLowerCase()}`;
        const e = results.get(key) ?? { name: row.sides[side - 1], list: [] };
        e.name = row.sides[side - 1];
        e.list.push(res.kind === "tie" ? "tie" : res.winner === side ? "win" : "loss");
        results.set(key, e);
      }
    }
  }
  const streaks = Array.from(results.values()).map((e) => {
    let best = 0, cur = 0;
    for (const r of e.list) { cur = r === "loss" ? 0 : cur + 1; best = Math.max(best, cur); }
    return { team: e.name, length: best };
  }).filter((x) => x.length > 0).sort((a, b) => b.length - a.length || a.team.localeCompare(b.team));

  const lines: RecordLine[] = [
    high ? { title: "Highest score", holder: high.name, userId: high.userId, figure: `${high.runs}${high.notOut ? "*" : ""}`, detail: `off ${high.balls} balls against ${high.opp}`, matchId: high.matchId } : { title: "Highest score", holder: null, userId: null, figure: "–", detail: "No finished matches yet", matchId: null },
    bowl ? { title: "Best bowling", holder: bowl.name, userId: bowl.userId, figure: `${bowl.wickets}/${bowl.runs}`, detail: `in ${Math.floor(bowl.balls / 6)}.${bowl.balls % 6} overs`, matchId: bowl.matchId } : { title: "Best bowling", holder: null, userId: null, figure: "–", detail: "No finished matches yet", matchId: null },
    fifty ? { title: "Fastest fifty", holder: fifty.name, userId: fifty.userId, figure: `${fifty.balls} balls`, detail: `went on to ${fifty.runs}`, matchId: fifty.matchId } : { title: "Fastest fifty", holder: null, userId: null, figure: "–", detail: "No fifty yet", matchId: null },
    sixes ? { title: "Most sixes in a match", holder: sixes.name, userId: sixes.userId, figure: String(sixes.n), detail: "sixes in one match", matchId: sixes.matchId } : { title: "Most sixes in a match", holder: null, userId: null, figure: "–", detail: "No sixes yet", matchId: null },
    streaks[0] ? { title: "Longest unbeaten run", holder: streaks[0].team, userId: null, figure: `${streaks[0].length} match${streaks[0].length === 1 ? "" : "es"}`, detail: "wins and ties in a row", matchId: null } : { title: "Longest unbeaten run", holder: null, userId: null, figure: "–", detail: "No results yet", matchId: null },
  ];
  return { lines, streaks };
}

/* ---------- 11. bowling by over ---------- */
export type OverBowlRow = { userId: string; name: string; balls: number; runs: number; wickets: number; economy: number | null; ranked: boolean };
export const BOWL_BY_OVER_MIN_BALLS = 12;

function collectBowling(rows: StateRow[], pick: (r: BallRecord, inn: InningsState) => boolean): OverBowlRow[] {
  const by = new Map<string, OverBowlRow>();
  for (const row of rows) {
    const s = row.state;
    for (const inn of regular(s)) {
      for (const r of inn.balls) {
        if (!pick(r, inn)) continue;
        const uid = userOf(s, r.bowler);
        if (!uid) continue;
        const e = by.get(uid) ?? { userId: uid, name: s.players[r.bowler]!.name, balls: 0, runs: 0, wickets: 0, economy: null, ranked: false };
        if (r.counted) e.balls++;
        e.runs += r.charged;
        if (wicketForBowler(r)) e.wickets++;
        by.set(uid, e);
      }
    }
  }
  const bpo = rows[0]?.state.rules.ballsPerOver ?? 6;
  const list = Array.from(by.values());
  for (const e of list) { e.economy = e.balls ? (e.runs * bpo) / e.balls : null; e.ranked = e.balls >= BOWL_BY_OVER_MIN_BALLS; }
  return list.sort((a, b) => Number(b.ranked) - Number(a.ranked) || (a.economy ?? 99) - (b.economy ?? 99) || b.wickets - a.wickets || a.name.localeCompare(b.name));
}

/** Who bowls best at the start (first two overs) and at the end (last two overs of the innings). Needs 12 balls to be ranked. */
export function bowlingByOver(rows: StateRow[]): { start: OverBowlRow[]; end: OverBowlRow[] } {
  return {
    start: collectBowling(rows, (r) => r.over < 2),
    end: collectBowling(rows, (r, inn) => r.over >= Math.max(0, inn.maxOvers - 2)),
  };
}

/* ---------- 12. match worm ---------- */
export type WormPoint = { x: number; y: number; wicket: boolean };
export type WormLine = { innings: number; side: string; points: WormPoint[]; total: number };

/** Cumulative runs ball by ball for each innings of the match (x counts fair balls, so a wide does not move the line sideways). */
export function wormSeries(m: MatchState): { lines: WormLine[]; maxBalls: number; maxRuns: number } {
  const lines: WormLine[] = regular(m).map((inn) => {
    const pts: WormPoint[] = [{ x: 0, y: 0, wicket: false }];
    let runs = 0, legal = 0;
    for (const r of inn.balls) {
      runs += r.teamRuns;
      if (r.counted) legal++;
      pts.push({ x: legal, y: runs, wicket: r.wicket });
    }
    return { innings: inn.index, side: m.sides[inn.batting - 1], points: pts, total: inn.runs };
  });
  return { lines, maxBalls: Math.max(1, ...lines.map((l) => l.points[l.points.length - 1]!.x), ...regular(m).map((i) => i.maxOvers * m.rules.ballsPerOver)), maxRuns: Math.max(1, ...lines.map((l) => l.points[l.points.length - 1]!.y)) };
}

/* ---------- 13. win likelihood (a rough estimate, not a prediction) ---------- */
const erf = (x: number) => {
  // Abramowitz and Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
export const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

export type ChaseInput = { target: number; runs: number; wickets: number; ballsBowled: number; maxBalls: number; firstRate: number };

/**
 * A simple estimate of the chasing side's chance, from 0 to 1.
 * It guesses how many runs the remaining balls will give: the rate is a blend of the first innings' rate (more weight early)
 * and the chasing side's own rate so far (more weight late), cut by 12% for every wicket lost (never below a quarter).
 * The gap between that guess and the runs still needed, divided by an uncertainty that grows with the balls left, goes through a normal curve.
 * It is a guide to how the chase looks, not a prediction.
 */
export function chaseProbability(c: ChaseInput): number {
  const needed = c.target - c.runs;
  if (needed <= 0) return 1;
  const left = c.maxBalls - c.ballsBowled;
  if (left <= 0) return 0;
  const own = c.ballsBowled >= 6 ? c.runs / c.ballsBowled : c.firstRate;
  const weight = left / c.maxBalls;
  const rate = weight * c.firstRate + (1 - weight) * own;
  const factor = Math.max(0.25, 1 - 0.12 * c.wickets);
  const expected = left * rate * factor;
  const sigma = 1.6 * Math.sqrt(left) + 1;
  const p = normalCdf((expected - needed + 0.5) / sigma);
  return Math.min(0.99, Math.max(0.01, p));
}

export type WinPoint = { x: number; p: number; runs: number; needed: number };

/** The chasing side's chance after every ball of the second innings. Null when the match had no chase. */
export function winSeries(m: MatchState): { chasing: string; points: WinPoint[]; maxBalls: number } | null {
  const inns = regular(m);
  if (inns.length < 2) return null;
  const first = inns[0]!, chase = inns[1]!;
  if (chase.target === null) return null;
  const target = chase.manualTarget ?? chase.target;
  const firstRate = first.legalBalls ? first.runs / first.legalBalls : 1;
  const maxBalls = chase.maxOvers * m.rules.ballsPerOver;
  const points: WinPoint[] = [{ x: 0, p: chaseProbability({ target, runs: 0, wickets: 0, ballsBowled: 0, maxBalls, firstRate }), runs: 0, needed: target }];
  let runs = 0, wickets = 0, legal = 0;
  for (const r of chase.balls) {
    runs += r.teamRuns;
    if (r.wicket) wickets++;
    if (r.counted) legal++;
    points.push({ x: legal, p: chaseProbability({ target, runs, wickets, ballsBowled: legal, maxBalls, firstRate }), runs, needed: Math.max(0, target - runs) });
  }
  // the end of the innings settles it
  const res = m.result;
  const last = points[points.length - 1]!;
  if (chase.ended) {
    if (chase.endReason === "target" || runs >= target) last.p = 1;
    else if (res?.kind === "tie") last.p = 0.5;
    else last.p = res?.winner === chase.batting ? 1 : 0;
  }
  return { chasing: m.sides[chase.batting - 1], points, maxBalls };
}
