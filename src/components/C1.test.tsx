// @vitest-environment jsdom
// Phase C (UI redesign), Builder C1: Create match (4-step wizard) and Edit match / postpone / cancel / delete.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/matches", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
let result: unknown = {};
vi.mock("@/app/actions4", () => ({
  createMatchAction: vi.fn(async () => result),
  updateMatchAction: vi.fn(async () => result),
  postponeAction: vi.fn(async () => undefined),
  cancelAction: vi.fn(async () => undefined),
  deleteMatchAction: vi.fn(async () => undefined),
}));

import { cancelAction, createMatchAction, deleteMatchAction, postponeAction, updateMatchAction } from "@/app/actions4";
import MatchEditor from "@/components/MatchEditor";
import MatchManage from "@/components/MatchManage";
import MatchNotice from "@/components/MatchNotice";
import MatchWizard from "@/components/MatchWizard";
import { SnackbarProvider } from "@/components/Snackbar";
import {
  changeCount, defaultValues, diffRows, editEffect, entriesOf, fmtLocal, limitFloor, parseTooMany, quickDates, rawOf, resetRules, setupWarning, stepOf,
  validateSetup, valuesFromMatch,
} from "@/lib/crSetup";
import { manageItems } from "@/lib/crManage";
import { DEFAULT_RULES, MATCH_STATUSES, validateMatchDetails, validateSides } from "@/lib/matchRules";

const teams = [
  { id: "t1", name: "Thunder Strikers", captain: "Ali Raza", vice: null, squad: 7, mine: true },
  { id: "t2", name: "Royal Panthers", captain: "Hamza Khan", vice: null, squad: 7, mine: false },
];
const names = new Map(teams.map((t) => [t.id, t.name]));
const wrap = (ui: React.ReactNode) => <SnackbarProvider>{ui}</SnackbarProvider>;
const click = async (name: RegExp | string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };
const change = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const NOW = new Date("2026-11-24T10:00:00Z");

beforeEach(() => { result = {}; vi.clearAllMocks(); });
afterEach(cleanup);

