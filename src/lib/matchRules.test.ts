import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES, bowlerLimitWarning, checkWhen, formatWhen, parsePattern, toLocalInput, validateGuestName, validateMatchDetails, validateRules,
  validateSides, validateToss, zonedToUtc,
} from "./matchRules";

const NOW = new Date("2026-11-23T10:00:00Z");

describe("bowler over pattern", () => {
  it("reads 2-1-1 however it is typed", () => {
    for (const t of ["2-1-1", "2 1 1", "2,1,1", "2/1/1", " 2 - 1 - 1 "]) expect(parsePattern(t)).toEqual({ ok: true, pattern: [2, 1, 1] });
  });
  it("refuses empty, a single number, zero, decimals, letters and too many bowlers", () => {
    for (const t of ["", "2", "0-1", "2-1.5-1", "a-b", "1-1-1-1-1-1-1-1-1-1-1-1", "2-0-1", "-"]) expect(parsePattern(t).ok).toBe(false);
  });
  it("warns, never blocks, when the pattern does not add up to the match overs", () => {
    expect(bowlerLimitWarning({ mode: "pattern", pattern: [2, 1, 1] }, 4)).toBeNull();
    expect(bowlerLimitWarning({ mode: "pattern", pattern: [2, 1, 1] }, 5)).toMatch(/adds up to 4 overs/);
    expect(bowlerLimitWarning({ mode: "max", overs: 2 }, 4)).toBeNull();
    expect(bowlerLimitWarning({ mode: "none" }, 4)).toBeNull();
  });
});

describe("match rules", () => {
  it("starts from the traditional defaults", () => {
    const r = validateRules({}, 6, 6);
    expect(r.ok && r.value).toEqual(DEFAULT_RULES);
    expect(DEFAULT_RULES).toMatchObject({ ballsPerOver: 6, wideRuns: 1, noBallRuns: 1, freeHit: true, lastBatterAlone: true, sameBowlerTwoInARow: false, superOver: "ask" });
  });
  it("a ticked form reads missing checkboxes as switched off", () => {
    const r = validateRules({ rulesForm: "1", freeHit: "on", dismissals: ["bowled", "caught"] }, 6, 6);
    expect(r.ok && r.value).toMatchObject({ freeHit: true, lastBatterAlone: false, overthrows: false, dismissals: ["bowled", "caught"] });
  });
  it("accepts a maximum per bowler or a 2-1-1 pattern", () => {
    expect(validateRules({ limitMode: "max", limitMax: "2" }, 4, 6)).toMatchObject({ ok: true, value: { bowlerLimit: { mode: "max", overs: 2 } } });
    expect(validateRules({ limitMode: "pattern", limitPattern: "2-1-1" }, 4, 6)).toMatchObject({ ok: true, value: { bowlerLimit: { mode: "pattern", pattern: [2, 1, 1] } }, warning: null });
    expect(validateRules({ limitMode: "pattern", limitPattern: "2-1-1" }, 5, 6)).toMatchObject({ ok: true, warning: expect.stringMatching(/adds up to 4/) });
  });
  it("refuses limits that could never finish an innings or do not fit the match", () => {
    expect(validateRules({ limitMode: "max", limitMax: "" }, 4, 6).ok).toBe(false);
    expect(validateRules({ limitMode: "max", limitMax: "0" }, 4, 6).ok).toBe(false);
    expect(validateRules({ limitMode: "max", limitMax: "5" }, 4, 6).ok).toBe(false);       // more than the match overs
    expect(validateRules({ limitMode: "max", limitMax: "1" }, 10, 6).ok).toBe(false);      // 6 players x 1 over < 10
    expect(validateRules({ limitMode: "pattern", limitPattern: "2-1-1-1-1-1-1" }, 8, 6).ok).toBe(false);   // 7 bowlers, 6 players
    expect(validateRules({ limitMode: "pattern", limitPattern: "9-1" }, 4, 6).ok).toBe(false);   // 9 > 4 overs
    expect(validateRules({ limitMode: "pattern", limitPattern: "" }, 4, 6).ok).toBe(false);
    expect(validateRules({ limitMode: "sometimes" }, 4, 6).ok).toBe(false);
  });
  it("checks every number and list", () => {
    expect(validateRules({ ballsPerOver: "0" }, 4, 6).ok).toBe(false);
    expect(validateRules({ ballsPerOver: "13" }, 4, 6).ok).toBe(false);
    expect(validateRules({ ballsPerOver: "five" }, 4, 6).ok).toBe(false);
    expect(validateRules({ wideRuns: "6" }, 4, 6).ok).toBe(false);
    expect(validateRules({ noBallRuns: "-1" }, 4, 6).ok).toBe(false);
    expect(validateRules({ innings: "3" }, 4, 6).ok).toBe(false);
    expect(validateRules({ superOver: "maybe" }, 4, 6).ok).toBe(false);
    expect(validateRules({ rulesForm: "1", dismissals: [] }, 4, 6).ok).toBe(false);          // at least one way out
    expect(validateRules({ dismissals: ["bowled", "hacked"] }, 4, 6).ok).toBe(false);
    expect(validateRules({ ballsPerOver: "8", wideRuns: "2", noBallRuns: "0", innings: "1", superOver: "always" }, 4, 6)).toMatchObject({ ok: true, value: { ballsPerOver: 8, wideRuns: 2, noBallRuns: 0, innings: 1, superOver: "always" } });
  });
});

