// @vitest-environment jsdom
// Phase C4: the two "no signal" screens after the redesign. Every state of the PDF (setup 10 scenarios, score entry 5 scenarios),
// with a stand-in for the phone's storage (fake IndexedDB) and NO network at all: any fetch during these tests fails them.
import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

configure({ asyncUtilTimeout: 5000 });
const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }), useSearchParams: () => new URLSearchParams(search), usePathname: () => "/c/x/matches/quick" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/actions5", () => ({ lockAction: vi.fn(async () => "ok"), lockStatus: vi.fn(async () => null) }));

// lets one test make "this phone could not save the match" happen
let storageFull = false;
let gate: Promise<void> | null = null;       // holds the save open so the "Saving…" state can be seen
vi.mock("@/lib/outbox", async (orig) => {
  const real = await orig<typeof import("@/lib/outbox")>();
  return { ...real, saveNewMatch: vi.fn(async (item: Parameters<typeof real.saveNewMatch>[0]) => { if (gate) await gate; return storageFull ? false : real.saveNewMatch(item); }) };
});

import QuickMatchForm from "@/components/QuickMatchForm";
import QuickScore, { QuickScoreLoading } from "@/components/QuickScore";
import QuickShell from "@/components/QuickShell";
import { SnackbarProvider } from "@/components/Snackbar";
import { readNewMatch, readNewMatches, saveNewMatch, saveRoster, putOutbox, type NewMatchItem } from "@/lib/outbox";
import { isStaleRoster, meterPercent, meterState, rosterAgeDays } from "@/lib/quickMatchUi";

const COMMUNITY = randomUUID();
const ME = randomUUID();
const ids = Array.from({ length: 9 }, () => randomUUID());
const NAMES = ["Ali Raza", "Hamza Khan", "Bilal Ahmed", "Usman Tariq", "Zain Malik", "Faizan Ali", "Saad Hussain", "Daniyal Shah", "Hassan Raza"];
const SQUAD_A = randomUUID();
const SQUAD_B = randomUUID();
const roster = (savedAt = Date.now() - 3600_000) => ({
  communityId: COMMUNITY, me: ME, savedAt,
  members: NAMES.map((name, i) => ({ id: ids[i]!, name, number: i === 8 ? null : i + 1, role: i % 2 ? "bowler" : "batter" })),
  teams: [{ id: SQUAD_A, name: "Thunder Strikers", squad: ids.slice(0, 7) }, { id: SQUAD_B, name: "Royal Panthers", squad: [ids[0]!, ids[7]!] }],
});

const fetchSpy = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
  window.dispatchEvent(new Event(v ? "online" : "offline"));
}
beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
  Object.defineProperty(navigator, "vibrate", { value: () => true, configurable: true });
  localStorage.setItem("ik_guide_done", "1");
  storageFull = false; gate = null; push.mockClear(); search = "";
  setOnline(false);                                                   // NO SIGNAL for every test in this file
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase("indoor-khelo"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const side = (who: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: `${who}: which side` })).getByRole("button", { name: `${who}: ${label}` }));
async function setUp(r = roster()) {
  await saveRoster(r);
  render(<SnackbarProvider><QuickMatchForm communityId={COMMUNITY} fallback={null} /></SnackbarProvider>);
  await screen.findByText(/Players last updated/);
}
const meter = (label: RegExp) => screen.getAllByRole("img", { name: label })[0]!;

describe("pure helpers", () => {
  it("knows when the saved player list is old (more than a week) and how many days", () => {
    const now = Date.UTC(2026, 10, 24, 12);
    expect(isStaleRoster(now - 6 * 86_400_000, now)).toBe(false);
    expect(isStaleRoster(now - 7 * 86_400_000, now)).toBe(false);
    expect(isStaleRoster(now - 7 * 86_400_000 - 1, now)).toBe(true);
    expect(rosterAgeDays(now - 11 * 86_400_000 - 5000, now)).toBe(11);
    expect(rosterAgeDays(now + 5000, now)).toBe(0);
  });
  it("meter states: empty, filling, full (green), over (red); a missing limit never breaks", () => {
    expect(meterState(0, 6)).toBe("empty"); expect(meterState(3, 6)).toBe("filling"); expect(meterState(6, 6)).toBe("full"); expect(meterState(7, 6)).toBe("over");
    expect(meterState(2, null)).toBe("filling"); expect(meterPercent(3, 6)).toBe(50); expect(meterPercent(9, 6)).toBe(100); expect(meterPercent(1, null)).toBe(0);
  });
});

