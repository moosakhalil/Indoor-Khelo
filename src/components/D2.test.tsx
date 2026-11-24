// @vitest-environment jsdom
// Phase D2 (UI redesign): the live view for non-scorers (score bug, strips, over, stats, scorecard) and the take-over gate.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const lock = vi.fn(async (..._a: unknown[]) => "ok" as string);
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }), usePathname: () => "/c/c1/matches/m1/score" }));
vi.mock("@/app/actions5", () => ({ lockAction: (...a: unknown[]) => lock(...a) }));
vi.mock("@/lib/outbox", () => ({ deviceId: () => "dev-1" }));

import LiveView, { AutoChip, LiveBug, LiveIdle, ScorecardView } from "@/components/LiveView";
import { LiveScore, Scorecard } from "@/components/Live";
import ScoreGate from "@/components/ScoreGate";
import { bugView, ballKind } from "@/lib/liveView";
import { chase, freeHit, innings1, inningsBreak, midChase, notStarted, paused, SIDES, Sim, superOver } from "./D2.fixtures";

beforeEach(() => { refresh.mockClear(); lock.mockReset(); lock.mockImplementation(async () => "ok"); });
afterEach(() => cleanup());

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const view = (m: ReturnType<typeof innings1>, o: Record<string, unknown> = {}) => html(<LiveView m={m} sides={SIDES} venue="Clifton Indoor Arena" {...o} />);

/* ---------------- the numbers and sentences ---------------- */
describe("score bug numbers (read from the engine)", () => {
  it("first innings: one team row, batting and run rate, no chase", () => {
    const v = bugView(innings1())!;
    expect(v.heading).toBe("Innings 1 · 6 overs");
    expect(v.rows).toHaveLength(1);
    expect(v.rows[0]).toMatchObject({ name: "Thunder Strikers", wickets: 1, overs: "3.4", current: true });
    expect(v.line).toMatch(/^Thunder Strikers batting · run rate \d+\.\d\d$/);
    expect(v.progress).toBeNull();
  });
  it("the chase: both rows, the chasing side highlighted, need N from N balls with RRR and RR, and the progress bar", () => {
    const m = midChase();
    const v = bugView(m)!;
    expect(v.heading).toBe("Innings 2 · 6 overs");
    expect(v.rows.map((r) => r.name)).toEqual(["Thunder Strikers", "Royal Panthers"]);
    expect(v.rows.map((r) => r.current)).toEqual([false, true]);
    expect(v.line).toMatch(/^Royal Panthers need \d+ from \d+ balls · RRR \d+\.\d\d · RR \d+\.\d\d$/);
    expect(v.progress).toMatchObject({ of: m.innings[0]!.runs + 1 });
    expect(v.progress!.have).toBe(m.innings[1]!.runs);
  });
  it("innings break: the first side's innings is over, with the run rate, one row", () => {
    const v = bugView(inningsBreak())!;
    expect(v.rows).toHaveLength(1);
    expect(v.line).toMatch(/^Thunder Strikers innings over · run rate \d+\.\d\d$/);
  });
  it("super over: labelled, rows are the super over innings, and the need sentence is for the chasing side", () => {
    const m = superOver();
    const v = bugView(m)!;
    expect(v.superOver).toBe(true);
    expect(v.heading).toBe("Super over · 1 over");
    expect(v.rows).toHaveLength(2);
    expect(v.rows[0]).toMatchObject({ name: "Royal Panthers", runs: 12, current: false });
    expect(v.rows[1]).toMatchObject({ name: "Thunder Strikers", runs: 10, current: true });
    expect(v.line).toMatch(/^Thunder Strikers need 3 from 4 balls/);
  });
  it("ball kinds: six gold, four blue, wicket red, wides and no balls orange, plain runs plain", () => {
    expect(ballKind({ wicket: false, label: "6" })).toBe("six");
    expect(ballKind({ wicket: false, label: "4" })).toBe("four");
    expect(ballKind({ wicket: true, label: "W" })).toBe("w");
    expect(ballKind({ wicket: false, label: "Wd" })).toBe("x");
    expect(ballKind({ wicket: false, label: "Nb+1" })).toBe("x");
    expect(ballKind({ wicket: false, label: "2" })).toBe("");
  });
});

