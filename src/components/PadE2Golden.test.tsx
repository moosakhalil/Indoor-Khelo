// @vitest-environment jsdom
// Phase E2 GOLDEN test for the pad's sheets. Every case taps through one sheet and records exactly what the sheet hands to
// `add` (the event bodies and the options, `then` chains and reasons included). The expected values in the snapshot file were
// recorded from the ORIGINAL (pre-redesign) PadSheets.tsx and must never change: a restyle may change how a sheet looks and how
// it is tapped, never what events it produces. (The taps below are for the redesigned sheets; the original taps are kept in the
// scratchpad copy PadE2Golden.OLD.test.tsx and produced the same snapshot.)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import {
  BatterSheet, BowlerSheet, ByeSheet, CreaseSheet, EditSheet, EndInningsSheet, EndMatchSheet, LateSheet, LimitSheet, OrderSheet, OutSheet,
  OversSheet, PenaltySheet, PlayersSheet, RetireSheet, SubSheet, TargetSheet, type Add,
} from "@/components/PadSheets";
import { currentInnings } from "@/lib/engine/engine";
import type { ScoreEventBody } from "@/lib/engine/types";
import { afterWicket, chasing, fresh, freeHitSim, lastBatter, midOver, overDone, Sim } from "./PadE2.fixture";

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
const golden = (calls: Call[]) => expect(JSON.stringify(calls, null, 1)).toMatchSnapshot();

/* ---------- wicket sheet ---------- */
describe("golden: the wicket sheet", () => {
  it("bowled, next batter picked", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Bowled"); pick("Next batter", /Talha/); tap("Confirm OUT");
    golden(s.calls); expect(s.close).toHaveBeenCalledTimes(1);
  });
  it("caught by the bowler, next batter picked", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Caught"); pick("Fielder", /Bilal/); pick("Next batter", /Owais/); tap("Confirm OUT");
    golden(s.calls);
  });
  it("stumped by the keeper, choose the next batter later", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Stumped"); pick("Fielder", /Usman/); tap("Choose later"); tap("Confirm OUT");
    golden(s.calls);
  });
  it("lbw and hit wicket", () => {
    for (const [kind, who] of [["LBW", /Arsalan/], ["Hit Wicket", /Noman/]] as const) {
      const s = setup(fresh());
      render(<OutSheet {...s.common} />);
      tap(kind); pick("Next batter", who); tap("Confirm OUT");
      golden(s.calls);
      cleanup();
    }
  });
  it("run out: the non-striker, 2 runs, on a wide, fielder, next batter at the non-striker's end", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Run Out");
    pick("Who is out", /Saad/); pick("Runs completed", "2"); pick("Wide or no ball", "Wide");
    pick("Fielder", /Faizan/); pick("Next batter", /Talha/); pick("Which end", /Non-striker/);
    tap("Confirm OUT");
    golden(s.calls);
  });
  it("run out from the RUN OUT key (preselected), striker, no runs, normal ball, suggested end", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} preset="run_out" />);
    pick("Fielder", /Moiz/); pick("Next batter", /Owais/);
    tap("Confirm OUT");
    golden(s.calls);
  });
  it("run out on a no ball with 1 run", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} preset="run_out" />);
    pick("Runs completed", "1"); pick("Wide or no ball", "No ball"); pick("Fielder", /Zain/); tap("Choose later");
    tap("Confirm OUT");
    golden(s.calls);
  });
  it("retired out: a retire event for the striker", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Retired out"); pick("Next batter", /Talha/); tap("Confirm OUT");
    golden(s.calls);
  });
  it("nothing chosen: confirm records nothing", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    const b = screen.queryByRole("button", { name: "Confirm OUT" });
    if (b && !b.hasAttribute("disabled")) fireEvent.click(b);
    expect(s.calls).toEqual([]); expect(s.close).not.toHaveBeenCalled();
  });
  it("caught with no fielder: confirm records nothing", () => {
    const s = setup(fresh());
    render(<OutSheet {...s.common} />);
    tap("Caught"); pick("Next batter", /Talha/);
    const b = screen.queryByRole("button", { name: "Confirm OUT" });
    if (b && !b.hasAttribute("disabled")) fireEvent.click(b);
    expect(s.calls).toEqual([]);
  });
  it("free hit: only run out can be picked", () => {
    const s = setup(freeHitSim());
    render(<OutSheet {...s.common} />);
    for (const k of ["Bowled", "Caught", "LBW", "Stumped", "Hit Wicket"]) expect(bt(k).hasAttribute("disabled")).toBe(true);
    expect(bt("Run Out").hasAttribute("disabled")).toBe(false);
    tap("Run Out"); pick("Fielder", /Bilal/); tap("Choose later"); tap("Confirm OUT");
    golden(s.calls);
  });
  it("kinds switched off in the rules: disabled, and Retired out is hidden", () => {
    const s = setup(new Sim({ dismissals: ["bowled", "caught", "run_out", "stumped"] }).startInnings());
    render(<OutSheet {...s.common} />);
    expect(bt("LBW").hasAttribute("disabled")).toBe(true);
    expect(bt("Hit Wicket").hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Retired out" })).toBeNull();
  });
  it("the last batter: there is no next-batter question", () => {
    const s = setup(lastBatter());
    render(<OutSheet {...s.common} />);
    expect(screen.queryByRole("group", { name: "Next batter" })).toBeNull();
    tap("Bowled"); tap("Confirm OUT");
    golden(s.calls);
  });
});

