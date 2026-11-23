// Phase 5: checks the shape of an event that arrives from a phone, before the engine looks at what it means.
// Nothing from the network is trusted: ids, numbers, lists and words are all checked here.
import { DEFAULT_RULES, DISMISSALS, type BowlerLimit, type Rules } from "@/lib/matchRules";
import type { BallPayload, PlayerEntry, ScoreEvent, Side } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

type R<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const int = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
const side = (v: unknown): Side | null => (v === 1 || v === 2 ? v : null);
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim().length >= 1 && v.trim().length <= max ? v.trim() : null);
const optId = (v: unknown): string | null | undefined => (v === undefined || v === null ? null : isId(v) ? v : undefined);

function player(v: unknown): R<PlayerEntry> {
  const o = obj(v);
  if (!o) return fail("A player is missing.");
  const s = side(o.side);
  const name = text(o.name, 60);
  if (!isId(o.id) || !s || !name) return fail("A player entry is not valid.");
  const kind = o.kind === "guest" ? "guest" : o.kind === "member" ? "member" : null;
  if (!kind) return fail("A player entry is not valid.");
  const number = o.number === null || o.number === undefined ? null : int(o.number, 1, 99);
  if (o.number !== null && o.number !== undefined && number === null) return fail("A player number must be from 1 to 99.");
  if (kind === "member" && !isId(o.userId)) return fail("A member entry needs its member.");
  return { ok: true, value: { id: o.id, side: s, name, number, kind, userId: kind === "member" ? (o.userId as string) : null } };
}

function limit(v: unknown): R<BowlerLimit> {
  const o = obj(v);
  if (!o) return fail("The bowler limit is not valid.");
  if (o.mode === "none") return { ok: true, value: { mode: "none" } };
  if (o.mode === "max") { const n = int(o.overs, 1, 50); return n === null ? fail("The limit must be from 1 to 50 overs.") : { ok: true, value: { mode: "max", overs: n } }; }
  if (o.mode === "pattern" && Array.isArray(o.pattern) && o.pattern.length >= 2 && o.pattern.length <= 11 && o.pattern.every((n) => int(n, 1, 50) !== null)) {
    return { ok: true, value: { mode: "pattern", pattern: o.pattern as number[] } };
  }
  return fail("The bowler limit is not valid.");
}

/** The rules snapshot must have exactly the known fields with the right kinds of values. */
export function parseRules(v: unknown): R<Rules> {
  const o = obj(v);
  if (!o) return fail("The rules are missing.");
  const flags = ["widesReBowled", "noBallsReBowled", "byesCountAsBalls", "legByesCountAsBalls", "freeHit", "overthrows", "retiredCanReturn", "sameBowlerTwoInARow", "lastBatterAlone"] as const;
  for (const f of flags) if (typeof o[f] !== "boolean") return fail("The rules are not valid.");
  const innings = o.innings === 1 || o.innings === 2 ? o.innings : null;
  const bpo = int(o.ballsPerOver, 1, 12), wide = int(o.wideRuns, 0, 5), nb = int(o.noBallRuns, 0, 5);
  const known = new Set<string>(DISMISSALS.map((d) => d.value));
  const dis = Array.isArray(o.dismissals) && o.dismissals.length >= 1 && o.dismissals.every((d) => typeof d === "string" && known.has(d)) ? (o.dismissals as string[]) : null;
  const so = o.superOver === "ask" || o.superOver === "always" || o.superOver === "never" ? o.superOver : null;
  const bl = limit(o.bowlerLimit);
  if (!innings || bpo === null || wide === null || nb === null || !dis || !so || !bl.ok) return fail("The rules are not valid.");
  const out: Rules = { ...DEFAULT_RULES, version: 1, innings, ballsPerOver: bpo, wideRuns: wide, noBallRuns: nb, dismissals: dis, superOver: so, bowlerLimit: bl.value };
  for (const f of flags) out[f] = o[f] as boolean;
  return { ok: true, value: out };
}

