// @vitest-environment jsdom
// A match made on a phone with no signal: set up from the roster kept on the phone, scored, and created on the server
// (then its balls sent in order) when the signal returns. A match the server refuses stays on the phone with the reason.
import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

configure({ asyncUtilTimeout: 5000 });
const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }), useSearchParams: () => new URLSearchParams(search) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions5", () => ({
  lockAction: vi.fn(async () => "ok"),
  lockStatus: vi.fn(async () => null),    // the match is not on the server yet
}));

import QuickMatchForm from "@/components/QuickMatchForm";
import QuickScore from "@/components/QuickScore";
import { buildState } from "@/lib/engine/engine";
import { parseEvent } from "@/lib/engine/parse";
import type { ScoreEvent } from "@/lib/engine/types";
import { flushAllWaiting, readNewMatch, readNewMatches, readOutbox, saveNewMatch, saveRoster, type NewMatchItem } from "@/lib/outbox";

const COMMUNITY = randomUUID();
const ME = randomUUID();
const P = { ali: randomUUID(), bob: randomUUID(), cara: randomUUID(), dan: randomUUID(), eve: randomUUID() };
const roster = () => ({
  communityId: COMMUNITY, me: ME, savedAt: Date.now() - 3600_000,
  members: [
    { id: P.ali, name: "Ali", number: 1, role: "batter" }, { id: P.bob, name: "Bob", number: 2, role: null }, { id: P.cara, name: "Cara", number: 3, role: null },
    { id: P.dan, name: "Dan", number: 4, role: null }, { id: P.eve, name: "Eve", number: 5, role: null },
  ],
  teams: [{ id: randomUUID(), name: "Regulars", squad: [P.ali, P.bob] }],
});

// A stand-in for the server: creating a match, then taking its events in order. It records the order of everything it was asked.
let online = true;
let createMode: "ok" | "refuse" = "ok";
let calls: string[] = [];
const created = new Map<string, Record<string, unknown>>();
const logs = new Map<string, ScoreEvent[]>();
function installFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    if (!online) throw new TypeError("Failed to fetch");
    const body = JSON.parse(init.body);
    const json = (status: number, data: unknown) => ({ ok: status < 300, status, redirected: false, headers: { get: () => "application/json" }, json: async () => data });
    if (url === "/api/matches/create") {
      calls.push("create");
      if (createMode === "refuse") return json(422, { ok: false, message: "A player in this match is no longer a member of the community." });
      const dup = created.has(body.match.id);
      created.set(body.match.id, body.match);
      return json(200, { ok: true, duplicate: dup });
    }
    const matchId = /matches\/([^/]+)\/events/.exec(url)![1]!;
    calls.push("events");
    if (!created.has(matchId)) return json(404, { error: "not_found" });
    const log = logs.get(matchId) ?? logs.set(matchId, []).get(matchId)!;
    const accepted: string[] = [], rejected: { id: string | null; reason: string; code: string }[] = [];
    let blocked = false;
    for (const raw of body.events) {
      const p = parseEvent(raw);
      if (!p.ok) { rejected.push({ id: null, reason: p.error, code: "invalid" }); blocked = true; continue; }
      if (blocked || p.value.seq !== log.length + 1 || !buildState([...log, p.value]).ok) { rejected.push({ id: p.value.id, reason: "refused", code: "refused" }); blocked = true; continue; }
      log.push(p.value); accepted.push(p.value.id);
    }
    return json(200, { accepted, duplicates: [], rejected, lockLost: false, lastSeq: log.length });
  }));
}
function setOnline(v: boolean) {
  online = v;
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
  window.dispatchEvent(new Event(v ? "online" : "offline"));
}

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  Object.defineProperty(navigator, "vibrate", { value: () => true, configurable: true });
  localStorage.setItem("ik_guide_done", "1");
  online = true; createMode = "ok"; calls = []; created.clear(); logs.clear(); push.mockClear(); search = "";
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  installFetch();
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const side = (who: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: `${who}: which side` })).getByRole("button", { name: `${who}: ${label}` }));
const pick = (group: string, name: RegExp | string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));

async function setUpForm() {
  await saveRoster(roster());
  render(<QuickMatchForm communityId={COMMUNITY} fallback={null} />);
  await screen.findByText(/Players last updated/);
}
async function fillAndStart() {
  side("Ali", "Team 1"); side("Bob", "Team 1"); side("Cara", "Team 2"); side("Dan", "Team 2");
  fireEvent.click(btn("Start scoring"));
  await waitFor(() => expect(push).toHaveBeenCalled());
  const url = push.mock.calls[0]![0] as string;
  expect(url).toMatch(new RegExp(`^/c/${COMMUNITY}/matches/quick/score\\?m=[0-9a-f-]{36}$`));
  return url.split("m=")[1]!;
}

