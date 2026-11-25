// The optional "how do you play" step after the first number (src/lib/profileSetup.ts).
import { describe, expect, it } from "vitest";
import { afterNumberHref, profileIsEmpty, profileSetupHref, shouldAskProfile } from "@/lib/profileSetup";

const empty = { playing_role: null, batting_hand: null, batting_position: null, bowling_style: null };

describe("profileIsEmpty", () => {
  it("is true when nothing is set, or there is no profile row", () => {
    expect(profileIsEmpty(empty)).toBe(true);
    expect(profileIsEmpty({})).toBe(true);
    expect(profileIsEmpty(null)).toBe(true);
    expect(profileIsEmpty(undefined)).toBe(true);
    expect(profileIsEmpty({ playing_role: "" })).toBe(true);
  });
  it("is false as soon as any one of the four is set", () => {
    expect(profileIsEmpty({ ...empty, playing_role: "batter" })).toBe(false);
    expect(profileIsEmpty({ ...empty, batting_hand: "right" })).toBe(false);
    expect(profileIsEmpty({ ...empty, batting_position: "opener" })).toBe(false);
    expect(profileIsEmpty({ ...empty, bowling_style: "fast" })).toBe(false);
  });
});

describe("shouldAskProfile", () => {
  it("asks at the first number with an empty profile", () => {
    expect(shouldAskProfile(false, empty)).toBe(true);
  });
  it("never asks when the person is only changing a number they already had", () => {
    expect(shouldAskProfile(true, empty)).toBe(false);
  });
  it("never asks someone who already filled in any choice (for example in another community)", () => {
    expect(shouldAskProfile(false, { ...empty, playing_role: "bowler" })).toBe(false);
  });
});

describe("where the player goes", () => {
  it("home for a member, the invite page for a community's creator", () => {
    expect(afterNumberHref("c1", false)).toBe("/c/c1");
    expect(afterNumberHref("c1", true)).toBe("/c/c1/invite?new=1");
  });
  it("the profile step keeps the creator flag so the creator still ends on the invite page", () => {
    expect(profileSetupHref("c1", false)).toBe("/c/c1/profile/setup");
    expect(profileSetupHref("c1", true)).toBe("/c/c1/profile/setup?new=1");
  });
});