function ballPatch(v: unknown, whole: boolean): R<BallPayload> {
  const o = obj(v);
  if (!o) return fail("The ball is not valid.");
  const out: BallPayload = {};
  if (o.runs !== undefined) { const r = int(o.runs, 0, 12); if (r === null) return fail("Runs must be from 0 to 12."); out.runs = r; }
  if (o.extra !== undefined) {
    if (o.extra !== null && !["wide", "noball", "bye", "legbye"].includes(o.extra as string)) return fail("The kind of extra is not valid.");
    out.extra = o.extra as BallPayload["extra"];
  }
  if (o.wicket !== undefined) {
    if (o.wicket === null) out.wicket = null;
    else {
      const w = obj(o.wicket);
      const types = ["bowled", "caught", "lbw", "stumped", "hit_wicket", "run_out"];
      if (!w || typeof w.type !== "string" || !types.includes(w.type)) return fail("The way of getting out is not valid.");
      const out1 = optId(w.out), fld = optId(w.fielder);
      if (out1 === undefined || fld === undefined) return fail("The wicket details are not valid.");
      const end = w.newEnd === "striker" || w.newEnd === "nonStriker" ? w.newEnd : null;
      out.wicket = { type: w.type as NonNullable<BallPayload["wicket"]>["type"], out: out1, fielder: fld, newEnd: end };
    }
  }
  if (!whole && Object.keys(out).length === 0) return fail("An edit needs something to change.");
  return { ok: true, value: out };
}

export const EVENT_TYPES = [
  "match_start", "innings_start", "ball", "batter_in", "bowler", "swap_strike", "set_crease", "batting_order", "player_added", "retire", "substitute",
  "overs_change", "players_change", "limit_change", "penalty", "target_manual", "innings_end", "super_over_decision", "match_end", "finish",
  "pause", "resume", "undo", "edit",
] as const;