describe("date and time", () => {
  it("turns a typed local time into the exact moment", () => {
    expect(zonedToUtc("2026-11-28T19:30", "Asia/Karachi")?.toISOString()).toBe("2026-11-28T14:30:00.000Z");
    expect(zonedToUtc("2026-07-01T12:00", "America/New_York")?.toISOString()).toBe("2026-07-01T16:00:00.000Z");   // summer time
    expect(zonedToUtc("2026-12-01T12:00", "America/New_York")?.toISOString()).toBe("2026-12-01T17:00:00.000Z");   // winter time
    expect(zonedToUtc("2026-11-28T19:30", "UTC")?.toISOString()).toBe("2026-11-28T19:30:00.000Z");
  });
  it("refuses text that is not a real date and time", () => {
    for (const t of ["", "tomorrow", "2026-02-30T10:00", "2026-13-01T10:00", "2026-11-28T25:00", "2026-11-28 19:30", "2026-11-28"]) expect(zonedToUtc(t, "UTC")).toBeNull();
  });
  it("shows the same moment back in the viewer's zone", () => {
    const d = new Date("2026-11-28T14:30:00Z");
    expect(toLocalInput(d, "Asia/Karachi")).toBe("2026-11-28T19:30");
    expect(formatWhen(d, "Asia/Karachi")).toMatch(/7:30/);
    expect(formatWhen(null, "UTC")).toBe("No date yet");
  });
  it("blocks dates far in the past or more than a year ahead, allows now and soon", () => {
    expect(checkWhen(new Date("2026-11-23T09:00:00Z"), NOW)).toBeNull();
    expect(checkWhen(new Date("2026-11-23T00:00:00Z"), NOW)).toBeNull();   // earlier today (10 hours ago)
    expect(checkWhen(new Date("2026-11-20T10:00:00Z"), NOW)).toMatch(/past/);
    expect(checkWhen(new Date("2027-12-30T10:00:00Z"), NOW)).toMatch(/year/);
    expect(checkWhen(new Date("2027-06-01T10:00:00Z"), NOW)).toBeNull();
  });
});

describe("the two sides", () => {
  const names = new Map([["11111111-1111-4111-8111-111111111111", "Alpha"], ["22222222-2222-4222-8222-222222222222", "Bravo"]]);
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  it("takes permanent teams or match-only names", () => {
    expect(validateSides({ teamId: A }, { teamId: B }, names)).toMatchObject({ ok: true, value: [{ teamId: A, name: "Alpha" }, { teamId: B, name: "Bravo" }] });
    expect(validateSides({ teamId: A }, { teamId: "", name: "  Walk-ins  " }, names)).toMatchObject({ ok: true, value: [{ name: "Alpha" }, { teamId: null, name: "Walk-ins" }] });
  });
  it("refuses a missing side, a stranger's team, the same team twice, equal names, and names that are too short or long", () => {
    expect(validateSides({}, { teamId: B }, names)).toMatchObject({ ok: false, errors: { sideA: expect.any(String) } });
    expect(validateSides({ teamId: "33333333-3333-4333-8333-333333333333" }, { teamId: B }, names).ok).toBe(false);
    expect(validateSides({ teamId: A }, { teamId: A }, names)).toMatchObject({ ok: false, errors: { sideB: expect.stringMatching(/different/) } });
    expect(validateSides({ teamId: A }, { name: " alpha " }, names).ok).toBe(false);
    expect(validateSides({ name: "X" }, { teamId: B }, names).ok).toBe(false);
    expect(validateSides({ name: "x".repeat(41) }, { teamId: B }, names).ok).toBe(false);
  });
});

