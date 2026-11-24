// @vitest-environment jsdom
// Phase A (UI redesign): shirt with initials, team badge, action menu, confirm dialog, snackbar with undo, adaptive nav.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/matches" }));

import ActionMenu from "@/components/ActionMenu";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog, { matchesTyped } from "@/components/ConfirmDialog";
import Frame from "@/components/Frame";
import { SnackbarProvider, useSnackbar } from "@/components/Snackbar";
import Shirt, { shirtLayout } from "@/components/Shirt";
import TeamBadge, { TEAM_COLORS, teamColor } from "@/components/TeamBadge";

afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ---------------- shirt ---------------- */
describe("shirt with number and initials", () => {
  it("big size with a name shows the number and two initials under it", () => {
    const html = renderToStaticMarkup(<Shirt number={7} size="big" name="Ali Raza" />);
    expect(html).toContain(">7<");
    expect(html).toContain(">AR<");
    expect(html).toContain("Player number 7, AR");
    expect(html).toContain('class="shirt big"');
  });
  it("big size without a name, and the smaller sizes, never show initials", () => {
    expect(renderToStaticMarkup(<Shirt number={7} size="big" />)).not.toContain("shirt-ini");
    expect(renderToStaticMarkup(<Shirt number={7} size="normal" name="Ali Raza" />)).not.toContain("shirt-ini");
    expect(renderToStaticMarkup(<Shirt number={7} size="small" name="Ali Raza" />)).not.toContain("shirt-ini");
  });
  it("no number: grey shirt with a dash, initials still shown on big", () => {
    const html = renderToStaticMarkup(<Shirt number={null} size="big" name="Zain Ahmed" />);
    expect(html).toContain("#8A97B5");
    expect(html).toContain(">–<");
    expect(html).toContain(">ZA<");
    expect(html).toContain("No player number, ZA");
  });
  it("a custom label wins over the default wording", () => {
    expect(renderToStaticMarkup(<Shirt number={null} size="small" label="Guest, no player number" />)).toContain('aria-label="Guest, no player number"');
  });
  it("two digits use a smaller font than one digit at every size, and 99 with WM fits", () => {
    for (const size of ["small", "normal", "big"] as const) {
      for (const ini of [false, true]) {
        if (ini && size !== "big") continue;
        expect(shirtLayout(size, 2, ini).numberSize).toBeLessThan(shirtLayout(size, 1, ini).numberSize);
      }
    }
    const html = renderToStaticMarkup(<Shirt number={99} size="big" name="Wasim Mirza" />);
    expect(html).toContain(">99<");
    expect(html).toContain(">WM<");
  });
  it("initials sit below the number and inside the shirt body", () => {
    const l = shirtLayout("big", 2, true);
    expect(l.initialsY).toBeGreaterThan(l.numberY);
    expect(l.initialsY).toBeLessThanOrEqual(43); // body ends at y 43
    expect(l.initialsSize).toBeGreaterThanOrEqual(7); // about 30 percent bigger than the first sample (5.6)
  });
});