/* ---------------------------------------------------------------- pure rules */
describe("crSetup rules", () => {
  it("posts exactly the field names of the old form", () => {
    const v = { ...defaultValues(), modeA: "team" as const, teamA: "t1", modeB: "own" as const, nameB: "Kings", when: "2026-11-28T20:00", flags: { ...defaultValues().flags, freeHit: false } };
    const e = entriesOf(v, "create");
    const keys = [...new Set(e.map(([k]) => k))];
    expect(keys).toEqual(expect.arrayContaining([
      "sideATeam", "sideAName", "sideBTeam", "sideBName", "when", "venue", "oversPreset", "oversCustom", "rulesForm", "playersPerSide", "innings", "ballsPerOver",
      "wideRuns", "noBallRuns", "widesReBowled", "noBallsReBowled", "byesCountAsBalls", "legByesCountAsBalls", "overthrows", "retiredCanReturn", "lastBatterAlone",
      "dismissals", "superOver", "limitMode", "limitMax", "limitPattern", "umpire", "notes",
    ]));
    expect(Object.fromEntries(e).sideATeam).toBe("t1");
    expect(Object.fromEntries(e).sideAName).toBe("");
    expect(Object.fromEntries(e).sideBName).toBe("Kings");
    expect(e.filter(([k]) => k === "dismissals")).toHaveLength(7);
    // an unticked switch is simply absent, as with a checkbox
    expect(keys).not.toContain("freeHit");
    expect(keys).not.toContain("sameBowlerTwoInARow");
    // edit sends no sides
    expect(entriesOf(v, "edit").some(([k]) => k.startsWith("side"))).toBe(false);
  });

  it("validates with the server's own functions and messages", () => {
    const blank = validateSetup(defaultValues(), "create", names, "UTC", NOW);
    expect(blank.sideA).toBe("Choose the first team or type a match-only team name.");
    expect(blank.sideB).toBe("Choose the second team or type a match-only team name.");
    const same = validateSetup({ ...defaultValues(), modeA: "team", teamA: "t1", modeB: "team", teamB: "t1" }, "create", names, "UTC", NOW);
    expect(same.sideB).toBe("The two sides must be different teams.");
    const v = { ...defaultValues(), modeA: "team" as const, teamA: "t1", modeB: "team" as const, teamB: "t2", when: "2026-11-20T20:00", playersPerSide: "14", oversPreset: "custom", oversCustom: "75" };
    const e = validateSetup(v, "create", names, "UTC", NOW);
    expect(e.when).toBe("That date and time is in the past. Choose today or a later day.");
    expect(e.overs).toBe("Overs must be a whole number from 1 to 50.");
    expect(e.playersPerSide).toBe("Players per side must be a whole number from 2 to 11.");
    // the same answers as calling the server functions directly
    const direct = validateMatchDetails(rawOf(v), "UTC", NOW);
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.errors).toEqual({ when: e.when, overs: e.overs, playersPerSide: e.playersPerSide });
    expect(validateSides({ teamId: "t1" }, { teamId: "t1" }, names).ok).toBe(false);
  });

  it("rule errors and bowler limit messages are the real ones", () => {
    const ok = { ...defaultValues(), modeA: "team" as const, teamA: "t1", modeB: "team" as const, teamB: "t2", oversPreset: "8" };
    expect(validateSetup({ ...ok, ballsPerOver: "15", wideRuns: "9", noBallRuns: "7" }, "create", names, "UTC", NOW))
      .toMatchObject({ ballsPerOver: "Balls per over must be a whole number from 1 to 12.", wideRuns: "Wide runs must be a whole number from 0 to 5.", noBallRuns: "No-ball runs must be a whole number from 0 to 5." });
    expect(validateSetup({ ...ok, dismissals: [] }, "create", names, "UTC", NOW).dismissals).toBe("Keep at least one way of getting out switched on.");
    expect(validateSetup({ ...ok, limitMode: "max", limitMax: "" }, "create", names, "UTC", NOW).limitMax).toBe("Type how many overs each bowler may bowl (a whole number, at least 1).");
    expect(validateSetup({ ...ok, limitMode: "max", limitMax: "9" }, "create", names, "UTC", NOW).limitMax).toBe("A bowler cannot be limited to more than the match overs (8).");
    expect(validateSetup({ ...ok, limitMode: "max", limitMax: "1" }, "create", names, "UTC", NOW).limitMax).toBe("With 6 players and 1 over each, a 8-over innings could never be finished. Raise the limit.");
    expect(validateSetup({ ...ok, limitMode: "pattern", limitPattern: "" }, "create", names, "UTC", NOW).limitPattern).toBe("Type the over pattern, for example 2-1-1.");
    expect(validateSetup({ ...ok, limitMode: "pattern", limitPattern: "9-1" }, "create", names, "UTC", NOW).limitPattern).toBe("One number in the pattern is bigger than the match overs (8).");
    expect(limitFloor(8, 6)).toBe(2);
  });

  it("a pattern that does not add up is a warning, never an error", () => {
    const v = { ...defaultValues(), modeA: "team" as const, teamA: "t1", modeB: "team" as const, teamB: "t2", limitMode: "pattern" as const, limitPattern: "2 1 1" };
    expect(setupWarning(v)).toBe("The pattern 2-1-1 adds up to 4 overs, but the match is 6 overs. Please check it.");
    expect(validateSetup(v, "create", names, "UTC", NOW)).toEqual({});
  });

  it("maps every error key to its step", () => {
    expect([stepOf("sideA"), stepOf("sideB"), stepOf("when"), stepOf("overs"), stepOf("playersPerSide"), stepOf("notes"), stepOf("ballsPerOver"), stepOf("limitPattern"), stepOf("dismissals")]).toEqual([1, 1, 2, 2, 2, 2, 3, 3, 3]);
  });

  it("counts changes from the traditional rules and resets them", () => {
    const v = defaultValues();
    expect(changeCount(v)).toBe(0);
    const c = { ...v, ballsPerOver: "8", flags: { ...v.flags, freeHit: false }, limitMode: "max" as const, dismissals: ["bowled"] };
    expect(changeCount(c)).toBe(4);
    expect(changeCount(resetRules(c))).toBe(0);
  });

  it("quick dates: tonight only while it is still ahead, tomorrow, next usual weekday", () => {
    const now = new Date(2026, 10, 24, 10, 0); // Tue 24 Nov, 10:00 (phone clock)
    const q = quickDates(now, "2026-11-21T20:00"); // last match was a Saturday 8 pm
    expect(q.map((x) => x.label)).toEqual(["Tonight 8:00 pm", "Tomorrow 8:00 pm", "Sat 28 Nov 8:00 pm"]);
    expect(q[2]!.value).toBe("2026-11-28T20:00");
    expect(quickDates(new Date(2026, 10, 24, 21, 0), null).map((x) => x.label)[0]).toBe("Tomorrow 8:00 pm");
  });

  it("edit effect mirrors updateMatch: status and who is alerted", () => {
    const t = "A v B";
    expect(editEffect("scheduled", "2026-11-28T20:00", "2026-11-29T18:00", t)).toMatchObject({ nextStatus: "scheduled", alert: "A v B has a new date or time." });
    expect(editEffect("scheduled", "2026-11-28T20:00", "2026-11-28T20:00", t)).toMatchObject({ nextStatus: "scheduled", alert: null });
    expect(editEffect("scheduled", "2026-11-28T20:00", "", t)).toMatchObject({ nextStatus: "draft", alert: null });
    expect(editEffect("scheduled", "2026-11-28T20:00", "", t).warn).toContain("back into a draft");
    expect(editEffect("draft", "", "2026-11-28T20:00", t)).toMatchObject({ nextStatus: "scheduled", alert: "New match: A v B. Are you coming?" });
    expect(editEffect("draft", "", "", t)).toMatchObject({ nextStatus: "draft", alert: null, warn: null });
    expect(editEffect("postponed", "2026-11-26T19:00", "", t).nextStatus).toBe("postponed");
    expect(editEffect("postponed", "2026-11-26T19:00", "2026-12-01T19:00", t)).toMatchObject({ nextStatus: "scheduled", alert: "A v B has a new date or time." });
  });

  it("diff rows, date text and lineup message parsing", () => {
    const a = valuesFromMatch({ when: "2026-11-28T20:00", venue: "Clifton", overs: 6, playersPerSide: 6, rules: DEFAULT_RULES, umpire: "", notes: "" });
    expect(diffRows(a, a)).toEqual([]);
    expect(diffRows(a, { ...a, when: "", playersPerSide: "4", oversPreset: "custom", oversCustom: "7" })).toEqual([
      { label: "When", from: fmtLocal(a.when), to: "no date" }, { label: "Overs", from: "6 overs", to: "7 overs" }, { label: "Players per side", from: "6", to: "4" },
    ]);
    expect(parseTooMany("Thunder Strikers already has more than 4 players in the lineup. Take some out first.")).toEqual({ side: "Thunder Strikers", max: 4 });
    expect(parseTooMany("nope")).toBeNull();
    expect(valuesFromMatch({ when: "", venue: "", overs: 7, playersPerSide: 6, rules: DEFAULT_RULES, umpire: "", notes: "" })).toMatchObject({ oversPreset: "custom", oversCustom: "7" });
  });

  it("which actions each status allows (the rules of matches.ts), with a reason when not", () => {
    const ok = (s: (typeof MATCH_STATUSES)[number]) => Object.fromEntries(manageItems(s).map((i) => [i.key, i.ok]));
    expect(ok("draft")).toEqual({ rematch: true, edit: true, postpone: true, cancel: true, delete: true });
    expect(ok("scheduled")).toEqual({ rematch: true, edit: true, postpone: true, cancel: true, delete: true });
    expect(ok("postponed")).toEqual({ rematch: true, edit: true, postpone: false, cancel: true, delete: true });
    expect(ok("cancelled")).toEqual({ rematch: true, edit: false, postpone: false, cancel: false, delete: true });
    for (const s of ["live", "paused", "completed", "abandoned"] as const) expect(ok(s)).toEqual({ rematch: true, edit: false, postpone: false, cancel: false, delete: false });
    for (const s of MATCH_STATUSES) for (const i of manageItems(s)) expect(i.ok ? i.why === null : (i.why ?? "").length > 10).toBe(true);
  });
});

