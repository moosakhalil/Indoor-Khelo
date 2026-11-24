// @vitest-environment jsdom
// Phase C (UI redesign), Builder C2: Plan several matches and Rematch.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/matches", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

type Result = { error?: string; fieldErrors?: Record<string, string> };
const several = vi.fn<(prev: Result, fd: FormData) => Promise<Result>>(async () => ({}));
const rematch = vi.fn<(prev: Result, fd: FormData) => Promise<Result>>(async () => ({}));
vi.mock("@/app/actions4", () => ({
  createSeveralAction: (p: Result, fd: FormData) => several(p, fd),
  rematchAction: (p: Result, fd: FormData) => rematch(p, fd),
}));

import RematchCopied, { type CopiedPlayer } from "@/components/RematchCopied";
import RematchPlan from "@/components/RematchPlan";
import SeveralPlan from "@/components/SeveralPlan";
import type { PickTeam } from "@/lib/c2Data";
import { DEFAULT_RULES } from "@/lib/matchRules";

const teams: PickTeam[] = [
  { id: "t1", name: "Thunder Strikers", squad: 7, captain: "Ali Raza", mine: true },
  { id: "t2", name: "Royal Panthers", squad: 7, captain: "Hamza Khan", mine: false },
  { id: "t3", name: "Desert Falcons", squad: 1, captain: null, mine: false },
];

beforeEach(() => { several.mockReset(); several.mockImplementation(async () => ({})); rematch.mockReset(); rematch.mockImplementation(async () => ({})); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const radio = (group: string, name: RegExp) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });
const input = (c: HTMLElement, name: string) => c.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
const form = (c: HTMLElement) => c.querySelector("form")!;
const submit = async (c: HTMLElement) => { await act(async () => { fireEvent.submit(form(c)); }); };

function pickBoth() {
  fireEvent.click(radio("Team 1", /Thunder Strikers/));
  fireEvent.click(radio("Team 2", /Royal Panthers/));
}

/* ====================================================================== Plan several matches ====================================================================== */
describe("Plan several: first look (scenario 1)", () => {
  it("starts with three empty matches, a counter, Team 2 waiting for Team 1, and a create button that says how many", () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    expect(container.querySelectorAll("article.sv-row")).toHaveLength(3);
    expect(screen.getByText("3 of 10")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Create 3 matches" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Pick Team 1 first")).toBeTruthy();
    expect(screen.getByText("Match-only team")).toBeTruthy();
    // the date label now says a date is required
    expect(screen.getAllByText("required").length).toBe(3);
    // the summary says "No date yet" for every match and that one alert goes out per match
    expect(screen.getAllByText("No date yet")).toHaveLength(3);
    expect(screen.getAllByText(/Everyone gets one alert per match/).length).toBeGreaterThan(0);
  });
  it("teams use the initials badge (never a shirt) and your own team is marked", () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    expect(container.querySelectorAll(".team-badge").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector("svg.shirt")).toBeNull();
    expect(radio("Team 1", /Thunder Strikers/).className).toContain("mine");
    expect(radio("Team 1", /Desert Falcons/).textContent).toContain("1 player · No captain yet");
    expect(radio("Team 1", /Royal Panthers/).textContent).toContain("7 players · Captain Hamza Khan");
  });
});

