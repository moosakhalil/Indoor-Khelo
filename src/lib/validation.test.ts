import { describe, expect, it } from "vitest";
import {
  COMMUNITY_MEMBER_CAP,
  generateInviteCode,
  initials,
  normalizeInviteCode,
  ordinal,
  parsePlayerNumber,
  safeNextPath,
  validateCommunityInput,
  validatePersonName,
} from "./validation";

describe("player number (1 to 99)", () => {
  it("accepts 1 and 99 and everything between", () => {
    expect(parsePlayerNumber(1)).toEqual({ ok: true, value: 1 });
    expect(parsePlayerNumber("99")).toEqual({ ok: true, value: 99 });
    expect(parsePlayerNumber(" 7 ")).toEqual({ ok: true, value: 7 });
  });
  it("rejects 0, 100, negatives, decimals, text and empty", () => {
    for (const bad of [0, 100, -3, 7.5, "abc", "", null, undefined, "1e1x", NaN]) {
      expect(parsePlayerNumber(bad as never).ok).toBe(false);
    }
  });
  it("a community holds at most 99 members", () => {
    expect(COMMUNITY_MEMBER_CAP).toBe(99);
  });
});

describe("community input", () => {
  it("accepts a valid community and trims spaces", () => {
    const r = validateCommunityInput({ name: "  Alpha   Indoor Club ", description: "Fun", location: "Lahore", approvalRequired: "on" });
    expect(r).toEqual({ ok: true, value: { name: "Alpha Indoor Club", description: "Fun", location: "Lahore", approvalRequired: true } });
  });
  it("needs a name of at least 2 letters", () => {
    const r = validateCommunityInput({ name: "A" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeTruthy();
  });
  it("limits name, description and location length", () => {
    const r = validateCommunityInput({ name: "x".repeat(61), description: "y".repeat(301), location: "z".repeat(81) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["description", "location", "name"]);
  });
  it("approval is off unless switched on", () => {
    const r = validateCommunityInput({ name: "Alpha", approvalRequired: undefined });
    expect(r.ok && r.value.approvalRequired).toBe(false);
  });
});

describe("person name", () => {
  it("needs 1 to 60 characters", () => {
    expect(validatePersonName("").ok).toBe(false);
    expect(validatePersonName("   ").ok).toBe(false);
    expect(validatePersonName("Ali Raza")).toEqual({ ok: true, value: "Ali Raza" });
    expect(validatePersonName("a".repeat(61)).ok).toBe(false);
  });
});

describe("invite codes", () => {
  it("normalises codes and links", () => {
    expect(normalizeInviteCode("KH-7Q4M")).toBe("KH-7Q4M");
    expect(normalizeInviteCode("kh7q4m")).toBe("KH-7Q4M");
    expect(normalizeInviteCode(" kh-7q4m ")).toBe("KH-7Q4M");
    expect(normalizeInviteCode("https://khelo.app/join/KH-7Q4M")).toBe("KH-7Q4M");
    expect(normalizeInviteCode("http://localhost:3000/join/kh-7q4m?x=1")).toBe("KH-7Q4M");
  });
  it("rejects nonsense", () => {
    for (const bad of ["", "7Q4M", "XX-7Q4M", "KH-", "KH-12", "hello world", null, 5]) {
      expect(normalizeInviteCode(bad as never)).toBeNull();
    }
  });
  it("generates codes that normalise to themselves and avoid look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateInviteCode();
      expect(normalizeInviteCode(c)).toBe(c);
      expect(c).not.toMatch(/[01OI]/);
    }
  });
});

describe("safe redirect path", () => {
  it("allows same-site paths only", () => {
    expect(safeNextPath("/c/123")).toBe("/c/123");
    expect(safeNextPath("//evil.com")).toBe("/home");
    expect(safeNextPath("https://evil.com")).toBe("/home");
    expect(safeNextPath("/a\\b")).toBe("/home");
    expect(safeNextPath(undefined)).toBe("/home");
  });
});

describe("small helpers", () => {
  it("initials", () => {
    expect(initials("Ali Raza")).toBe("AR");
    expect(initials("  noor  ")).toBe("N");
    expect(initials("")).toBe("?");
  });
  it("ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"]);
  });
});