/* ---------------- what is drawn ---------------- */
describe("live view states", () => {
  it("scenario 1: innings 1 with badge, big score, strips with shirts, overs left, this over with letters and empty slots", () => {
    const out = view(innings1());
    expect(out).toContain("LIVE");
    expect(out).toContain("Innings 1 · 6 overs · Clifton Indoor Arena");
    expect(out).toContain('class="team-badge md"');
    expect(out).toContain("lv-score");
    expect(out).toMatch(/Striker · SR \d+/);
    expect(out).toContain("Non-striker");
    expect(out).toMatch(/Bowler · \d\.\d-\d-\d+-\d/);
    expect(out).toMatch(/\d OVERS? LEFT/);
    expect(out).toContain('class="shirt small"');
    expect(out).toContain("Ball ");
    expect(out).toContain(">W<");
    expect(out).toContain("lv-b empty");
    expect(out).toContain("Partnership");
    expect(out).toContain("Last wicket");
    expect(out).not.toContain("Required rate");
    expect(out).not.toContain("lv-freehit");
  });
  it("scenario 2: the chase shows both teams, the need sentence, required rate and the bar", () => {
    const out = view(midChase());
    expect(out).toContain("Royal Panthers need");
    expect(out).toContain("Required rate");
    expect(out).toContain('role="progressbar"');
    expect(out).toContain("needed");
    expect(out).toContain("Thunder Strikers");
  });
  it("scenario 3: the free hit banner and the no ball bubble", () => {
    const out = view(freeHit());
    expect(out).toContain("FREE HIT");
    expect(out).toContain("Only Run Out is allowed on this ball");
    expect(out).toMatch(/lv-b x[^>]*>Nb/);
  });
  it("scenario 4: super over is labelled, and no bowler limit pill (limits do not apply)", () => {
    const out = view(superOver());
    expect(out).toContain("Super over · 1 over");
    expect(out).not.toContain("OVERS LEFT");
    expect(out).not.toContain("OVER LEFT");
  });
  it("scenario 5: a paused match shows a Paused badge instead of Live", () => {
    const m = paused();
    expect(m.paused).toBe(true);
    const out = view(m);
    expect(out).toContain("PAUSED");
    expect(out).not.toContain(">LIVE<");
    expect(html(<AutoChip paused />)).toContain("Paused");
    expect(html(<AutoChip />)).toContain("Auto");
  });
  it("scenario 6: innings break says the innings is over", () => {
    const out = view(inningsBreak());
    expect(out).toMatch(/Thunder Strikers innings over · run rate \d+\.\d\d/);
  });
  it("scenario 7 and 8 and 13 header: the two team badges and one sentence when nothing has started", () => {
    const out = html(<LiveView m={notStarted()} sides={SIDES} />);
    expect(out).toContain("The match has not started yet");
    expect((out.match(/class="team-badge lg"/g) ?? []).length).toBe(2);
    expect(html(<LiveIdle sides={SIDES} text="Waiting for the innings to start" />)).toContain("Waiting for the innings to start");
    expect(html(<LiveView m={null} sides={SIDES} />)).toContain("The match has not started yet");
  });
  it("the scorer's names are kept as a 'Scored by' line", () => {
    expect(view(innings1(), { scoredBy: ["Usman Tariq", "Hamza Khan"] })).toContain("Usman Tariq, Hamza Khan");
  });
  it("a guest bowler gets a grey shirt (no number), a member the number", () => {
    const m = new Sim().startInnings("t1", "t2", "r6").runs(1).state();
    const out = html(<LiveView m={m} sides={SIDES} />);
    expect(out).toContain("no player number");
    expect(out).toContain("#8A97B5");
    expect(out).toContain("number 7");
  });
  it("the bug has no hooks and keeps the old LiveScore export untouched", () => {
    expect(typeof LiveScore).toBe("function");
    expect(typeof Scorecard).toBe("function");
    const old = html(<LiveScore m={midChase()} />);
    expect(old).toContain("live-head");
    expect(html(<Scorecard m={midChase()} />)).toContain("Fall of wickets");
    expect(html(<LiveBug m={midChase()} />)).toContain("lv-bug");
  });
});

