// Phase F2: the small view helpers behind the leaderboard, compare, insights and player analytics screens.
import { describe, expect, it } from "vitest";
import type { CompareRow, FormPoint } from "@/lib/analytics";
import { formSummary } from "@/lib/analytics";
import { STATS, buildBoard, careerOf } from "@/lib/career";
import {
  bestText, compareHref, compareScore, howOutRows, orderLabel, oversText, personLine, podiumOf, progressText, quickPicks, rangeLabel, rankCard, roleLabel, trendBadge,
} from "@/lib/ldView";

const stat = (k: string) => STATS.find((s) => s.key === k)!;
const empty = careerOf([]);
const withBat = (o: Partial<typeof empty.batting>) => ({ ...empty, batting: { ...empty.batting, ...o } });
const member = (userId: string, name: string, runs: number, matches = 3) => ({ userId, name, number: 1, career: { ...withBat({ runs, innings: 3, balls: 40 }), matches } });

describe("names and lines", () => {
  it("role labels and the number-and-role line", () => {
    expect(roleLabel("all_rounder")).toBe("All-rounder");
    expect(roleLabel(null)).toBeNull();
    expect(roleLabel("nonsense")).toBeNull();
    expect(personLine(7, "batter")).toBe("#7 · Batter");
    expect(personLine(null, "batter")).toBe("Batter");
    expect(personLine(9, null)).toBe("#9");
    expect(personLine(null, null)).toBe("");
  });
  it("order words, date ranges and overs", () => {
    expect(orderLabel(stat("runs"), false)).toBe("Highest first");
    expect(orderLabel(stat("runs"), true)).toBe("Lowest first");
    expect(orderLabel(stat("economy"), false)).toBe("Lowest first");
    expect(orderLabel(stat("economy"), true)).toBe("Highest first");
    expect(rangeLabel("2026-11-01", "2026-11-23")).toBe("1 Nov 2026 to 23 Nov 2026");
    expect(rangeLabel("2026-11-01", null)).toBe("From 1 Nov 2026");
    expect(rangeLabel(null, "2026-11-23")).toBe("Until 23 Nov 2026");
    expect(oversText(14)).toBe("2.2");
    expect(oversText(12)).toBe("2");
  });
});

describe("rank card", () => {
  const board = (flip = false) => buildBoard([member("a", "Ana", 50), member("b", "Bo", 50), member("c", "Cy", 10)], stat("runs"), flip);
  it("ranked and tied are said in words", () => {
    const rows = board();
    const c = rankCard(rows.find((r) => r.userId === "a"), 3, stat("runs"), "50", empty, true);
    expect(c).toMatchObject({ kind: "ranked", rankText: "1st", of: 3, tied: true, sentence: "You are 1st of 3 (tied)." });
    const d = rankCard(rows.find((r) => r.userId === "c"), 3, stat("runs"), "10", empty, true);
    expect(d).toMatchObject({ kind: "ranked", rankText: "3rd", tied: false, sentence: "You are 3rd of 3." });
  });
  it("not ranked explains the rule and your progress; with no data there is no card", () => {
    const rows = buildBoard([{ userId: "a", name: "Ana", number: 1, career: withBat({ innings: 2, balls: 14, runs: 20, average: 20 }) }], stat("bat_avg"));
    const c = rankCard(rows[0], 0, stat("bat_avg"), "–", withBat({ innings: 2, balls: 14 }), true);
    expect(c).toEqual({ kind: "unranked", reason: "Needs at least 3 innings and 20 balls faced.", progress: "You have 2 innings and 14 balls so far." });
    expect(rankCard(rows[0], 0, stat("bat_avg"), "–", empty, false)).toBeNull();
    expect(rankCard(undefined, 0, stat("runs"), "0", empty, true)).toBeNull();
  });
  it("progress text for bowling and matches", () => {
    expect(progressText(stat("economy"), { ...empty, bowling: { ...empty.bowling, balls: 8, bpo: 6 } })).toBe("You have bowled 1.2 overs so far.");
    expect(progressText(stat("win_pct"), { ...empty, matches: 1 })).toBe("You have played 1 match so far.");
    expect(progressText(stat("runs"), empty)).toBeNull();
  });
  it("podium: three at most, no zero-count places, nothing without data", () => {
    const rows = buildBoard([member("a", "Ana", 50), member("b", "Bo", 40), member("c", "Cy", 30), member("d", "Di", 20), member("e", "Ed", 0)], stat("runs"));
    expect(podiumOf(rows, stat("runs"), true).map((r) => r.userId)).toEqual(["a", "b", "c"]);
    expect(podiumOf(rows, stat("runs"), false)).toEqual([]);
    const zeros = buildBoard([member("a", "Ana", 0), member("b", "Bo", 0)], stat("runs"));
    expect(podiumOf(zeros, stat("runs"), true)).toEqual([]);
  });
});

