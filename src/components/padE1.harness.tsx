// Phase E1 test helpers (not a test file): a pretend server, a pretend phone and deterministic match events, so the scoring pad
// can be driven tap by tap and the EVENTS it makes can be compared with what the code made before the redesign.
// The test files that use this must do the three vi.mock calls themselves (they are hoisted per file).
import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import type { ReactElement } from "react";
import ScoringPad from "@/components/ScoringPad";
import { buildState } from "@/lib/engine/engine";
import { parseEvent } from "@/lib/engine/parse";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side, StartPayload } from "@/lib/engine/types";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";

export const COMMUNITY = "00000000-0000-4000-8000-000000000001";

/** The same twelve people in every test, with fixed ids (real id format, the server stand-in checks it) so recorded events are comparable between runs. */
const uid = (side: "a" | "b", i: number) => `${side === "a" ? "aaaaaaaa" : "bbbbbbbb"}-0000-4000-8000-00000000000${i}`;
export const P = { a1: uid("a", 1), a2: uid("a", 2), a3: uid("a", 3), a4: uid("a", 4), a5: uid("a", 5), a6: uid("a", 6), b1: uid("b", 1), b2: uid("b", 2), b3: uid("b", 3), b4: uid("b", 4), b5: uid("b", 5), b6: uid("b", 6) };
const user = (side: "a" | "b", i: number) => `${side === "a" ? "cccccccc" : "dddddddd"}-0000-4000-8000-00000000000${i}`;
export const players = (): PlayerEntry[] => [
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: uid("a", i), side: 1 as const, name: `Alpha${i}`, number: i, kind: "member" as const, userId: user("a", i) })),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: uid("b", i), side: 2 as const, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: user("b", i) })),
];

export type Base = Omit<StartPayload, "battingFirst" | "toss">;
export const baseOf = (overs = 6, rules: Rules = DEFAULT_RULES): Base => ({ sides: ["Alpha", "Bravo"], overs, playersPerSide: 6, rules, players: players() });

export const AT = "2026-01-01T00:00:00.000Z";
/** Makes a list of real events (ids ev-1, ev-2 ...) and checks the engine accepts every one. */
export function chain(bodies: ScoreEventBody[]): ScoreEvent[] {
  const list: ScoreEvent[] = [];
  for (const b of bodies) {
    const e = { ...b, id: `ev-${list.length + 1}`, seq: list.length + 1, at: AT } as ScoreEvent;
    const r = buildState([...list, e]);
    if (!r.ok) throw new Error(`fixture refused at ${list.length + 1}: ${r.error}`);
    list.push(e);
  }
  return list;
}
export const matchStart = (overs = 6, battingFirst: Side = 1, rules: Rules = DEFAULT_RULES): ScoreEventBody => ({ type: "match_start", payload: { ...baseOf(overs, rules), toss: null, battingFirst } });
export const inningsStart = (striker: string, non: string, bowler: string): ScoreEventBody => ({ type: "innings_start", payload: { striker, nonStriker: non, bowler } });
export const ball = (runs: number, extra?: "wide" | "noball" | "bye" | "legbye"): ScoreEventBody => ({ type: "ball", payload: { runs, ...(extra ? { extra } : {}) } });

/** A match in the middle of the first innings: Alpha1 and Alpha2 batting, Bravo1 bowling, 6 overs. */
export const midInnings = (extra: ScoreEventBody[] = [], overs = 6) => chain([matchStart(overs), inningsStart(P.a1, P.a2, P.b1), ...extra]);

/* ---- a pretend server: the same engine, an in-memory log per match, can be switched offline or told to refuse ---- */
export const server = {
  online: true,
  lockLost: false,
  refuseAll: false,
  status: 200,
  logs: new Map<string, ScoreEvent[]>(),
  posted: [] as string[][],         // the ids sent in each request, in order
};
export const srv = (id: string) => { if (!server.logs.has(id)) server.logs.set(id, []); return server.logs.get(id)!; };

export function installFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    if (!server.online) throw new TypeError("Failed to fetch");
    if (server.status !== 200) return { ok: false, status: server.status, redirected: false, headers: { get: () => "application/json" }, json: async () => ({}) };
    const log = srv(/matches\/([^/]+)\/events/.exec(url)![1]);
    const body = JSON.parse(init.body) as { events: unknown[] };
    server.posted.push((body.events as { id: string }[]).map((e) => e.id));
    const accepted: string[] = [], duplicates: string[] = [];
    const rejected: { id: string | null; reason: string; code: string }[] = [];
    let blocked = false;
    for (const raw of body.events) {
      const p = parseEvent(raw);
      if (!p.ok) { rejected.push({ id: null, reason: p.error, code: "invalid" }); blocked = true; continue; }
      const ev = p.value;
      if (server.lockLost) { rejected.push({ id: ev.id, reason: "You no longer hold the scoring lock.", code: "not_scorer" }); continue; }
      if (log.some((e) => e.id === ev.id)) { duplicates.push(ev.id); continue; }
      if (blocked) { rejected.push({ id: ev.id, reason: "blocked", code: "blocked" }); continue; }
      if (server.refuseAll) { rejected.push({ id: ev.id, reason: "The server refused this ball (test).", code: "refused" }); blocked = true; continue; }
      if (ev.seq !== log.length + 1) { rejected.push({ id: ev.id, reason: "out of order", code: "out_of_order" }); blocked = true; continue; }
      const r = buildState([...log, ev]);
      if (!r.ok) { rejected.push({ id: ev.id, reason: r.error, code: "refused" }); blocked = true; continue; }
      log.push(ev); accepted.push(ev.id);
    }
    return { ok: true, status: 200, redirected: false, headers: { get: () => "application/json" }, json: async () => ({ accepted, duplicates, rejected, lockLost: server.lockLost, lastSeq: log.length }) };
  }));
}

export function setOnline(v: boolean) {
  server.online = v;
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
  window.dispatchEvent(new Event(v ? "online" : "offline"));
}

export const ctx = { matchId: "match-1" };
export function resetServer() {
  server.online = true; server.lockLost = false; server.refuseAll = false; server.status = 200; server.logs.clear(); server.posted = [];
  ctx.matchId = randomUUID();
}

export type PadOpts = { events?: ScoreEvent[]; overs?: number; scorerDevice?: string | null; lateMembers?: { userId: string; name: string; number: number | null }[]; rules?: Rules };
/** The pad, with the server already holding `events` (as the page would hand them over). */
export function padElement(o: PadOpts = {}): ReactElement {
  const events = o.events ?? [];
  if (!server.logs.has(ctx.matchId)) srv(ctx.matchId).push(...events);
  return (
    <ScoringPad
      communityId={COMMUNITY} matchId={ctx.matchId} matchHref="/m" serverEvents={events}
      start={{ base: baseOf(o.overs ?? 6, o.rules ?? DEFAULT_RULES), toss: null, battingFirst: null }}
      lateMembers={o.lateMembers ?? []} scorerDevice={o.scorerDevice ?? null} scorerName="Tester"
    />
  );
}

/** What the pad made, with the random parts (ids, clock) taken out: type, order number, payload and reason. */
export function made(matchId: string, already: number) {
  return srv(matchId).slice(already).map((e) => {
    const { id: _id, at: _at, by: _by, ...rest } = e as ScoreEvent & { by?: string };
    void _id; void _at; void _by;
    return rest;
  });
}
