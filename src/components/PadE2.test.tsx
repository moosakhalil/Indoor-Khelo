// @vitest-environment jsdom
// Phase E2 (UI redesign): the pad's sheets. What each sheet says, explains and refuses. (What events they produce is pinned by PadE2Golden.test.tsx.)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import * as Sheets from "@/components/PadSheets";
import {
  BatterSheet, BowlerSheet, ByeSheet, CreaseSheet, EditSheet, EndInningsSheet, EndMatchSheet, GuideSheet, LateSheet, LimitSheet, OrderSheet, OutSheet,
  OversSheet, PenaltySheet, PlayersSheet, RetireSheet, ScorecardSheet, Sheet, SubSheet, TargetSheet, type Add,
} from "@/components/PadSheets";
import ReleaseSheet from "@/components/PadRelease";
import { buildState, currentInnings } from "@/lib/engine/engine";
import type { ScoreEventBody } from "@/lib/engine/types";
import { aloneBatter, afterWicket, chasing, fresh, freeHitSim, midOver, nobodyAllowed, overDone, Sim } from "./PadE2.fixture";

afterEach(() => cleanup());

type Call = { bodies: ScoreEventBody[]; opts?: { reason?: string; then?: ScoreEventBody[] } };
function setup(sim: Sim) {
  const calls: Call[] = [];
  const add: Add = (bodies, opts) => { calls.push({ bodies, opts }); return true; };
  const close = vi.fn();
  const m = sim.state();
  const inn = currentInnings(m)!;
  return { calls, add, close, m, inn, common: { m, inn, add, close } };
}
const bt = (name: string | RegExp) => screen.getByRole("button", { name });
const tap = (name: string | RegExp) => fireEvent.click(bt(name));
const pick = (group: string, name: RegExp | string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));
const dialog = () => screen.getByRole("dialog");
const text = () => dialog().textContent ?? "";

describe("every export of the sheets file is still there (the pad imports them by name)", () => {
  it("names", () => {
    for (const n of ["ByeSheet", "OutSheet", "BatterSheet", "BowlerSheet", "PenaltySheet", "RetireSheet", "OversSheet", "PlayersSheet", "LimitSheet", "LateSheet", "CreaseSheet", "OrderSheet", "SubSheet", "TargetSheet", "EndInningsSheet", "EndMatchSheet", "EditSheet", "GuideSheet", "ScorecardSheet", "Sheet", "Chip"]) {
      expect(typeof (Sheets as Record<string, unknown>)[n], n).toBe("function");
    }
  });
});

