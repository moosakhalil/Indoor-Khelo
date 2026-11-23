// Phase 5: the scoring engine. A pure function: ordered events in, full match state out.
// It runs on the phone (so the score is right offline) and on the server (so nothing wrong is ever saved).
import type { BowlerLimit } from "@/lib/matchRules";
import {
  BOWLER_WICKETS, type BallPayload, type BatterLine, type BowlerLine, type BuildResult, type DismissalType, type InningsState, type MatchResult, type MatchState,
  type PlayerEntry, type ScoreEvent, type Side, type StartPayload,
} from "./types";

const other = (s: Side): Side => (s === 1 ? 2 : 1);
const MAX_RUNS = 12;

export const oversText = (balls: number, bpo: number) => `${Math.floor(balls / bpo)}.${balls % bpo}`;

export class Refusal extends Error {}
const refuse = (msg: string): never => { throw new Refusal(msg); };

/* ---------- limits ---------- */
/** Overs a bowler has used if they bowl `extra` more balls: whole or part overs both count. */
const usedOvers = (balls: number, bpo: number) => Math.ceil(balls / bpo);

/** Quota pattern check: can every bowler be given their own slot at least as big as the overs they bowled? */
function patternFits(usages: number[], pattern: number[]): boolean {
  const used = usages.filter((u) => u > 0).sort((a, b) => b - a);
  const slots = [...pattern].sort((a, b) => b - a);
  if (used.length > slots.length) return false;
  return used.every((u, i) => u <= slots[i]!);
}

export function bowlerCanDeliver(m: MatchState, inn: InningsState, id: string): { ok: true } | { ok: false; reason: string } {
  const p = m.players[id];
  if (!p || p.side !== inn.bowling) return { ok: false, reason: "That player is not in the bowling side." };
  if (m.gone[id]) return { ok: false, reason: `${p.name} is not playing any more.` };
  const limit: BowlerLimit = inn.superOver ? { mode: "none" } : m.limit;
  const bpo = m.rules.ballsPerOver;
  const have = inn.bowlers[id]?.legalBalls ?? 0;
  if (limit.mode === "max") {
    if (usedOvers(have + 1, bpo) > limit.overs) return { ok: false, reason: `${p.name} has used all ${limit.overs} over${limit.overs === 1 ? "" : "s"} allowed.` };
  } else if (limit.mode === "pattern") {
    const usages = Object.values(inn.bowlers).filter((b) => b.id !== id).map((b) => usedOvers(b.legalBalls, bpo));
    usages.push(usedOvers(have + 1, bpo));
    if (!patternFits(usages, limit.pattern)) {
      const left = bowlerAllowance(m, inn, id);
      return { ok: false, reason: `${p.name} cannot bowl more: the limit pattern ${limit.pattern.join("-")} is used up${left === 0 ? "" : ""}.` };
    }
  }
  return { ok: true };
}

/** For display: overs this bowler may still bowl under the limit (null when there is no limit). */
export function bowlerAllowance(m: MatchState, inn: InningsState, id: string): number | null {
  const limit: BowlerLimit = inn.superOver ? { mode: "none" } : m.limit;
  const bpo = m.rules.ballsPerOver;
  const have = inn.bowlers[id]?.legalBalls ?? 0;
  if (limit.mode === "none") return null;
  if (limit.mode === "max") return Math.max(0, limit.overs - usedOvers(have, bpo));
  let best = 0;
  for (let extra = 1; extra <= 50; extra++) {
    const usages = Object.values(inn.bowlers).filter((b) => b.id !== id).map((b) => usedOvers(b.legalBalls, bpo));
    usages.push(usedOvers(have, bpo) + extra);
    if (patternFits(usages, limit.pattern)) best = extra; else break;
  }
  return best;
}

export function selectableBowlers(m: MatchState, inn: InningsState): { player: PlayerEntry; ok: boolean; reason: string | null }[] {
  return Object.values(m.players).filter((p) => p.side === inn.bowling && !m.gone[p.id]).map((p) => {
    const can = bowlerCanDeliver(m, inn, p.id);
    if (!can.ok) return { player: p, ok: false, reason: can.reason };
    if (!m.rules.sameBowlerTwoInARow && inn.needBowler && inn.lastOverBowler === p.id) return { player: p, ok: false, reason: `${p.name} bowled the last over. The same bowler cannot bowl two overs in a row.` };
    if (!m.rules.sameBowlerTwoInARow && !inn.needBowler && inn.lastOverBowler === p.id && inn.bowler !== p.id && inn.legalBalls > 0) return { player: p, ok: false, reason: `${p.name} bowled the last over.` };
    return { player: p, ok: true, reason: null };
  });
}