describe("setup, scenarios 1 to 10", () => {
  it("1. fresh form: offline note, title chip, default names, 0 / 6 meters, nothing picked, no network used", async () => {
    await setUp();
    expect(screen.getByText("Works with no signal")).toBeTruthy();
    expect((screen.getByLabelText("Team 1") as HTMLInputElement).value).toBe("Team 1");
    expect((screen.getByLabelText("Team 2") as HTMLInputElement).value).toBe("Team 2");
    expect(meter(/Team 1: 0 of 6/)).toBeTruthy();
    expect(meter(/Team 2: 0 of 6/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "6 overs" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText(/Players per side/) as HTMLInputElement).value).toBe("6");
    // every player has a shirt (the one without a number is grey with a dash) and a three-way control
    expect(screen.getAllByRole("group", { name: /which side/ })).toHaveLength(9);
    expect(screen.getAllByRole("img", { name: "No player number" })).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Player number 1" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Ali Raza: which side" })).getByRole("button", { name: "Ali Raza: not playing" }).getAttribute("aria-pressed")).toBe("true");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the title bar chip says Offline-ready (and says Needs players when no players are saved)", () => {
    const { unmount } = render(<QuickShell communityId={COMMUNITY} title="Offline match" back="/x" ready>x</QuickShell>);
    expect(screen.getByText("Offline-ready")).toBeTruthy();
    unmount();
    render(<QuickShell communityId={COMMUNITY} title="Offline match" back="/x" ready={false}>x</QuickShell>);
    expect(screen.getByText("Needs players")).toBeTruthy();
  });

  it("2. ready to start: both sides full turn green, a guest counts toward the limit, saved on the phone, nothing sent", async () => {
    await setUp();
    fireEvent.change(screen.getByLabelText("Team 1"), { target: { value: "Thunder Strikers" } });
    fireEvent.change(screen.getByLabelText("Team 2"), { target: { value: "Royal Panthers" } });
    fireEvent.click(btn("Thunder Strikers")); // squad chip: the side with the same name gets it directly
    expect(meter(/Thunder Strikers: 6 of 6 players, full/)).toBeTruthy();
    for (const n of NAMES.slice(6, 9)) side(n, "Royal Panthers");
    expect(meter(/Royal Panthers: 3 of 6/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Add a guest/), { target: { value: "Sami Guest" } });
    fireEvent.click(btn("Add to Royal Panthers"));
    side(NAMES[1]!, "Royal Panthers");                                   // moves Hamza: a member is on one side only
    expect(meter(/Royal Panthers: 5 of 6/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Add a guest/), { target: { value: "Waleed" } });
    fireEvent.click(btn("Add to Royal Panthers"));
    expect(meter(/Royal Panthers: 6 of 6 players, full/)).toBeTruthy();
    fireEvent.click(btn("Start scoring"));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const id = (push.mock.calls[0]![0] as string).split("m=")[1]!;
    const item = (await readNewMatch(id))!;
    expect(item.status).toBe("pending");
    expect(item.match.players.filter((p) => p.side === 2)).toHaveLength(6);
    expect(item.match.players.filter((p) => p.side === 1)).toHaveLength(5);
    expect(fetchSpy).not.toHaveBeenCalled();                              // offline: nothing was sent
    expect(screen.getByText(/Saved on this phone first/)).toBeTruthy();
  });

  it("3. no players saved on this phone yet: red banner, empty list with the fix, guests still allowed, Start scoring disabled", async () => {
    render(<SnackbarProvider><QuickMatchForm communityId={COMMUNITY} fallback={null} /></SnackbarProvider>);
    expect(screen.getByText("No players are saved on this phone yet.")).toBeTruthy();
    expect(screen.getByText("No players saved on this phone yet.")).toBeTruthy();
    expect(screen.getAllByText(/Open Home once while you have signal/)).toHaveLength(2);
    expect((btn("Start scoring") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Add a guest/), { target: { value: "Guest One" } });
    fireEvent.click(btn("Add to Team 1"));
    expect(screen.getByText("Guest One")).toBeTruthy();
    expect((btn("Start scoring") as HTMLButtonElement).disabled).toBe(true);
  });

  it("4. roster older than a week: gold warning with the age; a fresh roster shows none", async () => {
    await setUp(roster(Date.now() - 11 * 86_400_000));
    expect(await screen.findByText("Players saved 11 days ago")).toBeTruthy();
    expect(screen.getByText(/New members since then will be missing/)).toBeTruthy();
    cleanup();
    await setUp(roster(Date.now() - 2 * 86_400_000));
    expect(screen.queryByText(/Players saved .* days ago/)).toBeNull();
  });

  it("5. team name errors: same names, empty, too short, too long (counter and badge preview)", async () => {
    await setUp();
    fireEvent.change(screen.getByLabelText("Team 1"), { target: { value: "Strikers" } });
    fireEvent.change(screen.getByLabelText("Team 2"), { target: { value: "strikers" } });
    expect(screen.getAllByText("8/40")).toHaveLength(2);
    fireEvent.click(btn("Start scoring"));
    expect(screen.getByText("The two sides need different names.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Team 2"), { target: { value: "" } });
    expect(screen.getByText("Choose the second team or type a match-only team name.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Team 2"), { target: { value: "A" } });
    expect(screen.getByText("A team name needs at least 2 letters.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Team 2"), { target: { value: "x".repeat(41) } });
    expect(screen.getByText("A team name can be at most 40 characters.")).toBeTruthy();
    expect(screen.getByText("41/40")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("6. overs and players-per-side errors sit beside their controls; the stepper stays inside 2 to 11", async () => {
    await setUp();
    fireEvent.click(btn("Custom"));
    fireEvent.click(btn("Start scoring"));
    expect(screen.getByText(/Overs must be/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Custom overs"), { target: { value: "3" } });
    expect(screen.queryByText(/Overs must be/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Players per side/), { target: { value: "20" } });
    expect(screen.getByText(/Players per side must be a whole number from 2 to 11/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Players per side/), { target: { value: "11" } });
    expect((btn("More players per side") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn("Fewer players per side"));
    expect((screen.getByLabelText(/Players per side/) as HTMLInputElement).value).toBe("10");
    fireEvent.change(screen.getByLabelText(/Players per side/), { target: { value: "2" } });
    expect((btn("Fewer players per side") as HTMLButtonElement).disabled).toBe(true);
  });

  it("7. lineup errors: the meter turns red (7 / 6) while picking, and the messages sit under the meters", async () => {
    await setUp();
    for (const n of NAMES.slice(0, 7)) side(n, "Team 1");
    side(NAMES[7]!, "Team 2");
    expect(meter(/Team 1: 7 of 6 players, too many/)).toBeTruthy();
    expect(screen.getAllByText("Over by 1").length).toBeGreaterThan(0);   // in the list and in the summary card
    expect(screen.getByText(/Team 1 can have at most 6 players\. Raise “players per side” or take someone out\./)).toBeTruthy();
    fireEvent.click(btn("Start scoring"));
    expect(screen.getByText(/Team 2 needs at least 2 players to start scoring\./)).toBeTruthy();
    expect(await readNewMatches()).toEqual([]);
    side(NAMES[6]!, "Team 2");                                           // fixing it clears both messages without pressing Start again
    expect(screen.queryByText(/can have at most/)).toBeNull();
    expect(screen.queryByText(/needs at least 2 players/)).toBeNull();
  });

  it("8. guest field: empty, too long (counter), duplicate; the list has Remove, and Remove can be undone", async () => {
    await setUp();
    fireEvent.click(btn("Add to Team 1"));
    expect(screen.getByText("Type the guest's name.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Add a guest/), { target: { value: "g".repeat(74) } });
    expect(screen.getByText("74/60")).toBeTruthy();
    expect(screen.getByText("A guest name can be at most 60 characters.")).toBeTruthy();
    fireEvent.click(btn("Add to Team 1"));
    fireEvent.change(screen.getByLabelText(/Add a guest/), { target: { value: "Waleed" } });
    fireEvent.click(btn("Add to Team 1"));
    fireEvent.change(screen.getByLabelText(/Add a guest/), { target: { value: "waleed" } });
    fireEvent.click(btn("Add to Team 2"));
    expect(screen.getByText("A guest with that name is already added.")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "No player number" }).length).toBe(2); // Ali's list has one grey shirt, the guest has the other
    fireEvent.click(btn("Remove Waleed"));
    expect(screen.queryByText("guest · Team 1")).toBeNull();
    expect(meter(/Team 1: 0 of 6/)).toBeTruthy();
    expect(screen.getByText("Waleed removed.")).toBeTruthy();
    fireEvent.click(btn("Undo"));
    expect(screen.getByText("guest · Team 1")).toBeTruthy();
    expect(meter(/Team 1: 1 of 6/)).toBeTruthy();
  });

  it("9. squads are one-tap chips: a chip whose name matches a side fills it, stops when the side is full; otherwise it asks which side", async () => {
    await setUp();
    fireEvent.click(btn("Thunder Strikers"));                            // no side has that name: asks which side
    expect(screen.getByRole("group", { name: "Which side gets Thunder Strikers" })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group", { name: "Which side gets Thunder Strikers" })).getByRole("button", { name: "Team 1" }));
    expect(screen.getByText("Thunder Strikers: 6 players added to Team 1. The side is full.")).toBeTruthy();   // the squad has 7, the side takes 6
    expect(meter(/Team 1: 6 of 6 players, full/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Which side gets/ })).toBeNull();
    fireEvent.click(btn("Royal Panthers"));
    fireEvent.click(within(screen.getByRole("group", { name: "Which side gets Royal Panthers" })).getByRole("button", { name: "Team 2" }));
    expect(screen.getByText("Royal Panthers: 1 player added to Team 2.")).toBeTruthy();                       // Ali is already placed
  });

  it("search and Picked only keep a long player list manageable", async () => {
    await setUp();
    fireEvent.change(screen.getByLabelText("Find a player"), { target: { value: "raza" } });
    expect(screen.getAllByRole("group", { name: /which side/ })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Find a player"), { target: { value: "zzz" } });
    expect(screen.getByText("No player matches that.")).toBeTruthy();
    fireEvent.click(btn("Show everyone"));
    expect(screen.getAllByRole("group", { name: /which side/ })).toHaveLength(9);
    side("Ali Raza", "Team 1");
    fireEvent.click(btn("Picked only"));
    expect(screen.getAllByRole("group", { name: /which side/ })).toHaveLength(1);
  });

  it("10. saving: the button says Saving…; storage full: the banner says nothing was started and everything typed stays", async () => {
    await setUp();
    fireEvent.change(screen.getByLabelText("Team 1"), { target: { value: "Strikers" } });
    side("Ali Raza", "Strikers"); side("Hamza Khan", "Strikers"); side("Bilal Ahmed", "Team 2"); side("Usman Tariq", "Team 2");
    storageFull = true;
    fireEvent.click(btn("Start scoring"));
    expect(await screen.findByText("This phone could not save the match.")).toBeTruthy();
    expect(screen.getByText(/Free some space and try again\. Nothing was started\./)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Team 1") as HTMLInputElement).value).toBe("Strikers");
    expect(meter(/Strikers: 2 of 6/)).toBeTruthy();
    expect((btn("Start scoring") as HTMLButtonElement).disabled).toBe(false);   // can retry
    expect(await readNewMatches()).toEqual([]);
    storageFull = false;
    fireEvent.click(btn("Start scoring"));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("saving state", () => {
  it("10b. while the phone saves, the button says Saving… and cannot be pressed twice; then the scoring screen opens", async () => {
    await setUp();
    side("Ali Raza", "Team 1"); side("Hamza Khan", "Team 1"); side("Bilal Ahmed", "Team 2"); side("Usman Tariq", "Team 2");
    let release!: () => void;
    gate = new Promise<void>((r) => { release = r; });
    fireEvent.click(btn("Start scoring"));
    const saving = await screen.findByRole("button", { name: "Saving…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    expect(push).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });
});

describe("score entry, scenarios 1 to 5", () => {
  const made = async (over: Partial<NewMatchItem> = {}) => {
    const id = randomUUID();
    const a = randomUUID(), b = randomUUID(), c = randomUUID(), d = randomUUID();
    const item: NewMatchItem = {
      id, communityId: COMMUNITY, createdAt: Date.now(), status: "pending", reason: null,
      names: { [a]: { name: "Ali", number: 1 }, [b]: { name: "Bob", number: 2 }, [c]: { name: "Cara", number: 3 }, [d]: { name: "Dan", number: 4 } },
      match: { id, sides: [{ id: randomUUID(), name: "Thunder Strikers" }, { id: randomUUID(), name: "Royal Panthers" }], overs: 6, playersPerSide: 6, players: [{ id: a, side: 1, userId: null, guestName: "Ali" }, { id: b, side: 1, userId: null, guestName: "Bob" }, { id: c, side: 2, userId: null, guestName: "Cara" }, { id: d, side: 2, userId: null, guestName: "Dan" }] },
      ...over,
    };
    await saveNewMatch(item);
    return item;
  };

  it("1. loading: a branded card that says the data comes from this phone", () => {
    render(<QuickScoreLoading />);
    expect(screen.getByText("Opening the match…")).toBeTruthy();
    expect(screen.getByText("Reading from this phone")).toBeTruthy();
    expect(screen.getByText("IK")).toBeTruthy();
  });

  it("1b. the same loading card shows first while the match is read", async () => {
    const it = await made();
    search = `m=${it.id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    expect(screen.getByText("Opening the match…")).toBeTruthy();
    await screen.findByText("Start the match");
  });

  it("2. not saved on this phone: the reason and both actions in one card", async () => {
    search = `m=${randomUUID()}`;
    render(<QuickScore communityId={COMMUNITY} />);
    expect(await screen.findByText("This match is not saved on this phone")).toBeTruthy();
    expect(screen.getByText(/probably started on another phone, or this phone.s storage was cleared/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set up a new match with no signal" }).getAttribute("href")).toBe(`/c/${COMMUNITY}/matches/quick`);
    expect(screen.getByRole("link", { name: "Back to matches" }).getAttribute("href")).toBe(`/c/${COMMUNITY}/matches`);
  });

  it("2b. a match of another community is also 'not saved here'", async () => {
    const it = await made({ communityId: randomUUID() });
    search = `m=${it.id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    expect(await screen.findByText("This match is not saved on this phone")).toBeTruthy();
  });

  it("3. already on the server and nothing waiting: green tick, one sentence and one action", async () => {
    const it = await made({ status: "synced" });
    search = `m=${it.id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    expect(await screen.findByText("This match is on the server now")).toBeTruthy();
    expect(screen.getByText(/Anyone in the community can follow it live/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the match" }).getAttribute("href")).toBe(`/c/${COMMUNITY}/matches/${it.id}/score`);
  });

  it("4. ready, not on the server yet: chip + blue banner above the pad, with the count of balls waiting", async () => {
    const it = await made();
    for (let i = 1; i <= 3; i++) await putOutbox({ id: randomUUID(), communityId: COMMUNITY, matchId: it.id, seq: i, status: "pending", reason: null, event: { type: "match_start", seq: i } as never });
    search = `m=${it.id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    expect(await screen.findByText("Saved on this phone, not on the server yet")).toBeTruthy();
    expect(screen.getByText("Saved on phone")).toBeTruthy();
    expect(screen.getByText(/The match and every ball you score are kept here/)).toBeTruthy();
    expect(screen.getByText("3 balls saved on this phone, waiting to send.")).toBeTruthy();
    expect(screen.getByText("Start the match")).toBeTruthy();            // the pad is below it, untouched
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("4b. the banner follows the phone's storage: once the match is on the server the chip changes", async () => {
    const it = await made();
    search = `m=${it.id}`;
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      render(<QuickScore communityId={COMMUNITY} />);
      await screen.findByText("Saved on phone");
      await saveNewMatch({ ...it, status: "synced" });
      await act(async () => { vi.advanceTimersByTime(3100); });
      await waitFor(() => expect(screen.getByText("On the server")).toBeTruthy());
      expect(screen.queryByText("Saved on this phone, not on the server yet")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("5. refused: red chip, the server's reason, balls safe, and a help button with a way forward", async () => {
    const it = await made({ status: "refused", reason: "One of the players is not a member of this community." });
    search = `m=${it.id}`;
    render(<QuickScore communityId={COMMUNITY} />);
    expect(await screen.findByText("The server did not accept this match: One of the players is not a member of this community.")).toBeTruthy();
    expect(screen.getByText("Not accepted")).toBeTruthy();
    expect(screen.getByText("Your balls are safe on this phone.")).toBeTruthy();
    expect(screen.queryByText(/Ask an Admin/)).toBeNull();
    const help = btn("What can I do?");
    expect(help.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(help);
    expect(help.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Ask an Admin to look at it/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Set up a new match with no signal" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Start the match")).toBeTruthy();
    expect((await readNewMatch(it.id))!.status).toBe("refused");         // nothing about the stored match changed
  });
});