/* ---------- byes ---------- */
describe("golden: byes and leg-byes", () => {
  it("2 byes and 3 leg-byes", () => {
    for (const [kind, n, button] of [["Byes", "2", "Add 2 byes"], ["Leg-byes", "3", "Add 3 leg-byes"]] as const) {
      const s = setup(fresh());
      render(<ByeSheet {...s.common} />);
      tap(kind); pick("Runs run", n); tap(button);
      golden(s.calls); expect(s.close).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });
});

/* ---------- batter and bowler ---------- */
describe("golden: the next batter and the bowler", () => {
  it("the next batter at the vacant (striker's) end", () => {
    const s = setup(afterWicket());
    render(<BatterSheet {...s.common} />);
    pick("Next batter", /Talha/); tap(/^Confirm/);
    golden(s.calls);
  });
  it("the next batter at the non-striker's end", () => {
    const s = setup(afterWicket());
    render(<BatterSheet {...s.common} />);
    pick("Next batter", /Owais/); pick("Which end", /Non-striker/); tap(/^Confirm/);
    golden(s.calls);
  });
  it("players who are out or at the crease cannot be picked", () => {
    const s = setup(afterWicket());
    render(<BatterSheet {...s.common} />);
    const g = within(screen.getByRole("group", { name: "Next batter" }));
    expect(g.getByRole("button", { name: /Hamza/ }).hasAttribute("disabled")).toBe(true);
    expect(g.getByRole("button", { name: /Saad/ }).hasAttribute("disabled")).toBe(true);
    expect(g.getByRole("button", { name: /Talha/ }).hasAttribute("disabled")).toBe(false);
    expect(s.calls).toEqual([]);
  });
  it("the bowler for the next over: one tap on an allowed bowler records it", () => {
    const s = setup(overDone());
    render(<BowlerSheet {...s.common} title="Pick bowler for over 2" />);
    fireEvent.click(screen.getByRole("button", { name: /Usman/ }));
    golden(s.calls); expect(s.close).toHaveBeenCalledTimes(1);
  });
  it("the bowler who bowled the last over, and a bowler past the limit, record nothing", () => {
    const s = setup(overDone({ bowlerLimit: { mode: "max", overs: 1 } }));
    render(<BowlerSheet {...s.common} title="Pick bowler for over 2" />);
    fireEvent.click(screen.getByRole("button", { name: /Bilal/ }));
    expect(s.calls).toEqual([]); expect(s.close).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/Pick another bowler/);
  });
  it("changing the bowler in the middle of an over", () => {
    const s = setup(midOver());
    render(<BowlerSheet {...s.common} title="Change the bowler" />);
    fireEvent.click(screen.getByRole("button", { name: /Ali Raza/ }));
    golden(s.calls);
  });
});

