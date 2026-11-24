// Phase C (UI redesign), Builder C2: the pure rules of Plan several matches and Rematch.
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import {
  LINEUP_EMPTY_HINT, LINEUP_HINT, NO_ZONE, addDaysLocal, attentionCount, attentionText, clampPlayers, createLabel, duplicateAt, fmtInstant, fmtLocal, isTraditional,
  limitText, lineupTitle, matchesWord, newRow, parseLocal, playersError, quickDates, removeAt, rematchBanner, rematchButton, repeatLast, rowErrors, rulesHint, severalBanner,
  stepPlayers, teamsHint, toLocalString,
} from "@/lib/c2";

const rows = (n: number) => Array.from({ length: n }, (_, i) => newRow(`r${i}`, { venue: `V${i}` }));

describe("local date text", () => {
  it("reads and writes a datetime-local value", () => {
    expect(parseLocal("2026-11-28T20:00")).toEqual({ y: 2026, mo: 11, d: 28, h: 20, mi: 0 });
    expect(parseLocal("2026-02-30T20:00")).toBeNull();
    expect(parseLocal("")).toBeNull();
    expect(fmtLocal("2026-11-28T20:00")).toBe("Sat 28 Nov, 8:00 pm");
    expect(fmtLocal("2026-11-29T00:05")).toBe("Sun 29 Nov, 12:05 am");
    expect(fmtLocal("2026-11-29T12:30")).toBe("Sun 29 Nov, 12:30 pm");
    expect(fmtLocal("nonsense")).toBe("");
  });
  it("adds days on the wall clock, across a month and a year", () => {
    expect(addDaysLocal("2026-11-28T20:00", 7)).toBe("2026-12-05T20:00");
    expect(addDaysLocal("2026-12-29T09:15", 7)).toBe("2027-01-05T09:15");
    expect(addDaysLocal("", 7)).toBe("");
  });
  it("formats an instant in a named time zone", () => {
    const d = new Date("2026-11-22T15:00:00Z");
    expect(fmtInstant(d, "Asia/Karachi")).toBe("Sun 22 Nov, 8:00 pm");
    expect(fmtInstant(d, "Asia/Karachi", true)).toBe("Sun 22 Nov");
    expect(fmtInstant(d, "UTC")).toBe("Sun 22 Nov, 3:00 pm");
  });
});

describe("quick dates for a rematch", () => {
  it("next week is the same time seven days after the first match", () => {
    const src = new Date(2026, 10, 22, 20, 0);          // 22 Nov 2026, 8 pm on the viewer's own clock
    const now = new Date(2026, 10, 23, 9, 0);
    const q = quickDates(src.toISOString(), now);
    expect(q.nextWeek!.value).toBe("2026-11-29T20:00");
    expect(q.nextWeek!.label).toBe("Next week, same time: Sun 29 Nov, 8:00 pm");
    expect(q.tomorrow.value).toBe("2026-11-24T20:00");
    expect(q.tomorrow.label).toBe("Tomorrow, 8:00 pm");
  });
  it("keeps adding weeks when the first match was long ago, so the chip is never in the past", () => {
    const src = new Date(2026, 9, 1, 18, 30);
    const now = new Date(2026, 10, 23, 9, 0);
    const q = quickDates(src.toISOString(), now);
    expect(q.nextWeek!.value >= toLocalString(now)).toBe(true);
    expect(q.nextWeek!.value.endsWith("T18:30")).toBe(true);
  });
  it("without a first date there is no next-week chip and tomorrow is 6:00 pm", () => {
    const q = quickDates(null, new Date(2026, 10, 23, 9, 0));
    expect(q.nextWeek).toBeNull();
    expect(q.tomorrow).toEqual({ value: "2026-11-24T18:00", label: "Tomorrow, 6:00 pm" });
  });
});

