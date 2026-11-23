import { describe, expect, it } from "vitest";
import { labelOf, PLAYING_ROLES, validateProfileInput, validateTeamInput } from "./validation";

describe("player profile input", () => {
  const base = { name: "Ali Raza" };
  it("accepts a full profile including the playing role", () => {
    const r = validateProfileInput({ ...base, playingRole: "all_rounder", battingHand: "right", battingPosition: "opener", bowlingStyle: "right_medium" });
    expect(r).toEqual({ ok: true, value: { name: "Ali Raza", battingHand: "right", battingPosition: "opener", bowlingStyle: "right_medium", playingRole: "all_rounder" } });
  });
  it("an empty choice means not set", () => {
    const r = validateProfileInput({ ...base, playingRole: "", battingHand: "", battingPosition: "", bowlingStyle: "" });
    expect(r.ok && r.value).toMatchObject({ playingRole: null, battingHand: null, battingPosition: null, bowlingStyle: null });
  });
  it("accepts all four playing roles and the Doesn't bowl choice", () => {
    for (const role of ["batter", "bowler", "all_rounder", "wicket_keeper"]) expect(validateProfileInput({ ...base, playingRole: role }).ok).toBe(true);
    expect(validateProfileInput({ ...base, bowlingStyle: "none" }).ok).toBe(true);
  });
  it("refuses anything that is not on the list", () => {
    for (const bad of [{ playingRole: "captain" }, { battingHand: "both" }, { battingPosition: "tail" }, { bowlingStyle: "underarm" }]) {
      expect(validateProfileInput({ ...base, ...bad }).ok).toBe(false);
    }
  });
  it("needs a name", () => {
    expect(validateProfileInput({ name: "  " }).ok).toBe(false);
  });
  it("labels", () => {
    expect(labelOf(PLAYING_ROLES, "wicket_keeper")).toBe("Wicket-keeper");
    expect(labelOf(PLAYING_ROLES, null)).toBeNull();
  });
});

describe("team input", () => {
  it("accepts a normal team", () => {
    expect(validateTeamInput({ name: "  Alpha ", description: "Friday regulars", captainId: "a", viceCaptainId: "b" })).toEqual({
      ok: true,
      value: { name: "Alpha", description: "Friday regulars", captainId: "a", viceCaptainId: "b" },
    });
  });
  it("needs a name of 2 to 40 letters, and a short description", () => {
    expect(validateTeamInput({ name: "A" }).ok).toBe(false);
    expect(validateTeamInput({ name: "x".repeat(41) }).ok).toBe(false);
    expect(validateTeamInput({ name: "Alpha", description: "y".repeat(201) }).ok).toBe(false);
  });
  it("captain and vice-captain must be different people", () => {
    const r = validateTeamInput({ name: "Alpha", captainId: "a", viceCaptainId: "a" });
    expect(r.ok).toBe(false);
  });
  it("captain and vice-captain are optional", () => {
    const r = validateTeamInput({ name: "Alpha" });
    expect(r.ok && r.value).toMatchObject({ captainId: null, viceCaptainId: null });
  });
});