describe("compare", () => {
  const row = (key: string, better: "a" | "b" | null): CompareRow => ({ key, label: key, group: "batting", a: 1, b: 2, fa: "1", fb: "2", better, lowSample: false });
  it("rows won and level rows", () => {
    expect(compareScore([row("x", "a"), row("y", "b"), row("z", "b"), row("w", null)])).toEqual({ a: 1, b: 2, level: 1, total: 4 });
  });
  it("the link keeps whichever sides are chosen", () => {
    expect(compareHref("c1", "u1", "u2")).toBe("/c/c1/compare?a=u1&b=u2");
    expect(compareHref("c1", null, "u2")).toBe("/c/c1/compare?b=u2");
    expect(compareHref("c1", null, null)).toBe("/c/c1/compare");
  });
  it("quick picks: top two scorers, you against the top scorer, never the same pair twice and never a player with no matches", () => {
    const members = [{ user_id: "me", name: "Ali Raza" }, { user_id: "h", name: "Hamza Khan" }, { user_id: "z", name: "Zain Malik" }, { user_id: "n", name: "No Matches" }];
    const careers = new Map([["me", { ...withBat({ runs: 100 }), matches: 3 }], ["h", { ...withBat({ runs: 300 }), matches: 3 }], ["z", { ...withBat({ runs: 200 }), matches: 3 }]]);
    const picks = quickPicks(members, careers, "me");
    expect(picks.map((p) => p.label)).toEqual(["Hamza v Zain", "You v Hamza", "Zain v Ali"]);
    expect(picks.every((p) => p.a !== "n" && p.b !== "n")).toBe(true);
    expect(quickPicks(members, new Map(), "me")).toEqual([]);
  });
});

describe("player analytics numbers in words", () => {
  const pts = (...v: number[]): FormPoint[] => v.map((value, i) => ({ matchId: `m${i}`, when: null, value, notOut: false, opponent: "X" }));
  it("trend badge: up, down, steady, and a needs-6 badge under six matches", () => {
    expect(trendBadge(formSummary(pts(10, 10, 10, 10, 30, 30, 30)), 7)).toEqual({ tone: "up", label: "Improving" });
    expect(trendBadge(formSummary(pts(30, 30, 30, 30, 3, 3, 3)), 7)).toEqual({ tone: "down", label: "Down lately" });
    expect(trendBadge(formSummary(pts(20, 20, 20, 20, 20, 20)), 6)).toEqual({ tone: "steady", label: "Steady" });
    expect(trendBadge(formSummary(pts(5, 6, 7)), 3)).toEqual({ tone: "need", label: "Needs 6 matches" });
  });
  it("best innings keeps its star when it was not out", () => {
    const p = pts(5, 61, 20);
    p[1]!.notOut = true;
    expect(bestText(p, "runs")).toBe("61*");
    expect(bestText(p, "wickets")).toBe("61");
    expect(bestText([], "runs")).toBeNull();
  });
  it("how out lists every way out, zeros included, with bar lengths", () => {
    const rows = howOutRows({ not_out: 3, caught: 5, bowled: 2 });
    expect(rows.map((r) => r.key)).toEqual(["not_out", "bowled", "caught", "lbw", "stumped", "hit_wicket", "run_out", "retired_out"]);
    expect(rows.find((r) => r.key === "caught")).toMatchObject({ count: 5, pct: 100 });
    expect(rows.find((r) => r.key === "lbw")).toMatchObject({ count: 0, pct: 0 });
  });
});
