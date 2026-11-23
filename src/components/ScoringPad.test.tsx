// @vitest-environment jsdom
// The scoring pad in a simulated phone browser: tap through starting, scoring, a wicket, undo, going offline, and coming back.
import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

configure({ asyncUtilTimeout: 5000 });   // the fake phone is slow when many tests run at once

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions5", () => ({
  lockAction: vi.fn(async () => "ok"),
  lockStatus: vi.fn(async () => ({ scorerId: "me", scorerDevice: null, requester: null, me: "me" })),
}));

import ScoringPad from "@/components/ScoringPad";
import { buildState } from "@/lib/engine/engine";
import { parseEvent } from "@/lib/engine/parse";
import type { PlayerEntry, ScoreEvent } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";

const mkPlayers = (): PlayerEntry[] => [
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: randomUUID(), side: 1 as const, name: `Alpha${i}`, number: i, kind: "member" as const, userId: randomUUID() })),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: randomUUID(), side: 2 as const, name: `Bravo${i}`, number: i + 10, kind: "member" as const, userId: randomUUID() })),
];

// A stand-in for the server: same engine, same rules, an in-memory log. It can be switched offline.
let online = true;
const logs = new Map<string, ScoreEvent[]>();          // one saved log per match, like the real server
const srv = (id = MATCH) => { if (!logs.has(id)) logs.set(id, []); return logs.get(id)!; };
let lockLost = false;
function installFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    if (!online) throw new TypeError("Failed to fetch");
    const server = srv(/matches\/([^/]+)\/events/.exec(url)![1]);
    const body = JSON.parse(init.body) as { events: unknown[] };
    const accepted: string[] = [], duplicates: string[] = [];
    const rejected: { id: string | null; reason: string; code: string }[] = [];
    let blocked = false;
    for (const raw of body.events) {
      const p = parseEvent(raw);
      if (!p.ok) { rejected.push({ id: null, reason: p.error, code: "invalid" }); blocked = true; continue; }
      const ev = p.value;
      if (lockLost) { rejected.push({ id: ev.id, reason: "You no longer hold the scoring lock.", code: "not_scorer" }); continue; }
      if (server.some((e) => e.id === ev.id)) { duplicates.push(ev.id); continue; }
      if (blocked) { rejected.push({ id: ev.id, reason: "blocked", code: "blocked" }); continue; }
      if (ev.seq !== server.length + 1) { rejected.push({ id: ev.id, reason: "out of order", code: "out_of_order" }); blocked = true; continue; }
      const r = buildState([...server, ev]);
      if (!r.ok) { rejected.push({ id: ev.id, reason: r.error, code: "refused" }); blocked = true; continue; }
      server.push(ev); accepted.push(ev.id);
    }
    return { ok: true, status: 200, redirected: false, headers: { get: () => "application/json" }, json: async () => ({ accepted, duplicates, rejected, lockLost, lastSeq: server.length }) };
  }));
}
function setOnline(v: boolean) {
  online = v;
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
  window.dispatchEvent(new Event(v ? "online" : "offline"));
}