describe("a new match with no signal", () => {
  it("is set up from the players kept on the phone, saved on the phone, and nothing is sent while offline", async () => {
    setOnline(false);
    await setUpForm();
    expect(screen.getByText(/works with no signal/)).toBeTruthy();
    // a guest typed by name, and a squad filled in one tap
    fireEvent.change(screen.getByLabelText(/Add a guest/), { target: { value: "Sami Guest" } });
    fireEvent.click(btn("Add to Team 2"));
    expect(screen.getByText("Sami Guest")).toBeTruthy();
    const id = await fillAndStart();
    expect(calls).toEqual([]);                                             // no signal: nothing sent
    const item = (await readNewMatch(id))!;
    expect(item).toMatchObject({ status: "pending", communityId: COMMUNITY, match: { overs: 6, playersPerSide: 6, sides: [{ name: "Team 1" }, { name: "Team 2" }] } });
    expect(item.match.players).toHaveLength(5);
    expect(item.match.players.find((p) => p.guestName === "Sami Guest")).toMatchObject({ side: 2, userId: null });
    expect(Object.values(item.names).map((n) => n.name).sort()).toEqual(["Ali", "Bob", "Cara", "Dan", "Sami Guest"]);
  });

  it("checks everything before saving: equal names, too few players, too many for the side; nothing is saved until it is valid", async () => {
    await setUpForm();
    fireEvent.change(screen.getByLabelText("Team 2"), { target: { value: "team 1" } });
    side("Ali", "Team 1"); side("Bob", "Team 1");
    fireEvent.click(btn("Start scoring"));
    expect(screen.getAllByText(/different/).length).toBeGreaterThan(0);
    expect(screen.getByText(/needs at least 2 players/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(await readNewMatches()).toEqual([]);
    fireEvent.change(screen.getByLabelText("Team 2"), { target: { value: "Bravo" } });
    side("Cara", "Bravo"); side("Dan", "Bravo");
    fireEvent.change(screen.getByLabelText(/Players per side/), { target: { value: "1" } });
    fireEvent.click(btn("Start scoring"));
    expect(screen.getByText(/Players per side must be/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Players per side/), { target: { value: "2" } });
    side("Eve", "Team 1");
    fireEvent.click(btn("Start scoring"));
    expect(screen.getByText(/can have at most 2 players/)).toBeTruthy();
    expect(await readNewMatches()).toEqual([]);
  });

  it("score it with no signal, then the signal returns: the match is created first, then the balls arrive in order", async () => {
    setOnline(false);
    await setUpForm();
    const id = await fillAndStart();
    cleanup();
    search = `m=${id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    await screen.findByText("Start the match");
    expect(screen.getByText(/not on the server yet/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Batting first"), { target: { value: "1" } });
    pick("Striker", /Ali/); pick("Non-striker", /Bob/); pick("First bowler", /Cara/);
    fireEvent.click(btn("Start scoring"));
    await screen.findByRole("button", { name: "WICKET" });
    fireEvent.click(btn("4")); fireEvent.click(btn("1"));
    await waitFor(async () => expect((await readOutbox(id)).length).toBe(4));          // start, innings, two balls: all kept on the phone
    expect(calls).toEqual([]);
    // the signal returns
    setOnline(true);
    await flushAllWaiting();
    await waitFor(() => expect(logs.get(id)?.length).toBe(4));
    expect(calls[0]).toBe("create");                                                   // the match first
    expect(calls.indexOf("events")).toBeGreaterThan(calls.indexOf("create"));           // no balls were sent before the match existed
    expect(created.get(id)).toMatchObject({ id, overs: 6, sides: [{ name: "Team 1" }, { name: "Team 2" }] });
    expect(logs.get(id)!.map((e) => e.type)).toEqual(["match_start", "innings_start", "ball", "ball"]);
    expect(logs.get(id)!.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect((await readNewMatch(id))!.status).toBe("synced");
    expect(await readOutbox(id)).toEqual([]);
    await flushAllWaiting();                                                           // a second send creates nothing new
    expect(created.size).toBe(1);
  });

  it("online it is created straight away", async () => {
    await setUpForm();
    const id = await fillAndStart();
    await waitFor(async () => expect((await readNewMatch(id))!.status).toBe("synced"));
    expect(calls).toEqual(["create"]);
    expect(created.has(id)).toBe(true);
  });

  it("a match the server refuses stays on the phone with the reason, and its balls are never sent", async () => {
    setOnline(false);
    createMode = "refuse";
    await setUpForm();
    const id = await fillAndStart();
    cleanup();
    search = `m=${id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    await screen.findByText("Start the match");
    fireEvent.change(screen.getByLabelText("Batting first"), { target: { value: "1" } });
    pick("Striker", /Ali/); pick("Non-striker", /Bob/); pick("First bowler", /Cara/);
    fireEvent.click(btn("Start scoring"));
    await screen.findByRole("button", { name: "WICKET" });
    fireEvent.click(btn("2"));
    setOnline(true);
    await flushAllWaiting();
    await waitFor(async () => expect((await readNewMatch(id))!.status).toBe("refused"));
    expect((await readNewMatch(id))!.reason).toMatch(/no longer a member/);
    expect(logs.get(id)).toBeUndefined();                                              // no balls were sent to a match that does not exist
    expect((await readOutbox(id)).filter((i) => i.status === "pending").length).toBe(3);  // still on the phone
    cleanup();
    render(<QuickScore communityId={COMMUNITY} />);
    await screen.findByText(/The server did not accept this match: A player in this match is no longer a member/);
    expect(screen.getByText(/Your balls are safe on this phone/)).toBeTruthy();
  });

  it("a match that is not saved on this phone says so; one that is on the server and has nothing waiting links to the normal page", async () => {
    search = `m=${randomUUID()}`;
    render(<QuickScore communityId={COMMUNITY} />);
    await screen.findByText(/not saved on this phone/);
    cleanup();
    const id = randomUUID();
    const item: NewMatchItem = { id, communityId: COMMUNITY, createdAt: Date.now(), status: "synced", reason: null, names: {}, match: { id, sides: [{ id: randomUUID(), name: "A1" }, { id: randomUUID(), name: "B1" }], overs: 4, playersPerSide: 4, players: [] } };
    await saveNewMatch(item);
    search = `m=${id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    const link = await screen.findByRole("link", { name: "Open the match" });
    expect(link.getAttribute("href")).toBe(`/c/${COMMUNITY}/matches/${id}/score`);
  });
});