/** Batters who can walk in: yet to bat, or retired hurt and allowed back. */
export function selectableBatters(m: MatchState, inn: InningsState): { player: PlayerEntry; returning: boolean }[] {
  const out: { player: PlayerEntry; returning: boolean }[] = [];
  const used = Object.keys(inn.batters).length;
  for (const p of Object.values(m.players)) {
    if (p.side !== inn.batting || m.gone[p.id]) continue;
    if (p.id === inn.striker || p.id === inn.nonStriker) continue;
    const line = inn.batters[p.id];
    if (!line) { if (used < m.playersPerSide) out.push({ player: p, returning: false }); }
    else if (line.status === "retired_hurt" && m.rules.retiredCanReturn) out.push({ player: p, returning: true });
  }
  const hint = inn.battingOrderHint;
  return out.sort((a, b) => {
    const ia = hint.indexOf(a.player.id), ib = hint.indexOf(b.player.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

/* ---------- state ---------- */
function newInnings(m: MatchState, index: number, superOver: boolean, batting: Side, target: number | null): InningsState {
  return {
    index, superOver, batting, bowling: other(batting), runs: 0, wickets: 0, legalBalls: 0,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 },
    maxOvers: superOver ? 1 : m.overs, target, manualTarget: null,
    batters: {}, battingOrderHint: [], striker: null, nonStriker: null, vacant: null, needBatter: false, needBowler: false,
    bowler: null, lastOverBowler: null, bowlers: {}, overBalls: [], balls: [], freeHit: false, fow: [],
    partnership: { runs: 0, balls: 0 }, ended: false, endReason: null, overRunsCharged: 0, overBowlers: [],
  };
}

const emptyBatter = (id: string, order: number): BatterLine => ({ id, runs: 0, balls: 0, fours: 0, sixes: 0, status: "batting", dismissal: null, order });
const emptyBowler = (id: string): BowlerLine => ({ id, legalBalls: 0, runs: 0, wickets: 0, wides: 0, noballs: 0, maidens: 0 });

export const currentInnings = (m: MatchState): InningsState | null => (m.innings.length ? m.innings[m.innings.length - 1]! : null);
export const activeInnings = (m: MatchState): InningsState | null => {
  const i = currentInnings(m);
  return i && !i.ended ? i : null;
};
export const effectiveTarget = (i: InningsState): number | null => i.manualTarget ?? i.target;

const nameOf = (m: MatchState, id: string | null | undefined) => (id ? m.players[id]?.name ?? "Player" : "Player");
const sideName = (m: MatchState, s: Side) => m.sides[s - 1];

function stamp(m: MatchState, ev: ScoreEvent, text: string) {
  const inn = currentInnings(m);
  const at = inn && !inn.ended && inn.legalBalls > 0 ? ` after ${oversText(inn.legalBalls, m.rules.ballsPerOver)} overs` : "";
  m.timeline.push({ at: ev.at ?? "", text: `${text}${at}`, by: ev.by });
}

/* ---------- ending an innings, and what comes next ---------- */
function wicketsAllowed(m: MatchState, side: Side): number {
  const n = Object.values(m.players).filter((p) => p.side === side && !m.gone[p.id]).length;
  return Math.max(0, Math.min(n, m.playersPerSide) - (m.rules.lastBatterAlone ? 0 : 1));
}

/** A chase that ends one run short of the original target is a tie. */
function isLevel(first: InningsState, second: InningsState): boolean {
  const tgt = effectiveTarget(second) ?? first.runs + 1;
  return tgt === first.runs + 1 && second.runs === tgt - 1;
}

function resultFor(m: MatchState, first: InningsState, second: InningsState, label: string): MatchResult {
  const bat1 = first.batting, bat2 = second.batting;
  const target = effectiveTarget(second) ?? first.runs + 1;
  if (second.runs >= target) {
    const left = Math.max(0, wicketsAllowed(m, bat2) - second.wickets);
    return { kind: "win", winner: bat2, margin: { type: "wickets", n: left }, text: `${sideName(m, bat2)} won${label} by ${left} wicket${left === 1 ? "" : "s"}` };
  }
  const by = target - 1 - second.runs;
  return { kind: "win", winner: bat1, margin: { type: "runs", n: by }, text: `${sideName(m, bat1)} won${label} by ${by} run${by === 1 ? "" : "s"}` };
}

function endInnings(m: MatchState, inn: InningsState, reason: NonNullable<InningsState["endReason"]>) {
  inn.ended = true;
  inn.endReason = reason;
  inn.needBatter = false;
  inn.needBowler = false;
  m.nextInnings = inn.index + 1;
  const regular = !inn.superOver;
  if (regular) {
    if (m.rules.innings === 1) {
      m.result = { kind: "innings", winner: null, margin: null, text: `${sideName(m, inn.batting)} scored ${inn.runs} for ${inn.wickets}` };
      m.phase = "result";
      return;
    }
    if (inn.index === 0) { m.phase = "need_innings"; return; }
    settlePair(m, m.innings[0]!, inn, "");
    return;
  }
  // super over: they come in pairs
  if ((inn.index - 2) % 2 === 0) { m.phase = "need_innings"; return; }
  settlePair(m, m.innings[inn.index - 1]!, inn, " in the super over");
}

function settlePair(m: MatchState, first: InningsState, second: InningsState, label: string) {
  if (isLevel(first, second)) {
    if (m.rules.superOver === "always") { m.phase = "need_innings"; m.superOverPlaying = true; return; }
    if (m.rules.superOver === "ask") { m.phase = "level_prompt"; return; }
    m.result = { kind: "tie", winner: null, margin: null, text: `Match tied: both sides scored ${first.runs}` };
    m.phase = "result";
    return;
  }
  m.result = resultFor(m, first, second, label);
  m.phase = "result";
}

/** After anything changes: has the innings finished? */
function checkEnd(m: MatchState, inn: InningsState) {
  if (inn.ended) return;
  const tgt = effectiveTarget(inn);
  if (tgt !== null && inn.runs >= tgt) return endInnings(m, inn, "target");
  if (inn.legalBalls >= inn.maxOvers * m.rules.ballsPerOver) return endInnings(m, inn, "overs");
}

/** After a batter leaves the crease: who comes in, or is it all out? */
function settleCrease(m: MatchState, inn: InningsState, exclude: string | null = null) {
  if (inn.ended) return;
  const atCrease = (inn.striker ? 1 : 0) + (inn.nonStriker ? 1 : 0);
  if (atCrease === 2) { inn.needBatter = false; inn.vacant = null; return; }
  const candidates = selectableBatters(m, inn).filter((c) => c.player.id !== exclude).length;
  if (candidates > 0) { inn.needBatter = true; return; }
  if (m.rules.lastBatterAlone) {
    if (atCrease === 0) return endInnings(m, inn, "allout");
    const lone = inn.striker ?? inn.nonStriker;
    inn.striker = lone; inn.nonStriker = null; inn.vacant = null; inn.needBatter = false;
    return;
  }
  if (atCrease <= 1) return endInnings(m, inn, "allout");
}

function swapEnds(inn: InningsState) {
  const s = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = s;
  if (inn.vacant) inn.vacant = inn.vacant === "striker" ? "nonStriker" : "striker";
}

function removeFromCrease(inn: InningsState, id: string) {
  if (inn.striker === id) { inn.striker = null; inn.vacant = "striker"; }
  else if (inn.nonStriker === id) { inn.nonStriker = null; inn.vacant = "nonStriker"; }
}

function recordWicket(m: MatchState, inn: InningsState, id: string, type: DismissalType, bowler: string | null, fielder: string | null) {
  const line = inn.batters[id]!;
  line.status = "out";
  line.dismissal = { type, bowler, fielder };
  inn.wickets += 1;
  inn.fow.push({ n: inn.wickets, runs: inn.runs, over: oversText(inn.legalBalls, m.rules.ballsPerOver), player: id });
  inn.partnership = { runs: 0, balls: 0 };
}

/* ---------- a ball ---------- */
const WIDE_OK = ["stumped", "hit_wicket", "run_out"];

export function describeBall(p: BallPayload, rules: { wideRuns: number; noBallRuns: number; widesReBowled: boolean; noBallsReBowled: boolean }): string {
  const runs = p.runs ?? 0;
  const w = p.wicket;
  const n = (k: number) => `${k} run${k === 1 ? "" : "s"}`;
  if (w) {
    const how = w.type === "run_out" ? `Run out${runs ? ` after ${n(runs)}` : ""}` : w.type.replace("_", " ").replace(/^./, (c) => c.toUpperCase());
    if (p.extra === "wide") return `Wide and ${how.toLowerCase()}: ${n(rules.wideRuns + (w.type === "run_out" ? runs : 0))}${rules.widesReBowled ? ", ball not counted" : ""}`;
    if (p.extra === "noball") return `No ball and ${how.toLowerCase()}: ${n(rules.noBallRuns + (w.type === "run_out" ? runs : 0))}${rules.noBallsReBowled ? ", ball not counted" : ""}`;
    return `Wicket: ${how}`;
  }
  switch (p.extra) {
    case "wide": return `Wide: ${n(rules.wideRuns + runs)}${rules.widesReBowled ? ", ball not counted" : ""}`;
    case "noball": return `No ball: ${n(rules.noBallRuns)}${runs ? ` plus ${n(runs)} off the bat` : ""}${rules.noBallsReBowled ? ", ball not counted" : ""}`;
    case "bye": return `Bye: ${n(runs)}`;
    case "legbye": return `Leg-bye: ${n(runs)}`;
    default: return runs === 0 ? "Dot ball" : runs === 4 ? "Four runs" : runs === 6 ? "Six runs" : n(runs);
  }
}

function labelFor(p: BallPayload): string {
  const r = p.runs ?? 0;
  if (p.wicket) {
    const base = p.wicket.type === "run_out" ? `RO${r ? r : ""}` : "W";
    return p.extra === "wide" ? `Wd+${base}` : p.extra === "noball" ? `Nb+${base}` : base;
  }
  switch (p.extra) {
    case "wide": return r ? `Wd+${r}` : "Wd";
    case "noball": return r ? `Nb+${r}` : "Nb";
    case "bye": return `B${r}`;
    case "legbye": return `Lb${r}`;
    default: return String(r);
  }
}

function applyBall(m: MatchState, ev: ScoreEvent, p: BallPayload) {
  const inn = activeInnings(m);
  if (m.phase !== "scoring" || !inn) refuse("There is no innings in progress.");
  const cur = inn as InningsState;
  if (cur.needBatter) refuse("Choose the next batter first.");
  if (cur.needBowler) refuse("Choose the bowler for the new over first.");
  if (!cur.striker || !cur.bowler) refuse("The batters and the bowler must be chosen first.");
  const rules = m.rules;
  const extra = p.extra ?? null;
  const runs = p.runs ?? 0;
  if (!Number.isInteger(runs) || runs < 0 || runs > MAX_RUNS) refuse(`Runs must be a whole number from 0 to ${MAX_RUNS}.`);
  if ((extra === "bye" || extra === "legbye") && runs < 1) refuse("Byes and leg-byes need at least 1 run.");
  const w = p.wicket ?? null;
  const striker = cur.striker as string;
  const bowler = cur.bowler as string;

  let outId: string | null = null;
  if (w) {
    if (!rules.dismissals.includes(w.type)) refuse("That way of getting out is switched off for this match.");
    if (cur.freeHit && w.type !== "run_out") refuse("On a free hit the batter can only be run out.");
    if (extra === "noball" && w.type !== "run_out") refuse("After a no ball the batter can only be run out.");
    if (extra === "wide" && !WIDE_OK.includes(w.type)) refuse("On a wide only stumped, hit wicket or run out is possible.");
    if ((extra === "bye" || extra === "legbye") && w.type !== "run_out") refuse("With byes only a run-out is possible.");
    if (w.type !== "run_out" && runs > 0 && extra !== "wide") refuse("Runs cannot be scored on the ball a batter is bowled, caught, LBW, stumped or hit wicket.");
    if (w.type === "run_out") {
      outId = w.out ?? striker;
      if (outId !== cur.striker && outId !== cur.nonStriker) refuse("The batter run out must be one of the two batters at the crease.");
    } else outId = striker;
    if (!w.fielder && (w.type === "caught" || w.type === "stumped" || w.type === "run_out")) {
      refuse(w.type === "caught" ? "Choose who took the catch (it can be the bowler)." : w.type === "stumped" ? "Choose the wicket-keeper who stumped the batter." : "Choose the fielder who ran the batter out.");
    }
    if (w.fielder && (!m.players[w.fielder] || m.players[w.fielder]!.side !== cur.bowling || m.gone[w.fielder])) refuse("The fielder must be a player of the fielding side who is still playing.");
  }

  const nonStrikerBefore = cur.nonStriker;
  const wasFreeHit = cur.freeHit;
  const penalty = extra === "wide" ? rules.wideRuns : extra === "noball" ? rules.noBallRuns : 0;
  const teamRuns = runs + penalty;
  const batRuns = extra === null || extra === "noball" ? runs : 0;
  const counted =
    !(extra === "wide" && rules.widesReBowled) && !(extra === "noball" && rules.noBallsReBowled) &&
    !(extra === "bye" && !rules.byesCountAsBalls) && !(extra === "legbye" && !rules.legByesCountAsBalls);
  const bat = cur.batters[striker] ?? (cur.batters[striker] = emptyBatter(striker, Object.keys(cur.batters).length + 1));
  const bwl = cur.bowlers[bowler] ?? (cur.bowlers[bowler] = emptyBowler(bowler));
  const overNo = Math.floor(cur.legalBalls / rules.ballsPerOver);
  const ballNo = (cur.legalBalls % rules.ballsPerOver) + 1;
  const labelOver = `${overNo}.${ballNo}`;

  // runs and extras
  cur.runs += teamRuns;
  cur.partnership.runs += teamRuns;
  if (extra === "wide") { cur.extras.wide += penalty + runs; bwl.wides += penalty + runs; }
  else if (extra === "noball") { cur.extras.noball += penalty; bwl.noballs += penalty; }
  else if (extra === "bye") cur.extras.bye += runs;
  else if (extra === "legbye") cur.extras.legbye += runs;
  const charged = batRuns + (extra === "wide" ? penalty + runs : 0) + (extra === "noball" ? penalty : 0);
  bwl.runs += charged;
  cur.overRunsCharged += charged;
  if (!cur.overBowlers.includes(bowler)) cur.overBowlers.push(bowler);
  if (extra !== "wide") { bat.balls += 1; cur.partnership.balls += 1; }
  bat.runs += batRuns;
  if (batRuns === 4) bat.fours += 1;
  if (batRuns === 6) bat.sixes += 1;
  if (counted) { cur.legalBalls += 1; bwl.legalBalls += 1; }

  // free hit
  if (extra === "noball" && rules.freeHit) cur.freeHit = true;
  else if (extra !== "wide") cur.freeHit = false;

  // strike and wicket
  const crossed = runs % 2 === 1;
  const wasLastLegal = counted && cur.legalBalls % rules.ballsPerOver === 0;
  let removed = false;
  if (w && outId) {
    if (w.type === "run_out") {
      if (crossed && cur.nonStriker) swapEnds(cur);
    }
    if (!cur.batters[outId]) cur.batters[outId] = emptyBatter(outId, Object.keys(cur.batters).length + 1);
    recordWicket(m, cur, outId, w.type, BOWLER_WICKETS.includes(w.type) ? bowler : null, w.fielder ?? null);
    if (BOWLER_WICKETS.includes(w.type)) bwl.wickets += 1;
    removeFromCrease(cur, outId);
    removed = true;
  } else if (crossed && cur.nonStriker) swapEnds(cur);

  const wicketNote = w ? ` WICKET: ${nameOf(m, outId)} ${w.type.replace("_", " ")}` : "";
  const rec = {
    eventId: ev.id, over: overNo, ball: ballNo, label: labelFor(p), teamRuns, counted, bowler, striker, wicket: !!w,
    text: `${labelOver} ${nameOf(m, bowler)} to ${nameOf(m, striker)}: ${describeBall(p, rules)}.${wicketNote}`,
    nonStriker: nonStrikerBefore, extra, runs, batRuns, charged, freeHit: wasFreeHit,
    wicketType: w ? w.type : null, out: w ? outId : null, fielder: w ? w.fielder ?? null : null,
  };
  cur.overBalls.push(rec);
  cur.balls.push(rec);

  // end of over
  if (wasLastLegal) {
    if (cur.overBowlers.length === 1 && cur.overRunsCharged === 0) bwl.maidens += 1;
    cur.lastOverBowler = bowler;
    cur.overBalls = [];
    cur.overRunsCharged = 0;
    cur.overBowlers = [];
    if (cur.nonStriker && cur.striker) swapEnds(cur); else if (cur.vacant && (cur.striker || cur.nonStriker)) swapEnds(cur);
    cur.needBowler = true;
  }

  if (removed) settleCrease(m, cur);
  checkEnd(m, cur);
  if (cur.ended) { cur.needBowler = false; cur.needBatter = false; }
}

/* ---------- the reducer ---------- */
function validateStart(p: StartPayload) {
  if (p.overs < 1 || p.overs > 50) refuse("Overs must be from 1 to 50.");
  if (p.playersPerSide < 2 || p.playersPerSide > 11) refuse("Players per side must be from 2 to 11.");
  const ids = new Set<string>();
  for (const pl of p.players) {
    if (ids.has(pl.id)) refuse("A player appears twice.");
    ids.add(pl.id);
  }
  for (const s of [1, 2] as const) if (p.players.filter((x) => x.side === s).length < 2) refuse("Each side needs at least 2 players to start the match.");
}

/** Which side bats in innings number `index` (0 and 1 are the match; from 2 on they are super overs, and the side that batted second goes first). */
export function battingSideFor(m: MatchState, index: number): Side {
  if (index < 2) return index === 0 ? m.battingFirst : other(m.battingFirst);
  const regularSecond = other(m.battingFirst);
  return (index - 2) % 2 === 0 ? regularSecond : other(regularSecond);
}

function startInnings(m: MatchState, ev: ScoreEvent, p: { striker: string; nonStriker: string | null; bowler: string }) {
  if (m.phase !== "need_innings") refuse("The next innings cannot be started now.");
  const index = m.nextInnings;
  const superOver = index >= 2;
  const batting = battingSideFor(m, index);
  // a repeated super over alternates the same way
  let target: number | null = null;
  if (index === 1) target = m.innings[0]!.runs + 1;
  if (superOver && (index - 2) % 2 === 1) target = m.innings[index - 1]!.runs + 1;
  const inn = newInnings(m, index, superOver, batting, target);
  const b1 = m.players[p.striker];
  if (!b1 || b1.side !== batting || m.gone[b1.id]) refuse("The striker must be a player of the batting side.");
  if (p.nonStriker) {
    const b2 = m.players[p.nonStriker];
    if (!b2 || b2.side !== batting || m.gone[b2.id]) refuse("The non-striker must be a player of the batting side.");
    if (p.nonStriker === p.striker) refuse("The two batters must be different people.");
  } else if (!m.rules.lastBatterAlone) refuse("Choose the non-striker.");
  m.innings.push(inn);
  inn.striker = p.striker;
  inn.nonStriker = p.nonStriker;
  inn.batters[p.striker] = emptyBatter(p.striker, 1);
  if (p.nonStriker) inn.batters[p.nonStriker] = emptyBatter(p.nonStriker, 2);
  const can = bowlerCanDeliver(m, inn, p.bowler);
  if (!can.ok) { m.innings.pop(); refuse(can.reason); }
  inn.bowler = p.bowler;
  m.phase = "scoring";
  stamp(m, ev, superOver ? `Super over: ${sideName(m, batting)} bat` : `Innings ${index + 1}: ${sideName(m, batting)} bat${target ? `, target ${target}` : ""}`);
}

function applyEvent(m: MatchState, ev: ScoreEvent, ballPayload?: BallPayload) {
  if (ev.type === "match_start") {
    if (m.started) refuse("The match has already started.");
    validateStart(ev.payload);
    const p = ev.payload;
    m.started = true;
    m.sides = p.sides; m.rules = p.rules; m.overs = p.overs; m.playersPerSide = p.playersPerSide; m.limit = p.rules.bowlerLimit;
    m.toss = p.toss; m.battingFirst = p.battingFirst;
    for (const pl of p.players) m.players[pl.id] = pl;
    m.phase = "need_innings";
    m.timeline.push({ at: ev.at ?? "", text: `Match started: ${p.sides[0]} v ${p.sides[1]}, ${p.overs} overs`, by: ev.by });
    return;
  }
  if (!m.started) refuse("The match has not started yet.");
  if (m.phase === "abandoned" || (m.phase === "finished" && ev.type !== "edit")) refuse("This match is finished and locked. Corrections to a finished match are made from its scorecard.");

  if (ev.type === "pause") { if (m.paused) refuse("Already paused."); m.paused = true; stamp(m, ev, "Match paused"); return; }
  if (ev.type === "resume") { if (!m.paused) refuse("The match is not paused."); m.paused = false; stamp(m, ev, "Match resumed"); return; }
  if (m.paused && ev.type !== "match_end") refuse("The match is paused. Resume it first.");

  const bpo = m.rules.ballsPerOver;
  const inn = activeInnings(m);
  const needInn = () => { if (!inn) refuse("There is no innings in progress."); return inn as InningsState; };

  switch (ev.type) {
    case "innings_start": return startInnings(m, ev, ev.payload);
    case "ball": return applyBall(m, ev, ballPayload ?? ev.payload);
    case "batter_in": {
      const cur = needInn();
      const p = ev.payload;
      if (!cur.needBatter) refuse("No batter is needed right now. To fix the batters at the crease use “Correct batters”.");
      const cand = selectableBatters(m, cur).find((c) => c.player.id === p.player);
      if (!cand) refuse(m.players[p.player]?.side === cur.batting ? "That player cannot bat now (already out, not playing, or the side's batter limit is reached)." : "Choose a player from the batting side.");
      const free: "striker" | "nonStriker" = cur.vacant ?? (cur.striker ? "nonStriker" : "striker");
      const want = p.end ?? free;
      const id = p.player;
      if (want !== free) {
        // swapping ends: the batter already there moves to the vacant end
        const stay = cur.striker ?? cur.nonStriker;
        if (free === "striker") { cur.nonStriker = id; cur.striker = stay; } else { cur.striker = id; cur.nonStriker = stay; }
      } else if (free === "striker") cur.striker = id; else cur.nonStriker = id;
      const line = cur.batters[id];
      if (line) line.status = "batting"; else cur.batters[id] = emptyBatter(id, Object.keys(cur.batters).length + 1);
      cur.needBatter = false; cur.vacant = null;
      return;
    }
    case "bowler": {
      const cur = needInn();
      const id = ev.payload.player;
      if (cur.bowler === id && !cur.needBowler) refuse("That bowler is already bowling.");
      const sel = selectableBowlers(m, cur).find((s) => s.player.id === id);
      if (!sel) refuse("Choose a player from the bowling side.");
      if (!sel!.ok) refuse(sel!.reason as string);
      const mid = !cur.needBowler && cur.legalBalls % bpo !== 0;
      if (mid) stamp(m, ev, `${nameOf(m, id)} replaced ${nameOf(m, cur.bowler)} mid-over`);
      cur.bowler = id; cur.needBowler = false;
      return;
    }
    case "swap_strike": {
      const cur = needInn();
      if (!cur.striker || !cur.nonStriker) refuse("There is no second batter to swap with.");
      swapEnds(cur);
      return;
    }
    case "set_crease": {
      const cur = needInn();
      const { striker, nonStriker } = ev.payload;
      for (const id of [striker, nonStriker]) {
        if (!id) continue;
        const pl = m.players[id];
        if (!pl || pl.side !== cur.batting || m.gone[id]) refuse("The batters must be players of the batting side.");
        if (cur.batters[id] && cur.batters[id]!.status !== "batting") refuse(`${pl.name} is not available to bat.`);
      }
      if (nonStriker === striker) refuse("The two batters must be different people.");
      if (!nonStriker && !m.rules.lastBatterAlone) refuse("Choose the non-striker.");
      for (const old of [cur.striker, cur.nonStriker]) {
        if (old && old !== striker && old !== nonStriker) {
          const l = cur.batters[old];
          if (l && (l.balls > 0 || l.runs > 0)) refuse(`${nameOf(m, old)} has already batted. Use “Retire a player” instead.`);
          delete cur.batters[old];
        }
      }
      cur.striker = striker; cur.nonStriker = nonStriker;
      for (const id of [striker, nonStriker]) if (id && !cur.batters[id]) cur.batters[id] = emptyBatter(id, Object.keys(cur.batters).length + 1);
      cur.needBatter = false; cur.vacant = null;
      stamp(m, ev, "Batters at the crease corrected");
      return;
    }
    case "batting_order": {
      const cur = needInn();
      for (const id of ev.payload.order) if (m.players[id]?.side !== cur.batting) refuse("The batting order can only list players of the batting side.");
      cur.battingOrderHint = ev.payload.order;
      return;
    }
    case "player_added": {
      const p = ev.payload.player;
      if (m.players[p.id]) refuse("That player is already in the match.");
      if (p.userId && Object.values(m.players).some((x) => x.userId === p.userId)) refuse("That member is already in this match.");
      if (Object.values(m.players).some((x) => x.kind === "guest" && p.kind === "guest" && x.name.trim().toLowerCase() === p.name.trim().toLowerCase())) refuse("A guest with that name is already in this match.");
      if (!p.name.trim()) refuse("Type a name.");
      const size = Object.values(m.players).filter((x) => x.side === p.side && !m.gone[x.id]).length;
      if (size >= m.playersPerSide) refuse(`${sideName(m, p.side)} already has ${m.playersPerSide} players. Raise “players per side” first.`);
      m.players[p.id] = p;
      stamp(m, ev, `${p.name}${p.kind === "guest" ? " (guest)" : ""} joined ${sideName(m, p.side)}`);
      return;
    }
    case "retire": {
      const { player, kind } = ev.payload;
      const pl = m.players[player];
      if (!pl) refuse("That player is not in the match.");
      const cur = currentInnings(m);
      if (kind === "absent" || kind === "replaced") {
        if (cur && !cur.ended && (cur.striker === player || cur.nonStriker === player || cur.bowler === player)) refuse("That player is batting or bowling right now. Use “Retired hurt” or change the bowler first.");
        if (m.gone[player]) refuse("That player is already out of the match.");
        m.gone[player] = kind;
        if (ev.payload.replacedBy && m.players[ev.payload.replacedBy]?.side !== pl!.side) refuse("The replacement must be on the same side.");
        stamp(m, ev, `${pl!.name} ${kind === "absent" ? "is absent" : `was replaced${ev.payload.replacedBy ? ` by ${nameOf(m, ev.payload.replacedBy)}` : ""}`}`);
        if (cur && !cur.ended && pl!.side === cur.batting) settleCrease(m, cur);
        return;
      }
      const c = needInn();
      if (c.striker !== player && c.nonStriker !== player) refuse("Only a batter at the crease can retire.");
      const line = c.batters[player]!;
      if (kind === "retired_out") recordWicket(m, c, player, "retired_out", null, null);
      else line.status = "retired_hurt";
      removeFromCrease(c, player);
      stamp(m, ev, `${pl!.name} ${kind === "retired_out" ? "retired out" : "retired hurt"}`);
      settleCrease(m, c, kind === "retired_hurt" ? player : null);
      checkEnd(m, c);
      return;
    }
    case "substitute": {
      if (!ev.payload.name.trim()) refuse("Type the substitute's name.");
      stamp(m, ev, `Substitute fielder ${ev.payload.name.trim()} for ${sideName(m, ev.payload.side)} (no batting or bowling credit)`);
      return;
    }
    case "overs_change": {
      const { overs, scope } = ev.payload;
      if (!Number.isInteger(overs) || overs < 1 || overs > 50) refuse("Overs must be a whole number from 1 to 50.");
      const cur = currentInnings(m);
      const before = cur && !cur.ended ? cur.maxOvers : m.overs;
      if (cur && !cur.ended) {
        if (overs * bpo < cur.legalBalls) refuse(`${oversText(cur.legalBalls, bpo)} overs have already been bowled in this innings.`);
        cur.maxOvers = overs;
      } else if (scope === "innings") refuse("There is no innings in progress to change.");
      if (scope === "remaining") m.overs = overs;
      stamp(m, ev, `Overs ${overs < before ? "reduced" : "increased"} from ${before} to ${overs}${scope === "remaining" ? " for all remaining innings" : " for this innings"}`);
      if (cur && !cur.ended) checkEnd(m, cur);
      return;
    }
    case "players_change": {
      const n = ev.payload.playersPerSide;
      if (!Number.isInteger(n) || n < 2 || n > 11) refuse("Players per side must be from 2 to 11.");
      const before = m.playersPerSide;
      m.playersPerSide = n;
      stamp(m, ev, `Players per side changed from ${before} to ${n}`);
      const cur = activeInnings(m);
      if (cur) { settleCrease(m, cur); checkEnd(m, cur); }
      return;
    }
    case "limit_change": {
      const l = ev.payload.limit;
      if (l.mode === "max" && (!Number.isInteger(l.overs) || l.overs < 1)) refuse("The limit must be at least 1 over.");
      if (l.mode === "pattern" && (l.pattern.length < 2 || l.pattern.some((n) => !Number.isInteger(n) || n < 1))) refuse("The pattern needs at least two whole numbers.");
      const text = (x: BowlerLimit) => (x.mode === "none" ? "no limit" : x.mode === "max" ? `${x.overs} over${x.overs === 1 ? "" : "s"} each` : `pattern ${x.pattern.join("-")}`);
      stamp(m, ev, `Bowler limit changed from ${text(m.limit)} to ${text(l)}`);
      m.limit = l;
      return;
    }
    case "penalty": {
      const cur = needInn();
      const r = ev.payload.runs;
      if (!Number.isInteger(r) || r < 1 || r > 20) refuse("Penalty runs must be from 1 to 20.");
      cur.runs += r; cur.extras.penalty += r;
      stamp(m, ev, `${r} penalty run${r === 1 ? "" : "s"} to ${sideName(m, cur.batting)}`);
      checkEnd(m, cur);
      return;
    }
    case "target_manual": {
      const cur = needInn();
      if (cur.target === null && ev.payload.target !== null) refuse("A target only applies to the side batting second.");
      const t = ev.payload.target;
      if (t !== null && (!Number.isInteger(t) || t < 1 || t > 999)) refuse("The target must be a whole number from 1 to 999.");
      stamp(m, ev, t === null ? "Revised target removed" : `Target revised to ${t}`);
      cur.manualTarget = t;
      checkEnd(m, cur);
      return;
    }
    case "innings_end": {
      const cur = needInn();
      stamp(m, ev, `${sideName(m, cur.batting)} innings ended early`);
      return endInnings(m, cur, "declared");
    }
    case "super_over_decision": {
      if (m.phase !== "level_prompt") refuse("There is no super over to decide on.");
      if (ev.payload.play) { m.phase = "need_innings"; m.superOverPlaying = true; stamp(m, ev, "Super over accepted"); }
      else { m.result = { kind: "tie", winner: null, margin: null, text: "Match tied" }; m.phase = "result"; stamp(m, ev, "Super over declined: match tied"); }
      return;
    }
    case "match_end": {
      const { kind, winner } = ev.payload;
      const cur = currentInnings(m);
      if (cur && !cur.ended) { cur.ended = true; cur.endReason = "declared"; cur.needBatter = false; cur.needBowler = false; }
      if (kind === "abandoned") {
        m.result = { kind: "abandoned", winner: null, margin: null, text: "Match abandoned" };
        m.phase = "abandoned";
      } else {
        m.result = winner
          ? { kind: "win", winner, margin: null, text: `${sideName(m, winner)} won (result entered by the scorer)` }
          : { kind: "no_result", winner: null, margin: null, text: "No result" };
        m.phase = "finished";
      }
      m.paused = false;
      stamp(m, ev, m.result.text);
      return;
    }
    case "finish": {
      if (m.phase !== "result") refuse("The match is not ready to finish yet.");
      m.phase = "finished";
      stamp(m, ev, m.result?.text ?? "Match finished");
      return;
    }
    case "edit": return; // the replay applies it to the ball it names
    default: refuse("Unknown event.");
  }
}

/* ---------- replay ---------- */
const emptyState = (): MatchState => ({
  started: false, sides: ["Team 1", "Team 2"], rules: undefined as never, overs: 0, playersPerSide: 0, limit: { mode: "none" }, toss: null, battingFirst: 1,
  players: {}, gone: {}, innings: [], phase: "not_started", paused: false, nextInnings: 0, superOverPlaying: false, result: null, timeline: [], eventCount: 0,
});

/** Undo takes away the latest event still standing; an edit rewrites one earlier ball. */
export function effectiveEvents(events: ScoreEvent[]): { ok: true; list: ScoreEvent[] } | { ok: false; error: string; at: number } {
  const list: ScoreEvent[] = [];
  for (const [i, ev] of events.entries()) {
    if (ev.type === "undo") {
      const last = list.pop();
      if (!last) return { ok: false, error: "There is nothing to undo.", at: i };
      if (last.type === "match_start" || last.type === "finish" || last.type === "match_end") { return { ok: false, error: "The start or the end of the match cannot be undone.", at: i }; }
      continue;
    }
    if (ev.type === "edit") {
      const t = list.find((e) => e.id === ev.payload.target);
      if (!t || t.type !== "ball") return { ok: false, error: "That delivery cannot be edited (it was undone or does not exist).", at: i };
    }
    list.push(ev);
  }
  return { ok: true, list };
}

export function buildState(events: ScoreEvent[]): BuildResult {
  const eff = effectiveEvents(events);
  if (!eff.ok) return { ok: false, error: eff.error, at: eff.at, effective: [] };
  const overrides = new Map<string, BallPayload>();
  for (const ev of eff.list) if (ev.type === "edit") overrides.set(ev.payload.target, { ...(overrides.get(ev.payload.target) ?? (eff.list.find((e) => e.id === ev.payload.target) as { payload: BallPayload }).payload), ...ev.payload.patch });
  const m = emptyState();
  for (const [i, ev] of eff.list.entries()) {
    try {
      if (ev.type === "ball" && overrides.has(ev.id)) applyEvent(m, ev, overrides.get(ev.id));
      else applyEvent(m, ev);
      if (ev.type === "edit") stamp(m, ev, "A delivery was corrected");
    } catch (e) {
      if (e instanceof Refusal) return { ok: false, error: e.message, at: i, effective: eff.list };
      throw e;
    }
  }
  m.eventCount = eff.list.length;
  return { ok: true, state: m, effective: eff.list };
}

/** Would this event be accepted on top of what is already saved? */
export function tryEvent(events: ScoreEvent[], next: ScoreEvent): BuildResult {
  return buildState([...events, next]);
}

/* ---------- numbers for the scoreboard ---------- */
export function runRate(inn: InningsState, bpo: number): number {
  return inn.legalBalls === 0 ? 0 : (inn.runs * bpo) / inn.legalBalls;
}
export function requiredRate(inn: InningsState, bpo: number): number | null {
  const t = effectiveTarget(inn);
  if (t === null) return null;
  const ballsLeft = inn.maxOvers * bpo - inn.legalBalls;
  if (ballsLeft <= 0) return null;
  return (Math.max(0, t - inn.runs) * bpo) / ballsLeft;
}
export const strikeRate = (b: BatterLine) => (b.balls === 0 ? 0 : (b.runs * 100) / b.balls);
export const economy = (b: BowlerLine, bpo: number) => (b.legalBalls === 0 ? 0 : (b.runs * bpo) / b.legalBalls);

export function dismissalText(m: MatchState, l: BatterLine): string {
  const d = l.dismissal;
  if (!d) return l.status === "retired_hurt" ? "retired hurt" : l.status === "batting" ? "not out" : l.status;
  const f = d.fielder ? nameOf(m, d.fielder) : null;
  const b = d.bowler ? nameOf(m, d.bowler) : null;
  switch (d.type) {
    case "bowled": return `b ${b}`;
    case "caught": return d.fielder === d.bowler ? `c & b ${b}` : `c ${f} b ${b}`;
    case "lbw": return `lbw b ${b}`;
    case "stumped": return `${f ? `st ${f} ` : "st "}b ${b}`;
    case "hit_wicket": return `hit wicket b ${b}`;
    case "run_out": return f ? `run out (${f})` : "run out";
    case "retired_out": return "retired out";
  }
}

export const totalExtras = (inn: InningsState) => inn.extras.wide + inn.extras.noball + inn.extras.bye + inn.extras.legbye + inn.extras.penalty;