describe("the sheet shell", () => {
  it("is a modal dialog with a labelled close button, a backdrop that closes, and Escape", () => {
    const onClose = vi.fn();
    render(<Sheet title="Something" onClose={onClose}><p>Body</p></Sheet>);
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    expect(dialog().getAttribute("aria-label")).toBe("Something");
    fireEvent.click(bt("Close")); expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(bt("Close this panel")); expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(dialog(), { key: "Escape" }); expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Body")).toBeTruthy();
  });
  it("keeps Tab inside the sheet", () => {
    render(<Sheet title="T" onClose={() => {}}><button>one</button><button>two</button></Sheet>);
    const two = bt("two");
    two.focus();
    fireEvent.keyDown(dialog(), { key: "Tab" });
    expect(document.activeElement).toBe(bt("Close"));   // from the last control back to the first (the close button)
    fireEvent.keyDown(dialog(), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(two);
  });
});

describe("wicket sheet: it explains and reads back", () => {
  it("opens on the right ball, with nothing chosen: the button names the missing step and nothing is recorded", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    expect(text()).toContain("Bilal Ahmed to Hamza Khan · over 0.1");
    const b = bt("Choose how the batter is out");
    expect(b.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(b);
    expect(s.calls).toEqual([]);
    expect(screen.getAllByRole("alert").some((a) => /Choose how the batter is out/.test(a.textContent ?? ""))).toBe(true);
  });
  it("progress: how, the fielder, who comes in", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    const bar = () => screen.getByRole("progressbar");
    expect(bar().getAttribute("aria-valuenow")).toBe("0");
    tap("Caught");
    expect(bar().getAttribute("aria-valuemax")).toBe("3"); expect(bar().getAttribute("aria-valuenow")).toBe("1");
    pick("Fielder", /Usman/); expect(bar().getAttribute("aria-valuenow")).toBe("2");
    pick("Next batter", /Talha/); expect(bar().getAttribute("aria-valuenow")).toBe("3");
  });
  it("caught: errors sit next to the field; the button says what is missing; then it reads the dismissal back", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Caught"); pick("Next batter", /Talha/);
    fireEvent.click(bt("Pick the fielder to continue"));
    expect(s.calls).toEqual([]);
    expect(screen.getByText("Pick the fielder.")).toBeTruthy();
    pick("Fielder", /Usman/);
    expect(text()).toContain("Out: Hamza Khan c Usman Tariq b Bilal Ahmed");
    expect(text()).toContain("Score becomes 0/1. Wicket to Bilal Ahmed.");
    expect(bt("Confirm OUT").getAttribute("aria-disabled")).toBeNull();
  });
  it("the sentence about run outs appears for a run out only", () => {
    const a = setup(fresh());
    render(<OutSheet {...a.common} />);
    tap("Bowled");
    expect(text()).toContain("Out: Hamza Khan b Bilal Ahmed");
    expect(text()).not.toMatch(/not the bowler.s wicket/);
    cleanup();
    const b = setup(fresh());
    render(<OutSheet {...b.common} preset="run_out" />);
    pick("Who is out", /Saad/); pick("Runs completed", "1"); pick("Fielder", /Faizan/);
    expect(text()).toContain("Out: Saad Hussain run out (Faizan Ali)");
    expect(text()).toMatch(/A run out is not the bowler.s wicket\./);
    expect(text()).toContain("Score becomes 1/1 (1 run completed)");
  });
  it("retired out and the kinds of ball: LBW, stumped, hit wicket read back", () => {
    for (const [kind, expected] of [["LBW", "Out: Hamza Khan lbw b Bilal Ahmed"], ["Hit Wicket", "Out: Hamza Khan hit wicket b Bilal Ahmed"], ["Retired out", "Out: Hamza Khan retired out (counts as a wicket)"]] as const) {
      const s = setup(fresh());
      render(<OutSheet {...s.common} />);
      tap(kind);
      expect(text()).toContain(expected);
      cleanup();
    }
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Retired out");
    expect(text()).toContain("No wicket for the bowler.");
  });
  it("a wide ball with a run out counts the wide in the new score", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} preset="run_out" />);
    pick("Wide or no ball", "Wide");
    expect(text()).toContain("Score becomes 1/1");
  });
  it("free hit: one orange banner, the other kinds are dimmed, Run Out is already chosen", () => {
    const s = setup(freeHitSim());
    render(<OutSheet {...s.common} />);
    expect(screen.getAllByText(/Free hit: only a run out is possible on this ball\./)).toHaveLength(1);
    expect(text()).not.toContain("Free hit: only Run Out");
    expect(bt("Run Out").getAttribute("aria-pressed")).toBe("true");
    expect(bt("Bowled").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("group", { name: "Fielder" })).toBeTruthy();
  });
  it("a kind switched off in the rules says so on its own tile; the grid keeps six tiles and Retired out is hidden", () => {
    const s = setup(new Sim({ dismissals: ["bowled", "caught", "run_out", "stumped"] }).startInnings());
    render(<OutSheet {...s.common} />);
    const grid = within(screen.getByRole("group", { name: "How out" }));
    expect(grid.getAllByRole("button")).toHaveLength(6);
    expect(grid.getByRole("button", { name: "LBW" }).hasAttribute("disabled")).toBe(true);
    expect(grid.getByRole("button", { name: "LBW" }).getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getAllByText("Switched off for this match")).toHaveLength(2);
    expect(text()).toContain("can be turned on in the match rules");
  });
  it("last wicket: a banner says the innings ends, and there is no question about the next batter", () => {
    const s = setup(aloneBatter());
    render(<OutSheet {...s.common} />);
    tap("Bowled");
    expect(text()).toContain("Last wicket");
    expect(screen.queryByRole("group", { name: "Next batter" })).toBeNull();
    expect(bt("Confirm OUT")).toBeTruthy();
  });
  it("players who cannot come in are named: At crease, Out, Yet to bat; guests are named too", () => {
    const sim = new Sim({}, 6, 6, true).startInnings("a1", "a2", "b1").runs(1, 0).ball({ wicket: { type: "bowled" } });
    const s = setup(sim);
    render(<BatterSheet {...s.common} />);
    const g = within(screen.getByRole("group", { name: "Next batter" }));
    const note = (name: RegExp) => g.getByRole("button", { name }).getAttribute("aria-describedby")!;
    expect(document.getElementById(note(/Saad/))!.textContent).toBe("Out");
    expect(document.getElementById(note(/Hamza/))!.textContent).toBe("At crease");
    expect(document.getElementById(note(/Talha/))!.textContent).toBe("Yet to bat");
  });
});

