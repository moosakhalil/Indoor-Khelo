// @vitest-environment jsdom
// Phase C3: Pick lineups (LineupPicker) and Correct a finished match (CorrectForm).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/matches/m1/lineup", useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/actions4", () => ({ addGuestAction: vi.fn(), fillInAction: vi.fn(), setLineupAction: vi.fn() }));
const saveLineupC3 = vi.fn();
const addGuestC3 = vi.fn();
const removeGuestC3 = vi.fn();
const previewCorrectionC3 = vi.fn();
vi.mock("@/app/actionsC3", () => ({
  saveLineupC3: (...a: unknown[]) => saveLineupC3(...a),
  addGuestC3: (...a: unknown[]) => addGuestC3(...a),
  removeGuestC3: (...a: unknown[]) => removeGuestC3(...a),
  previewCorrectionC3: (...a: unknown[]) => previewCorrectionC3(...a),
}));
const correctBallAction = vi.fn();
vi.mock("@/app/actions6", () => ({ correctBallAction: (...a: unknown[]) => correctBallAction(...a) }));

import CorrectForm from "@/components/CorrectForm";
import LineupPicker from "@/components/LineupPicker";
import { SnackbarProvider } from "@/components/Snackbar";
import type { PickGuest, PickMember } from "@/lib/lineupPick";

const T = "Thunder Strikers";
const R = "Royal Panthers";
const mem = (id: string, name: string, number: number | null, answer: PickMember["answer"], saved: 0 | 1 | 2 = 0): PickMember => ({ id, name, number, answer, role: null, saved });
const MEMBERS = [
  mem("a", "Ali Raza", 7, "in"), mem("b", "Zain Malik", 3, "in"), mem("c", "Bilal Ahmed", 18, "in"),
  mem("d", "Talha Mehmood", 8, null), mem("e", "Hassan Raza", 5, "out", 2),
];
const guest = (id: string, name: string, saved: 0 | 1 | 2 = 1): PickGuest => ({ id, name, kind: "guest", userId: null, linkedBy: null, saved });

function picker(over: Partial<React.ComponentProps<typeof LineupPicker>> = {}) {
  return render(
    <SnackbarProvider>
      <LineupPicker communityId="c1" matchId="m1" sides={[T, R]} max={2} members={MEMBERS} guests={[]} fixed={[0, 0]} notice={null} editHref="/c/c1/matches/m1/edit" {...over} />
    </SnackbarProvider>,
  );
}
const choose = (who: string, side: string) => fireEvent.click(screen.getByLabelText(`${who}: play for ${side}`));
const saveBtn = () => screen.getAllByRole("button", { name: /Save lineups|Saving/ })[0]! as HTMLButtonElement;

beforeEach(() => { saveLineupC3.mockReset(); addGuestC3.mockReset(); removeGuestC3.mockReset(); previewCorrectionC3.mockReset(); correctBallAction.mockReset(); push.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Pick lineups: counters, groups and the control", () => {
  it("shows both sides with their saved counts and the reply groups with counts", () => {
    picker();
    expect(screen.getAllByText("1 / 2").length).toBeGreaterThan(0); // Royal Panthers has Hassan
    expect(screen.getAllByText("0 / 2").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Said yes" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Can’t make it" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /All 5/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /In 3/ })).toBeTruthy();
  });
  it("every person gets Out and both team badges as real radio buttons, with the team names in full for screen readers", () => {
    picker();
    const group = screen.getByRole("radiogroup", { name: "Ali Raza: which side" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["Ali Raza: not playing", `Ali Raza: play for ${T}`, `Ali Raza: play for ${R}`]);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(`Hassan Raza: play for ${R}`) as HTMLInputElement).checked).toBe(true);
  });
  it("players are gold shirts with their number, guests grey with a dash", () => {
    picker({ guests: [guest("g1", "Waleed")] });
    expect(screen.getAllByRole("img", { name: "Player number 7" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: "Guest, no player number" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Waleed").length).toBeGreaterThan(0);
  });
  it("counters update while picking and the unsaved note counts the changes", () => {
    picker();
    expect(screen.queryByText(/not saved yet/)).toBeNull();
    choose("Ali Raza", T);
    expect(screen.getAllByText("1 change not saved yet.").length).toBeGreaterThan(0);
    choose("Zain Malik", T);
    expect(screen.getAllByText("2 changes not saved yet.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 / 2").length).toBeGreaterThan(0);
  });
  it("search and the reply filter narrow the list", () => {
    picker();
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "raza" } });
    expect(screen.queryByText("Zain Malik")).toBeNull();
    expect(screen.getAllByText("Hassan Raza").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear the search" }));
    fireEvent.click(screen.getByRole("button", { name: /Can’t make it 1/ }));
    expect(screen.queryByText("Zain Malik")).toBeNull();
    expect(screen.getAllByText("Hassan Raza").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "zzz" } });
    expect(screen.getByText("No members match.")).toBeTruthy();
  });
});

