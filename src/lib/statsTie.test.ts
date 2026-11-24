import { describe, expect, it } from "vitest";
import { compareEconomy } from "@/lib/stats";

describe("economy tie-break in Player of the Match", () => {
  it("lower economy ranks first", () => {
    expect(compareEconomy(4, 6)).toBeLessThan(0);
    expect(compareEconomy(6, 4)).toBeGreaterThan(0);
  });
  it("two players who never bowled tie (Infinity) instead of producing NaN, so a shared award still has winners", () => {
    expect(compareEconomy(Infinity, Infinity)).toBe(0);
    expect(Number.isNaN(compareEconomy(Infinity, Infinity))).toBe(false);
  });
  it("someone who bowled beats someone who never bowled", () => {
    expect(compareEconomy(7, Infinity)).toBeLessThan(0);
    expect(compareEconomy(Infinity, 7)).toBeGreaterThan(0);
  });
});
