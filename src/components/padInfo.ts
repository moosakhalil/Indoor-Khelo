// Phase E1: small pure helpers for the scoring pad's words and numbers (no React, no events made here).
// Everything in this file only READS the engine's state to write a sentence or pick a label; nothing here can add an event.
import { bowlerAllowance, describeBall, dismissalText, selectableBowlers } from "@/lib/engine/engine";
import type { BallRecord, InningsState, MatchState, PlayerEntry, ScoreEvent } from "@/lib/engine/types";

/** What the scorer is told UNDO took back ("Undone: ..."): the word for each kind of change. */
export const WORDS: Record<string, string> = {
  ball: "the last ball", batter_in: "choosing the batter", bowler: "choosing the bowler", swap_strike: "the strike swap", set_crease: "the batter correction", batting_order: "the batting order",
  player_added: "adding the player", retire: "the retirement", substitute: "the substitute", overs_change: "the overs change", players_change: "the players change", limit_change: "the limit change",
  penalty: "the penalty runs", target_manual: "the revised target", innings_end: "ending the innings", super_over_decision: "the super over answer", innings_start: "starting the innings",
  pause: "the pause", resume: "the resume", edit: "the edit",
};

export const nameOf = (m: MatchState, id: string | null | undefined) => (id ? m.players[id]?.name ?? "Player" : "");
export const numberOf = (m: MatchState, id: string | null | undefined): number | null => (id ? m.players[id]?.number ?? null : null);

/** "Ali Raza" -> "Ali R." so a button can name three people without wrapping. */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "Player";
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The word under a ball chip in the over strip, so colour is never the only difference between a 4 and a dot. */
export function ballCaption(b: BallRecord): string {
  const r = b.runs;
  if (b.wicket) {
    const how = b.wicketType === "run_out" ? "run out" : "wicket";
    return b.extra === "wide" ? `wide + ${how}` : b.extra === "noball" ? `no ball + ${how}` : how;
  }
  switch (b.extra) {
    case "wide": return r ? `wide + ${r}` : "wide";
    case "noball": return r ? `no ball + ${r}` : "no ball";
    case "bye": return plural(r, "bye", "byes");
    case "legbye": return plural(r, "leg-bye", "leg-byes");
    default: return r === 0 ? "dot" : r === 4 ? "four" : r === 6 ? "six" : plural(r, "run", "runs");
  }
}

/** Colour class for a ball chip (kept the same as before: four and six blue/gold, wickets red, wides and no balls orange). */
export const ballTone = (b: { wicket: boolean; label: string }) => (b.wicket ? "w" : b.label === "6" ? "six" : b.label === "4" ? "four" : /^(Wd|Nb)/.test(b.label) ? "x" : "");