describe("Pick lineups: quick tool, limit and save", () => {
  it("Add everyone who is in fills the list on screen, saves nothing, and says what did not fit", () => {
    picker();
    fireEvent.click(screen.getByRole("button", { name: `Add everyone who is in to ${T}` }));
    expect(saveLineupC3).not.toHaveBeenCalled();
    expect((screen.getByLabelText(`Zain Malik: play for ${T}`) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(`Ali Raza: play for ${T}`) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(`Bilal Ahmed: play for ${T}`) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Added 2 players who replied/)).toBeTruthy();
    expect(screen.getByText("1 more did not fit: this side is full.")).toBeTruthy();
    expect(screen.getAllByText("2 changes not saved yet.").length).toBeGreaterThan(0);
  });
  it("adds nobody and says so when nobody replied In", () => {
    picker({ members: MEMBERS.map((m) => ({ ...m, answer: null })) });
    fireEvent.click(screen.getByRole("button", { name: `Add everyone who is in to ${R}` }));
    expect(screen.getByText("Added 0 players who replied “I’m in”.")).toBeTruthy();
    expect(screen.queryByText(/not saved yet/)).toBeNull();
  });
  it("a third player turns the side red, blocks Save and links to Edit match", () => {
    picker();
    choose("Ali Raza", T); choose("Zain Malik", T); choose("Bilal Ahmed", T);
    expect(screen.getAllByText("3 / 2").length).toBeGreaterThan(0);
    const alert = screen.getAllByRole("alert").find((a) => a.textContent?.includes("can have at most 2 players"))!;
    expect(alert.textContent).toContain(`${T} can have at most 2 players`);
    expect(within(alert).getByRole("link", { name: "Open Edit match" }).getAttribute("href")).toBe("/c/c1/matches/m1/edit");
    expect(saveBtn().disabled).toBe(true);
  });
  it("taking someone out lifts the block", () => {
    picker();
    choose("Ali Raza", T); choose("Zain Malik", T); choose("Bilal Ahmed", T);
    fireEvent.click(screen.getByLabelText("Bilal Ahmed: not playing"));
    expect(saveBtn().disabled).toBe(false);
  });
  it("Save sends only what changed and the picks stay if the server refuses", async () => {
    saveLineupC3.mockResolvedValue({ ok: false, code: "too_many", text: `${T} can have at most 2 players. Raise “players per side” in Edit match first, or take someone out.` });
    picker();
    choose("Ali Raza", T);
    fireEvent.click(screen.getByLabelText("Hassan Raza: not playing"));
    await act(async () => { fireEvent.click(saveBtn()); });
    expect(saveLineupC3).toHaveBeenCalledWith("c1", "m1", { m_a: "1", m_e: "0" });
    await waitFor(() => expect(screen.getAllByText(/can have at most 2 players/).length).toBeGreaterThan(0));
    expect((screen.getByLabelText(`Ali Raza: play for ${T}`) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText("2 changes not saved yet.").length).toBeGreaterThan(0);
  });
  it("shows Saving… and locks the button while the server works", async () => {
    let done: (v: unknown) => void = () => {};
    saveLineupC3.mockReturnValue(new Promise((r) => { done = r; }));
    picker();
    choose("Ali Raza", T);
    await act(async () => { fireEvent.click(saveBtn()); });
    expect(saveBtn().textContent).toBe("Saving…");
    expect(saveBtn().disabled).toBe(true);
    await act(async () => { done({ ok: true }); });
  });
  it("a message from the address (an old link) is shown as a banner you can close", () => {
    picker({ notice: { tone: "red", text: "That match or entry could not be found." } });
    expect(screen.getByText("That match or entry could not be found.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss this message" }));
    expect(screen.queryByText("That match or entry could not be found.")).toBeNull();
  });
});

