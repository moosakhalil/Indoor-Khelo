// @vitest-environment jsdom
// The Player of the Series card and its place on the Series page.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1", useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/app/actionsF1", () => ({ seriesStatusQuietAction: vi.fn(async () => ({ ok: true })), removeMatchQuietAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/app/actionsSeries", () => ({ deleteSeriesAction: vi.fn(async () => undefined) }));

import SeriesAward, { type AwardView } from "@/components/SeriesAward";
import SeriesView, { type SeriesViewData } from "@/components/SeriesView";
import { SnackbarProvider } from "@/components/Snackbar";

const wrap = (ui: React.ReactNode) => <SnackbarProvider>{ui}</SnackbarProvider>;

afterEach(cleanup);

const entry = (o: Partial<AwardView["winners"][number]> = {}) => ({
  userId: "u1", name: "Ali Raza", number: 7, points: 78, matches: 3, runs: 55, wickets: 4, catches: 1,
  perMatch: [{ matchId: "m1", opponent: "Bravo", points: 40 }, { matchId: "m2", opponent: "Bravo", points: 20 }, { matchId: "m3", opponent: "Bravo", points: 18 }], ...o,
});
const award = (o: Partial<AwardView> = {}): AwardView => ({ final: true, winners: [entry()], others: [{ ...entry({ userId: "u2", name: "Hamza Khan", points: 61 }) }, { ...entry({ userId: "u3", name: "Usman Tariq", points: 44 }) }], matchesCounted: 3, ...o });

describe("Player of the Series card", () => {
  it("final: says Player of the Series, with the gold shirt number, the total, the figures and the next two", () => {
    render(<SeriesAward a={award()} />);
    const card = screen.getByRole("region", { name: "Player of the Series" });
    expect(card.textContent).toContain("Player of the Series");
    expect(within(card).getByText("Ali Raza")).toBeTruthy();
    expect(card.textContent).toContain("78 points in 3 matches");
    expect(card.textContent).toContain("55 runs · 4 wickets · 1 catch");
    expect(card.textContent).toContain("Next: Hamza Khan 61 · Usman Tariq 44");
    expect(card.textContent).toContain("Final.");
    expect(card.textContent).toContain("Guests are not counted");
    expect(within(card).getByRole("img", { name: /Ali Raza, number 7/ })).toBeTruthy();
  });

  it("lists the points of each match in a details section", () => {
    render(<SeriesAward a={award()} />);
    const d = screen.getByText("Points by match").closest("details")!;
    expect(Array.from(d.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["v Bravo40", "v Bravo20", "v Bravo18"]);
  });

  it("while the series is open it says Leading and that it is not final", () => {
    render(<SeriesAward a={award({ final: false })} />);
    const card = screen.getByRole("region", { name: "Player of the Series, so far" });
    expect(card.textContent).toContain("Leading for Player of the Series");
    expect(card.textContent).toContain("Not final until the series is closed");
  });

  it("a shared award shows every winner and says so", () => {
    render(<SeriesAward a={award({ winners: [entry(), entry({ userId: "u2", name: "Hamza Khan", number: 10, points: 78 })], others: [] })} />);
    const card = screen.getByRole("region", { name: "Player of the Series" });
    expect(card.textContent).toContain("Players of the Series");
    expect(within(card).getByText("Hamza Khan")).toBeTruthy();
    expect(card.textContent).toContain("Equal points share the award");
    expect(card.textContent).not.toContain("Next:");
  });

  it("one match and one wicket use the singular", () => {
    render(<SeriesAward a={award({ winners: [entry({ matches: 1, points: 1, wickets: 1, catches: 0, perMatch: [{ matchId: "m1", opponent: "Bravo", points: 1 }] })], others: [], matchesCounted: 1 })} />);
    expect(document.body.textContent).toContain("1 point in 1 match");
    expect(document.body.textContent).toContain("1 wicket · 0 catches");
  });
});

const sv = (over: Partial<SeriesViewData> = {}): SeriesViewData => ({
  id: "s1", name: "Alpha v Bravo", open: true, matchCount: 3,
  hero: { open: true, sides: [{ name: "Alpha", teamId: null, mine: false }, { name: "Bravo", teamId: null, mine: false }], wins: [2, 1], counted: 3, format: "open", bestOf: null, status: { text: "Alpha leads 2–1", winner: null, drawn: false, clinched: false, inProgress: true }, state: { kind: "in_progress", label: "In progress", tone: "green" }, matchCount: 3, abandoned: 0, dates: null },
  latestId: "m3", clinchedWinner: null, drawn: false, showTable: true, table: [],
  fixtures: [], results: [], notes: "", createdBy: "Ali", changedBy: "Ali", changedAt: "today", created: false, error: null, ...over,
});

describe("Series page", () => {
  it("shows the award card when there is one, and nothing when there is not", () => {
    const { unmount } = render(wrap(<SeriesView communityId="c1" d={sv({ award: award({ final: false }) })} />));
    expect(screen.getByText("Leading for Player of the Series")).toBeTruthy();
    unmount();
    render(wrap(<SeriesView communityId="c1" d={sv({ award: null })} />));
    expect(screen.queryByText(/Player of the Series/)).toBeNull();
    cleanup();
    render(wrap(<SeriesView communityId="c1" d={sv()} />));           // old data without the field still renders
    expect(screen.queryByText(/Player of the Series/)).toBeNull();
  });
});