describe("scorecard cards", () => {
  it("shows both innings with badges, batting and bowling tables, extras, did not bat, fall of wickets and the timeline", () => {
    const out = html(<ScorecardView m={midChase()} />);
    expect(out).toContain("Thunder Strikers, innings 1 batting");
    expect(out).toContain("Royal Panthers, innings 2 bowling");
    expect(out).toContain("Innings 1");
    expect(out).toContain("Extras");
    expect(out).toContain("Timeline");
    expect(out).toContain("not out");
    expect((out.match(/class="team-badge md"/g) ?? []).length).toBe(2);
  });
  it("shows the result and the guest tag when there is one", () => {
    const s = new Sim({ innings: 1 }, 1);
    s.startInnings("t1", "t2", "r6");
    s.runs(1, 2, 3, 0, 0, 0);
    const out = html(<ScorecardView m={s.state()} />);
    expect(out).toContain("(guest)");
  });
  it("nothing before the match starts", () => {
    const m = notStarted();
    expect(m ? html(<ScorecardView m={m} />) : "").toBe("");
  });
});

/* ---------------- the gate ---------------- */
type Props = Partial<React.ComponentProps<typeof ScoreGate>>;
const gate = (p: Props = {}) => render(
  <ScoreGate
    communityId="c1" matchId="m1" me="me" isAdmin={false} scorerId="u1" scorerName="Usman Tariq" takeoverBy={null} takeoverName={null}
    canScore reason={null} started {...p}
  />,
);