/** "Four runs · Hamza Khan off Bilal Ahmed": what the next UNDO takes back. `last` is the last event that still counts. */
export function lastActionText(m: MatchState, last: ScoreEvent | undefined): string | null {
  if (!last) return null;
  if (last.type === "ball") {
    const rec = m.innings.flatMap((i) => i.balls).find((b) => b.eventId === last.id);
    const what = describeBall(last.payload, m.rules);
    return rec ? `${what} · ${nameOf(m, rec.striker)} off ${nameOf(m, rec.bowler)}` : what;
  }
  const w = WORDS[last.type] ?? "the last action";
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** The balls of an over that has just finished (the bowler is still to be chosen); empty otherwise. */
export function finishedOverBalls(inn: InningsState, bpo: number): BallRecord[] {
  if (inn.ended || !inn.needBowler || inn.legalBalls === 0 || inn.legalBalls % bpo !== 0) return [];
  const over = inn.legalBalls / bpo - 1;
  return inn.balls.filter((b) => b.over === over);
}

/** The last over of an innings that has ended (level / result screens), so the over strip is not left empty. */
export function lastOverBalls(inn: InningsState, bpo: number): BallRecord[] {
  if (!inn.ended || inn.legalBalls === 0) return [];
  const over = Math.floor((inn.legalBalls - 1) / bpo);
  return inn.balls.filter((b) => b.over === over);
}

/** Earlier overs, latest first, for the wide layout. `shown` is the over (counting from 0) drawn as "this over"; only earlier ones are listed. */
export function previousOvers(m: MatchState, inn: InningsState, shown: number) {
  const by = new Map<number, BallRecord[]>();
  for (const b of inn.balls) {
    if (b.over >= shown) continue;
    const list = by.get(b.over);
    if (list) list.push(b); else by.set(b.over, [b]);
  }
  return Array.from(by.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([over, balls]) => ({ over: over + 1, balls, runs: balls.reduce((s, x) => s + x.teamRuns, 0), bowler: nameOf(m, balls[0]!.bowler) }));
}

/** The gold note above "Choose the next batter": who is out and how. */
export function outNote(m: MatchState, inn: InningsState): string {
  const last = inn.fow[inn.fow.length - 1];
  const line = last ? inn.batters[last.player] : undefined;
  if (!last || !line) return "A batter is needed. Pick who comes in to continue.";
  return `${nameOf(m, last.player)} is out (${dismissalText(m, line)}). Pick who comes in to continue.`;
}

/** The note above "Choose the bowler for over N": the finished over, and who cannot bowl the next one. */
export function overNote(m: MatchState, inn: InningsState): string {
  const balls = finishedOverBalls(inn, m.rules.ballsPerOver);
  const overNo = inn.legalBalls / m.rules.ballsPerOver;
  const runs = balls.reduce((s, b) => s + b.teamRuns, 0);
  const wk = balls.filter((b) => b.wicket).length;
  const out = selectableBowlers(m, inn).filter((o) => !o.ok).map((o) => o.player.name);
  const base = `Over ${overNo} complete: ${plural(runs, "run", "runs")}, ${wk ? plural(wk, "wicket", "wickets") : "no wicket"}.`;
  return out.length ? `${base} ${out.join(", ")} cannot bowl the next over.` : base;
}

/** The target to show when an innings is about to start. The first super-over innings has NO target yet (the engine only sets one for the second). */
export function chaseFor(m: MatchState, index: number): number | null {
  if (index === 1) return m.innings[0] ? m.innings[0].runs + 1 : null;
  if (index >= 3 && (index - 2) % 2 === 1) return m.innings[index - 1] ? m.innings[index - 1]!.runs + 1 : null;
  return null;
}

/** What the start button will do, in words ("Ali R. and Zain M. to face Hamza K."). */
export function openersLine(players: PlayerEntry[], striker: string, non: string, bowler: string): string | null {
  const nm = (id: string) => players.find((p) => p.id === id)?.name;
  const a = nm(striker), b = nm(non), c = nm(bowler);
  if (!a || !b || !c) return null;
  return `${shortName(a)} and ${shortName(b)} to face ${shortName(c)}`;
}

export type StatusTone = "green" | "orange" | "blue" | "red";
/** The sync line. Words are the ones the scorer has always seen; the colour now says whether anything needs doing (offline is calm, not an error). */
export function statusWording(o: { signin: boolean; online: boolean; syncing: boolean; waiting: number; failed: boolean }): { text: string; tone: StatusTone } {
  const { signin, online, syncing, waiting } = o;
  let r: { text: string; tone: StatusTone };
  if (signin) r = { text: "Signed out · balls are safe on this phone", tone: "red" };
  else if (!online) r = { text: `Offline${waiting ? ` · ${waiting} ball${waiting === 1 ? "" : "s"} waiting to sync` : ""}`, tone: "blue" };
  else if (syncing) r = { text: "Syncing…", tone: "orange" };
  else if (waiting) r = { text: `${waiting} waiting to sync`, tone: "orange" };
  else r = { text: "All saved", tone: "green" };
  // the phone could not keep a ball in its own storage: that needs the scorer's attention, so it is red whatever else is true
  return o.failed ? { ...r, tone: "red" } : r;
}

export type MoreItem = { key: string; label: string; off: boolean; why: string | null };
/** Why a More item is greyed out (the rule is the same as before; only the reason is new). */
export function moreWhy(o: { live: boolean; inn: boolean; needBatter: boolean; needBowler: boolean; paused: boolean; lock: boolean; target: number | null | undefined }) {
  const noLive = o.live ? null : "No innings in progress";
  const noInn = o.inn ? null : "No innings yet";
  const byes = !o.live ? "No innings in progress" : o.lock ? "Scoring is not on this phone" : o.paused ? "The match is paused" : o.needBatter ? "Choose the next batter first" : o.needBowler ? "Choose the bowler first" : null;
  return {
    bye: byes, penalty: noLive, changebowler: noLive ?? (o.needBatter ? "Choose the next batter first" : null), retire: noLive, late: noInn,
    overs: noLive, players: noInn, limit: noInn, crease: noLive, order: noLive, sub: noInn, edit: noInn,
    target: noLive ?? (o.target === null || o.target === undefined ? "Only for the side batting second" : null), endinnings: noLive,
  };
}

/** "0 overs left" style text for the bowler row (unchanged wording). */
export const overLeftText = (left: number) => `${left} ${left === 1 ? "OVER" : "OVERS"} LEFT`;
export { bowlerAllowance };
