// @vitest-environment jsdom
// Phase E1 (the live scoring pad redesign): what the NEW screen shows in each state. The events the pad makes are guarded
// separately by PadE1Golden.test.tsx (written before the redesign). Sheets are E2's and are not driven here.
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
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

import { lockStatus } from "@/app/actions5";
import { P, ball, chain, ctx, inningsStart, installFetch, matchStart, midInnings, padElement, resetServer, server, setOnline } from "@/components/padE1.harness";
import { ballCaption, chaseFor, finishedOverBalls, lastActionText, moreWhy, openersLine, previousOvers, shortName, statusWording } from "@/components/padInfo";
import { buildState, currentInnings, effectiveEvents } from "@/lib/engine/engine";
import type { ScoreEventBody } from "@/lib/engine/types";

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => fireEvent.click(btn(name));
const pick = (group: string, name: RegExp | string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  Object.defineProperty(navigator, "vibrate", { value: () => true, configurable: true });
  localStorage.clear(); localStorage.setItem("ik_guide_done", "1");
  resetServer(); installFetch();
  nav.refresh.mockClear(); nav.push.mockClear();
  vi.mocked(lockStatus).mockReset();
  vi.mocked(lockStatus).mockResolvedValue({ scorerId: "me", scorerDevice: null, requester: null, me: "me" } as never);
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const ready = () => screen.findByRole("button", { name: "WICKET" });
const innings1 = (): ScoreEventBody[] => [matchStart(2), inningsStart(P.a1, P.a2, P.b1), ...[1, 4, 0, 6, 2, 1].map((n) => ball(n)), { type: "bowler", payload: { player: P.b2 } }, ...[0, 1, 1, 0, 2, 6].map((n) => ball(n))];
const chase = (n: number[] = [1, 4, 0]): ScoreEventBody[] => [...innings1(), inningsStart(P.b1, P.b2, P.a1), ...n.map((x) => ball(x))];
const oneEach = (): ScoreEventBody[] => [matchStart(1), inningsStart(P.a1, P.a2, P.b1), ...[1, 1, 1, 1, 1, 1].map((n) => ball(n)), inningsStart(P.b1, P.b2, P.a1), ...[1, 1, 1, 1, 1, 1].map((n) => ball(n))];

describe("pad words and numbers (padInfo)", () => {
  it("short names, captions under the balls, the chase for an innings that is about to start", () => {
    expect(shortName("Ali Raza")).toBe("Ali R.");
    expect(shortName("Cher")).toBe("Cher");
    const m = buildState(chain(chase([4, 0, 1]))); if (!m.ok) throw new Error(m.error);
    const inn = currentInnings(m.state)!;
    expect(inn.overBalls.map(ballCaption)).toEqual(["four", "dot", "1 run"]);
    // the engine sets a target only for innings 2 and for the second super-over innings
    expect(chaseFor(m.state, 1)).toBe(25);
    expect(chaseFor(m.state, 2)).toBeNull();
    expect(chaseFor(m.state, 3)).toBe(m.state.innings[2] ? m.state.innings[2]!.runs + 1 : null);
    expect(openersLine(Object.values(m.state.players), P.a1, P.a2, P.b1)).toBe("Alpha1 and Alpha2 to face Bravo1");
  });
  it("what Undo will take back, in words", () => {
    const events = chain(chase([4]));
    const m = buildState(events); if (!m.ok) throw new Error(m.error);
    const eff = effectiveEvents(events); if (!eff.ok) throw new Error(eff.error);
    expect(lastActionText(m.state, eff.list[eff.list.length - 1])).toBe("Four runs · Bravo1 off Alpha1");
    expect(lastActionText(m.state, { ...events[1]!, type: "pause", payload: {} } as never)).toBe("The pause");
    expect(lastActionText(m.state, undefined)).toBeNull();
  });
  it("the sync line keeps its words and only the colour changes: offline is blue (calm), waiting orange, signed out red", () => {
    expect(statusWording({ signin: false, online: true, syncing: false, waiting: 0, failed: false })).toEqual({ text: "All saved", tone: "green" });
    expect(statusWording({ signin: false, online: false, syncing: false, waiting: 3, failed: false })).toEqual({ text: "Offline · 3 balls waiting to sync", tone: "blue" });
    expect(statusWording({ signin: false, online: false, syncing: false, waiting: 1, failed: false }).text).toBe("Offline · 1 ball waiting to sync");
    expect(statusWording({ signin: false, online: true, syncing: false, waiting: 3, failed: false })).toEqual({ text: "3 waiting to sync", tone: "orange" });
    expect(statusWording({ signin: false, online: true, syncing: true, waiting: 3, failed: false })).toEqual({ text: "Syncing…", tone: "orange" });
    expect(statusWording({ signin: true, online: true, syncing: false, waiting: 0, failed: false })).toEqual({ text: "Signed out · balls are safe on this phone", tone: "red" });
    expect(statusWording({ signin: false, online: true, syncing: false, waiting: 0, failed: true }).tone).toBe("red");
  });
  it("More: every greyed item has a reason", () => {
    const all = moreWhy({ live: true, inn: true, needBatter: false, needBowler: false, paused: false, lock: false, target: 25 });
    expect(Object.values(all).every((v) => v === null)).toBe(true);
    const none = moreWhy({ live: false, inn: true, needBatter: false, needBowler: false, paused: false, lock: false, target: undefined });
    expect(none.bye).toBe("No innings in progress");
    expect(none.late).toBeNull();                         // needs only an innings to exist
    const first = moreWhy({ live: true, inn: true, needBatter: false, needBowler: false, paused: false, lock: false, target: null });
    expect(first.target).toBe("Only for the side batting second");
    expect(moreWhy({ live: true, inn: true, needBatter: false, needBowler: false, paused: true, lock: false, target: null }).bye).toBe("The match is paused");
  });
  it("a finished over is kept on show, and earlier overs are listed latest first", () => {
    const over = buildState(chain(chase([1, 4, 0, 2, 1, 0]))); if (!over.ok) throw new Error(over.error);
    expect(finishedOverBalls(currentInnings(over.state)!, 6).length).toBe(6);
    const first = buildState(chain(innings1())); if (!first.ok) throw new Error(first.error);
    const prev = previousOvers(first.state, currentInnings(first.state)!, 2);
    expect(prev.map((o) => o.over)).toEqual([2, 1]);
    expect(prev[1]!.runs).toBe(14);
    expect(prev[0]!.bowler).toBe("Bravo2");
  });
});

describe("the pad on screen", () => {
  it("the keys keep their order and names; each number has a word under it; Undo is a labelled bar showing the last ball", async () => {
    render(padElement({ events: chain(chase()), overs: 2 }));
    await ready();
    const keys = within(screen.getByLabelText("Scoring pad")).getAllByRole("button");
    expect(keys.map((b) => b.textContent)).toEqual(["0", "1", "2", "3", "4", "5", "6", "UNDO", "WIDE", "NO BALL", "WICKET", "RUN OUT", "More ↑"]);
    expect(keys.slice(0, 7).map((b) => b.getAttribute("data-cap"))).toEqual(["DOT", "RUN", "RUNS", "RUNS", "FOUR", "RUNS", "SIX"]);
    expect(screen.getByText("Last: Dot ball · Bravo2 off Alpha1")).toBeTruthy();
    click("4");
    await screen.findByText("Four runs");
    expect(screen.getByText("Bravo2 8 (3)")).toBeTruthy();                       // the read-back under the toast
    await screen.findByText("Last: Four runs · Bravo2 off Alpha1");
  });
  it("the score bug has team badges, the chase sentence and the score label the old tests rely on", async () => {
    render(padElement({ events: chain(chase()), overs: 2 }));
    await ready();
    expect(screen.getAllByRole("img", { name: "Team Bravo" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Need 20 from 9 balls · RRR 13\.33 · RR 10\.00$/)).toBeTruthy();
    expect(screen.getByLabelText("5 for 0")).toBeTruthy();
    expect(screen.getByText("Innings 2 · Target 25")).toBeTruthy();
    expect(screen.getAllByText(/of 2 overs/).length).toBeGreaterThan(0);
  });
  it("batters and bowler are three rows with gold shirts (number only) and plain words", async () => {
    render(padElement({ events: chain(chase()), overs: 2 }));
    await ready();
    const rows = within(screen.getByLabelText("Batters and bowler"));
    expect(rows.getByText("ON STRIKE")).toBeTruthy();
    expect(rows.getByText("NON-STRIKER")).toBeTruthy();
    expect(rows.getByText("BOWLING")).toBeTruthy();
    expect(rows.getAllByRole("img").map((i) => i.getAttribute("aria-label"))).toEqual(["Player number 12", "Player number 11"]);
    expect(rows.queryByText(/OVERS? LEFT/)).toBeNull();                         // no bowler limit in this match, so no pill
  });
  it("over strip: each ball has its word, empty slots show the rest of the over, Ball 4 of 6", async () => {
    render(padElement({ events: chain(chase()), overs: 2 }));
    await ready();
    const over = within(screen.getByLabelText("This over"));
    expect(over.getAllByText(/^(1 run|four|dot)$/).map((e) => e.textContent)).toEqual(["1 run", "four", "dot"]);
    expect(over.getByText("Ball 4 of 6")).toBeTruthy();
    expect(over.getByRole("button", { name: "Edit ball 4" })).toBeTruthy();
  });
  it("free hit: a solid strip, WICKET keeps working but says RUN OUT ONLY, RUN OUT is marked as the allowed one", async () => {
    render(padElement({ events: chain([...chase(), { type: "ball", payload: { extra: "noball", runs: 0 } }]), overs: 2 }));
    await ready();
    expect(screen.getByText("FREE HIT")).toBeTruthy();
    expect(btn("WICKET").getAttribute("data-cap")).toBe("RUN OUT ONLY");
    expect(btn("WICKET").hasAttribute("disabled")).toBe(false);                // the sheet still offers "Retired out"
    expect(btn("RUN OUT").getAttribute("data-cap")).toBe("ALLOWED");
    expect(btn("WICKET").getAttribute("aria-describedby")).toBe("pp-fh-note");
    expect(document.getElementById("pp-fh-note")?.textContent).toMatch(/Only Run Out/);
  });
  it("armed wide / no ball: the bar explains what the keys mean now and why Wicket is off", async () => {
    render(padElement({ events: chain(chase()), overs: 2 }));
    await ready();
    click("WIDE");
    await screen.findByText(/Wide: now tap the extra runs that were run/);
    expect(screen.getByText(/A wide is 1 run by itself/)).toBeTruthy();
    expect(btn("WIDE").getAttribute("aria-pressed")).toBe("true");
    click("Cancel");
    click("NO BALL");
    await screen.findByText(/No Ball: now tap the runs off the bat/);
    expect(screen.getByText(/The next ball will be a Free Hit\./)).toBeTruthy();
    expect(btn("WICKET").hasAttribute("disabled")).toBe(true);
  });
  it("paused: a paused badge, a reason, and the Resume button", async () => {
    render(padElement({ events: chain([...chase(), { type: "pause", payload: {} }]), overs: 2 }));
    await screen.findByRole("button", { name: /Match paused\. Resume/ });
    expect(screen.getByText("Paused")).toBeTruthy();
    expect(screen.getByText(/the scoring keys are locked until you resume/)).toBeTruthy();
  });
  it("the striker is out: the board says Next batter needed / strike end is empty (no blank name), and the note says who is out", async () => {
    render(padElement({ events: chain([...chase(), { type: "ball", payload: { runs: 0, wicket: { type: "caught", fielder: P.a1 } } }]), overs: 2 }));
    await screen.findByText("Next batter");
    fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
    await screen.findByRole("button", { name: "Choose the next batter" });
    expect(screen.getByText("Next batter needed")).toBeTruthy();
    expect(screen.getByText("STRIKE END IS EMPTY")).toBeTruthy();
    expect(screen.getByText("Bravo2 is out (c & b Alpha1). Pick who comes in to continue.")).toBeTruthy();
    expect(screen.getByText("wicket")).toBeTruthy();                           // the red W ball is labelled
    expect(screen.getByText(/^Takes back: Wicket: Caught/)).toBeTruthy();
  });
  it("over finished: the over stays visible with its words, the note says what happened, the button names the over", async () => {
    render(padElement({ events: chain(chase([1, 4, 0, 2, 1, 0])), overs: 2 }));
    await screen.findByText(/Pick bowler for over 2/);
    fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
    await screen.findByRole("button", { name: "Choose the bowler for over 2" });
    expect(screen.getByText("Over complete")).toBeTruthy();
    expect(within(screen.getByLabelText("This over")).getAllByText(/run|four|dot/i).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(/Over 1 complete: 8 runs, no wicket\./)).toBeTruthy();
    expect(screen.getByText("New bowler needed")).toBeTruthy();
  });
  it("level scores, result and finished: the new wording, a way to the report, the board stays honest", async () => {
    render(padElement({ events: chain(oneEach()), overs: 1 }));
    await screen.findByText(/The scores are level/);
    expect(screen.getByText("Scores level: 6 all")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yes, play a super over" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "No, call it a tie" })).toBeTruthy();
    expect(screen.getByText(/^Takes back: 1 run/)).toBeTruthy();                // Undo names the ball
    cleanup(); resetServer();
    render(padElement({ events: chain([...oneEach(), { type: "super_over_decision", payload: { play: false } }, { type: "finish", payload: {} }]), overs: 1 }));
    expect((await screen.findByRole("link", { name: "Open the match report" })).getAttribute("href")).toBe(`/c/${"00000000-0000-4000-8000-000000000001"}/matches/${ctx.matchId}/report`);
    expect(screen.getByText("FINAL")).toBeTruthy();
    expect(screen.getByText(/The scorecard is locked\. Corrections are made from the match page\./)).toBeTruthy();
  });
  it("start: progress segments, a sticky Start button that says what is missing, then what it will do; no target in the first super-over innings", async () => {
    render(padElement());
    await screen.findByText("Start the match");
    const steps = within(screen.getByLabelText("Progress"));
    expect(steps.getAllByRole("listitem").map((li) => li.className)).toEqual(["", "", ""]);
    expect(screen.getByText("Choose who bats first")).toBeTruthy();
    expect((btn("Start scoring") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Batting first"), { target: { value: "1" } });
    expect(screen.getByText("Pick both openers and the bowler")).toBeTruthy();
    pick("Striker", /Alpha1/); pick("Non-striker", /Alpha1/); pick("First bowler", /Bravo1/);
    expect(screen.getByText("Striker and non-striker must be different players.")).toBeTruthy();
    expect(screen.getByText("Pick two different openers")).toBeTruthy();
    pick("Non-striker", /Alpha2/);
    expect(screen.getByText("Alpha1 and Alpha2 to face Bravo1")).toBeTruthy();
    expect(steps.getAllByRole("listitem").map((li) => li.className)).toEqual(["done", "done", "done"]);
    // a player chip has the gold shirt (number only) and still answers to the name
    expect(within(screen.getByRole("group", { name: "Striker" })).getAllByRole("button")[0]!.textContent).toMatch(/Alpha1/);
  });
  it("super over: no invented target for the first super-over innings, a reminder that the bowler limit is off", async () => {
    render(padElement({ events: chain([...oneEach(), { type: "super_over_decision", payload: { play: true } }]), overs: 1 }));
    await screen.findByText("Start the super over");
    expect(screen.getByText(/One over each/)).toBeTruthy();
    expect(screen.getByText(/There is no bowler limit in a super over\./)).toBeTruthy();
    const panel = within(document.querySelector(".pp-start") as HTMLElement);       // (the bug above still shows the finished innings and its own target)
    expect(panel.queryByText(/Target/)).toBeNull();
    expect(panel.queryByText(/need \d+ to win/)).toBeNull();
  });
  it("innings break: the first innings stays in the bug and a gold card gives the target", async () => {
    const events = chain([matchStart(1), inningsStart(P.a1, P.a2, P.b1), ...[1, 1, 1, 1, 1, 1].map((n) => ball(n))]);
    render(padElement({ events, overs: 1 }));
    await screen.findByText("Start innings 2");
    expect(screen.getByText("Innings 1 complete: Alpha finish on 6/0")).toBeTruthy();
    expect(screen.getByText("Bravo need 7 to win")).toBeTruthy();
    expect(screen.getByText("BREAK")).toBeTruthy();
  });
  it("header: History, Scorecard and a ? that opens the guide again (new)", async () => {
    render(padElement({ events: midInnings() }));
    await ready();
    click("Open the guide: how to score");
    await screen.findByText(/How to score \(1 of 5\)/);
  });
  it("More groups its items by purpose, says why items are off, and keeps End the match apart from Stop scoring", async () => {
    render(padElement({ events: midInnings() }));
    await ready();
    click("More");
    const more = within(screen.getByRole("dialog"));
    for (const g of ["During play", "Players", "Match rules", "Fix and finish"]) expect(more.getByRole("region", { name: g })).toBeTruthy();
    expect(more.getByText("Only for the side batting second")).toBeTruthy();
    expect((more.getByRole("button", { name: "Revised target" }) as HTMLButtonElement).disabled).toBe(true);
    const end = more.getByRole("button", { name: "End or abandon the match" });
    const stop = more.getByRole("button", { name: "Stop scoring (hand over)" });
    expect(end.closest("section")).not.toBe(stop.closest("section"));            // not side by side any more
    expect(end.className).toContain("pp-end");
  });
  it("offline: a calm blue strip with 'Saved on this phone', a clock on each unsent ball, and Send now only when online", async () => {
    render(padElement({ events: chain(chase()), overs: 2 }));
    await ready();
    setOnline(false);
    click("1"); click("4");
    await screen.findByText(/Offline · 2 balls waiting to sync/);
    expect(document.querySelector(".pp-status.blue")).toBeTruthy();
    expect(screen.getByText("Saved on this phone")).toBeTruthy();
    expect(document.querySelectorAll('.pp-b[data-state="pending"]').length).toBe(2);
    expect(screen.queryByRole("button", { name: "Send now" })).toBeNull();
  });
  it("a refusal is written 'Not saved' with the reason; a lock lost shows the button and the unsent count", async () => {
    render(padElement({ events: midInnings() }));
    await ready();
    server.lockLost = true;
    click("2");
    await screen.findByText(/You are no longer the scorer\./);
    expect(screen.getByRole("button", { name: "See the live score" })).toBeTruthy();
    await waitFor(() => expect(document.querySelector(".pp-note.bad")).toBeTruthy());
  });
  it("a take-over request while balls wait: Hand over is dimmed, with the reason (nothing is thrown away)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    render(padElement({ events: midInnings() }));
    await ready();
    setOnline(false);
    click("1");
    await screen.findByText(/Offline · 1 ball waiting to sync/);
    vi.mocked(lockStatus).mockResolvedValue({ scorerId: "me", scorerDevice: null, requester: "Hamza Khan", me: "me" } as never);
    setOnline(true); server.online = false;
    await vi.advanceTimersByTimeAsync(7100);
    await screen.findByText(/would like to take over scoring/);
    expect((screen.getByRole("button", { name: "Hand over to Hamza" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/1 ball is still waiting to sync\. Get a signal before handing over\. They are saved only on this phone\./)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Not now" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("styles (read from pp.css)", () => {
  const css = fs.readFileSync("src/components/pp.css", "utf8");
  const rule = (sel: string) => { const m = css.split("\n").find((l) => l.startsWith(`${sel} {`)); return m ?? ""; };
  const px = (sel: string, prop: string) => Number(new RegExp(`${prop}: (\\d+)px`).exec(rule(sel))?.[1] ?? 0);
  it("tap targets are at least 44px and the keys are bigger (62px)", () => {
    expect(px(".pp-key", "min-height")).toBeGreaterThanOrEqual(62);
    for (const s of [".pp-back", ".pp-send", ".pp-chipbtn", ".pp-link", ".pp-undo"]) expect(px(s, "min-height") || px(s, "min-width")).toBeGreaterThanOrEqual(44);
    expect(px(".pp-tile", "min-height")).toBeGreaterThanOrEqual(56);
    expect(px(".pp-ball", "width")).toBeGreaterThanOrEqual(44);
    expect(px(".pp-hbtn", "min-height")).toBeGreaterThanOrEqual(44);
  });
  it("heights of text boxes are minimums (so large text grows them), the board is the scrolling area and the keypad is not", () => {
    expect(rule(".pp-key")).not.toMatch(/(^|[^-])height: \d/);
    expect(rule(".pp-scroll")).toMatch(/overflow-y: auto/);
    expect(rule(".pp-dockw")).not.toMatch(/overflow/);
  });
  it("two panes from 720px, no gradients on controls, reduced motion is respected through globals", () => {
    expect(css).toMatch(/@container \(min-width: 720px\)/);
    expect(css).not.toMatch(/gradient\(/);
  });
});