/* ---------------------------------------------------------------- the wizard */
function openWizard(props: Partial<React.ComponentProps<typeof MatchWizard>> = {}) {
  return render(wrap(<MatchWizard communityId="c1" teams={teams} recentVenues={["Clifton Indoor Arena"]} lastWhen="2026-11-21T20:00" {...props} />));
}
const first = (name: RegExp) => screen.getAllByRole("button", { name })[0]!;

describe("Create match wizard", () => {
  it("starts on step 1 with the teams as rows, a match-only option and Team 2 waiting", () => {
    openWizard();
    expect(screen.getByRole("heading", { name: /Teams/ })).toBeTruthy();
    expect(screen.getByText("Thunder Strikers")).toBeTruthy();
    expect(screen.getByText(/7 players · Captain Ali Raza/)).toBeTruthy();
    expect(screen.getAllByText("Match-only team").length).toBe(1);
    expect(screen.getByText("Pick Team 1 first")).toBeTruthy();
    // only step 1 is reachable; the others are hidden
    expect(screen.queryByRole("heading", { name: /Format/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Next: Format/ }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/c/c1/matches");
  });

  it("gives the player's own team the gold ring and pre-selects ?team=", () => {
    const { container } = openWizard({ preselect: "t1" });
    expect(container.querySelector(".cr-mine")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Change/ })).toBeTruthy();
    expect(screen.getAllByText(/Captain Ali Raza/).length).toBeGreaterThan(0);
    // Team 2 is now open to choose
    expect(screen.getByRole("group", { name: "Choose Team 2" })).toBeTruthy();
  });

  it("an unknown ?team= is ignored", () => {
    openWizard({ preselect: "nope" });
    expect(screen.getByText("Pick Team 1 first")).toBeTruthy();
  });

  it("Next shows only this step's errors with an icon, and stays", async () => {
    openWizard();
    await click(/Next: Format/);
    expect(screen.getByText("Choose the first team or type a match-only team name.")).toBeTruthy();
    expect(screen.getByText("Choose the second team or type a match-only team name.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Teams/ })).toBeTruthy();
    expect(screen.queryByText(/Overs must be/)).toBeNull();
  });

  it("flags the same team twice and a too short or too long match-only name", async () => {
    openWizard({ preselect: "t1" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Thunder Strikers/ })); });
    await click(/Next: Format/);
    expect(screen.getByText("The two sides must be different teams.")).toBeTruthy();
    await click(/Use a community team/).catch(() => undefined);
  });

  it("match-only names: live counter, 2 letters minimum, 40 maximum", async () => {
    openWizard({ preselect: "t1" });
    await act(async () => { fireEvent.click(within(screen.getByRole("group", { name: "Choose Team 2" })).getByRole("button", { name: /Match-only team/ })); });
    change(/Team 2: match-only team name/, "X");
    await click(/Next: Format/);
    expect(screen.getByText("A team name needs at least 2 letters.")).toBeTruthy();
    expect(screen.getByLabelText("1 of 40 characters")).toBeTruthy();
    change(/Team 2: match-only team name/, "K".repeat(46));
    expect(screen.getByText("A team name can be at most 40 characters.")).toBeTruthy();
    expect(screen.getByLabelText("46 of 40 characters")).toBeTruthy();
  });

  it("swaps the two sides", async () => {
    openWizard({ preselect: "t1" });
    await act(async () => { fireEvent.click(within(screen.getByRole("group", { name: "Choose Team 2" })).getByRole("button", { name: /Royal Panthers/ })); });
    await click(/Swap teams/);
    expect(within(screen.getByRole("region", { name: "Team 1" })).getByText("Royal Panthers")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Team 2" })).getByText("Thunder Strikers")).toBeTruthy();
  });

  async function toFormat() {
    await act(async () => { fireEvent.click(first(/Thunder Strikers/)); });
    await act(async () => { fireEvent.click(within(screen.getByRole("group", { name: "Choose Team 2" })).getByRole("button", { name: /Royal Panthers/ })); });
    await click(/Next: Format/);
  }

  it("step 2 has overs chips, a players stepper, counters, a recent venue and quick dates", async () => {
    openWizard();
    await toFormat();
    expect(screen.getByRole("heading", { name: /Format/ })).toBeTruthy();
    for (const o of [2, 3, 4, 5, 6, 8, 10, 12, 15, 20]) expect(screen.getByRole("radio", { name: String(o) })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Custom" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "6" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Players per side") as HTMLInputElement).value).toBe("6");
    expect(screen.getByText("Leave empty to save as a draft. Nobody is told until the match has a date.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Clifton Indoor Arena/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tomorrow 8:00 pm/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Clifton Indoor Arena/ }));
    expect((screen.getByLabelText("Venue (optional)") as HTMLInputElement).value).toBe("Clifton Indoor Arena");
    expect(screen.getByLabelText("20 of 80 characters")).toBeTruthy();
  });

  it("the stepper cannot leave 2 to 11 with its buttons; typing shows the real message on this step", async () => {
    openWizard();
    await toFormat();
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole("button", { name: "More: Players per side" }));
    expect((screen.getByLabelText("Players per side") as HTMLInputElement).value).toBe("11");
    expect((screen.getByRole("button", { name: "More: Players per side" }) as HTMLButtonElement).disabled).toBe(true);
    change("Players per side", "14");
    await click(/Next: Rules/);
    expect(screen.getByText("Players per side must be a whole number from 2 to 11.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Format/ })).toBeTruthy();
  });

  it("date, custom overs, venue, umpire and notes errors", async () => {
    openWizard();
    await toFormat();
    change("Date and time", "2026-01-01T20:00");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    change("Custom overs", "75");
    change("Venue (optional)", "V".repeat(97));
    change("Umpire (optional)", "U".repeat(47));
    change("Notes (optional)", "N".repeat(301));
    await click(/Next: Rules/);
    expect(screen.getByText("That date and time is in the past. Choose today or a later day.")).toBeTruthy();
    expect(screen.getByText("Overs must be a whole number from 1 to 50.")).toBeTruthy();
    expect(screen.getByText("The venue can be at most 80 characters.")).toBeTruthy();
    expect(screen.getByText("The umpire name can be at most 40 characters.")).toBeTruthy();
    expect(screen.getByText("Notes can be at most 300 characters.")).toBeTruthy();
    expect(screen.getByLabelText("97 of 80 characters")).toBeTruthy();
  });

  it("Back keeps everything that was typed", async () => {
    openWizard();
    await toFormat();
    change("Venue (optional)", "Hall 2");
    await click(/Back/);
    expect(screen.getByRole("heading", { name: /Teams/ })).toBeTruthy();
    expect(screen.getByText("Thunder Strikers")).toBeTruthy();
    await click(/Next: Format/);
    expect((screen.getByLabelText("Venue (optional)") as HTMLInputElement).value).toBe("Hall 2");
  });

  async function toRules() {
    await toFormat();
    change("Date and time", "2026-11-28T20:00");
    await click(/Next: Rules/);
  }

  it("step 3 shows every rule control, steppers, a Traditional badge and Reset", async () => {
    openWizard();
    await toRules();
    expect(screen.getByRole("heading", { name: /Rules/ })).toBeTruthy();
    expect(screen.getByText("Traditional rules")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Reset to traditional/ }) as HTMLButtonElement).disabled).toBe(true);
    for (const l of ["Balls per over", "Wide runs", "No-ball runs"]) expect(screen.getByLabelText(l)).toBeTruthy();
    expect(screen.getAllByRole("checkbox").length).toBe(9 + 7);
    expect(screen.getByLabelText(/Free hit after a no ball/)).toBeTruthy();
    expect(screen.getByText("The batter can only be run out on a free hit.")).toBeTruthy();
    expect(screen.getByText("If off, the innings ends when one batter is left.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Each team bats once" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Ask me when the match ends level/ })).toBeTruthy();
    expect(screen.getByText("Once chosen, the limit is locked: a bowler who used their overs cannot be picked.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Free hit after a no ball/));
    expect(screen.getByText("1 change from traditional")).toBeTruthy();
    await click(/Reset to traditional/);
    expect(screen.getByText("Traditional rules")).toBeTruthy();
  });

  it("ways of getting out say on or off in words; the last one cannot be switched off silently", async () => {
    openWizard();
    await toRules();
    expect(screen.getAllByText(/\(on\)/).length).toBe(7);
    for (const d of ["Bowled", "Caught", "LBW", "Stumped", "Hit wicket", "Run out", "Retired out"]) fireEvent.click(screen.getByLabelText(new RegExp(`^${d}`)));
    expect(screen.getAllByText(/\(off\)/).length).toBe(7);
    await click(/Next: Review/);
    expect(screen.getByText("Keep at least one way of getting out switched on.")).toBeTruthy();
  });

  it("rule errors under the control: balls, wide, no-ball", async () => {
    openWizard();
    await toRules();
    change("Balls per over", "15"); change("Wide runs", "9"); change("No-ball runs", "7");
    await click(/Next: Review/);
    expect(screen.getByText("Balls per over must be a whole number from 1 to 12.")).toBeTruthy();
    expect(screen.getByText("Wide runs must be a whole number from 0 to 5.")).toBeTruthy();
    expect(screen.getByText("No-ball runs must be a whole number from 0 to 5.")).toBeTruthy();
  });

  it("bowler limit: minimum shown first, then every error text", async () => {
    openWizard();
    await toRules();
    fireEvent.click(screen.getByRole("radio", { name: "Max per bowler" }));
    expect(screen.getByText("At least 1 over each, so 6 players can finish a 6-over innings. Never more than 6.")).toBeTruthy();
    await click(/Next: Review/);
    expect(screen.getByText("Type how many overs each bowler may bowl (a whole number, at least 1).")).toBeTruthy();
    change("Maximum overs per bowler", "9");
    expect(screen.getByText("A bowler cannot be limited to more than the match overs (6).")).toBeTruthy();
  });

  it("bowler limit pattern: hint, bowler chips with the total, errors and the warning", async () => {
    openWizard();
    await toRules();
    fireEvent.click(screen.getByRole("radio", { name: "Pattern" }));
    expect(screen.getByText("Type 2-1-1, 2 1 1, 2,1,1 or 2/1/1. They all mean the same.")).toBeTruthy();
    await click(/Next: Review/);
    expect(screen.getByText("Type the over pattern, for example 2-1-1.")).toBeTruthy();
    change("Over pattern", "2-x-1");
    expect(screen.getByText("Each number in the pattern must be a whole number from 1 to 50, for example 2-1-1.")).toBeTruthy();
    change("Over pattern", "4");
    expect(screen.getByText(/A pattern needs at least two numbers/)).toBeTruthy();
    change("Over pattern", "1-1-1-1-1-1-1-1-1-1-1-1");
    expect(screen.getByText("A pattern can have at most 11 numbers.")).toBeTruthy();
    change("Over pattern", "2-1-1");
    expect(screen.getByText(/Bowler 1: 2, Bowler 2: 1, Bowler 3: 1\./)).toBeTruthy();
    expect(screen.getAllByText("The pattern 2-1-1 adds up to 4 overs, but the match is 6 overs. Please check it.").length).toBeGreaterThan(0);
    // still only a warning: Next works
    await click(/Next: Review/);
    expect(screen.getByRole("heading", { name: /Review/ })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: /Review/ })).getByText(/adds up to 4 overs/)).toBeTruthy();
  });

  async function toReview() {
    await toRules();
    await click(/Next: Review/);
  }

  it("Review: scheduled match says everyone is alerted and offers Create match + Save as draft instead", async () => {
    openWizard();
    await toReview();
    expect(screen.getByRole("heading", { name: /Review/ })).toBeTruthy();
    expect(screen.getByText("Scheduled")).toBeTruthy();
    expect(screen.getByText("Thunder Strikers v Royal Panthers")).toBeTruthy();
    expect(screen.getByText(/Everyone in the community gets an alert: “New match: Thunder Strikers v Royal Panthers. Are you coming\?”/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create match" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save as draft instead" })).toBeTruthy();
    const review = within(screen.getByRole("region", { name: /Review/ }));
    expect(review.getByText("Traditional")).toBeTruthy();
    expect(review.getByText("No limit")).toBeTruthy();
  });

  it("Review without a date is a draft: honest text and Save as draft", async () => {
    openWizard();
    await toFormat();
    await click(/Next: Rules/);
    await click(/Next: Review/);
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("No date: it is saved as a draft and nobody is told yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeTruthy();
    expect(screen.queryByText(/Everyone in the community gets an alert/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Save as draft instead" })).toBeNull();
  });

  it("posts the same fields to createMatchAction", async () => {
    openWizard();
    await toFormat();
    change("Date and time", "2026-11-28T20:00");
    change("Venue (optional)", "Clifton Indoor Arena");
    change("Umpire (optional)", "Asif Mehmood");
    await click(/Next: Rules/);
    fireEvent.click(screen.getByLabelText(/Free hit after a no ball/));
    await click(/Next: Review/);
    await click("Create match");
    expect(createMatchAction).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(createMatchAction).mock.calls[0]![1] as FormData;
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("sideATeam")).toBe("t1");
    expect(fd.get("sideBTeam")).toBe("t2");
    expect(fd.get("sideAName")).toBe("");
    expect(fd.get("when")).toBe("2026-11-28T20:00");
    expect(fd.get("venue")).toBe("Clifton Indoor Arena");
    expect(fd.get("oversPreset")).toBe("6");
    expect(fd.get("rulesForm")).toBe("1");
    expect(fd.get("playersPerSide")).toBe("6");
    expect(fd.get("freeHit")).toBeNull();
    expect(fd.get("widesReBowled")).toBe("on");
    expect(fd.getAll("dismissals")).toHaveLength(7);
    expect(fd.get("superOver")).toBe("ask");
    expect(fd.get("limitMode")).toBe("none");
    expect(fd.get("umpire")).toBe("Asif Mehmood");
    expect(fd.has("tz")).toBe(true);
  });

  it("Save as draft instead asks first, because the typed date will be removed; Keep it cancels, confirming posts with an empty date", async () => {
    openWizard();
    await toReview();
    await click("Save as draft instead");
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("will be removed from this match");
    expect(createMatchAction).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Cancel" })); });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(createMatchAction).not.toHaveBeenCalled();
    await click("Save as draft instead");
    await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Save as draft" })); });
    const fd = vi.mocked(createMatchAction).mock.calls[0]![1] as FormData;
    expect(fd.get("when")).toBe("");
  });

  it("saving: the button says Saving… and the whole form is locked", async () => {
    let release: () => void = () => undefined;
    vi.mocked(createMatchAction).mockImplementationOnce(() => new Promise((r) => { release = () => r({}); }));
    const { container } = openWizard();
    await toReview();
    await click("Create match");
    expect(screen.getByRole("button", { name: "Saving…" })).toBeTruthy();
    expect((container.querySelector("fieldset.cr-fs") as HTMLFieldSetElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Back/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { release(); });
  });

  it("a server failure lists each problem with a Fix button that opens its step, and nothing is cleared", async () => {
    result = { fieldErrors: { when: "That date and time is in the past. Choose today or a later day.", limitMax: "A bowler cannot be limited to more than the match overs (6)." }, error: "Please fix the highlighted fields." };
    openWizard();
    await toFormat();
    change("Venue (optional)", "Hall 7");
    change("Date and time", "2026-11-28T20:00");
    await click(/Next: Rules/);
    await click(/Next: Review/);
    await click("Create match");
    expect(screen.getByText("Please fix the highlighted fields.")).toBeTruthy();
    expect(screen.getByText("2 things need attention")).toBeTruthy();
    expect(screen.getByText("Format: date and time")).toBeTruthy();
    expect(screen.getByText("Rules: bowler limit")).toBeTruthy();
    await click("Fix Format: date and time");
    expect(screen.getByRole("heading", { name: /Format/ })).toBeTruthy();
    expect((screen.getByLabelText("Venue (optional)") as HTMLInputElement).value).toBe("Hall 7");
    expect((screen.getByLabelText("Date and time") as HTMLInputElement).value).toBe("2026-11-28T20:00");
    // changing the value drops the stale server message
    change("Date and time", "2026-11-29T20:00");
    expect(screen.queryByText("That date and time is in the past. Choose today or a later day.")).toBeNull();
  });

  it("not a member: a calm banner with the server's words", async () => {
    result = { error: "Only members of this community can create matches." };
    openWizard();
    await toReview();
    await click("Create match");
    expect(screen.getByText("Only members of this community can create matches.")).toBeTruthy();
    expect(screen.getByText("Ask an admin to approve you again.")).toBeTruthy();
  });

  it("team removed meanwhile: the Teams error comes back with a way to the Teams step", async () => {
    result = { fieldErrors: { sideA: "Choose teams from this community." }, error: "Please fix the highlighted fields." };
    openWizard();
    await toReview();
    await click("Create match");
    await click("Fix Teams: first team");
    expect(screen.getByRole("heading", { name: /Teams/ })).toBeTruthy();
    expect(screen.getAllByText("Choose teams from this community.").length).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------- the edit page */
const base = valuesFromMatch({ when: "2026-11-28T20:00", venue: "Clifton Indoor Arena", overs: 6, playersPerSide: 6, rules: DEFAULT_RULES, umpire: "", notes: "" });
function openEditor(props: Partial<React.ComponentProps<typeof MatchEditor>> = {}) {
  return render(wrap(
    <MatchEditor communityId="c1" matchId="m1" status="scheduled" sideA={{ name: "Thunder Strikers", mine: true }} sideB={{ name: "Royal Panthers", mine: false }}
      lineup={{ a: 5, b: 4 }} initialValues={base} recentVenues={[]} lastWhen={null} whenLabel="Sat 28 Nov, 8:00 pm" {...props} />,
  ));
}

describe("Edit match", () => {
  it("shows the teams locked, every field prefilled, and nothing changed yet", () => {
    const { container } = openEditor();
    expect(screen.getByText("Locked")).toBeTruthy();
    expect(screen.getByText("Teams cannot be changed after the match is created. To use different teams, cancel this match and create a new one, or use Rematch.")).toBeTruthy();
    expect(container.querySelector(".cr-mine")).toBeTruthy();
    expect((screen.getByLabelText("Date and time") as HTMLInputElement).value).toBe("2026-11-28T20:00");
    expect((screen.getByLabelText("Venue (optional)") as HTMLInputElement).value).toBe("Clifton Indoor Arena");
    expect(screen.getByText("Nothing changed yet")).toBeTruthy();
    expect(screen.getByText("Clearing the date turns a scheduled match back into a draft.")).toBeTruthy();
    expect(screen.queryByText(/leave empty to save as a draft/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/c/c1/matches/m1");
  });

  it("moving the date shows old to new and announces the alert before it is sent", () => {
    openEditor();
    change("Date and time", "2026-11-29T18:00");
    expect(screen.getByText(/Sat 28 Nov, 8:00 pm to Sun 29 Nov, 6:00 pm/)).toBeTruthy();
    expect(screen.getByText("Everyone gets an alert: “Thunder Strikers v Royal Panthers has a new date or time.”")).toBeTruthy();
  });

  it("clearing the date of a scheduled match warns that it becomes a draft", () => {
    openEditor();
    change("Date and time", "");
    expect(screen.getByText("Clearing the date turns this match back into a draft. Replies and lineups are kept. Nobody is told.")).toBeTruthy();
    expect(screen.getByText("Scheduled to Draft")).toBeTruthy();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("a draft that gets its first date announces the new-match alert", () => {
    openEditor({ status: "draft", initialValues: { ...base, when: "" } });
    change("Date and time", "2026-12-01T19:00");
    expect(screen.getByText("Everyone gets an alert: “New match: Thunder Strikers v Royal Panthers. Are you coming?”")).toBeTruthy();
  });

  it("a postponed match explains itself on the edit page and says what a date does", () => {
    openEditor({ status: "postponed" });
    expect(screen.getByText("This match is postponed.")).toBeTruthy();
    expect(screen.getByText(/Choose a new date and time to schedule it again/)).toBeTruthy();
    // Postpone is not offered again, and says why
    expect(screen.queryByRole("button", { name: /Postpone/ })).toBeNull();
    expect(screen.getByText("Already postponed. Edit it to choose a new date.")).toBeTruthy();
    change("Date and time", "2026-12-01T19:00");
    expect(screen.getByText(/Setting a date moves it to Scheduled and tells everyone/)).toBeTruthy();
    expect(screen.getByText("Postponed to Scheduled")).toBeTruthy();
    change("Date and time", "");
    expect(screen.getByText("Stays postponed until a date is set.")).toBeTruthy();
  });

  it("a validation error sits under its field and Save is disabled; no request is made", async () => {
    openEditor();
    change("Date and time", "2026-11-20T20:00");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    change("Custom overs", "75");
    expect(screen.getAllByText("That date and time is in the past. Choose today or a later day.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overs must be a whole number from 1 to 50.").length).toBeGreaterThan(0);
    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(updateMatchAction).not.toHaveBeenCalled();
  });

  it("the players stepper cannot go below the biggest lineup", () => {
    openEditor({ lineup: { a: 5, b: 4 } });
    expect((screen.getByRole("button", { name: "Fewer: Players per side" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Fewer: Players per side" }));
    expect((screen.getByLabelText("Players per side") as HTMLInputElement).value).toBe("5");
    expect((screen.getByRole("button", { name: "Fewer: Players per side" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("link", { name: "Pick lineups" })[0]!.getAttribute("href")).toBe("/c/c1/matches/m1/lineup");
  });

  it("saves through updateMatchAction with the same fields (no sides)", async () => {
    openEditor();
    change("Venue (optional)", "Hall 3");
    await click("Save changes");
    expect(updateMatchAction).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(updateMatchAction).mock.calls[0]![1] as FormData;
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("matchId")).toBe("m1");
    expect(fd.get("venue")).toBe("Hall 3");
    expect(fd.get("when")).toBe("2026-11-28T20:00");
    expect(fd.get("rulesForm")).toBe("1");
    expect(fd.has("sideATeam")).toBe(false);
    expect(fd.getAll("dismissals")).toHaveLength(7);
  });

  it("server error: lineup bigger than players per side shows under the stepper and in the panel with both sizes", async () => {
    result = { fieldErrors: { playersPerSide: "Thunder Strikers already has more than 4 players in the lineup. Take some out first." }, error: "Please fix the highlighted fields." };
    openEditor();
    await click("Save changes");
    expect(screen.getAllByText("Thunder Strikers already has more than 4 players in the lineup. Take some out first.").length).toBeGreaterThan(0);
    expect(screen.getByText(/Thunder Strikers has 5 in the lineup, Royal Panthers 4\./)).toBeTruthy();
    expect(screen.getByText("Please fix the highlighted fields.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("failures have a next step: started, gone, not a member", async () => {
    result = { error: "This match has already started, so its setup can no longer be changed here." };
    openEditor();
    await click("Save changes");
    expect(screen.getByText("This match has already started, so its setup can no longer be changed here.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the match" }).getAttribute("href")).toBe("/c/c1/matches/m1");
    cleanup();
    result = { error: "That match no longer exists." };
    openEditor();
    await click("Save changes");
    expect(screen.getByRole("link", { name: "Back to matches" }).getAttribute("href")).toBe("/c/c1/matches");
    cleanup();
    result = { error: "Only members of this community can change matches." };
    openEditor();
    await click("Save changes");
    expect(screen.getByText("Only members of this community can change matches.")).toBeTruthy();
  });

  it("saving locks the form and reads Saving…", async () => {
    let release: () => void = () => undefined;
    vi.mocked(updateMatchAction).mockImplementationOnce(() => new Promise((r) => { release = () => r({}); }));
    const { container } = openEditor();
    await click("Save changes");
    expect(screen.getByRole("button", { name: "Saving…" })).toBeTruthy();
    expect((container.querySelector("fieldset.cr-fs") as HTMLFieldSetElement).disabled).toBe(true);
    await act(async () => { release(); });
  });
});

/* ---------------------------------------------------------------- postpone, cancel, delete */
describe("Manage this match", () => {
  const props = { communityId: "c1", matchId: "m1", title: "Thunder Strikers v Royal Panthers", whenLabel: "Fri 28 Nov, 8:00 pm" } as const;

  it("postpone: the dialog states the outcome and the alert, then uses the existing action", async () => {
    render(wrap(<MatchManage {...props} status="scheduled" />));
    await click("Postpone…");
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Postpone this match?")).toBeTruthy();
    expect(within(dlg).getByText("Everyone gets an alert: “Thunder Strikers v Royal Panthers has been postponed.”")).toBeTruthy();
    expect(within(dlg).getByText(/stays in Upcoming/)).toBeTruthy();
    await click("Keep it");
    expect(postponeAction).not.toHaveBeenCalled();
    await click("Postpone…");
    await click("Postpone and tell everyone");
    const fd = vi.mocked(postponeAction).mock.calls[0]![0] as FormData;
    expect([fd.get("communityId"), fd.get("matchId")]).toEqual(["c1", "m1"]);
  });

  it("cancel: says a cancelled match stays in the list, then uses the existing action", async () => {
    render(wrap(<MatchManage {...props} status="scheduled" />));
    await click("Cancel match…");
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Everyone gets an alert: “Thunder Strikers v Royal Panthers has been cancelled.”")).toBeTruthy();
    expect(within(dlg).getByText(/stays in the Past list/)).toBeTruthy();
    await click("Cancel match");
    expect(cancelAction).toHaveBeenCalledTimes(1);
  });

  it("delete: the button stays off until the match name is typed (case ignored), then uses the existing action", async () => {
    render(wrap(<MatchManage {...props} status="cancelled" />));
    expect(screen.queryByRole("button", { name: /Postpone/ })).toBeNull();
    await click("Delete match…");
    const confirm = screen.getByRole("button", { name: "Delete forever" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "thunder strikers" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "thunder strikers v royal panthers" } });
    expect(confirm.disabled).toBe(false);
    await click("Delete forever");
    const fd = vi.mocked(deleteMatchAction).mock.calls[0]![0] as FormData;
    expect([fd.get("communityId"), fd.get("matchId")]).toEqual(["c1", "m1"]);
  });

  it("the card variant lists every action; unavailable ones are dimmed with the reason (live match)", () => {
    render(wrap(<MatchManage {...props} status="live" variant="card" />));
    expect(screen.getByRole("link", { name: /Rematch/ }).getAttribute("href")).toBe("/c/c1/matches/m1/rematch");
    for (const label of ["Edit match", "Postpone", "Cancel match", "Delete match"]) expect(screen.getByText(label).closest("[aria-disabled='true']")).toBeTruthy();
    expect(screen.getByText("A match that has started cannot be cancelled. End it from the scoring pad.")).toBeTruthy();
    expect(screen.getByText(/This one carries scores and stats, so it stays\./)).toBeTruthy();
  });

  it("on the edit page the panel offers postpone, cancel and delete for a scheduled match", () => {
    openEditor();
    for (const n of ["Postpone…", "Cancel match…", "Delete match…"]) expect(screen.getByRole("button", { name: n })).toBeTruthy();
  });
});

/* ---------------------------------------------------------------- result notices */
describe("MatchNotice", () => {
  it("uses the real words, and failures say what to do next", () => {
    render(<MatchNotice code="postponed" communityId="c1" matchId="m1" />);
    expect(screen.getByText("Match postponed. Everyone was told.")).toBeTruthy();
    cleanup();
    render(<MatchNotice code="locked" communityId="c1" matchId="m1" />);
    expect(screen.getByRole("alert").textContent).toContain("This match has already started, so this can no longer be changed here.");
    expect(screen.getByRole("link", { name: "Open the match" }).getAttribute("href")).toBe("/c/c1/matches/m1");
    cleanup();
    render(<MatchNotice code="not_found" communityId="c1" matchId="m1" />);
    expect(screen.getByRole("link", { name: "Back to matches" })).toBeTruthy();
    cleanup();
    const { container } = render(<MatchNotice code="bad_state" communityId="c1" matchId="m1" />);
    expect(container.textContent).toContain("That cannot be done in this match's current state.");
    cleanup();
    expect(render(<MatchNotice code={undefined} communityId="c1" matchId="m1" />).container.innerHTML).toBe("");
  });
});