/* ---------------- team badge ---------------- */
describe("team badge", () => {
  it("shows the team initials, not a shirt", () => {
    const html = renderToStaticMarkup(<TeamBadge name="Lahore Lions" />);
    expect(html).toContain(">LL<");
    expect(html).toContain('aria-label="Team Lahore Lions"');
    expect(html).not.toContain("<svg");
  });
  it("same name always gives the same colour, ignoring case and spaces", () => {
    expect(teamColor("Lahore Lions")).toEqual(teamColor("  lahore   LIONS "));
  });
  it("different teams spread over the palette", () => {
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima"];
    const used = new Set(names.map((n) => teamColor(n).bg));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
  it("every palette colour has readable text (contrast 4.5 : 1 or more)", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    for (const { bg, fg } of TEAM_COLORS) {
      const [a, b] = [lum(bg), lum(fg)].sort((x, y) => y - x);
      expect((a! + 0.05) / (b! + 0.05), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("sizes map to classes", () => {
    expect(renderToStaticMarkup(<TeamBadge name="A B" size="lg" />)).toContain("team-badge lg");
    expect(renderToStaticMarkup(<TeamBadge name="A B" size="sm" />)).toContain("team-badge sm");
  });
});

/* ---------------- action menu ---------------- */
describe("action menu", () => {
  const items = (spy = vi.fn()) => [
    { label: "Edit", href: "/c/c1/teams/t1/edit" },
    { label: "Duplicate", onSelect: spy },
    { label: "Delete", onSelect: vi.fn(), danger: true },
    { label: "Archive", disabled: true, hint: "Not while a match is live" },
  ];
  it("is closed until the three-dots button is pressed, and the button has a name", () => {
    render(<ActionMenu items={items()} label="Team actions" />);
    expect(screen.queryByRole("menu")).toBeNull();
    const btn = screen.getByRole("button", { name: "Team actions" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("menuitem").map((n) => n.textContent)).toEqual(["Edit", "Duplicate", "Delete", "ArchiveNot while a match is live"]);
  });
  it("links go to their page, buttons run and close the menu, delete is marked danger", () => {
    const spy = vi.fn();
    render(<ActionMenu items={items(spy)} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Edit" }).getAttribute("href")).toBe("/c/c1/teams/t1/edit");
    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain("danger");
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("a disabled item explains why and does nothing", () => {
    const fn = vi.fn();
    render(<ActionMenu items={[{ label: "Archive", disabled: true, hint: "Not while a match is live", onSelect: fn }]} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const it = screen.getByRole("menuitem", { name: /Archive/ });
    expect(it.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(it);
    expect(fn).not.toHaveBeenCalled();
  });
  it("Escape closes it and gives focus back to the button; arrows move between items", () => {
    render(<ActionMenu items={items()} />);
    const btn = screen.getByRole("button", { name: "More actions" });
    fireEvent.click(btn);
    const [edit, dup] = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(edit);
    fireEvent.keyDown(edit!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(dup);
    fireEvent.keyDown(dup!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(edit);
    fireEvent.keyDown(edit!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(btn);
  });
  it("a tap outside closes it", () => {
    render(<div><span data-testid="out">x</span><ActionMenu items={items()} /></div>);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.pointerDown(screen.getByTestId("out"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("renders nothing for an empty list", () => {
    const { container } = render(<ActionMenu items={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

/* ---------------- confirm dialog ---------------- */
describe("confirm dialog", () => {
  const base = { title: "Delete team?", body: "This cannot be undone.", confirmLabel: "Delete team" };
  it("is not on screen when closed", () => {
    render(<ConfirmDialog {...base} open={false} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("plain: Cancel has the focus first, confirm runs the action, Escape cancels", async () => {
    const ok = vi.fn();
    const close = vi.fn();
    render(<ConfirmDialog {...base} open danger onConfirm={ok} onClose={close} />);
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete team" })); });
    expect(ok).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("typed name: the confirm button stays off until the exact name is typed", async () => {
    const ok = vi.fn();
    render(<ConfirmDialog {...base} open danger typeToConfirm="Lahore Lions" onConfirm={ok} onClose={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Delete team" }) as HTMLButtonElement;
    const field = screen.getByLabelText(/Type/) as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect(confirm.disabled).toBe(true);
    fireEvent.change(field, { target: { value: "Lahore" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(field, { target: { value: "  lahore   lions " } });
    expect(confirm.disabled).toBe(false);
    await act(async () => { fireEvent.click(confirm); });
    expect(ok).toHaveBeenCalledTimes(1);
  });
  it("typed name: Enter in the field cannot confirm a wrong name", async () => {
    const ok = vi.fn();
    render(<ConfirmDialog {...base} open typeToConfirm="Lahore Lions" onConfirm={ok} onClose={vi.fn()} />);
    const field = screen.getByLabelText(/Type/);
    fireEvent.change(field, { target: { value: "nope" } });
    await act(async () => { fireEvent.keyDown(field, { key: "Enter" }); });
    expect(ok).not.toHaveBeenCalled();
  });
  it("what was typed is forgotten when the box opens again", () => {
    const { rerender } = render(<ConfirmDialog {...base} open typeToConfirm="Abc" onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: "Abc" } });
    rerender(<ConfirmDialog {...base} open={false} typeToConfirm="Abc" onConfirm={vi.fn()} onClose={vi.fn()} />);
    rerender(<ConfirmDialog {...base} open typeToConfirm="Abc" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect((screen.getByLabelText(/Type/) as HTMLInputElement).value).toBe("");
  });
  it("matchesTyped ignores case and spaces but never matches an empty name", () => {
    expect(matchesTyped("  The  Team ", "the team")).toBe(true);
    expect(matchesTyped("", "")).toBe(false);
    expect(matchesTyped("a", "b")).toBe(false);
  });
});

/* ---------------- snackbar ---------------- */
function Buttons({ commit, onUndo }: { commit: () => void; onUndo?: () => void }) {
  const s = useSnackbar();
  return (
    <>
      <button onClick={() => s.show({ message: "Saved", tone: "success" })}>show</button>
      <button onClick={() => s.undoable({ message: "Venue deleted", commit, onUndo })}>del</button>
      <button onClick={() => s.undoable({ message: "Second delete", commit: vi.fn() })}>del2</button>
    </>
  );
}
describe("snackbar", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  it("shows a message and removes it after a few seconds", () => {
    render(<SnackbarProvider><Buttons commit={vi.fn()} /></SnackbarProvider>);
    fireEvent.click(screen.getByText("show"));
    expect(screen.getByText("Saved")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4100); });
    expect(screen.queryByText("Saved")).toBeNull();
  });
  it("Undo: the real delete waits, and runs after 6 seconds if Undo is not pressed", () => {
    const commit = vi.fn();
    render(<SnackbarProvider><Buttons commit={commit} /></SnackbarProvider>);
    fireEvent.click(screen.getByText("del"));
    expect(screen.getByText("Venue deleted")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(commit).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1100); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Venue deleted")).toBeNull();
  });
  it("Undo pressed: the delete never happens and the undo hook runs", () => {
    const commit = vi.fn();
    const onUndo = vi.fn();
    render(<SnackbarProvider><Buttons commit={commit} onUndo={onUndo} /></SnackbarProvider>);
    fireEvent.click(screen.getByText("del"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(commit).not.toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Venue deleted")).toBeNull();
  });
  it("a new message while a delete is waiting finishes that delete first (nothing is lost)", () => {
    const commit = vi.fn();
    render(<SnackbarProvider><Buttons commit={commit} /></SnackbarProvider>);
    fireEvent.click(screen.getByText("del"));
    fireEvent.click(screen.getByText("show"));
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it("leaving the page finishes a waiting delete", () => {
    const commit = vi.fn();
    render(<SnackbarProvider><Buttons commit={commit} /></SnackbarProvider>);
    fireEvent.click(screen.getByText("del"));
    window.dispatchEvent(new Event("pagehide"));
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it("the message is announced politely to screen readers", () => {
    render(<SnackbarProvider><Buttons commit={vi.fn()} /></SnackbarProvider>);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});

/* ---------------- adaptive navigation ---------------- */
describe("navigation: bar, rail and sidebar", () => {
  it("has the five labelled tabs with the right links and marks the current one", () => {
    render(<BottomNav communityId="c1" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const main = Array.from(nav.querySelectorAll(":scope > ul a")).map((a) => [a.textContent, a.getAttribute("href")]);
    expect(main).toEqual([
      ["Home", "/c/c1"],
      ["Matches", "/c/c1/matches"],
      ["Teams", "/c/c1/teams"],
      ["Payments", "/c/c1/payments"],
      ["Profile", "/c/c1/profile"],
    ]);
    expect(nav.querySelector('a[aria-current="page"]')?.textContent).toBe("Matches");
  });
  it("the sidebar-only list has the other places and a way to switch community", () => {
    render(<BottomNav communityId="c1" />);
    const more = Array.from(document.querySelectorAll(".nav-more a")).map((a) => [a.textContent, a.getAttribute("href")]);
    expect(more).toEqual([
      ["Community", "/c/c1/community"],
      ["Series", "/c/c1/series"],
      ["Leaderboard", "/c/c1/leaderboard"],
      ["Insights", "/c/c1/insights"],
      ["Members", "/c/c1/members"],
      ["Alerts", "/c/c1/alerts"],
      ["Switch community", "/switch"],
    ]);
  });
  it("the page frame keeps the header, back link and content, and the side panel is optional", () => {
    const withPanel = renderToStaticMarkup(<Frame communityId="c1" title="Teams" back="/c/c1" panel={<p>Details</p>}><p>Body</p></Frame>);
    expect(withPanel).toContain("<h1>Teams</h1>");
    expect(withPanel).toContain('aria-label="Back"');
    expect(withPanel).toContain("<p>Body</p>");
    expect(withPanel).toContain('class="panel"');
    const without = renderToStaticMarkup(<Frame communityId="c1" title="Teams"><p>Body</p></Frame>);
    expect(without).not.toContain('class="panel"');
    expect(without).toContain('class="app has-nav"');
  });
});

describe("Shirt hideNumber (public profile)", () => {
  it("shows initials and no number, gold", () => {
    const html = renderToStaticMarkup(<Shirt size="big" name="Ali Raza" hideNumber />);
    expect(html).toContain("shirt-ini");
    expect(html).toContain("AR");
    expect(html).not.toContain("shirt-num");
    expect(html).toContain("#F5C84B");
  });
  it("ignores hideNumber when there is no name or the size is not big", () => {
    expect(renderToStaticMarkup(<Shirt number={7} size="big" hideNumber />)).toContain("shirt-num");
    expect(renderToStaticMarkup(<Shirt number={7} size="normal" name="Ali Raza" hideNumber />)).toContain("shirt-num");
  });
});
