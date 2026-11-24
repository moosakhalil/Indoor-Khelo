// @vitest-environment jsdom
// Phase E2: the redesigned sheets inside the REAL scoring pad (real engine, real add chain, no signal): the events they make are accepted and
// the score on the pad moves. (The exact event bodies are pinned by PadE2Golden.test.tsx.)
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

configure({ asyncUtilTimeout: 5000 });

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions5", () => ({
  lockAction: vi.fn(async () => "ok"),
  lockStatus: vi.fn(async () => ({ scorerId: "me", scorerDevice: null, requester: null, me: "me" })),
}));

import ScoringPad from "@/components/ScoringPad";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { fresh, players, SIDES, Sim } from "./PadE2.fixture";

let n = 0;
function pad(sim: Sim) {
  n += 1;
  const start = sim.events[0]!;
  if (start.type !== "match_start") throw new Error("fixture");
  return (
    <ScoringPad
      communityId="c1" matchId={`pad-${n}`} matchHref="/m" serverEvents={sim.events}
      start={{ base: { sides: SIDES, overs: 6, playersPerSide: 6, rules: DEFAULT_RULES, players: players() }, toss: null, battingFirst: null }}
      lateMembers={[]} scorerDevice={null} scorerName="Tester"
    />
  );
}
const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => fireEvent.click(btn(name));
const pick = (group: string, name: RegExp | string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  Object.defineProperty(navigator, "vibrate", { value: () => true, configurable: true });
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  localStorage.setItem("ik_guide_done", "1");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));   // no signal at all
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("the redesigned sheets inside the real pad, with no signal", () => {
  it("byes from More: two tabs, a run chip, an outcome button: the team score and the strike move", async () => {
    render(pad(fresh()));
    await screen.findByRole("button", { name: "WICKET" });
    click("More");
    click("Byes and leg-byes");
    click("Leg-byes"); pick("Runs run", "3"); click("Add 3 leg-byes");
    await waitFor(() => expect(screen.getByLabelText("3 for 0")).toBeTruthy());
    expect(screen.queryByRole("dialog")).toBeNull();
    await screen.findByText(/Offline · 1 ball waiting to sync/);
  });

  it("a caught wicket: the sheet reads the dismissal back, then Confirm OUT records the wicket and the next batter", async () => {
    render(pad(fresh()));
    await screen.findByRole("button", { name: "WICKET" });
    click("WICKET");
    click("Caught");
    pick("Fielder", /Usman/);
    pick("Next batter", /Talha/);
    expect(screen.getByText(/Out: Hamza Khan c Usman Tariq b Bilal Ahmed/)).toBeTruthy();
    click("Confirm OUT");
    await waitFor(() => expect(screen.getByLabelText("0 for 1")).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByText(/Offline · 2 balls waiting to sync/);   // the wicket and the new batter
    expect(screen.queryByRole("button", { name: "Choose the next batter" })).toBeNull();
  });

  it("an edit of an earlier ball from the history: pick the ball, set it again, save: the score changes", async () => {
    render(pad(fresh().ball({ runs: 4 }).ball({ runs: 1 })));
    await screen.findByRole("button", { name: "WICKET" });
    expect(screen.getByLabelText("5 for 0")).toBeTruthy();
    click("History");
    const first = Array.from(document.querySelectorAll("button.ps-ballrow")).find((b) => b.textContent?.includes("Four runs"))!;
    fireEvent.click(first);
    pick("Quick runs", "6");
    click(/^Save the edit: 4 becomes 6/);
    await waitFor(() => expect(screen.getByLabelText("7 for 0")).toBeTruthy());
  });

  it("the bowler for the next over: one tap on an allowed bowler still records it; the one who just bowled is refused with a reason", async () => {
    render(pad(fresh().runs(0, 0, 0, 0, 0, 0)));
    await screen.findByText(/Pick bowler for over 2/);
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /Bilal/ }));
    expect(within(sheet).getByRole("alert").textContent).toMatch(/Pick another bowler/);
    fireEvent.click(within(sheet).getByRole("button", { name: /Usman/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    click("2");
    await waitFor(() => expect(screen.getByLabelText("2 for 0")).toBeTruthy());
  });
});
