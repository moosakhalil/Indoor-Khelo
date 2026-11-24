// What a stored correction (an "edit" row of match_event) lets us show again: who, when, why, which ball, what changed, and the figures before and after.
import { describe, expect, it } from "vitest";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { correctionsOf, describeBall } from "@/lib/corrections";

const A = (i: number) => `a${i}`;
const B = (i: number) => `b${i}`;
const players: PlayerEntry[] = [
  ...[1, 2, 3].map((i) => ({ id: A(i), side: 1 as Side, name: `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
  ...[1, 2, 3].map((i) => ({ id: B(i), side: 2 as Side, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
];
const ball = (p: object): ScoreEventBody => ({ type: "ball", payload: p } as ScoreEventBody);
const bodies: ScoreEventBody[] = [
  { type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs: 1, playersPerSide: 3, rules: DEFAULT_RULES, players, toss: null, battingFirst: 1 } },
  { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ball({ runs: 4 }), ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 0 }),   // 7 runs
  { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } },
  ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 1 }), ball({ runs: 3 }),   // 8 runs, wins on the last ball
  { type: "finish", payload: {} },
];
const log = bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1, by: "Scorer", at: `2026-11-23T10:${String(i).padStart(2, "0")}:00.000Z` }) as ScoreEvent);
const edit = (n: number, target: string, patch: object, extra: Partial<ScoreEvent> = {}) =>
  ({ type: "edit", id: `ed${n}`, seq: log.length + n, payload: { target, patch }, reason: "Wrong key", by: "Ali Raza", at: "2026-11-24T08:30:00.000Z", ...extra }) as ScoreEvent;

describe("correctionsOf", () => {
  it("no corrections gives an empty list", () => {
    expect(correctionsOf(log)).toEqual([]);
  });

  it("reads who, when, why and which ball from the stored row", () => {
    const c = correctionsOf([...log, edit(1, "e3", { runs: 3 })])[0]!;
    expect(c.by).toBe("Ali Raza");
    expect(c.at).toBe("2026-11-24T08:30:00.000Z");
    expect(c.reason).toBe("Wrong key");
    expect(c.ballId).toBe("e3");
    expect(c.inningsLabel).toBe("Innings 1: Alpha");
    expect(c.ballText).toContain("Bravo1 to Alpha1");
  });

  it("says what the patch changed and how the totals, the result and the Player of the Match moved", () => {
    // the 4 in the first ball was really a 3: Alpha 7 -> 6
    const c = correctionsOf([...log, edit(1, "e3", { runs: 3 })])[0]!;
    expect(c.before).toBe("4 runs");
    expect(c.after).toBe("3 runs");
    expect(c.changes).toEqual([{ label: "Runs", from: "4", to: "3" }]);
    expect(c.scores).toEqual([{ label: "Alpha, innings 1", before: "7/0", after: "6/0" }]);
    expect(c.resultBefore).toContain("Bravo won");
    expect(c.resultAfter).toContain("Bravo won");
    expect("pomBefore" in c && "pomAfter" in c).toBe(true);   // shown only when they differ
  });

  it("a wicket added by a correction is described, and a reason that is empty becomes null", () => {
    const c = correctionsOf([...log, edit(1, "e8", { wicket: { type: "bowled" } }, { reason: "  " })])[0]!;
    expect(c.reason).toBeNull();
    expect(c.changes).toEqual([{ label: "Wicket", from: "no wicket", to: "wicket, bowled" }]);
    expect(c.after).toBe("dot ball, wicket, bowled");
  });

  it("a second correction of the same ball starts from the first one", () => {
    const list = correctionsOf([...log, edit(1, "e3", { runs: 3 }), edit(2, "e3", { runs: 2 }, { by: "Sam" })]);
    expect(list).toHaveLength(2);
    expect(list[1]!.changes).toEqual([{ label: "Runs", from: "3", to: "2" }]);
    expect(list[1]!.by).toBe("Sam");
  });

  it("describes a ball in plain words", () => {
    const m = buildState(log);
    if (!m.ok) throw new Error(m.error);
    expect(describeBall(m.state, { runs: 1, extra: "wide" })).toBe("wide and 1 run");
    expect(describeBall(m.state, { runs: 0 })).toBe("dot ball");
    expect(describeBall(m.state, { runs: 2, wicket: { type: "run_out", out: A(2), fielder: B(2) } })).toBe("2 runs, wicket, run out (fielder Bravo2, Alpha2 out)");
  });

  it("a correction row that points at nothing is skipped instead of breaking the page", () => {
    expect(correctionsOf([...log, edit(1, "nope", { runs: 1 })])).toEqual([]);
  });
});
