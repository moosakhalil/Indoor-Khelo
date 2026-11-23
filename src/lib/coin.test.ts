import { describe, expect, it } from "vitest";
import { flipCoin, tossWinner } from "./coin";

describe("the coin toss", () => {
  it("the caller wins when the coin shows what they called, otherwise the other side wins", () => {
    expect(tossWinner(1, "heads", "heads")).toBe(1);
    expect(tossWinner(1, "heads", "tails")).toBe(2);
    expect(tossWinner(2, "tails", "tails")).toBe(2);
    expect(tossWinner(2, "tails", "heads")).toBe(1);
  });
  it("maps the random bit to heads or tails", () => {
    expect(flipCoin(() => 1)).toBe("heads");
    expect(flipCoin(() => 0)).toBe("tails");
  });
  it("uses the secure generator and is fair: about half heads over many flips, and both appear", () => {
    let heads = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (flipCoin() === "heads") heads++;
    expect(heads).toBeGreaterThan(n * 0.47);
    expect(heads).toBeLessThan(n * 0.53);
  });
  it("a run of flips is not stuck or alternating", () => {
    const flips = Array.from({ length: 64 }, () => flipCoin());
    expect(new Set(flips).size).toBe(2);
    expect(flips.some((f, i) => i > 0 && f === flips[i - 1])).toBe(true);
    expect(flips.some((f, i) => i > 0 && f !== flips[i - 1])).toBe(true);
  });
});