describe("take-over gate", () => {
  it("scenario 7: nobody scoring, not started: a big Start scoring button runs 'take'", async () => {
    gate({ scorerId: null, scorerName: null, started: false });
    expect(screen.getByText("Nobody is scoring this match")).toBeTruthy();
    expect(screen.getByText(/Only one person scores at a time/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start scoring/ }));
    await waitFor(() => expect(lock).toHaveBeenCalledWith("c1", "m1", "take", "dev-1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
  it("scenario 9: nobody holds the lock but the match is on: the button says Take over scoring", () => {
    gate({ scorerId: null, scorerName: null, started: true });
    expect(screen.getByRole("button", { name: /Take over scoring/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start scoring/ })).toBeNull();
  });
  it("scenario 1: someone else scores: who, the plain explanation and Ask to take over (runs 'request')", async () => {
    gate();
    expect(screen.getByText("Usman Tariq is scoring")).toBeTruthy();
    expect(screen.getByText(/You are watching the live score/)).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ask to take over scoring/ }));
    await waitFor(() => expect(lock).toHaveBeenCalledWith("c1", "m1", "request", "dev-1"));
  });
  it("the scorer's shirt number is shown when known", () => {
    const { container } = gate({ scorerNumber: 10 });
    expect(container.querySelector(".shirt")?.getAttribute("aria-label")).toContain("number 10");
  });
  it("scenario 10: I asked: a waiting block says what happens next, and Cancel my request runs 'cancel'", async () => {
    gate({ takeoverBy: "me", takeoverName: "Me" });
    expect(screen.getByText("Waiting for Usman Tariq to hand over…")).toBeTruthy();
    expect(screen.getByText(/taken to the pad as soon as they accept/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ask to take over scoring/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel my request" }));
    await waitFor(() => expect(lock).toHaveBeenCalledWith("c1", "m1", "cancel", "dev-1"));
  });
  it("scenario 11: someone else asked: the button is disabled, names them, and a hint says one request at a time", () => {
    gate({ takeoverBy: "u9", takeoverName: "Hamza Khan" });
    const b = screen.getByRole("button", { name: "Hamza Khan has already asked" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(screen.getByText(/Only one request at a time/)).toBeTruthy();
    fireEvent.click(b);
    expect(lock).not.toHaveBeenCalled();
  });
  it("scenario 12: an error shows in a red alert banner; every message of the table is kept", async () => {
    lock.mockImplementation(async () => "held");
    gate();
    fireEvent.click(screen.getByRole("button", { name: /Ask to take over scoring/ }));
    const a = await screen.findByRole("alert");
    expect(a.textContent).toContain("Someone else is scoring now.");
    expect(a.className).toContain("lv-err");
    expect(a.querySelector("svg")).not.toBeNull();
  });
  it.each([
    ["forbidden", "Only members of this community can score."], ["bad_state", "That cannot be done right now."],
    ["busy", "Someone else has already asked to take over. Please wait a moment."], ["not_holder", "You are not the scorer."],
    ["no_request", "There is no request to answer."], ["not_admin", "Only an Admin can take over this way."], ["weird", "That did not work."],
  ])("error text for %s", async (code, text) => {
    lock.mockImplementation(async () => code);
    gate();
    fireEvent.click(screen.getByRole("button", { name: /Ask to take over scoring/ }));
    expect((await screen.findByRole("alert")).textContent).toContain(text);
  });
  it("an Admin sees the Admin area; the button asks first, names the consequence, and only then takes over", async () => {
    gate({ isAdmin: true });
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText(/Their unsent balls will not be saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Take over as Admin/ }));
    expect(lock).not.toHaveBeenCalled();
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("Take over scoring now?");
    expect(dlg.textContent).toContain("Usman Tariq is scoring");
    expect(dlg.textContent).toContain("will not be saved");
    expect(dlg.textContent).toContain("Use this only if they cannot hand over.");
    fireEvent.click(screen.getByRole("button", { name: "Keep watching" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(lock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Take over as Admin/ }));
    const confirm = screen.getAllByRole("button", { name: "Take over as Admin" }).pop()!;
    await act(async () => { fireEvent.click(confirm); });
    await waitFor(() => expect(lock).toHaveBeenCalledWith("c1", "m1", "admin", "dev-1"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("Escape also closes the Admin confirm without taking over", () => {
    gate({ isAdmin: true });
    fireEvent.click(screen.getByRole("button", { name: /Take over as Admin/ }));
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(lock).not.toHaveBeenCalled();
  });
  it("an Admin who is the scorer, or when nobody scores, sees no Admin area (as today)", () => {
    gate({ isAdmin: true, scorerId: "me" });
    expect(screen.queryByText("Admin")).toBeNull();
    cleanup();
    gate({ isAdmin: true, scorerId: null });
    expect(screen.queryByText("Admin")).toBeNull();
  });
  it("scenario 8: cannot start: the reason is one orange block with Pick lineups", () => {
    const { container } = gate({ canScore: false, reason: "Each side needs at least 2 players before scoring can start. Pick the lineups first.", lineupsHref: "/c/c1/matches/m1/lineup" });
    expect(container.querySelector(".lv-warn")?.textContent).toContain("Each side needs at least 2 players");
    expect(container.querySelector("svg")).not.toBeNull();
    const a = screen.getByRole("link", { name: /Pick lineups/ });
    expect(a.getAttribute("href")).toBe("/c/c1/matches/m1/lineup");
    expect(screen.queryByRole("button", { name: /Start scoring/ })).toBeNull();
  });
  it("scenario 13: cancelled or postponed: the reason sentence is kept, no actions", () => {
    const { container } = gate({ canScore: false, reason: "This match is cancelled, so it cannot be scored." });
    expect(container.textContent).toContain("This match is cancelled, so it cannot be scored.");
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
  it("the buttons are disabled while an action is running", async () => {
    let done: (v: string) => void = () => {};
    lock.mockImplementation(() => new Promise<string>((r) => { done = r; }));
    gate({ scorerId: null, scorerName: null, started: false });
    const b = screen.getByRole("button", { name: /Start scoring/ }) as HTMLButtonElement;
    fireEvent.click(b);
    await waitFor(() => expect(b.disabled).toBe(true));
    await act(async () => { done("ok"); });
  });
});