describe("byes and leg-byes", () => {
  it("one row of run chips (1 to 5), two kinds, a read-back of the ball and the strike, an outcome button", () => {
    const s = setup(fresh());
    render(<ByeSheet {...s.common} />);
    expect(dialog().textContent).toContain("Not off the bat, not charged to the bowler");
    expect(within(screen.getByRole("group", { name: "Runs run" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    expect(text()).toContain("Records: 1 bye.");
    expect(text()).toContain("strike changes (odd runs)");
    pick("Runs run", "2");
    expect(text()).toContain("strike does not change (even runs)");
    tap("Leg-byes"); expect(bt("Add 2 leg-byes")).toBeTruthy();
    tap("Byes"); tap("Add 2 byes");
    expect(s.calls).toEqual([{ bodies: [{ type: "ball", payload: { extra: "bye", runs: 2 } }], opts: undefined }]);
    expect(s.close).toHaveBeenCalledTimes(1);
  });
  it("five byes (overthrows) are accepted by the engine", () => {
    const sim = fresh();
    const s = setup(sim);
    render(<ByeSheet {...s.common} />);
    pick("Runs run", "5"); tap("Add 5 byes");
    const call = s.calls[0]!;
    const ev = { ...call.bodies[0]!, id: "x1", seq: sim.events.length + 1 } as never;
    expect(buildState([...sim.events, ev]).ok).toBe(true);
  });
  it("the last ball of an over says the over ends", () => {
    const s = setup(fresh().runs(0, 0, 0, 0, 0));
    render(<ByeSheet {...s.common} />);
    expect(text()).toContain("The over ends after this ball.");
  });
});

describe("next batter and bowler", () => {
  it("the next batter: who is out and the score in the header; Confirm names the player and the end; the empty end is marked", () => {
    const s = setup(afterWicket());
    render(<BatterSheet {...s.common} />);
    expect(dialog().textContent).toContain("Saad Hussain is out · 5/1 after 0.4 overs");
    expect(bt("Pick who comes in").getAttribute("aria-disabled")).toBe("true");
    expect(bt("Striker end").getAttribute("aria-pressed")).toBe("true");
    expect(within(bt("Striker end")).getByText("Empty end")).toBeTruthy();
    pick("Next batter", /Talha/);
    expect(bt("Confirm: Talha Mehmood to bat at the striker's end")).toBeTruthy();
    pick("Which end", "Non-striker end");
    tap("Confirm: Talha Mehmood to bat at the non-striker's end");
    expect(s.calls[0]!.bodies).toEqual([{ type: "batter_in", payload: { player: "a3", end: "nonStriker" } }]);
  });
  it("the bowler list: a text badge and the reason on every row, blocked rows are not hidden and say why when tapped", () => {
    const s = setup(overDone({ bowlerLimit: { mode: "max", overs: 2 } }));
    render(<BowlerSheet {...s.common} title="Pick bowler for over 2" />);
    const d = within(dialog());
    expect(d.getByText("Maximum 2 overs each · no two overs in a row")).toBeTruthy();
    expect(d.getByText("BOWLED LAST OVER")).toBeTruthy();
    expect(d.getAllByText("2 OVERS LEFT").length).toBeGreaterThan(0);
    expect(d.getByText(/Bowled the last over\. The same bowler cannot bowl two overs in a row\./)).toBeTruthy();
    const row = d.getByRole("button", { name: /Bilal/ });
    expect(row.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(row);
    expect(d.getByRole("alert").textContent).toMatch(/Pick another bowler/);
    expect(s.calls).toEqual([]);
  });
  it("a bowler who used all the overs shows 'USED 1 OF 1' and the limit wording", () => {
    const s = setup(nobodyAllowed());
    render(<BowlerSheet {...s.common} title="Pick bowler for over 3" />);
    expect(screen.getAllByText("USED 1 OF 1")).toHaveLength(2);
    expect(screen.getAllByText("Has used all 1 over allowed.")).toHaveLength(2);
  });
  it("mid-over: the warning is a banner and the current bowler is marked and cannot be picked", () => {
    const s = setup(midOver());
    render(<BowlerSheet {...s.common} title="Change the bowler" />);
    expect(screen.getByText(/This changes the bowler in the middle of an over; balls already bowled stay with the first bowler\./)).toBeTruthy();
    expect(screen.getByText("BOWLING NOW")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Bilal/ }));
    expect(screen.getByRole("alert").textContent).toBe("That bowler is already bowling.");
    expect(s.calls).toEqual([]);
  });
  it("nobody allowed: the banner has a button that changes the limit right there", () => {
    const s = setup(nobodyAllowed());
    render(<BowlerSheet {...s.common} title="Pick bowler for over 3" />);
    expect(screen.getByRole("alert").textContent).toContain("No bowler is allowed under the limit right now");
    tap("Change the bowler limit");
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Change the bowler limit");
    fireEvent.click(screen.getByRole("radio", { name: /Maximum overs per bowler/ }));
    fireEvent.change(screen.getByLabelText("Maximum overs"), { target: { value: "2" } });
    tap("Set limit: 2 overs each");
    expect(s.calls).toEqual([{ bodies: [{ type: "limit_change", payload: { limit: { mode: "max", overs: 2 } } }], opts: { reason: "" } }]);
    expect(s.close).toHaveBeenCalledTimes(1);
  });
});

describe("the sheets from More", () => {
  it("penalty: quick values, a read-back of the new score, and a button that says what to fix", () => {
    const s = setup(fresh().runs(4, 2));
    render(<PenaltySheet {...s.common} />);
    expect(within(screen.getByRole("group", { name: "Quick values" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["1", "2", "5", "10", "Other"]);
    expect(bt("Add 5 penalty runs")).toBeTruthy();
    expect(text()).toContain("6/0 becomes 11/0.");
    pick("Quick values", "10");
    expect(bt("Add 10 penalty runs")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Runs added/), { target: { value: "0" } });
    expect(screen.getByText("Type a whole number from 1 to 20.")).toBeTruthy();
    expect(bt("Fix the number to continue").hasAttribute("disabled")).toBe(true);
  });
  it("overs: a stepper that stops at the minimum, the minimum explained, the target stays in a banner", () => {
    const s = setup(chasing().runs(1, 1, 1, 1, 1));
    render(<OversSheet {...s.common} />);
    expect(text()).toContain("The target stays at 8 unless you enter a revised target");
    expect(text()).toContain("Minimum 1 because 0.5 overs are bowled.");
    const input = screen.getByRole("textbox", { name: "New overs per innings" }) as HTMLInputElement;
    expect(input.value).toBe("1");
    fireEvent.click(bt("More overs")); expect(input.value).toBe("2");
    fireEvent.click(bt("Fewer overs")); fireEvent.click(bt("Fewer overs")); expect(input.value).toBe("1");
    expect(bt("Fewer overs").hasAttribute("disabled")).toBe(true);
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getByText(/Overs must be a whole number from 1 to 50/)).toBeTruthy();
    expect(bt("Fix the overs to continue").hasAttribute("disabled")).toBe(true);
    fireEvent.change(input, { target: { value: "4" } });
    expect(text()).toContain("Change to 4 overs for this innings.");
    tap("All remaining innings");
    expect(text()).toContain("Change to 4 overs for all remaining innings.");
  });
  it("players per side: the stepper, and what it means for all out", () => {
    const s = setup(fresh());
    render(<PlayersSheet {...s.common} />);
    expect(text()).toContain("An innings ends when 6 wickets have fallen.");
    fireEvent.click(bt("More players"));
    expect(text()).toContain("An innings ends when 7 wickets have fallen.");
    fireEvent.change(screen.getByRole("textbox", { name: /Players per side/ }), { target: { value: "11" } });
    expect(bt("More players").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /Players per side/ }), { target: { value: "1" } });
    expect(screen.getByText("Players per side must be a whole number from 2 to 11.")).toBeTruthy();
    expect(bt("Fix the number to continue").hasAttribute("disabled")).toBe(true);
  });
  it("bowler limit: three option cards, the lock note, an inline error and a button that says what to fix", () => {
    const s = setup(fresh());
    render(<LimitSheet {...s.common} />);
    expect(text()).toContain("The limit is locked on the bowling screen.");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    fireEvent.click(screen.getByRole("radio", { name: /Pattern/ }));
    fireEvent.change(screen.getByLabelText("Over pattern"), { target: { value: "3" } });
    expect(screen.getByText(/A pattern needs at least two numbers/)).toBeTruthy();
    expect(bt("Fix the pattern to continue").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Over pattern"), { target: { value: "2-1-1" } });
    expect(bt("Set limit: pattern 2-1-1")).toBeTruthy();
  });
  it("revised target: the unit is shown, the original can be restored with one button, and 0 is refused", () => {
    const s = setup(chasing());
    render(<TargetSheet {...s.common} />);
    const field = screen.getByRole("textbox", { name: "Revised target" });
    expect(text()).toContain("runs");
    fireEvent.change(field, { target: { value: "0" } });
    expect(screen.getByText("Type a whole number from 1 to 999.")).toBeTruthy();
    expect(bt("Fix the target to continue").hasAttribute("disabled")).toBe(true);
    tap("Use the original target (8)");
    expect((field as HTMLInputElement).value).toBe("");
    expect(bt("Use the original target")).toBeTruthy();
  });
  it("end the innings: the team and the score, what happens next, and a full-width way back", () => {
    const s = setup(fresh().runs(4, 6, 1));
    render(<EndInningsSheet {...s.common} />);
    expect(text()).toContain("Thunder Strikers finish on 11/0");
    expect(text()).toContain("Royal Panthers then chase 12.");
    tap("Keep batting"); expect(s.close).toHaveBeenCalledTimes(1);
    expect(s.calls).toEqual([]);
  });
  it("end the match: nothing is recorded until ABANDON is typed; results need no typing; every outcome says what it does to the records", () => {
    const s = setup(fresh());
    render(<EndMatchSheet {...s.common} />);
    expect(text()).toContain("It cannot be undone here.");
    expect(text()).toContain("Not counted as a win, a loss or an appearance.");
    expect(text()).toContain("Counted in both teams' records.");
    const go = bt("Type ABANDON to continue");
    expect(go.hasAttribute("disabled")).toBe(true);
    fireEvent.click(go);
    expect(s.calls).toEqual([]);
    fireEvent.change(screen.getByLabelText(/Type ABANDON/), { target: { value: "abandon " } });
    tap("Abandon the match");
    expect(s.calls).toEqual([{ bodies: [{ type: "match_end", payload: { kind: "abandoned" } }], opts: { reason: "" } }]);
    cleanup();
    const t = setup(fresh());
    render(<EndMatchSheet {...t.common} />);
    fireEvent.click(screen.getByRole("radio", { name: /No result/ }));
    expect(screen.queryByLabelText(/Type ABANDON/)).toBeNull();
    tap("Finish: No result");
    expect(t.calls[0]!.bodies).toEqual([{ type: "match_end", payload: { kind: "result", winner: null } }]);
  });
  it("stop scoring: all saved gives a green banner and an outcome button; waiting balls give a calm orange banner and a disabled button", () => {
    const onConfirm = vi.fn();
    const close = vi.fn();
    render(<ReleaseSheet waiting={0} onConfirm={onConfirm} close={close} />);
    expect(text()).toContain("All changes are saved");
    tap("Stop scoring and hand over");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    cleanup();
    render(<ReleaseSheet waiting={3} onConfirm={onConfirm} close={close} />);
    expect(text()).toContain("3 changes are still saved only on this device");
    expect(text()).toContain("3 balls are still waiting to sync. Get a signal first, so nothing is lost.");
    const b = bt("Stop scoring (wait for sync)");
    expect(b.hasAttribute("disabled")).toBe(true);
    fireEvent.click(b);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    tap("Keep scoring"); expect(close).toHaveBeenCalled();
  });
});

describe("edit an earlier ball", () => {
  const sim = () => fresh().ball({ runs: 4 }).runs(1).ball({ wicket: { type: "caught", fielder: "b2" } }).batter("a3");
  it("lists the balls latest first with a visible edit icon; the innings switch is a control with two options", () => {
    const s = setup(sim());
    render(<EditSheet {...s.common} />);
    const rows = dialog().querySelectorAll("button.ps-ballrow");
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain("Caught");
    expect(rows[2]!.textContent).toContain("Four runs");
  });
  it("shows the before and after, and the save button says what changes", () => {
    const m = sim();
    const s = setup(m);
    render(<EditSheet {...s.common} initial={m.ballId(1)} />);
    pick("Quick runs", "6");
    expect(bt("Save the edit: 4 becomes 6")).toBeTruthy();
    expect(text()).toContain("Was 4 · will be 6.");
    expect(text()).toContain("The team score changes by +2.");
    pick("Wicket", "Caught");
    expect(bt("Pick the fielder to continue").hasAttribute("disabled")).toBe(true);
    pick("Fielder (required)", /Usman/);
    expect(bt("Save the edit: 4 becomes W")).toBeTruthy();
    tap("Back to the ball list");
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Edit an earlier ball");
  });
  it("a run count over 12 is refused with the engine's words", () => {
    const m = sim();
    const s = setup(m);
    render(<EditSheet {...s.common} initial={m.ballId(1)} />);
    fireEvent.change(screen.getByLabelText(/^Runs \(/), { target: { value: "13" } });
    expect(screen.getAllByText("Runs must be from 0 to 12.").length).toBeGreaterThan(0);
    expect(bt("Fix the runs to continue").hasAttribute("disabled")).toBe(true);
  });
});

describe("players: late player, retire, crease, order, substitute", () => {
  const members = [{ userId: "u1", name: "Yasir Farooq", number: 9 }, { userId: "u2", name: "Imran Javed", number: 33 }];
  it("late player: a searchable list of members with gold shirts, side buttons with team badges, a button that names the person and the side", () => {
    const s = setup(fresh());
    render(<LateSheet {...s.common} members={members} newId={() => "n1"} />);
    expect(bt("Choose a member").hasAttribute("disabled")).toBe(true);
    const list = within(screen.getByRole("group", { name: "Member" }));
    expect(list.getAllByRole("button")).toHaveLength(2);
    expect(dialog().querySelectorAll(".ps-row svg.shirt")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Find a member"), { target: { value: "imr" } });
    expect(within(screen.getByRole("group", { name: "Member" })).getAllByRole("button")).toHaveLength(1);
    pick("Member", /Imran/);
    expect(dialog().querySelectorAll(".team-badge")).toHaveLength(2);
    tap("Royal Panthers");
    tap("Add Imran Javed to Royal Panthers");
    expect(s.calls[0]!.bodies).toEqual([{ type: "player_added", payload: { player: { id: "n1", side: 2, name: "Imran Javed", number: 33, kind: "member", userId: "u2" } } }]);
  });
  it("late player: nobody left gives an empty state with two next steps", () => {
    const s = setup(fresh());
    render(<LateSheet {...s.common} members={[]} newId={() => "n1"} />);
    tap("A community member");
    expect(text()).toContain("Everyone in the community is already in this match.");
    tap("Raise players per side");
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Players per side");
  });
  it("late player: a guest is a name only (grey shirt), the button asks for the name, and a repeated guest name is refused early", () => {
    const sim = new Sim({}, 6, 6, true).startInnings();
    const s = setup(sim);
    render(<LateSheet {...s.common} members={[]} newId={() => "n1"} />);
    expect(text()).toContain("A guest is a name only: no player number and no profile.");
    expect(bt("Type the guest name").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(/Guest.s name/), { target: { value: "   " } });
    expect(screen.getByText("Type the guest's name.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Guest.s name/), { target: { value: "guest kamran" } });
    expect(screen.getByText("A guest with that name is already in this match.")).toBeTruthy();
    expect(bt("Use a different name").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(/Guest.s name/), { target: { value: "Ahmed" } });
    expect(bt("Add Ahmed to Thunder Strikers")).toBeTruthy();
  });
  it("late player: a full side gets a warning (the engine still decides)", () => {
    const s = setup(fresh());
    render(<LateSheet {...s.common} members={members} newId={() => "n1"} />);
    expect(text()).toContain("Thunder Strikers already has 6 players. Raise players per side first");
  });
  it("retire: four outcomes with their effect, and the button names the outcome", () => {
    const s = setup(fresh().runs(4, 1));
    render(<RetireSheet {...s.common} />);
    const kinds = within(screen.getByRole("group", { name: "What happened" }));
    for (const k of ["Retired hurt", "Retired out", "Absent", "Replaced"]) expect(kinds.getByRole("button", { name: k })).toBeTruthy();
    expect(text()).toContain("Saad Hussain leaves the crease, 0 (0) is kept, and can be chosen again later.");
    expect(bt("Confirm: Saad Hussain retired hurt")).toBeTruthy();
    pick("What happened", "Retired out");
    expect(text()).toContain("counts as a wicket");
    expect(bt("Confirm: Saad Hussain retired out")).toBeTruthy();
    pick("What happened", "Replaced");
    expect(screen.getByRole("group", { name: "Replaced by" })).toBeTruthy();
    pick("Replaced by", /Arsalan/);
    expect(bt("Confirm: Saad Hussain replaced")).toBeTruthy();
  });
  it("correct the batters: tiles, the warning stays visible, and the button describes the result", () => {
    const s = setup(fresh());
    render(<CreaseSheet {...s.common} />);
    expect(text()).toContain("use Retire instead");
    expect(bt("Save: Hamza Khan on strike, Saad Hussain at the other end")).toBeTruthy();
    pick("Non-striker", "Nobody (batting alone)");
    expect(bt("Save: Hamza Khan on strike, batting alone")).toBeTruthy();
    pick("Non-striker", /Hamza/);
    expect(bt("Pick two different batters").hasAttribute("disabled")).toBe(true);
  });
  it("batting order: numbered slots, the button lists the order, a repeated person is outlined and the button says to fix it", () => {
    const s = setup(fresh());
    render(<OrderSheet {...s.common} />);
    expect(bt("Save order: no preference")).toBeTruthy();
    pick("Next", /Arsalan/); pick("After that", /Owais/);
    expect(bt("Save order: Arsalan, Owais")).toBeTruthy();
    pick("After that", /Arsalan/);
    expect(screen.getByText("Each person can be listed once.")).toBeTruthy();
    expect(bt("Fix the duplicate to save").hasAttribute("disabled")).toBe(true);
    expect(dialog().querySelectorAll(".ps-grid.bad")).toHaveLength(2);
  });
  it("substitute: team badges on the side buttons, the button names the player and the side", () => {
    const s = setup(fresh());
    render(<SubSheet {...s.common} />);
    expect(bt("Type the substitute's name").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(/Substitute.s name/), { target: { value: "Danish" } });
    expect(bt("Note: Danish fielding for Royal Panthers")).toBeTruthy();
    expect(dialog().querySelectorAll(".team-badge")).toHaveLength(2);
  });
});

describe("the guide and the scorecard keep their content", () => {
  it("the five guide steps, skip, next and start", () => {
    const close = vi.fn();
    render(<GuideSheet close={close} />);
    const titles = ["Tap a number", "Wide, no ball, wicket, run out", "Undo is always there", "More has everything else", "No signal? Keep going"];
    titles.forEach((t, i) => {
      expect(screen.getByText(`How to score (${i + 1} of 5)`, { selector: "h2" })).toBeTruthy();
      expect(screen.getByText(t)).toBeTruthy();
      if (i < 4) tap("Next");
    });
    tap("Start scoring"); expect(close).toHaveBeenCalledTimes(1);
    cleanup();
    render(<GuideSheet close={close} />);
    tap("Skip the guide"); expect(close).toHaveBeenCalledTimes(2);
  });
  it("the scorecard opens in the same shell", () => {
    render(<ScorecardSheet m={fresh().runs(1, 4).state()} close={() => {}} />);
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Full scorecard");
    expect(dialog().textContent).toContain("Hamza Khan");
  });
});

describe("accessibility basics across the sheets", () => {
  it("every button in every sheet has a name, and every text field has a label", () => {
    const members = [{ userId: "u1", name: "Yasir Farooq", number: 9 }];
    const all: [string, React.ReactElement][] = [];
    const mk = (sim: Sim) => setup(sim).common;
    all.push(["out", <OutSheet key="o" {...mk(fresh())} />], ["bye", <ByeSheet key="b" {...mk(fresh())} />], ["batter", <BatterSheet key="bt" {...mk(afterWicket())} />],
      ["bowler", <BowlerSheet key="bw" {...mk(overDone())} title="Pick bowler for over 2" />], ["pen", <PenaltySheet key="p" {...mk(fresh())} />], ["retire", <RetireSheet key="r" {...mk(fresh())} />],
      ["overs", <OversSheet key="ov" {...mk(fresh())} />], ["players", <PlayersSheet key="pl" {...mk(fresh())} />], ["limit", <LimitSheet key="l" {...mk(fresh())} />],
      ["late", <LateSheet key="la" {...mk(fresh())} members={members} newId={() => "x"} />], ["crease", <CreaseSheet key="c" {...mk(fresh())} />], ["order", <OrderSheet key="or" {...mk(fresh())} />],
      ["sub", <SubSheet key="s" {...mk(fresh())} />], ["target", <TargetSheet key="t" {...mk(chasing())} />], ["endinn", <EndInningsSheet key="ei" {...mk(fresh())} />],
      ["endmatch", <EndMatchSheet key="em" {...mk(fresh())} />], ["edit", <EditSheet key="e" {...mk(fresh().runs(1))} />], ["guide", <GuideSheet key="g" close={() => {}} />],
      ["release", <ReleaseSheet key="rl" waiting={2} onConfirm={() => {}} close={() => {}} />]);
    for (const [name, el] of all) {
      render(el);
      for (const b of screen.getAllByRole("button")) {
        const named = (b.getAttribute("aria-label") ?? "").trim() || (b.textContent ?? "").trim() || b.getAttribute("aria-labelledby");
        expect(named, `${name}: a button without a name`).toBeTruthy();
      }
      for (const i of Array.from(dialog().querySelectorAll("input:not([type=radio])"))) {
        const el2 = i as HTMLInputElement;
        const labelled = el2.getAttribute("aria-label") || el2.id && document.querySelector(`label[for="${el2.id}"]`);
        expect(labelled, `${name}: an input without a label`).toBeTruthy();
      }
      cleanup();
    }
  });
});