describe("Plan several: building the plan (scenario 2)", () => {
  it("sends the SAME field names as the old form, in the order the rows are shown", async () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    pickBoth();
    fireEvent.change(input(container, "when_0"), { target: { value: "2026-11-28T20:00" } });
    fireEvent.change(input(container, "when_1"), { target: { value: "2026-11-29T18:00" } });
    fireEvent.change(input(container, "when_2"), { target: { value: "2026-11-30T17:00" } });
    fireEvent.change(input(container, "venue_0"), { target: { value: "Clifton Indoor Arena" } });
    fireEvent.change(input(container, "oversPreset_1"), { target: { value: "custom" } });
    fireEvent.change(input(container, "oversCustom_1"), { target: { value: "7" } });
    await submit(container);
    expect(several).toHaveBeenCalledTimes(1);
    const fd = several.mock.calls[0]![1];
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("count")).toBe("3");
    expect(fd.get("sideATeam")).toBe("t1");
    expect(fd.get("sideAName")).toBe("");
    expect(fd.get("sideBTeam")).toBe("t2");
    expect(fd.get("sideBName")).toBe("");
    expect(fd.get("playersPerSide")).toBe("6");
    expect(fd.has("tz")).toBe(true);
    expect([fd.get("when_0"), fd.get("when_1"), fd.get("when_2")]).toEqual(["2026-11-28T20:00", "2026-11-29T18:00", "2026-11-30T17:00"]);
    expect(fd.get("venue_0")).toBe("Clifton Indoor Arena");
    expect(fd.get("oversPreset_0")).toBe("6");
    expect(fd.get("oversPreset_1")).toBe("custom");
    expect(fd.get("oversCustom_1")).toBe("7");
    expect(fd.has("oversCustom_0")).toBe(false);
  });
  it("the recap lists the dates and the button follows the count", () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    pickBoth();
    fireEvent.change(input(container, "when_0"), { target: { value: "2026-11-28T20:00" } });
    expect(screen.getByText("Sat 28 Nov, 8:00 pm")).toBeTruthy();
    expect(screen.getByText("Thunder Strikers v Royal Panthers", { selector: "h3" })).toBeTruthy();
    expect(screen.getByText("3 separate matches, 6 players a side")).toBeTruthy();
  });
  it("a match-only team sends its typed name and no team id", async () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.click(radio("Team 1", /Match-only team/));
    fireEvent.change(screen.getByLabelText("Team 1: match-only team name"), { target: { value: "Friends XI" } });
    fireEvent.click(radio("Team 2", /Royal Panthers/));
    await submit(container);
    const fd = several.mock.calls[0]![1];
    expect(fd.get("sideATeam")).toBe("");
    expect(fd.get("sideAName")).toBe("Friends XI");
    expect(fd.get("sideBTeam")).toBe("t2");
  });
  it("Swap teams swaps both sides", async () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    pickBoth();
    fireEvent.click(screen.getByRole("button", { name: /Swap teams/ }));
    await submit(container);
    const fd = several.mock.calls[0]![1];
    expect([fd.get("sideATeam"), fd.get("sideBTeam")]).toEqual(["t2", "t1"]);
  });
  it("Change opens the list again", () => {
    render(<SeveralPlan communityId="c1" teams={teams} />);
    pickBoth();
    expect(screen.queryByRole("radiogroup", { name: "Team 1" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change Team 1" }));
    fireEvent.click(radio("Team 1", /Desert Falcons/));
    expect(screen.getByText("Desert Falcons", { selector: "b" })).toBeTruthy();
  });
  it("players per side: stepper, typed value and the field name", async () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.click(screen.getByRole("button", { name: "More players per side" }));
    expect(input(container, "playersPerSide").value).toBe("7");
    fireEvent.click(screen.getByRole("button", { name: "Fewer players per side" }));
    fireEvent.click(screen.getByRole("button", { name: "Fewer players per side" }));
    expect(input(container, "playersPerSide").value).toBe("5");
    fireEvent.change(input(container, "playersPerSide"), { target: { value: "14" } });
    await submit(container);
    expect(several.mock.calls[0]![1].get("playersPerSide")).toBe("14");
  });
});

