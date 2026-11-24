// @vitest-environment jsdom
// Phase E1 GOLDEN TESTS for the live scoring pad. They record the events (type, order, payload, reason) and the server calls
// the pad makes for a list of taps. They were written and run BEFORE the pad was restyled; the snapshot file next to this test
// is what the old code produced. If a redesign ever changes it, the redesign changed what the scorer records: fix the redesign.
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

configure({ asyncUtilTimeout: 6000 });

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions5", () => ({
  lockAction: vi.fn(async () => "ok"),
  lockStatus: vi.fn(async () => ({ scorerId: "me", scorerDevice: null, requester: null, me: "me" })),
}));

import { lockAction, lockStatus } from "@/app/actions5";
import { readOutbox } from "@/lib/outbox";
import { AT, P, ball, chain, ctx, inningsStart, installFetch, made, matchStart, midInnings, padElement, resetServer, server, setOnline, srv } from "@/components/padE1.harness";
import type { ScoreEventBody } from "@/lib/engine/types";

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => fireEvent.click(btn(name));
const pick = (group: string, name: RegExp | string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));
/** Byes sheet: works with the old sheet (buttons "2 byes") and the redesigned one (kind, runs, "Add 2 byes"). Only the way in differs; the event is what is compared. */
function playBye(kind: "bye" | "legbye", n: number) {
  const word = kind === "bye" ? `bye${n === 1 ? "" : "s"}` : `leg-bye${n === 1 ? "" : "s"}`;
  const old = screen.queryByRole("button", { name: `${n} ${word}` });
  if (old) { fireEvent.click(old); return; }
  if (kind === "legbye") click("Leg-byes");
  pick("Runs run", String(n));
  click(new RegExp(`^Add ${n} ${word}$`));
}

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  Object.defineProperty(navigator, "vibrate", { value: () => true, configurable: true });
  localStorage.clear();
  localStorage.setItem("ik_guide_done", "1");
  resetServer();
  nav.refresh.mockClear(); nav.push.mockClear();
  vi.mocked(lockAction).mockClear();
  vi.mocked(lockStatus).mockReset();
  vi.mocked(lockStatus).mockResolvedValue({ scorerId: "me", scorerDevice: null, requester: null, me: "me" } as never);
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  installFetch();
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

/** Taps one thing, waits until the server has everything, and returns what was made. */
async function tapAndRecord(el: React.ReactElement, already: number, taps: () => void | Promise<void>, expectCount: number) {
  render(el);
  await screen.findByRole("button", { name: "0" }).catch(() => undefined);
  await taps();
  await waitFor(() => expect(srv(ctx.matchId).length).toBe(already + expectCount));
  return made(ctx.matchId, already);
}