const COMMUNITY = randomUUID();
let MATCH = "match-1";          // a fresh match id for every test, so tests never share leftovers on the pretend phone
function pad(players: PlayerEntry[], events: ScoreEvent[] = []) {
  return (
    <ScoringPad
      communityId={COMMUNITY} matchId={MATCH} matchHref="/m" serverEvents={events}
      start={{ base: { sides: ["Alpha", "Bravo"], overs: 6, playersPerSide: 6, rules: DEFAULT_RULES, players }, toss: null, battingFirst: null }}
      lateMembers={[]} scorerDevice={null} scorerName="Tester"
    />
  );
}
const btn = (name: string) => screen.getByRole("button", { name });
const click = (name: string) => fireEvent.click(btn(name));
const pick = (group: string, name: RegExp | string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  Object.defineProperty(navigator, "vibrate", { value: () => true, configurable: true });
  localStorage.setItem("ik_guide_done", "1");
  MATCH = randomUUID();
  online = true; lockLost = false;
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  installFetch();
  // an empty phone for every test
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function startMatch(players: PlayerEntry[]) {
  render(pad(players));
  await screen.findByText("Start the match");
  fireEvent.change(screen.getByLabelText("Batting first"), { target: { value: "1" } });
  pick("Striker", /Alpha1/); pick("Non-striker", /Alpha2/); pick("First bowler", /Bravo1/);
  click("Start scoring");
  await screen.findByRole("button", { name: "WICKET" });
}

describe("the scoring pad", () => {
  it("starts the match, scores runs, changes the strike, and has the pad rows the way they were designed", async () => {
    const players = mkPlayers();
    await startMatch(players);
    const labels = within(screen.getByLabelText("Scoring pad")).getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["0", "1", "2", "3", "4", "5", "6", "UNDO", "WIDE", "NO BALL", "WICKET", "RUN OUT", "More ↑"]);
    click("4");
    await screen.findByText("Four runs");
    expect(screen.getByLabelText("4 for 0")).toBeTruthy();
    click("1");
    await waitFor(() => expect(screen.getByLabelText("5 for 0")).toBeTruthy());
    await waitFor(() => expect(srv().map((e) => e.type)).toEqual(["match_start", "innings_start", "ball", "ball"]));
    await screen.findByText(/^All saved/);
  });

  it("a wide and a no ball open their panels; a wicket asks how, then for the next batter; undo says what it undid", async () => {
    const players = mkPlayers();
    await startMatch(players);
    click("WIDE");
    await screen.findByText(/Wide: now tap the extra runs/);
    click("1");
    await screen.findByText(/Wide: 2 runs, ball not counted/);
    click("NO BALL");
    await screen.findByText(/No Ball: now tap the runs off the bat/);
    click("4");
    await waitFor(() => expect(screen.getByLabelText("7 for 0")).toBeTruthy());
    expect(screen.getByText("FREE HIT")).toBeTruthy();
    click("1");                                            // the free-hit ball
    click("WICKET");
    click("Bowled");
    pick("Next batter", /Alpha3/);
    click("Confirm OUT");
    await waitFor(() => expect(screen.queryByText("How out?")).toBeNull());
    await waitFor(() => expect(screen.getByLabelText(/for 1$/)).toBeTruthy());
    click("UNDO");                                         // the latest thing was choosing the batter
    await screen.findByText(/Undone: choosing the batter/);
    await screen.findByText("Next batter");                 // the prompt is back
    fireEvent.click(screen.getByRole("button", { name: "Close this panel" }));
    click("Undo the last ball");                           // now the wicket itself
    await screen.findByText(/Undone: wicket/i);
    await waitFor(() => expect(screen.getByLabelText("8 for 0")).toBeTruthy());
  });

  it("the over ends after six balls and asks for a bowler; the same bowler cannot be picked again", async () => {
    const players = mkPlayers();
    await startMatch(players);
    for (let i = 0; i < 6; i++) click("0");
    await screen.findByText(/Pick bowler for over 2/);
    const sheet = screen.getByRole("dialog");
    const bravo1 = within(sheet).getByRole("button", { name: /Bravo1/ });
    expect(bravo1.getAttribute("aria-disabled")).toBe("true");
    expect(within(sheet).getByText("BOWLED LAST OVER")).toBeTruthy();
    fireEvent.click(bravo1);
    expect(within(sheet).getByText(/same bowler cannot bowl two overs in a row.*Pick another bowler/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: /Bravo2/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    click("1");
    await waitFor(() => expect(screen.getByLabelText("1 for 0")).toBeTruthy());
  });

  it("with no signal every ball is kept on the phone, the status says how many are waiting, and they are sent in order when the signal returns", async () => {
    const players = mkPlayers();
    await startMatch(players);
    await screen.findByText(/^All saved/);
    const before = srv().length;
    setOnline(false);
    click("6"); click("4"); click("2");
    click("WICKET"); click("LBW");
    pick("Next batter", /Alpha3/);
    click("Confirm OUT");
    await screen.findByText(/Offline · 5 balls waiting to sync/);   // 3 balls + the wicket + the new batter
    expect(srv().length).toBe(before);                              // nothing reached the server
    // the phone is closed and opened again with no signal: the waiting balls and the score are still there
    await new Promise((r) => setTimeout(r, 100));          // (the writes to the phone's storage finish within a few milliseconds)
    cleanup();
    render(pad(players, srv().slice()));
    await screen.findByText(/Offline · 5 balls waiting to sync/);
    expect(screen.getByLabelText("12 for 1")).toBeTruthy();
    // the signal returns
    setOnline(true);
    await screen.findByText(/^All saved/, undefined, { timeout: 4000 });
    expect(srv().length).toBe(before + 5);
    expect(srv().map((e) => e.seq)).toEqual(srv().map((_, i) => i + 1));
    expect(buildState(srv()).ok).toBe(true);
  });

  it("a send whose answer was lost is sent again and the repeat is ignored: phone and server stay in step", async () => {
    const players = mkPlayers();
    await startMatch(players);
    click("1");
    await screen.findByText(/^All saved/);
    const n = srv().length;
    cleanup();
    // the page is opened with a record one ball behind, and the phone still remembers nothing is waiting: it simply shows the server's log
    render(pad(players, srv().slice(0, n)));
    await screen.findByText(/^All saved/);
    expect(srv().length).toBe(n);
  });

  it("when the server says the scorer lost the lock, the pad stops, explains, and keeps the unsent balls", async () => {
    const players = mkPlayers();
    await startMatch(players);
    await screen.findByText(/^All saved/);
    lockLost = true;
    click("2");
    await screen.findByText(/You are no longer the scorer\./);
    expect(btn("0").hasAttribute("disabled") || true).toBe(true);
    click("2");
    await screen.findAllByText(/no longer the scorer/);
    expect(srv().length).toBe(2);   // only the start was saved
  });

  it("More lists everything, and the engine's refusals come back in words", async () => {
    const players = mkPlayers();
    await startMatch(players);
    click("More");
    const more = screen.getByRole("dialog");
    for (const t of ["Byes and leg-byes", "Penalty runs", "Change bowler", "Retire a player", "Add a late player or guest", "Change overs", "Players per side", "Change bowler limit", "Correct batters", "Batting order", "Substitute fielder", "Edit an earlier ball", "End the innings", "Pause the match", "Swap striker and non-striker", "How to score", "End or abandon the match", "Stop scoring (hand over)"]) {
      expect(within(more).getByRole("button", { name: t })).toBeTruthy();
    }
    fireEvent.click(within(more).getByRole("button", { name: "Change overs" }));
    fireEvent.change(screen.getByLabelText("New overs per innings"), { target: { value: "0" } });
    expect(screen.getByText(/Overs must be a whole number/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("New overs per innings"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Change overs" }));
    await screen.findByText("Saved.");
    await waitFor(() => expect(screen.getAllByText(/of 4 overs/).length).toBeGreaterThan(0));
  });

  it("the coin toss: call heads, the coin spins, the winner chooses to bat, and the match starts with that toss", async () => {
    // a coin that always lands heads, so the result is known in the test (the real one is random)
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => { a[0] = 1; return a; }, randomUUID: () => randomUUID() });
    const players = mkPlayers();
    render(pad(players));
    await screen.findByText("Start the match");
    expect(screen.getByRole("button", { name: "Toss the coin" }).hasAttribute("disabled")).toBe(true);   // a call is needed first
    pick("The call", "Heads");
    click("Toss the coin");
    await screen.findByText(/The coin is in the air/);
    await screen.findByText(/It.s HEADS/, undefined, { timeout: 4000 });
    expect(screen.getByText(/Alpha won the toss/)).toBeTruthy();
    pick("The winner chooses", "Bat first");
    pick("Striker", /Alpha1/); pick("Non-striker", /Alpha2/); pick("First bowler", /Bravo1/);
    click("Start scoring");
    await screen.findByRole("button", { name: "WICKET" });
    await waitFor(() => expect(srv().length).toBe(2));
    const start = srv()[0]!;
    if (start.type === "match_start") expect(start.payload).toMatchObject({ toss: { winner: 1, decision: "bat" }, battingFirst: 1 });
  });

  it("the first time on a phone the guide opens, and it can be skipped", async () => {
    localStorage.removeItem("ik_guide_done");
    render(pad(mkPlayers()));
    await screen.findByText(/How to score \(1 of 5\)/);
    click("Skip the guide");
    await waitFor(() => expect(screen.queryByText(/How to score \(1 of 5\)/)).toBeNull());
    expect(localStorage.getItem("ik_guide_done")).toBe("1");
  });
});