describe("Plan several: the rows (scenarios 1, 4 and 5)", () => {
  it("Add another and Repeat last stop at 10, the counter turns orange and the hint appears", () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    const add = screen.getByRole("button", { name: /Add another match/ });
    for (let i = 0; i < 7; i++) fireEvent.click(add);
    expect(container.querySelectorAll("article.sv-row")).toHaveLength(10);
    expect(screen.getByText("10 of 10").className).toContain("max");
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Repeat last/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Duplicate match 1" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Up to 10 at a time. You can plan more any time.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Create 10 matches" }).length).toBeGreaterThan(0);
  });
  it("sends count 10 with ten numbered rows", async () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    const add = screen.getByRole("button", { name: /Add another match/ });
    for (let i = 0; i < 7; i++) fireEvent.click(add);
    await submit(container);
    const fd = several.mock.calls[0]![1];
    expect(fd.get("count")).toBe("10");
    expect(fd.has("when_9")).toBe(true);
    expect(fd.has("when_10")).toBe(false);
  });
  it("any row can be removed, not only the last, and the numbers close up", () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.change(input(container, "venue_0"), { target: { value: "Hall A" } });
    fireEvent.change(input(container, "venue_1"), { target: { value: "Hall B" } });
    fireEvent.change(input(container, "venue_2"), { target: { value: "Hall C" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove match 2" }));
    expect(container.querySelectorAll("article.sv-row")).toHaveLength(2);
    expect(input(container, "venue_0").value).toBe("Hall A");
    expect(input(container, "venue_1").value).toBe("Hall C");
    expect(screen.getAllByRole("button", { name: "Create 2 matches" }).length).toBeGreaterThan(0);
  });
  it("with one match left Remove is disabled and the button says Create 1 match", () => {
    render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove match 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove match 2" }));
    expect((screen.getByRole("button", { name: "Remove match 1" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: "Create 1 match" }).length).toBeGreaterThan(0);
    expect(screen.getByText("1 of 10")).toBeTruthy();
    expect(screen.getByText(/1 separate match, 6 players a side/)).toBeTruthy();
  });
  it("Duplicate copies the row right after it", () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.change(input(container, "venue_0"), { target: { value: "Hall A" } });
    fireEvent.change(input(container, "when_0"), { target: { value: "2026-11-28T20:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate match 1" }));
    expect(container.querySelectorAll("article.sv-row")).toHaveLength(4);
    expect(input(container, "venue_1").value).toBe("Hall A");
    expect(input(container, "when_1").value).toBe("2026-11-28T20:00");
  });
  it("Repeat last, +7 days adds next week's fixture with the same venue and overs", () => {
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.change(input(container, "when_2"), { target: { value: "2026-11-30T17:00" } });
    fireEvent.change(input(container, "venue_2"), { target: { value: "Hall C" } });
    fireEvent.change(input(container, "oversPreset_2"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /Repeat last/ }));
    expect(container.querySelectorAll("article.sv-row")).toHaveLength(4);
    expect(input(container, "when_3").value).toBe("2026-12-07T17:00");
    expect(input(container, "venue_3").value).toBe("Hall C");
    expect(input(container, "oversPreset_3").value).toBe("10");
  });
});