/* ---------- changes during play ---------- */
describe("golden: changes during play", () => {
  it("penalty runs: the default, and 7 with a reason", () => {
    const a = setup(fresh());
    render(<PenaltySheet {...a.common} />);
    tap("Add 5 penalty runs"); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<PenaltySheet {...b.common} />);
    fireEvent.change(screen.getByLabelText(/Runs added/), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "slow over rate" } });
    tap("Add 7 penalty runs"); golden(b.calls);
  });
  it("penalty runs: 0 is refused", () => {
    const s = setup(fresh());
    render(<PenaltySheet {...s.common} />);
    fireEvent.change(screen.getByLabelText(/Runs added/), { target: { value: "0" } });
    expect(screen.getByText(/Type a whole number from 1 to 20/)).toBeTruthy();
    const b = screen.getByRole("button", { name: /penalty|Fix/i });
    expect(b.hasAttribute("disabled")).toBe(true);
    expect(s.calls).toEqual([]);
  });
  it("retire: retired hurt (the default), absent, replaced by someone", () => {
    const a = setup(fresh());
    render(<RetireSheet {...a.common} />);
    tap(/^Confirm/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<RetireSheet {...b.common} />);
    pick("Player, Thunder Strikers", /Owais/); pick("What happened", "Absent");
    tap(/^Confirm/); golden(b.calls); cleanup();
    const c = setup(fresh());
    render(<RetireSheet {...c.common} />);
    pick("Player, Thunder Strikers", /Owais/); pick("What happened", "Replaced"); pick("Replaced by", /Arsalan/);
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "went home" } });
    tap(/^Confirm/); golden(c.calls); cleanup();
    const d = setup(fresh());
    render(<RetireSheet {...d.common} />);
    pick("What happened", "Retired out");
    tap(/^Confirm/); golden(d.calls);
  });
  it("overs: 8 for the remaining innings with a reason, and the default", () => {
    const a = setup(fresh());
    render(<OversSheet {...a.common} />);
    fireEvent.change(screen.getByLabelText("New overs per innings"), { target: { value: "8" } });
    tap("All remaining innings"); fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "rain stopped play" } });
    tap(/^Change/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<OversSheet {...b.common} />);
    tap(/^Change/); golden(b.calls);
  });
  it("overs below what is already bowled is refused", () => {
    const s = setup(fresh().runs(1, 1, 1, 1, 1, 1).bowler("b2").runs(1, 1));
    render(<OversSheet {...s.common} />);
    fireEvent.change(screen.getByLabelText("New overs per innings"), { target: { value: "1" } });
    expect(screen.getByText(/Overs must be a whole number from 2 to 50\. 1\.2 overs are already bowled/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Change|Fix/ }).hasAttribute("disabled")).toBe(true);
  });
  it("players per side: 7, and 12 is refused", () => {
    const a = setup(fresh());
    render(<PlayersSheet {...a.common} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Players per side/ }), { target: { value: "7" } });
    tap(/^Save/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<PlayersSheet {...b.common} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Players per side/ }), { target: { value: "12" } });
    expect(screen.getByText(/whole number from 2 to 11/)).toBeTruthy();
    expect(b.calls).toEqual([]);
  });
  it("bowler limit: none, maximum 2, pattern 2-1-1 (with a reason); the pattern 3 is refused", () => {
    const a = setup(fresh({ bowlerLimit: { mode: "max", overs: 3 } }));
    render(<LimitSheet {...a.common} />);
    fireEvent.click(screen.getByRole("radio", { name: /No limit/ }));
    tap(/^Set limit/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<LimitSheet {...b.common} />);
    fireEvent.click(screen.getByRole("radio", { name: /Maximum overs per bowler/ }));
    fireEvent.change(screen.getByLabelText("Maximum overs"), { target: { value: "2" } });
    tap(/^Set limit/); golden(b.calls); cleanup();
    const c = setup(fresh());
    render(<LimitSheet {...c.common} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pattern/ }));
    fireEvent.change(screen.getByLabelText("Over pattern"), { target: { value: "2-1-1" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "agreed before the toss" } });
    tap(/^Set limit/); golden(c.calls); cleanup();
    const d = setup(fresh());
    render(<LimitSheet {...d.common} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pattern/ }));
    fireEvent.change(screen.getByLabelText("Over pattern"), { target: { value: "3" } });
    expect(screen.getByText(/at least two numbers/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fix the pattern to continue" }).hasAttribute("disabled")).toBe(true);
    expect(d.calls).toEqual([]);
  });
  it("late player: a member joins Royal Panthers; a guest joins Thunder Strikers; an empty guest name adds nothing", () => {
    const members = [{ userId: "u-yasir", name: "Yasir Farooq", number: 9 }, { userId: "u-imran", name: "Imran Javed", number: 33 }];
    const a = setup(new Sim({}, 6, 6).startInnings());
    a.m.playersPerSide = 8;   // room on both sides (the sheet itself does not check this: the engine does)
    render(<LateSheet {...a.common} members={members} newId={() => "new-1"} />);
    pick("Member", /Yasir/);
    tap("Royal Panthers"); tap("Add Yasir Farooq to Royal Panthers"); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<LateSheet {...b.common} members={members} newId={() => "new-2"} />);
    tap("A guest (name only)");
    expect((bt("Type the guest name") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Guest.s name/), { target: { value: "  Ahmed  " } });
    tap("Add Ahmed to Thunder Strikers"); golden(b.calls); expect(b.close).toHaveBeenCalledTimes(1);
  });
  it("correct the batters: striker Talha with Saad, then Hamza with nobody (batting alone)", () => {
    const a = setup(fresh());
    render(<CreaseSheet {...a.common} />);
    pick("Striker", /Talha/);
    tap(/^Save/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<CreaseSheet {...b.common} />);
    pick("Non-striker", "Nobody (batting alone)");
    tap(/^Save/); golden(b.calls);
  });
  it("batting order: Arsalan then Owais; the same person twice is refused", () => {
    const a = setup(fresh());
    render(<OrderSheet {...a.common} />);
    pick("Next", /Arsalan/); pick("After that", /Owais/);
    tap(/^Save order/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<OrderSheet {...b.common} />);
    pick("Next", /Arsalan/); pick("After that", /Arsalan/);
    expect(screen.getByText("Each person can be listed once.")).toBeTruthy();
    expect(b.calls).toEqual([]);
  });
  it("substitute fielder: Danish for Royal Panthers (the default), and for Thunder Strikers", () => {
    const a = setup(fresh());
    render(<SubSheet {...a.common} />);
    fireEvent.change(screen.getByLabelText(/Substitute.s name/), { target: { value: " Danish " } });
    tap(/^Note/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<SubSheet {...b.common} />);
    fireEvent.change(screen.getByLabelText(/Substitute.s name/), { target: { value: "Danish" } });
    tap(/Thunder Strikers/); tap(/^Note/); golden(b.calls);
  });
  it("revised target: 55, empty (back to the original) and 0 (refused)", () => {
    const a = setup(chasing());
    render(<TargetSheet {...a.common} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Revised target" }), { target: { value: "55" } });
    tap("Save target: 55"); golden(a.calls); cleanup();
    const b = setup(chasing());
    render(<TargetSheet {...b.common} />);
    tap("Use the original target"); golden(b.calls); cleanup();
    const c = setup(chasing());
    render(<TargetSheet {...c.common} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Revised target" }), { target: { value: "0" } });
    expect(screen.getByText("Type a whole number from 1 to 999.")).toBeTruthy();
    expect(c.calls).toEqual([]);
  });
  it("end the innings, with and without a reason", () => {
    const a = setup(fresh().runs(4, 2));
    render(<EndInningsSheet {...a.common} />);
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "declared" } });
    tap(/^Yes, end/); golden(a.calls); cleanup();
    const b = setup(fresh());
    render(<EndInningsSheet {...b.common} />);
    tap(/^Yes, end/); golden(b.calls);
  });
});