describe("GOLDEN: events made by the pad (must not change in the redesign)", () => {
  it("start the match: batting first chosen, openers and bowler, Start scoring", async () => {
    render(padElement());
    await screen.findByText("Start the match");
    fireEvent.change(screen.getByLabelText("Batting first"), { target: { value: "1" } });
    pick("Striker", /Alpha1/); pick("Non-striker", /Alpha2/); pick("First bowler", /Bravo1/);
    click("Start scoring");
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(2));
    const got = made(ctx.matchId, 0);
    expect(got.map((e) => e.type)).toEqual(["match_start", "innings_start"]);
    expect(got).toMatchSnapshot();
    expect(lockAction).toHaveBeenCalledWith(expect.any(String), ctx.matchId, "claim", expect.any(String));
  });

  it("start the match with the toss entered by hand (Bravo won, chose to bowl): Alpha bat", async () => {
    render(padElement());
    await screen.findByText("Start the match");
    click("The toss was already done: enter the result by hand");
    fireEvent.change(screen.getByLabelText("Toss won by"), { target: { value: "2" } });
    expect(screen.getByText("Choose what the toss winner decided.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Chose to"), { target: { value: "bowl" } });
    pick("Striker", /Alpha3/); pick("Non-striker", /Alpha4/); pick("First bowler", /Bravo5/);
    click("Start scoring");
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(2));
    expect(made(ctx.matchId, 0)).toMatchSnapshot();
  });

  it("start refuses the same player as striker and non-striker: nothing is made", async () => {
    render(padElement());
    await screen.findByText("Start the match");
    fireEvent.change(screen.getByLabelText("Batting first"), { target: { value: "2" } });
    pick("Striker", /Bravo1/); pick("Non-striker", /Bravo1/); pick("First bowler", /Alpha1/);
    expect(screen.getByText("Striker and non-striker must be different players.")).toBeTruthy();
    expect((btn("Start scoring") as HTMLButtonElement).disabled).toBe(true);
    pick("Non-striker", /Bravo2/);
    expect((btn("Start scoring") as HTMLButtonElement).disabled).toBe(false);
    click("Start scoring");
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(2));
    expect(made(ctx.matchId, 0)).toMatchSnapshot();   // side 2 bats: Bravo1/Bravo2 face Alpha1
  });

  it("0 1 2 3 4 5 6 with the new bowler after the over", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      for (const n of ["0", "1", "2", "3", "4", "5"]) click(n);
      await screen.findByText(/Pick bowler for over 2/);
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Bravo2/ }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      click("6");
    }, 8);
    expect(got.map((e) => e.type)).toEqual(["ball", "ball", "ball", "ball", "ball", "ball", "bowler", "ball"]);
    expect(got).toMatchSnapshot();
  });

  it("wide with runs, just the wide, no ball with runs, then a cancelled wide makes nothing", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      click("WIDE"); await screen.findByText(/Wide: now tap the extra runs/);
      expect(btn("WICKET").hasAttribute("disabled")).toBe(true);
      expect(btn("RUN OUT").hasAttribute("disabled")).toBe(true);
      click("1");
      await screen.findByText(/Wide: 2 runs, ball not counted/);
      click("WIDE"); click("Just the wide");
      await screen.findByText(/Wide: 1 run, ball not counted/);
      click("NO BALL"); await screen.findByText(/No Ball: now tap the runs off the bat/);
      click("4");
      await screen.findByText("FREE HIT");
      click("WIDE"); click("Cancel");                       // nothing recorded
      click("0");                                            // the free hit ball
    }, 4);
    expect(got.map((e) => e.type)).toEqual(["ball", "ball", "ball", "ball"]);
    expect(got).toMatchSnapshot();
  });

  it("wicket bowled with the next batter, then a second wicket caught (fielder), made as ball + batter_in", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      click("WICKET"); click("Bowled");
      pick("Next batter", /Alpha3/);
      click("Confirm OUT");
      await waitFor(() => expect(screen.queryByText("How out?")).toBeNull());
      click("WICKET"); click("Caught");
      pick("Fielder", /Bravo4/);
      pick("Next batter", /Alpha4/);
      click("Confirm OUT");
      await waitFor(() => expect(screen.queryByText("How out?")).toBeNull());
    }, 4);
    expect(got.map((e) => e.type)).toEqual(["ball", "batter_in", "ball", "batter_in"]);
    expect(got).toMatchSnapshot();
  });

  it("RUN OUT: who is out, runs completed, the fielder and the next batter", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      click("RUN OUT");
      pick("Who is out", /Alpha2/);
      pick("Runs completed", "1");
      pick("Fielder", /Bravo3/);
      pick("Next batter", /Alpha5/);
      click("Confirm OUT");
      await waitFor(() => expect(screen.queryByText("How out?")).toBeNull());
    }, 2);
    expect(got.map((e) => e.type)).toEqual(["ball", "batter_in"]);
    expect(got).toMatchSnapshot();
  });

  it("UNDO several times (the ball, then the one before), straight after the innings start too", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      click("4"); await screen.findByText("Four runs");
      click("UNDO"); await screen.findByText(/Undone: four runs/);
      click("1"); await waitFor(() => expect(screen.getByLabelText("1 for 0")).toBeTruthy());
      click("2"); await waitFor(() => expect(screen.getByLabelText("3 for 0")).toBeTruthy());
      click("UNDO"); await screen.findByText(/Undone: 2 runs/);
      click("UNDO"); await screen.findByText(/Undone: 1 run/);
      click("UNDO"); await screen.findByText(/^Undone: /);
    }, 7);
    expect(got.map((e) => e.type)).toEqual(["ball", "undo", "ball", "ball", "undo", "undo", "undo"]);
    expect(got).toMatchSnapshot();
  });

  it("More: pause, resume (from the paused bar), swap strike", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      click("More"); click("Pause the match");
      await screen.findByRole("button", { name: /Match paused\. Resume/ });
      expect(btn("0").hasAttribute("disabled")).toBe(true);
      click(/Match paused\. Resume/);
      await waitFor(() => expect((btn("0") as HTMLButtonElement).disabled).toBe(false));
      click("More"); click("Swap striker and non-striker");
    }, 3);
    expect(got.map((e) => e.type)).toEqual(["pause", "resume", "swap_strike"]);
    expect(got).toMatchSnapshot();
  });

  it("More: Pause then Resume the match from the same menu item", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      click("More"); click("Pause the match");
      await screen.findByRole("button", { name: /Match paused\. Resume/ });
      click("More"); click("Resume the match");
    }, 2);
    expect(got.map((e) => e.type)).toEqual(["pause", "resume"]);
  });

  it("More: byes and leg-byes (sheet) make a ball with the extra kind and runs", async () => {
    const start = midInnings();
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      click("More"); click("Byes and leg-byes");
      playBye("bye", 2);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      click("More"); click("Byes and leg-byes");
      playBye("legbye", 1);
    }, 2);
    expect(got).toMatchSnapshot();
  });

  it("More: every item opens its own sheet (or acts), and Stop scoring waits for a signal", async () => {
    const start = midInnings();
    render(padElement({ events: start }));
    await screen.findByRole("button", { name: "WICKET" });
    const items: [string, string][] = [
      ["Byes and leg-byes", "Byes and leg-byes"], ["Penalty runs", "Penalty runs"], ["Change bowler", "Change the bowler"],
      ["Retire a player", "Retire a player"], ["Add a late player or guest", "Add a late player"], ["Change overs", "Change the overs"],
      ["Players per side", "Players per side"], ["Change bowler limit", "Change the bowler limit"], ["Correct batters", "Correct the batters"],
      ["Batting order", "Batting order"], ["Substitute fielder", "Substitute fielder"], ["Edit an earlier ball", "Edit an earlier ball"],
      ["End the innings", "End the innings now?"], ["End or abandon the match", "End the match early"],
      ["Stop scoring (hand over)", "Stop scoring?"], ["How to score", "How to score (1 of 5)"],
    ];
    for (const [item, title] of items) {
      click("More");
      click(item);
      const dlg = await screen.findByRole("dialog", { name: title });
      expect(dlg).toBeTruthy();
      fireEvent.click(screen.getAllByRole("button", { name: "Close this panel" })[0]!);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    // revised target is off in the first innings
    click("More");
    expect((btn("Revised target") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Stop scoring: releases the lock and goes to the match page", async () => {
    render(padElement({ events: midInnings() }));
    await screen.findByRole("button", { name: "WICKET" });
    click("More"); click("Stop scoring (hand over)");
    click("Stop scoring and hand over");
    await waitFor(() => expect(lockAction).toHaveBeenCalledWith(expect.any(String), ctx.matchId, "release", expect.any(String)));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/m"));
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("the next batter prompt dismissed: Choose the next batter opens it again and the choice makes batter_in", async () => {
    const start = midInnings([{ type: "ball", payload: { runs: 0, wicket: { type: "bowled" } } }]);
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      await screen.findByText("Next batter");
      fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
      click("Choose the next batter");
      pick("Next batter", /Alpha3/);
      click(/^Confirm/);
    }, 1);
    expect(got).toMatchSnapshot();
  });

  it("needing a batter: Undo the last ball takes the wicket back", async () => {
    const start = midInnings([{ type: "ball", payload: { runs: 0, wicket: { type: "bowled" } } }]);
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      await screen.findByText("Next batter");
      fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
      click("Undo the last ball");
    }, 1);
    expect(got).toMatchSnapshot();
  });

  it("an over finished, the bowler prompt dismissed: Choose the bowler for the next over, Undo the last ball", async () => {
    const start = midInnings([0, 1, 2, 0, 1, 0].map((n) => ball(n)));
    render(padElement({ events: start }));
    await screen.findByText(/Pick bowler for over 2/);
    fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
    click(/^Choose the bowler for over 2/);
    await screen.findByRole("dialog", { name: /Pick bowler for over 2/ });
    fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
    click("Undo the last ball");
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(start.length + 1));
    expect(made(ctx.matchId, start.length)).toMatchSnapshot();
  });

  it("paused match from the server: the Resume bar makes a resume, the keys stay locked until then", async () => {
    const start = midInnings([{ type: "pause", payload: {} }]);
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      expect((btn("0") as HTMLButtonElement).disabled).toBe(true);
      click(/Match paused\. Resume/);
    }, 1);
    expect(got).toMatchSnapshot();
  });

  it("free hit: the banner is shown and the next ball clears it", async () => {
    const start = midInnings([{ type: "ball", payload: { extra: "noball", runs: 0 } }]);
    const got = await tapAndRecord(padElement({ events: start }), start.length, async () => {
      expect(screen.getByText("FREE HIT")).toBeTruthy();
      click("6");
    }, 1);
    expect(got).toMatchSnapshot();
    await waitFor(() => expect(screen.queryByText("FREE HIT")).toBeNull());
  });

  /* ---------- between innings, level scores, super over, result ---------- */
  const oneOverEach = (): ScoreEventBody[] => [matchStart(1), inningsStart(P.a1, P.a2, P.b1), ...[1, 1, 1, 1, 1, 1].map((n) => ball(n))];

  it("innings break: openers and bowler for innings 2 make innings_start", async () => {
    const start = chain(oneOverEach());
    render(padElement({ events: start, overs: 1 }));
    await screen.findByText("Start innings 2");
    expect(screen.getByText(/Bravo need 7 to win/)).toBeTruthy();
    pick("Striker", /Bravo1/); pick("Non-striker", /Bravo2/); pick("First bowler", /Alpha1/);
    click("Start the innings");
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(start.length + 1));
    expect(made(ctx.matchId, start.length)).toMatchSnapshot();
  });

  const levelUp = (): ScoreEventBody[] => [...oneOverEach(), inningsStart(P.b1, P.b2, P.a1), ...[1, 1, 1, 1, 1, 1].map((n) => ball(n))];

  it("scores level: Yes, super over", async () => {
    const start = chain(levelUp());
    render(padElement({ events: start, overs: 1 }));
    await screen.findByText(/The scores are level/);
    click("Yes, play a super over");
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(start.length + 1));
    expect(made(ctx.matchId, start.length)).toMatchSnapshot();
    await screen.findByText("Start the super over");
    pick("Striker", /Bravo3/); pick("Non-striker", /Bravo4/); pick("First bowler", /Alpha2/);
    click("Start the innings");
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(start.length + 2));
    expect(made(ctx.matchId, start.length + 1)).toMatchSnapshot();
  });

  it("scores level: No, it is a tie, then Finish the match; Undo is offered at each step", async () => {
    const start = chain(levelUp());
    render(padElement({ events: start, overs: 1 }));
    await screen.findByText(/The scores are level/);
    click("No, call it a tie");
    await screen.findByRole("button", { name: /^Finish match/ });
    click("Undo the last action");
    await screen.findByText(/The scores are level/);
    click("No, call it a tie");
    await screen.findByRole("button", { name: /^Finish match/ });
    click(/^Finish match/);
    await waitFor(() => expect(srv(ctx.matchId).length).toBe(start.length + 4));
    expect(made(ctx.matchId, start.length).map((e) => e.type)).toEqual(["super_over_decision", "undo", "super_over_decision", "finish"]);
    expect(made(ctx.matchId, start.length)).toMatchSnapshot();
    await screen.findByText("Back to the match");
  });

  it("the match is already finished: the result is shown with a way back", async () => {
    const start = chain([...levelUp(), { type: "super_over_decision", payload: { play: false } }, { type: "finish", payload: {} }]);
    render(padElement({ events: start, overs: 1 }));
    const back = await screen.findByRole("link", { name: "Back to the match" });
    expect(back.getAttribute("href")).toBe("/m");
    expect(srv(ctx.matchId).length).toBe(start.length);
  });

  /* ---------- offline, held balls, the lock ---------- */
  it("offline: balls are kept on the phone, nothing is sent, and they go in order when the signal returns", async () => {
    const start = midInnings();
    render(padElement({ events: start }));
    await screen.findByRole("button", { name: "WICKET" });
    setOnline(false);
    click("6"); click("4"); click("2");
    await screen.findByText(/Offline · 3 balls waiting to sync/);
    expect(srv(ctx.matchId).length).toBe(start.length);
    expect((await readOutbox(ctx.matchId)).map((i) => i.seq)).toEqual([start.length + 1, start.length + 2, start.length + 3]);
    setOnline(true);
    await screen.findByText(/^All saved/, undefined, { timeout: 6000 });
    expect(made(ctx.matchId, start.length)).toMatchSnapshot();
    expect(await readOutbox(ctx.matchId)).toEqual([]);
  });

  it("the server refuses a ball: it is held (never dropped), the fix sheet lists it, Try again keeps it, Discard removes it and refreshes", async () => {
    const start = midInnings();
    render(padElement({ events: start }));
    await screen.findByRole("button", { name: "WICKET" });
    server.refuseAll = true;
    click("1"); click("2");
    await screen.findByText(/not accepted by the server/, undefined, { timeout: 6000 });
    await screen.findByRole("dialog", { name: "Balls the server did not accept" });
    expect(screen.getAllByText(/The server refused this ball \(test\)\./).length).toBe(1);
    click("Try sending them again");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByText(/not accepted by the server/, undefined, { timeout: 6000 });
    expect((await readOutbox(ctx.matchId)).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: /^Fix \d+ balls?/ }));
    click(/^Discard \d+ balls?/);
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    await waitFor(async () => expect(await readOutbox(ctx.matchId)).toEqual([]));
    expect(srv(ctx.matchId).length).toBe(start.length);
  });

  it("lock lost: the keys stop, nothing more is made, See the live score refreshes", async () => {
    const start = midInnings();
    render(padElement({ events: start }));
    await screen.findByRole("button", { name: "WICKET" });
    server.lockLost = true;
    click("2");
    await screen.findByText(/You are no longer the scorer\./);
    expect((btn("0") as HTMLButtonElement).disabled).toBe(true);
    click("See the live score");
    expect(nav.refresh).toHaveBeenCalled();
    expect(srv(ctx.matchId).length).toBe(start.length);
  });

  it("another phone holds the lock: the keys say so, Move scoring to this phone takes it", async () => {
    render(padElement({ events: midInnings(), scorerDevice: "some-other-phone" }));
    await screen.findByText(/You are scoring this match on another phone/);
    expect((btn("0") as HTMLButtonElement).disabled).toBe(true);
    click("Move scoring to this phone");
    await waitFor(() => expect(lockAction).toHaveBeenCalledWith(expect.any(String), ctx.matchId, "take", expect.any(String)));
    await waitFor(() => expect(screen.queryByText(/You are scoring this match on another phone/)).toBeNull());
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("someone asks to take over: Hand over accepts, Not now declines (asked every 7 seconds)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.mocked(lockStatus).mockResolvedValue({ scorerId: "me", scorerDevice: null, requester: "Hamza Khan", me: "me" } as never);
    render(padElement({ events: midInnings() }));
    await screen.findByRole("button", { name: "WICKET" });
    await vi.advanceTimersByTimeAsync(7100);
    await screen.findByText(/would like to take over scoring/);
    click("Not now");
    await waitFor(() => expect(lockAction).toHaveBeenCalledWith(expect.any(String), ctx.matchId, "decline", expect.any(String)));
    await waitFor(() => expect(screen.queryByText(/would like to take over scoring/)).toBeNull());
    await vi.advanceTimersByTimeAsync(7100);
    await screen.findByText(/would like to take over scoring/);
    click(/^Hand over/);
    await waitFor(() => expect(lockAction).toHaveBeenCalledWith(expect.any(String), ctx.matchId, "accept", expect.any(String)));
    await screen.findByText(/You are no longer the scorer\./);
  });

  it("a take-over request while balls are waiting: no Hand over button, the reason is written", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    render(padElement({ events: midInnings() }));
    await screen.findByRole("button", { name: "WICKET" });
    setOnline(false);
    click("1"); click("1"); click("1");
    await screen.findByText(/Offline · 3 balls waiting to sync/);
    vi.mocked(lockStatus).mockResolvedValue({ scorerId: "me", scorerDevice: null, requester: "Hamza Khan", me: "me" } as never);
    setOnline(true);                                      // lockStatus is asked only with a signal; the balls are still waiting at this instant
    server.online = false;                                // ...but the server cannot be reached, so they stay waiting
    await vi.advanceTimersByTimeAsync(7100);
    await screen.findByText(/would like to take over scoring/);
    expect(screen.getByText(/3 balls are still waiting to sync\. Get a signal before handing over\./)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Hand over/ }) as HTMLButtonElement).disabled).toBe(true);   // still there, dimmed, with the reason written
  });

  it("signed out: the balls are kept and the Sign in again link is there", async () => {
    render(padElement({ events: midInnings() }));
    await screen.findByRole("button", { name: "WICKET" });
    server.status = 401;
    click("1");
    await screen.findByText(/Your sign-in ran out/);
    expect(screen.getByRole("link", { name: /Sign in/ }).getAttribute("href")).toBe("/");
    await screen.findByText(/Signed out · balls are safe on this phone/);
    expect((await readOutbox(ctx.matchId)).length).toBe(1);
  });

  it("History opens the edit sheet, a ball in the over strip opens it on that ball, Scorecard opens the scorecard", async () => {
    const start = midInnings([ball(4)]);
    render(padElement({ events: start }));
    await screen.findByRole("button", { name: "WICKET" });
    click("History");
    await screen.findByRole("dialog", { name: "Edit an earlier ball" });
    fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit ball 4" }));
    await screen.findByRole("dialog", { name: "Edit this ball" });
    fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
    click("Scorecard");
    await screen.findByRole("dialog", { name: "Full scorecard" });
  });

  it("the guide opens by itself the first time and is marked done when closed", async () => {
    localStorage.removeItem("ik_guide_done");
    render(padElement({ events: midInnings() }));
    await screen.findByText(/How to score \(1 of 5\)/);
    click("Skip the guide");
    await waitFor(() => expect(screen.queryByText(/How to score/)).toBeNull());
    expect(localStorage.getItem("ik_guide_done")).toBe("1");
  });
});

void AT;