describe("Plan several: errors (scenario 3) and failures (scenario 7)", () => {
  it("each error sits in its own row, keeps the server's words and goes away when that field is edited", async () => {
    several.mockImplementation(async () => ({
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        sideB: "The two sides must be different teams.", playersPerSide_1: "Players per side must be a whole number from 2 to 11.", when_0: "Choose a date and time for match 1.",
        when_1: "That date and time is in the past. Choose today or a later day.", overs_2: "Overs must be a whole number from 1 to 50.", venue_2: "The venue can be at most 80 characters.",
      },
    }));
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.click(radio("Team 1", /Thunder Strikers/));
    fireEvent.click(radio("Team 2", /Thunder Strikers/));
    fireEvent.change(input(container, "playersPerSide"), { target: { value: "14" } });
    await submit(container);
    const rowsEl = container.querySelectorAll("article.sv-row");
    expect(within(rowsEl[0] as HTMLElement).getByText("Choose a date and time for match 1.")).toBeTruthy();
    expect(within(rowsEl[1] as HTMLElement).getByText(/in the past/)).toBeTruthy();
    expect(within(rowsEl[2] as HTMLElement).getByText("Overs must be a whole number from 1 to 50.")).toBeTruthy();
    expect(within(rowsEl[2] as HTMLElement).getByText("The venue can be at most 80 characters.")).toBeTruthy();
    expect(screen.getByText("The two sides must be different teams.")).toBeTruthy();
    // players per side is one line, not one per match
    expect(screen.getAllByText("Players per side must be a whole number from 2 to 11.")).toHaveLength(1);
    // the recap counts what is left: 2 team-or-players + 4 row errors = players, sideB, 4 row messages = 6
    expect(screen.getAllByText("Please fix the highlighted fields.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6 things need attention.").length).toBeGreaterThan(0);
    // typed values are all still there
    expect(input(container, "playersPerSide").value).toBe("14");
    // fixing one field clears only its message
    fireEvent.change(input(container, "when_0"), { target: { value: "2026-11-28T20:00" } });
    expect(screen.queryByText("Choose a date and time for match 1.")).toBeNull();
    expect(screen.getByText(/in the past/)).toBeTruthy();
    expect(screen.getAllByText("5 things need attention.").length).toBeGreaterThan(0);
  });
  it("a row removed after an error does not move the messages to another row", async () => {
    several.mockImplementation(async () => ({ error: "Please fix the highlighted fields.", fieldErrors: { when_0: "Choose a date and time for match 1.", when_1: "Choose a date and time for match 2." } }));
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    await submit(container);
    fireEvent.click(screen.getByRole("button", { name: "Remove match 1" }));
    const rowsEl = container.querySelectorAll("article.sv-row");
    expect(rowsEl).toHaveLength(2);
    expect(within(rowsEl[0] as HTMLElement).getByText("Choose a date and time for match 2.")).toBeTruthy();
    expect(screen.queryByText("Choose a date and time for match 1.")).toBeNull();
  });
  it("server failures become banners with the same text", async () => {
    several.mockImplementation(async () => ({ error: "Plan between 1 and 10 matches at a time." }));
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    await submit(container);
    expect(screen.getByText("Plan between 1 and 10 matches at a time.")).toBeTruthy();
    cleanup();
    several.mockImplementation(async () => ({ error: "Only members of this community can create matches." }));
    const r2 = render(<SeveralPlan communityId="c1" teams={teams} />);
    await submit(r2.container);
    expect(screen.getByText("Only members of this community can create matches.")).toBeTruthy();
    cleanup();
    several.mockImplementation(async () => ({ error: "Please fix the highlighted fields.", fieldErrors: { sideA: "Choose teams from this community." } }));
    const r3 = render(<SeveralPlan communityId="c1" teams={teams} />);
    fireEvent.click(radio("Team 1", /Desert Falcons/));
    await submit(r3.container);
    expect(screen.getByText("Choose teams from this community.")).toBeTruthy();
  });
});

describe("Plan several: creating (scenario 6)", () => {
  it("locks the form and shows Creating… so one tap cannot create twice", async () => {
    let release: (r: Result) => void = () => {};
    several.mockImplementation(() => new Promise<Result>((res) => { release = res; }));
    const { container } = render(<SeveralPlan communityId="c1" teams={teams} />);
    await act(async () => { fireEvent.submit(form(container)); });
    expect(screen.getAllByRole("button", { name: "Creating…" }).length).toBeGreaterThan(0);
    expect(container.querySelector("fieldset.sv-fs")!.hasAttribute("disabled")).toBe(true);
    await act(async () => { fireEvent.submit(form(container)); });
    expect(several).toHaveBeenCalledTimes(1);
    await act(async () => { release({}); });
  });
});

/* ====================================================================== Rematch ====================================================================== */
const lineup = (n: number): CopiedPlayer[] => Array.from({ length: n }, (_, i) => ({ name: `Player ${i + 1}`, number: i + 1, side: (i % 2 === 0 ? 1 : 2) as 1 | 2, guest: false }));
const copied = (over: Partial<React.ComponentProps<typeof RematchCopied>> = {}) => (
  <RematchCopied side1={{ name: "Thunder Strikers", mine: true, permanent: true }} side2={{ name: "Royal Panthers", mine: false, permanent: true }}
    ofText="Rematch of Sun 22 Nov, 8:00 pm" venue="Clifton Indoor Arena" overs={6} rules={DEFAULT_RULES} playersPerSide={6} lineup={lineup(12)} {...over} />
);