/** Turns whatever came over the network into a clean ScoreEvent, or says why not. */
export function parseEvent(raw: unknown): R<ScoreEvent> {
  const o = obj(raw);
  if (!o) return fail("An event is missing.");
  if (!isId(o.id)) return fail("An event has no valid id.");
  const seq = int(o.seq, 1, 1_000_000);
  if (seq === null) return fail("An event has no valid sequence number.");
  const type = o.type as string;
  if (!(EVENT_TYPES as readonly string[]).includes(type)) return fail("Unknown kind of event.");
  const p = obj(o.payload ?? {});
  if (!p) return fail("An event has no payload.");
  const reason = o.reason === undefined || o.reason === null || o.reason === "" ? undefined : text(o.reason, 200) ?? undefined;
  if (o.reason && reason === undefined) return fail("The reason is too long (200 characters at most).");
  const at = typeof o.at === "string" && !Number.isNaN(Date.parse(o.at)) ? o.at : undefined;
  const base = { id: o.id, seq, reason, at };
  const done = (body: Record<string, unknown>): R<ScoreEvent> => ({ ok: true, value: { ...base, ...body } as ScoreEvent });

  switch (type) {
    case "match_start": {
      const sides = Array.isArray(p.sides) && p.sides.length === 2 ? [text(p.sides[0], 40), text(p.sides[1], 40)] : null;
      const overs = int(p.overs, 1, 50), pps = int(p.playersPerSide, 2, 11), bf = side(p.battingFirst);
      const rules = parseRules(p.rules);
      if (!sides || !sides[0] || !sides[1] || overs === null || pps === null || !bf) return fail("The match setup is not valid.");
      if (!rules.ok) return fail(rules.error);
      if (!Array.isArray(p.players) || p.players.length > 40) return fail("The players are not valid.");
      const players: PlayerEntry[] = [];
      for (const x of p.players) { const r = player(x); if (!r.ok) return fail(r.error); players.push(r.value); }
      let toss: { winner: Side; decision: "bat" | "bowl" } | null = null;
      if (p.toss) {
        const t = obj(p.toss);
        const w = t ? side(t.winner) : null;
        if (!t || !w || (t.decision !== "bat" && t.decision !== "bowl")) return fail("The toss is not valid.");
        toss = { winner: w, decision: t.decision };
      }
      return done({ type, payload: { sides, overs, playersPerSide: pps, rules: rules.value, players, toss, battingFirst: bf } });
    }
    case "innings_start": {
      const ns = optId(p.nonStriker);
      if (!isId(p.striker) || !isId(p.bowler) || ns === undefined) return fail("Choose the batters and the bowler.");
      return done({ type, payload: { striker: p.striker, nonStriker: ns, bowler: p.bowler } });
    }
    case "ball": { const b = ballPatch(p, true); return b.ok ? done({ type, payload: b.value }) : fail(b.error); }
    case "edit": {
      const b = ballPatch(p.patch, false);
      if (!isId(p.target)) return fail("The delivery to edit is not valid.");
      return b.ok ? done({ type, payload: { target: p.target, patch: b.value } }) : fail(b.error);
    }
    case "batter_in": {
      if (!isId(p.player)) return fail("Choose a batter.");
      const end = p.end === "striker" || p.end === "nonStriker" ? p.end : null;
      return done({ type, payload: { player: p.player, end } });
    }
    case "bowler": return isId(p.player) ? done({ type, payload: { player: p.player } }) : fail("Choose a bowler.");
    case "set_crease": {
      const ns = optId(p.nonStriker);
      if (!isId(p.striker) || ns === undefined) return fail("Choose both batters.");
      return done({ type, payload: { striker: p.striker, nonStriker: ns } });
    }
    case "batting_order": return Array.isArray(p.order) && p.order.length <= 40 && p.order.every(isId) ? done({ type, payload: { order: p.order } }) : fail("The batting order is not valid.");
    case "player_added": { const r = player(p.player); return r.ok ? done({ type, payload: { player: r.value } }) : fail(r.error); }
    case "retire": {
      const kinds = ["retired_out", "retired_hurt", "absent", "replaced"];
      const rb = optId(p.replacedBy);
      if (!isId(p.player) || typeof p.kind !== "string" || !kinds.includes(p.kind) || rb === undefined) return fail("The retirement is not valid.");
      return done({ type, payload: { player: p.player, kind: p.kind, replacedBy: rb } });
    }
    case "substitute": { const s = side(p.side), n = text(p.name, 60); return s && n ? done({ type, payload: { side: s, name: n } }) : fail("Type the substitute's name."); }
    case "overs_change": {
      const n = int(p.overs, 1, 50);
      return n !== null && (p.scope === "innings" || p.scope === "remaining") ? done({ type, payload: { overs: n, scope: p.scope } }) : fail("Overs must be from 1 to 50.");
    }
    case "players_change": { const n = int(p.playersPerSide, 2, 11); return n !== null ? done({ type, payload: { playersPerSide: n } }) : fail("Players per side must be from 2 to 11."); }
    case "limit_change": { const l = limit(p.limit); return l.ok ? done({ type, payload: { limit: l.value } }) : fail(l.error); }
    case "penalty": { const n = int(p.runs, 1, 20); return n !== null ? done({ type, payload: { runs: n } }) : fail("Penalty runs must be from 1 to 20."); }
    case "target_manual": {
      if (p.target === null) return done({ type, payload: { target: null } });
      const n = int(p.target, 1, 999);
      return n !== null ? done({ type, payload: { target: n } }) : fail("The target must be from 1 to 999.");
    }
    case "super_over_decision": return typeof p.play === "boolean" ? done({ type, payload: { play: p.play } }) : fail("Choose yes or no.");
    case "match_end": {
      if (p.kind !== "abandoned" && p.kind !== "result") return fail("Choose abandoned or a result.");
      const w = p.winner === undefined || p.winner === null ? null : side(p.winner);
      if (p.winner !== undefined && p.winner !== null && w === null) return fail("Choose a winner.");
      return done({ type, payload: { kind: p.kind, winner: w } });
    }
    case "innings_end": case "finish": case "pause": case "resume": case "undo": case "swap_strike":
      return done({ type, payload: {} });
  }
  return fail("Unknown kind of event.");
}