describe("plan several: the rows", () => {
  it("duplicates any row (the copy sits right after it) and stops at the limit", () => {
    const r = rows(3);
    const d = duplicateAt(r, 1, "x");
    expect(d.map((x) => x.id)).toEqual(["r0", "r1", "x", "r2"]);
    expect(d[2]!.venue).toBe("V1");
    expect(duplicateAt(rows(10), 0, "x")).toHaveLength(10);
  });
  it("repeat last adds the next weekly fixture with the same venue and overs", () => {
    const r = rows(2);
    r[1] = { ...r[1]!, when: "2026-11-28T20:00", preset: "custom", custom: "7" };
    const out = repeatLast(r, "n");
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ id: "n", venue: "V1", preset: "custom", custom: "7", when: "2026-12-05T20:00" });
    expect(repeatLast([newRow("a")], "b")[1]!.when).toBe("");
    expect(repeatLast(rows(10), "n")).toHaveLength(10);
  });
  it("removes any row, never the last one left", () => {
    expect(removeAt(rows(3), 1).map((x) => x.id)).toEqual(["r0", "r2"]);
    expect(removeAt(rows(1), 0)).toHaveLength(1);
  });
  it("the stepper stays between 2 and 11 and recovers from a bad typed value", () => {
    expect(stepPlayers("6", 1)).toBe("7");
    expect(stepPlayers("11", 1)).toBe("11");
    expect(stepPlayers("2", -1)).toBe("2");
    expect(stepPlayers("14", -1)).toBe("11");
    expect(stepPlayers("", 1)).toBe("6");
    expect(clampPlayers(0)).toBe(2);
  });
  it("words: singular and plural", () => {
    expect(matchesWord(1)).toBe("1 match");
    expect(createLabel(1)).toBe("Create 1 match");
    expect(createLabel(3)).toBe("Create 3 matches");
    expect(attentionText(1)).toBe("1 thing needs attention.");
    expect(attentionText(7)).toBe("7 things need attention.");
  });
  it("row errors carry the row number; players per side is shown once", () => {
    const fe = { when_0: "Choose a date and time for match 1.", overs_2: "Overs must be a whole number from 1 to 50.", venue_2: "The venue can be at most 80 characters.", playersPerSide_1: "Players per side must be a whole number from 2 to 11.", playersPerSide_2: "Players per side must be a whole number from 2 to 11.", sideB: "x" };
    expect(rowErrors(fe, 0)).toEqual({ when: fe.when_0, venue: undefined, overs: undefined });
    expect(rowErrors(fe, 2).overs).toBe(fe.overs_2);
    expect(playersError(fe)).toBe(fe.playersPerSide_1);
    expect(playersError({ playersPerSide: "p" })).toBe("p");
    expect(playersError({})).toBeUndefined();
    expect(attentionCount(fe)).toBe(5);
  });
});

describe("failure banners keep the server's words", () => {
  it("several", () => {
    expect(severalBanner(undefined)).toBeNull();
    expect(severalBanner("Please fix the highlighted fields.")).toBeNull();
    expect(severalBanner("Plan between 1 and 10 matches at a time.")).toEqual({ icon: "warn", headline: "Plan between 1 and 10 matches at a time." });
    expect(severalBanner("Only members of this community can create matches.")!.icon).toBe("lock");
    expect(severalBanner(NO_ZONE)).toEqual({ icon: "warn", headline: "We could not read your phone's time zone.", detail: "Please reload the page and try again." });
  });
  it("rematch: each failure has its own next step", () => {
    expect(rematchBanner("Please fix the highlighted fields.", true)).toBeNull();
    expect(rematchBanner("Only members of this community can create matches.", false)).toEqual({ icon: "lock", headline: "Only members of this community can create matches." });
    expect(rematchBanner("The original match no longer exists.", false)!.next).toBe("plan");
    expect(rematchBanner("The rematch could not be created.", false)).toMatchObject({ next: "retry", detail: "Try again in a moment." });
    expect(rematchBanner(NO_ZONE, false)!.detail).toBe("Please reload the page and try again.");
    expect(rematchBanner(undefined, false)).toBeNull();
  });
});

describe("rematch: what is copied", () => {
  it("lineup wording, singular and plural, and the empty case", () => {
    expect(lineupTitle(12)).toBe("12 players copied into the lineups");
    expect(lineupTitle(1)).toBe("1 player copied into the lineups");
    expect(lineupTitle(0)).toBe("0 players copied into the lineups");
    expect(LINEUP_HINT).toContain("add a guest");
    expect(LINEUP_EMPTY_HINT).toContain("Pick them later, even on match day.");
  });
  it("rules hint: traditional, custom and the bowler limit", () => {
    expect(isTraditional(DEFAULT_RULES)).toBe(true);
    expect(rulesHint(DEFAULT_RULES, 6)).toBe("Traditional rules, no bowler limit, 6 players a side.");
    const custom: Rules = { ...DEFAULT_RULES, freeHit: false, bowlerLimit: { mode: "max", overs: 2 } };
    expect(rulesHint(custom, 8)).toBe("Custom rules, at most 2 overs per bowler, 8 players a side.");
    expect(limitText({ ...DEFAULT_RULES, bowlerLimit: { mode: "pattern", pattern: [2, 1, 1] } })).toBe("over pattern 2-1-1");
    expect(limitText({ ...DEFAULT_RULES, bowlerLimit: { mode: "max", overs: 1 } })).toBe("at most 1 over per bowler");
    // the database may give the dismissals in another order: still traditional
    expect(isTraditional({ ...DEFAULT_RULES, dismissals: [...DEFAULT_RULES.dismissals].reverse() })).toBe(true);
  });
  it("teams hint", () => {
    expect(teamsHint(true, true)).toBe("The permanent squads stay exactly as they are.");
    expect(teamsHint(false, false)).toContain("copied by name");
    expect(teamsHint(true, false)).toContain("match-only team");
  });
  it("button text follows the series choice", () => {
    expect(rematchButton(false, false, false)).toBe("Create rematch");
    expect(rematchButton(false, true, false)).toBe("Create rematch and series");
    expect(rematchButton(true, false, false)).toBe("Play another match in this series");
    expect(rematchButton(true, false, true)).toBe("Creating…");
  });
});