describe("Rematch: what is copied (scenarios 1, 5 and 6)", () => {
  it("shows both team badges (own team ringed), the match it repeats and a checklist", () => {
    const html = renderToStaticMarkup(copied());
    expect(html.match(/team-badge lg/g)).toHaveLength(2);
    expect(html.match(/sv-mine/g)).toHaveLength(1);
    expect(html).toContain("Thunder Strikers v Royal Panthers");
    expect(html).toContain("Rematch of Sun 22 Nov, 8:00 pm");
    expect(html).toContain("Same two teams");
    expect(html).toContain("The permanent squads stay exactly as they are.");
    expect(html).toContain("Clifton Indoor Arena");
    expect(html).toContain("6 overs and the same rules");
    expect(html).toContain("Traditional rules, no bowler limit, 6 players a side.");
    expect(html).toContain("12 players copied into the lineups");
    expect(html).toContain("swap players, add a guest");
    expect(html).toContain("It is a separate match. Replies, toss and scores are not copied.");
  });
  it("the venue line is dropped when there was none, and an empty lineup is explained", () => {
    const html = renderToStaticMarkup(copied({ venue: "", lineup: [] }));
    expect(html).not.toContain(">Venue<");
    expect(html).toContain("0 players copied into the lineups");
    expect(html).toContain("The first match had no lineup, so the rematch starts with none. Pick them later, even on match day.");
    expect(html).not.toContain("See who is copied");
  });
  it("one player is singular", () => {
    expect(renderToStaticMarkup(copied({ lineup: lineup(1) }))).toContain("1 player copied into the lineups");
  });
  it("players are gold shirts with their number and a guest is a grey shirt with a dash", () => {
    const html = renderToStaticMarkup(copied({ lineup: [{ name: "Ali Raza", number: 7, side: 1, guest: false }, { name: "Visitor", number: null, side: 2, guest: true }] }));
    expect(html).toContain("See who is copied");
    expect(html).toContain("Player number 7");
    expect(html).toContain("Guest, no player number");
    expect(html).toContain("#8A97B5");
    expect(html).toContain("guest");
  });
});