/* ---------- ending the match ---------- */
describe("golden: ending the match early (each outcome)", () => {
  const drive = (label: RegExp, typed?: string, reason?: string) => {
    const s = setup(fresh());
    render(<EndMatchSheet {...s.common} />);
    if (reason) fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: reason } });
    endMatchDriver(label, typed);
    golden(s.calls); expect(s.close).toHaveBeenCalledTimes(1);
    cleanup();
  };
  it("abandon, thunder won, panthers won, no result", () => {
    drive(/Abandon the match/, "ABANDON", "ground flooded");
    drive(/Thunder Strikers won/);
    drive(/Royal Panthers won/);
    drive(/No result/);
  });
});
/** Redesigned sheet: choose the outcome, type ABANDON for an abandon, then press the outcome button (the original had one button per outcome). */
function endMatchDriver(label: RegExp, typed?: string) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  if (typed) fireEvent.change(screen.getByLabelText(/Type ABANDON/), { target: { value: typed } });
  tap(typed ? /^Abandon the match$/ : /^Finish:/);
}

/* ---------- editing an earlier ball ---------- */
describe("golden: editing an earlier ball", () => {
  const sim = () => fresh().ball({ runs: 4 }).runs(1).ball({ wicket: { type: "caught", fielder: "b2" } }).batter("a3");
  it("change the first ball from 4 to 6 with a reason", () => {
    const s = setup(sim());
    render(<EditSheet {...s.common} />);
    fireEvent.click(screen.getAllByText("4").find((e) => e.classList.contains("ball"))!.closest("button")!);
    fireEvent.change(screen.getByLabelText(/^Runs \(/), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "mis-tap" } });
    tap(/^Save the edit/); golden(s.calls);
  });
  it("open on a given ball (from the over strip): make it a wide with 1 run", () => {
    const sm = sim();
    const s = setup(sm);
    render(<EditSheet {...s.common} initial={sm.ballId(2)} />);
    pick("Kind of ball", "Wide");
    tap(/^Save the edit/); golden(s.calls);
  });
  it("make the third ball a run out of the non-striker caught by Usman; a caught needs a fielder", () => {
    const sm = sim();
    const s = setup(sm);
    render(<EditSheet {...s.common} initial={sm.ballId(3)} />);
    pick("Wicket", "Run out");
    pick("Batter out", /Saad/);
    expect((screen.getByRole("button", { name: "Pick the fielder to continue" }) as HTMLButtonElement).disabled).toBe(true);
    pick("Fielder (required)", /Usman/);
    tap(/^Save the edit/); golden(s.calls);
  });
  it("a wicket removed from the third ball", () => {
    const sm = sim();
    const s = setup(sm);
    render(<EditSheet {...s.common} initial={sm.ballId(3)} />);
    tap(/^Save the edit/); golden(s.calls);
  });
});