describe("Pick lineups: guests", () => {
  const type = (v: string) => fireEvent.change(screen.getByLabelText("Add a guest (a name is enough)"), { target: { value: v } });
  it("the Add to buttons wake up when a name is typed", () => {
    picker();
    expect((screen.getByRole("button", { name: `Add to ${T}` }) as HTMLButtonElement).disabled).toBe(true);
    type("Sameer");
    expect((screen.getByRole("button", { name: `Add to ${T}` }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("adds a guest through the server, clears the field and offers Undo that removes the guest again", async () => {
    addGuestC3.mockResolvedValue({ ok: true, guestId: "g-new" });
    removeGuestC3.mockResolvedValue({ ok: true });
    picker();
    type("Sameer");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Add to ${R}` })); });
    expect(addGuestC3).toHaveBeenCalledWith("c1", "m1", 2, "Sameer");
    expect((screen.getByLabelText("Add a guest (a name is enough)") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Guest added.")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Undo" })); });
    expect(removeGuestC3).toHaveBeenCalledWith("c1", "m1", "g-new");
  });
  it("a duplicate name is refused under the field with the real sentence, before any call", () => {
    picker({ guests: [guest("g1", "Sameer")] });
    type("  sameer ");
    fireEvent.click(screen.getByRole("button", { name: `Add to ${T}` }));
    expect(screen.getByText("A guest with that name is already in this match. Use a slightly different name.")).toBeTruthy();
    expect(addGuestC3).not.toHaveBeenCalled();
  });
  it("a full side is refused with the limit sentence", () => {
    picker({ guests: [guest("g1", "A"), guest("g2", "B")] });
    type("Third");
    fireEvent.click(screen.getByRole("button", { name: `Add to ${T}` }));
    expect(screen.getAllByText(/Thunder Strikers can have at most 2 players/).length).toBeGreaterThan(0);
    expect(addGuestC3).not.toHaveBeenCalled();
  });
  it("a refusal from the server shows under the field", async () => {
    addGuestC3.mockResolvedValue({ ok: false, code: "duplicate_guest", text: "A guest with that name is already in this match. Use a slightly different name.", field: "guest" });
    picker();
    type("Sameer");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Add to ${R}` })); });
    expect(screen.getByText(/already in this match/)).toBeTruthy();
  });
  it("the bottom sheet shows the 60-character counter and a choice of side", async () => {
    addGuestC3.mockResolvedValue({ ok: true, guestId: "g2" });
    picker();
    fireEvent.click(screen.getByRole("button", { name: "Add a guest" }));
    const dlg = screen.getByRole("dialog", { name: "Add a guest" });
    expect(within(dlg).getByText("0/60")).toBeTruthy();
    fireEvent.change(within(dlg).getByLabelText("Guest’s name"), { target: { value: "Sameer" } });
    expect(within(dlg).getByText("6/60")).toBeTruthy();
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: `Add to ${T}` })); });
    expect(addGuestC3).toHaveBeenCalledWith("c1", "m1", 1, "Sameer");
    expect(screen.queryByRole("dialog", { name: "Add a guest" })).toBeNull();
  });
  it("the sheet closes with Escape", () => {
    picker();
    fireEvent.click(screen.getByRole("button", { name: "Add a guest" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("a guest linked to a member moves together with that member and is counted once", () => {
    const g: PickGuest = { id: "g9", name: "Ali Raza", kind: "linked", userId: "a", linkedBy: "Zain Malik", saved: 1 };
    picker({ members: [mem("a", "Ali Raza", 7, "in", 1), ...MEMBERS.slice(1)], guests: [g] });
    expect(screen.getAllByText("1 / 2").length).toBeGreaterThan(0); // Ali once on Thunder (not twice)
    expect(screen.queryByText("2 / 2")).toBeNull();
    expect(screen.getByText("Guest, linked to a member by Zain Malik")).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText(`Ali Raza: play for ${R}`)[1]!);
    expect((screen.getAllByLabelText(`Ali Raza: play for ${R}`)[0] as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText("1 change not saved yet.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 / 2").length).toBeGreaterThan(0); // Ali moved to Royal Panthers: Hassan and Ali
  });
});

describe("Pick lineups: unsaved changes guard", () => {
  it("leaving through a link asks to keep or discard, and discarding goes on", () => {
    const { container } = render(<div><a href="/c/c1/matches" id="away">Matches</a></div>);
    picker();
    choose("Ali Raza", T);
    fireEvent.click(container.querySelector("#away")!);
    const dlg = screen.getByRole("alertdialog", { name: "Leave without saving?" });
    expect(dlg.textContent).toContain("1 change that is not saved yet");
    fireEvent.click(within(dlg).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog", { name: "Leave without saving?" })).toBeNull();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector("#away")!);
    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }));
    expect(push).toHaveBeenCalledWith("/c/c1/matches");
  });
  it("with nothing changed a link just goes (no question)", () => {
    const { container } = render(<div><a href="/c/c1/matches" id="away2" onClick={(e) => e.preventDefault()}>Matches</a></div>);
    picker();
    fireEvent.click(container.querySelector("#away2")!);
    expect(screen.queryByRole("alertdialog", { name: "Leave without saving?" })).toBeNull();
  });
  it("closing the tab with changes asks the browser to confirm", () => {
    picker();
    choose("Ali Raza", T);
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

/* ------------------------------------------------------------------ Correct a ball */
const P = (id: string, name: string, number: number) => ({ id, name, number });
const BAT = [P("h", "Hamza Khan", 10), P("s", "Saad Hussain", 99)];
const FIELD = [P("al", "Ali Raza", 7), P("us", "Usman Tariq", 45)];
function correct(current = { extra: "", runs: 1, wicket: "", out: "", fielder: "" }) {
  return render(
    <CorrectForm communityId="c1" matchId="m1" ballId="b1" bat={BAT} field={FIELD} current={current} cancelHref="/c/c1/matches/m1/report?tab=balls"
      ball={{ over: "2.4", innings: 1, text: "2.4 Faizan Ali to Hamza Khan: 1 run.", runs: 1, bowler: P("f", "Faizan Ali", 22), batter: P("h", "Hamza Khan", 10) }} />,
  );
}
const saveCorrection = () => screen.getAllByRole("button", { name: /Save the correction|Saving/ })[0]! as HTMLButtonElement;
const runsPad = () => within(screen.getByRole("group", { name: "Runs" }));

describe("Correct a ball: the form", () => {
  it("shows the ball like a scorebook entry with shirts for bowler and batter", () => {
    correct();
    expect(screen.getByText("Over 2.4")).toBeTruthy();
    expect(screen.getByText("Faizan Ali")).toBeTruthy();
    expect(screen.getByText("bowled to")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Player number 22" })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "Player number 10" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Innings 1 · 2.4 Faizan Ali to Hamza Khan/)).toBeTruthy();
  });
  it("kind of ball and wicket are one-tap chips (no Retired out), runs is a 0 to 12 pad with the range written", () => {
    correct();
    expect(within(screen.getByRole("radiogroup", { name: "Kind of ball" })).getAllByRole("radio")).toHaveLength(5);
    const wk = within(screen.getByRole("radiogroup", { name: "Wicket" })).getAllByRole("radio").map((r) => r.parentElement!.textContent);
    expect(wk).toEqual(["No wicket", "Bowled", "Caught", "LBW", "Stumped", "Hit wicket", "Run out"]);
    const pad = runsPad().getAllByRole("button");
    expect(pad.map((b) => b.textContent)).toEqual(Array.from({ length: 13 }, (_, i) => String(i)));
    expect(pad[1]!.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/0 to 12\./)).toBeTruthy();
  });
  it("nothing changed yet: the preview says so and the warning that any member can correct is there", () => {
    correct();
    expect(screen.getAllByText("Nothing has changed yet.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Any member can correct a finished match. Everyone can see this change in the history.").length).toBeGreaterThan(0);
    expect(previewCorrectionC3).not.toHaveBeenCalled();
    // decided 2026-11-24: Save stays off until something changes, so no empty history row is written
    expect(saveCorrection().disabled).toBe(true);
  });
  it("changing runs asks for the preview and shows the score and result before saving", async () => {
    previewCorrectionC3.mockResolvedValue({ ok: true, changed: true, innings: { label: "Thunder Strikers innings 1", before: "72/4", after: "75/4" }, result: { before: "Thunder Strikers won by 6 runs", after: "Thunder Strikers won by 3 runs" } });
    correct();
    fireEvent.click(runsPad().getByRole("button", { name: "4" }));
    await waitFor(() => expect(screen.getAllByText("72/4 to 75/4").length).toBeGreaterThan(0), { timeout: 3000 });
    expect(previewCorrectionC3).toHaveBeenCalledWith({ communityId: "c1", matchId: "m1", ballId: "b1", extra: "", runs: 4, wicket: "", out: "", fielder: "" });
    expect(screen.getAllByText("Thunder Strikers won by 6 runs to Thunder Strikers won by 3 runs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recalculated").length).toBeGreaterThan(0);
  });
  it("a preview that the engine refuses is shown in red before saving", async () => {
    previewCorrectionC3.mockResolvedValue({ ok: false, kind: "refused", error: "A wicket cannot happen to a batter who is already out." });
    correct();
    fireEvent.click(screen.getByLabelText("Bowled"));
    await waitFor(() => expect(screen.getAllByText(/would break the balls after it/).length).toBeGreaterThan(0), { timeout: 3000 });
  });
  it("Caught needs the catcher: the chips go red, the real label shows and Save is off until one is chosen", () => {
    correct();
    fireEvent.click(screen.getByLabelText("Caught"));
    expect(screen.getAllByText("Who took the catch (required)").length).toBeGreaterThan(0);
    expect(screen.getByText("Choose the fielder.")).toBeTruthy();
    expect(screen.getByLabelText("Ali Raza").parentElement!.className).toContain("bad");
    expect(saveCorrection().disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Usman Tariq"));
    expect(screen.queryByText("Choose the fielder.")).toBeNull();
    expect(saveCorrection().disabled).toBe(false);
  });
  it("Stumped says wicket-keeper, Run out asks who was out and the fielder, and the runs hint changes", () => {
    correct();
    fireEvent.click(screen.getByLabelText("Stumped"));
    expect(screen.getAllByText("Wicket-keeper (required)").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Run out"));
    expect(screen.getAllByText("Who was run out").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fielder (required)").length).toBeGreaterThan(0);
    expect(screen.getByText("Choose who was run out.")).toBeTruthy();
    expect(screen.getByText("Choose the fielder.")).toBeTruthy();
    expect(screen.getByText("Runs completed before the run out. 0 to 12.")).toBeTruthy();
    expect(saveCorrection().disabled).toBe(true);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Who was run out" })).getByLabelText("Hamza Khan"));
    expect(saveCorrection().disabled).toBe(true);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fielder (required)" })).getByLabelText("Ali Raza"));
    expect(saveCorrection().disabled).toBe(false);
  });
  it("runs typed outside 0 to 12 show the real message on a red field and block Save", () => {
    correct();
    fireEvent.change(screen.getByLabelText("Or type the runs"), { target: { value: "15" } });
    expect(screen.getByText("Runs must be a whole number from 0 to 12.")).toBeTruthy();
    expect(screen.getByLabelText("Or type the runs").getAttribute("aria-invalid")).toBe("true");
    expect(saveCorrection().disabled).toBe(true);
    fireEvent.click(runsPad().getByRole("button", { name: "12" }));
    expect(screen.queryByText("Runs must be a whole number from 0 to 12.")).toBeNull();
  });
});

describe("Correct a ball: saving and server failures", () => {
  it("posts the same fields as before to the same action", async () => {
    previewCorrectionC3.mockResolvedValue({ ok: true, changed: true, innings: null, result: null });
    correctBallAction.mockResolvedValue({});
    correct();
    fireEvent.click(screen.getByLabelText("Wide"));
    fireEvent.click(screen.getByLabelText("Stumped"));
    fireEvent.click(screen.getByLabelText("Usman Tariq"));
    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "It was a stumping" } });
    await act(async () => { fireEvent.click(saveCorrection()); });
    expect(correctBallAction).toHaveBeenCalledTimes(1);
    const fd = correctBallAction.mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(["communityId", "matchId", "ballId", "extra", "runs", "wicket", "fielder", "reason"].map((k) => [k, fd.get(k)]))).toEqual({
      communityId: "c1", matchId: "m1", ballId: "b1", extra: "wide", runs: "1", wicket: "stumped", fielder: "us", reason: "It was a stumping",
    });
    expect(fd.get("out")).toBeNull();
  });
  it("Saving… shows while the server recalculates and the button is locked", async () => {
    let done: (v: unknown) => void = () => {};
    correctBallAction.mockReturnValue(new Promise((r) => { done = r; }));
    previewCorrectionC3.mockResolvedValue({ ok: true, changed: true, innings: null, result: null });
    correct();
    await act(async () => { fireEvent.click(runsPad().getByRole("button", { name: "2" })); });
    await act(async () => { fireEvent.click(saveCorrection()); });
    expect(saveCorrection().textContent).toContain("Saving…");
    expect(saveCorrection().disabled).toBe(true);
    await act(async () => { done({}); });
  });
  it("a refusal keeps the exact text and adds a way to the balls after it", async () => {
    const text = "This change would break the balls after it, so it was not saved. A wicket cannot happen to a batter who is already out.";
    correctBallAction.mockResolvedValue({ error: text });
    previewCorrectionC3.mockResolvedValue({ ok: true, changed: true, innings: null, result: null });
    correct();
    await act(async () => { fireEvent.click(runsPad().getByRole("button", { name: "2" })); });
    await act(async () => { fireEvent.click(saveCorrection()); });
    expect(screen.getAllByText((_, el) => el?.textContent?.startsWith(text) === true && el.className.includes("grow")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Show the balls after this one" })[0]!.getAttribute("href")).toBe("/c/c1/matches/m1/report?tab=balls");
  });
  it("the other server messages keep their exact text, and editing again clears them", async () => {
    correctBallAction.mockResolvedValue({ error: "Only members of this community can correct a match." });
    previewCorrectionC3.mockResolvedValue({ ok: true, changed: true, innings: null, result: null });
    correct();
    await act(async () => { fireEvent.click(runsPad().getByRole("button", { name: "2" })); });
    await act(async () => { fireEvent.click(saveCorrection()); });
    expect(screen.getAllByText("Only members of this community can correct a match.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Wide"));
    expect(screen.queryByText("Only members of this community can correct a match.")).toBeNull();
  });
  it("Cancel goes back to the ball by ball list", () => {
    correct();
    expect(screen.getAllByRole("link", { name: "Cancel" })[0]!.getAttribute("href")).toBe("/c/c1/matches/m1/report?tab=balls");
  });
});