describe("Rematch: the form (scenarios 1 to 4, 7 to 9)", () => {
  const baseProps = { communityId: "c1", matchId: "m1", sourceIso: new Date(2026, 10, 22, 20, 0).toISOString() };

  it("plain rematch: field names, no series banner, and the 'Create rematch' button", async () => {
    const { container } = render(<RematchPlan {...baseProps} canMakeSeries />);
    expect(screen.getByRole("button", { name: "Create rematch" })).toBeTruthy();
    fireEvent.change(input(container, "when"), { target: { value: "2026-11-29T20:00" } });
    await submit(container);
    const fd = rematch.mock.calls[0]![1];
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("matchId")).toBe("m1");
    expect(fd.get("when")).toBe("2026-11-29T20:00");
    expect(fd.has("tz")).toBe(true);
    expect(fd.has("makeSeries")).toBe(false);
  });
  it("quick date chips fill the field in one tap", () => {
    const { container } = render(<RematchPlan {...baseProps} canMakeSeries />);
    const chip = screen.getByRole("button", { name: /^Next week, same time:/ });
    fireEvent.click(chip);
    expect(input(container, "when").value).toMatch(/^\d{4}-\d{2}-\d{2}T20:00$/);
    fireEvent.click(screen.getByRole("button", { name: /^Tomorrow, 8:00 pm$/ }));
    expect(input(container, "when").value).toMatch(/T20:00$/);
  });
  it("a first match with no date offers only the tomorrow chip", () => {
    render(<RematchPlan {...baseProps} sourceIso={null} canMakeSeries />);
    expect(screen.queryByRole("button", { name: /^Next week/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Tomorrow, 6:00 pm" })).toBeTruthy();
  });
  it("ticking Make this a series changes the button and sends makeSeries=on", async () => {
    const { container } = render(<RematchPlan {...baseProps} canMakeSeries />);
    const tick = screen.getByRole("checkbox", { name: /Make this a series/ });
    expect(screen.getByText(/The first match and this rematch become a series between the same two teams/)).toBeTruthy();
    fireEvent.click(tick);
    expect(screen.getByRole("button", { name: "Create rematch and series" })).toBeTruthy();
    await submit(container);
    expect(rematch.mock.calls[0]![1].get("makeSeries")).toBe("on");
    fireEvent.click(tick);
    expect(screen.getByRole("button", { name: "Create rematch" })).toBeTruthy();
  });
  it("an open series: gold banner, 'Play another match in this series', and no Make-a-series option", () => {
    render(<RematchPlan {...baseProps} openSeriesName="Winter Cup 2026" canMakeSeries={false} />);
    expect(screen.getByText("Part of the series Winter Cup 2026")).toBeTruthy();
    expect(screen.getByText("The new match joins it. Series table and fixtures update.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play another match in this series" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("a finished series is explained, and no option is offered", () => {
    render(<RematchPlan {...baseProps} seriesClosed canMakeSeries={false} />);
    expect(screen.getByText("This match’s series is finished")).toBeTruthy();
    expect(screen.getByText("The rematch is a normal match. Start a new series from the Series page.")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Create rematch" })).toBeTruthy();
  });
  it("shows each of the four date errors under the field with an icon, and clears it when a chip is used", async () => {
    const texts = ["Choose the date and time of the rematch.", "Choose a real date and time.", "That date and time is in the past. Choose today or a later day.", "That date is more than a year away. Please check the year."];
    for (const t of texts) {
      rematch.mockImplementation(async () => ({ fieldErrors: { when: t }, error: "Please fix the highlighted fields." }));
      const { container } = render(<RematchPlan {...baseProps} canMakeSeries />);
      await submit(container);
      const err = screen.getByText(t);
      expect(err.closest("p")!.className).toContain("sv-err");
      expect(err.closest("p")!.querySelector("svg")).toBeTruthy();
      expect(input(container, "when").getAttribute("aria-invalid")).toBe("true");
      // the generic line is not shown as a banner when a field has its own message
      expect(screen.queryByText("Please fix the highlighted fields.")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /^Tomorrow/ }));
      expect(screen.queryByText(t)).toBeNull();
      cleanup();
    }
  });
  it("Creating… locks the form", async () => {
    let release: (r: Result) => void = () => {};
    rematch.mockImplementation(() => new Promise<Result>((res) => { release = res; }));
    const { container } = render(<RematchPlan {...baseProps} canMakeSeries />);
    await submit(container);
    expect(screen.getByRole("button", { name: "Creating…" })).toBeTruthy();
    expect(container.querySelector("fieldset")!.hasAttribute("disabled")).toBe(true);
    await act(async () => { release({}); });
  });
  it("server failures keep their text and offer the next step", async () => {
    rematch.mockImplementation(async () => ({ error: "Only members of this community can create matches." }));
    let r = render(<RematchPlan {...baseProps} canMakeSeries />);
    await submit(r.container);
    expect(screen.getByText("Only members of this community can create matches.")).toBeTruthy();
    cleanup();

    rematch.mockImplementation(async () => ({ error: "The original match no longer exists." }));
    r = render(<RematchPlan {...baseProps} canMakeSeries />);
    await submit(r.container);
    expect(screen.getByText("The original match no longer exists.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Plan a new match instead" }).getAttribute("href")).toBe("/c/c1/matches/new");
    cleanup();

    rematch.mockClear();
    rematch.mockImplementation(async () => ({ error: "The rematch could not be created." }));
    r = render(<RematchPlan {...baseProps} canMakeSeries />);
    fireEvent.change(input(r.container, "when"), { target: { value: "2026-11-29T20:00" } });
    await submit(r.container);
    expect(screen.getByText("The rematch could not be created.")).toBeTruthy();
    expect(screen.getByText("Try again in a moment.")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(rematch).toHaveBeenCalledTimes(2);
    expect(rematch.mock.calls[1]![1].get("when")).toBe("2026-11-29T20:00");
    cleanup();

    rematch.mockImplementation(async () => ({ error: "We could not read your phone's time zone. Please reload the page and try again." }));
    r = render(<RematchPlan {...baseProps} canMakeSeries />);
    await submit(r.container);
    expect(screen.getByText("We could not read your phone's time zone.")).toBeTruthy();
    expect(screen.getByText("Please reload the page and try again.")).toBeTruthy();
  });
  it("Cancel goes back to the match", () => {
    render(<RematchPlan {...baseProps} canMakeSeries />);
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/c/c1/matches/m1");
  });
});