describe("match details", () => {
  const ok = (raw: Record<string, unknown>) => validateMatchDetails({ oversPreset: "6", ...raw }, "UTC", NOW);
  it("a match can be a draft with no date", () => {
    expect(ok({})).toMatchObject({ ok: true, value: { scheduledAt: null, overs: 6, playersPerSide: 6, venue: "" } });
  });
  it("reads a date, venue, preset overs, custom overs and players per side", () => {
    expect(ok({ when: "2026-11-28T19:30", venue: "  Hall 2 ", playersPerSide: "7" })).toMatchObject({ ok: true, value: { scheduledAt: new Date("2026-11-28T19:30:00Z"), venue: "Hall 2", playersPerSide: 7 } });
    expect(ok({ oversPreset: "custom", oversCustom: "7" })).toMatchObject({ ok: true, value: { overs: 7 } });
    expect(ok({ oversPreset: "20" })).toMatchObject({ ok: true, value: { overs: 20 } });
  });
  it("refuses bad dates, overs, players and over-long text, with a message per field", () => {
    expect(ok({ when: "nonsense" })).toMatchObject({ ok: false, errors: { when: expect.any(String) } });
    expect(ok({ when: "2020-01-01T10:00" })).toMatchObject({ ok: false, errors: { when: expect.stringMatching(/past/) } });
    expect(ok({ oversPreset: "custom", oversCustom: "" })).toMatchObject({ ok: false, errors: { overs: expect.any(String) } });
    expect(ok({ oversPreset: "custom", oversCustom: "0" }).ok).toBe(false);
    expect(ok({ oversPreset: "custom", oversCustom: "51" }).ok).toBe(false);
    expect(ok({ oversPreset: "custom", oversCustom: "2.5" }).ok).toBe(false);
    expect(ok({ playersPerSide: "1" }).ok).toBe(false);
    expect(ok({ playersPerSide: "12" }).ok).toBe(false);
    expect(ok({ playersPerSide: "six" }).ok).toBe(false);
    expect(ok({ venue: "v".repeat(81) })).toMatchObject({ ok: false, errors: { venue: expect.any(String) } });
    expect(ok({ umpire: "u".repeat(41) })).toMatchObject({ ok: false, errors: { umpire: expect.any(String) } });
    expect(ok({ notes: "n".repeat(301) })).toMatchObject({ ok: false, errors: { notes: expect.any(String) } });
  });
  it("checks the bowler limit against this match's overs and players", () => {
    expect(ok({ oversPreset: "4", limitMode: "pattern", limitPattern: "2-1-1" })).toMatchObject({ ok: true, value: { rules: { bowlerLimit: { mode: "pattern", pattern: [2, 1, 1] } }, warning: null } });
    expect(ok({ oversPreset: "5", limitMode: "pattern", limitPattern: "2-1-1" })).toMatchObject({ ok: true, value: { warning: expect.stringMatching(/adds up to 4/) } });
    expect(ok({ oversPreset: "4", playersPerSide: "2", limitMode: "pattern", limitPattern: "2-1-1" }).ok).toBe(false);   // 3 bowlers, 2 players
  });
});

describe("toss and guests", () => {
  it("a toss needs both winner and decision, and says who bats first", () => {
    expect(validateToss("1", "bat")).toMatchObject({ ok: true, value: { battingFirst: 1 } });
    expect(validateToss("1", "bowl")).toMatchObject({ ok: true, value: { battingFirst: 2 } });
    expect(validateToss("2", "bat")).toMatchObject({ ok: true, value: { battingFirst: 2 } });
    expect(validateToss("2", "bowl")).toMatchObject({ ok: true, value: { battingFirst: 1 } });
    expect(validateToss("", "")).toMatchObject({ ok: true, value: { winnerSide: null, decision: null, battingFirst: null } });
    expect(validateToss("1", "").ok).toBe(false);
    expect(validateToss("", "bat").ok).toBe(false);
    expect(validateToss("3", "bat").ok).toBe(false);
    expect(validateToss("1", "dance").ok).toBe(false);
  });
  it("a guest needs a name of up to 60 characters", () => {
    expect(validateGuestName("  Sami ")).toEqual({ ok: true, value: "Sami" });
    expect(validateGuestName("   ").ok).toBe(false);
    expect(validateGuestName("g".repeat(61)).ok).toBe(false);
  });
});
