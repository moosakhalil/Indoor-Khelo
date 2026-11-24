// @vitest-environment jsdom
// L1 leftovers: cancel box coming count, typed-name tick, lineup Back guard.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1/matches/m1/lineup", useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/app/actions4", () => ({ addGuestAction: vi.fn(), fillInAction: vi.fn(), setLineupAction: vi.fn(), cancelAction: vi.fn(), deleteMatchAction: vi.fn(), postponeAction: vi.fn() }));
vi.mock("@/app/actionsC3", () => ({ addGuestC3: vi.fn(), removeGuestC3: vi.fn(), saveLineupC3: vi.fn() }));

import ConfirmDialog from "@/components/ConfirmDialog";
import LineupPicker from "@/components/LineupPicker";
import MatchManage from "@/components/MatchManage";
import { SnackbarProvider } from "@/components/Snackbar";
import { comingText } from "@/lib/crManage";
import type { PickMember } from "@/lib/lineupPick";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => push.mockReset());

describe("L1: cancel box shows who said they were coming", () => {
  it("wording", () => {
    expect(comingText(0)).toBe("");
    expect(comingText(1)).toBe("1 player said they were coming");
    expect(comingText(7)).toBe("7 players said they were coming");
  });
  const open = (n?: number) => {
    render(<MatchManage communityId="c1" matchId="m1" status="scheduled" title="A v B" whenLabel="Sat" variant="card" comingCount={n} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel match/ }));
    return screen.getByRole("alertdialog", { name: "Cancel this match?" });
  };
  it("is shown when above zero and keeps the old text", () => {
    const d = open(5);
    expect(d.textContent).toContain("5 players said they were coming");
    expect(d.textContent).toContain("Everyone gets an alert");
    expect(within(d).getByRole("button", { name: "Keep match" })).toBeTruthy();
    expect(within(d).getByRole("button", { name: "Cancel match" })).toBeTruthy();
  });
  it("is hidden at zero or when not given", () => {
    expect(open(0).textContent).not.toContain("said they were coming");
    cleanup();
    expect(open().textContent).not.toContain("said they were coming");
  });
});

describe("L1: typed-name tick", () => {
  const base = { open: true, title: "Delete", body: "x", confirmLabel: "Delete", typeToConfirm: "Thunder", onClose: vi.fn() };
  it("shows tick and words only when the name matches; button follows", () => {
    const ok = vi.fn();
    const { container } = render(<ConfirmDialog {...base} onConfirm={ok} />);
    const input = screen.getByRole("textbox");
    const btn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(container.querySelector(".dlg-tick")).toBeNull();
    fireEvent.change(input, { target: { value: "thun" } });
    expect(btn.disabled).toBe(true);
    expect(screen.queryByText("The name matches.")).toBeNull();
    fireEvent.change(input, { target: { value: "  thunder " } });
    expect(btn.disabled).toBe(false);
    expect(screen.getByText("The name matches.")).toBeTruthy();
    expect(container.querySelector(".dlg-tick")).not.toBeNull();
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByText("The name matches.").id);
    fireEvent.change(input, { target: { value: "thunde" } });
    expect(btn.disabled).toBe(true);
    expect(screen.queryByText("The name matches.")).toBeNull();
  });
  it("plain dialogs have no field or tick", () => {
    const { container } = render(<ConfirmDialog {...base} typeToConfirm={undefined} onConfirm={vi.fn()} />);
    expect(container.querySelector(".dlg-tick")).toBeNull();
    expect(container.querySelector(".dlg-match")).toBeNull();
  });
});

describe("L1: lineup Back guard", () => {
  const T = "Thunder Strikers";
  const R = "Royal Panthers";
  const MEMBERS: PickMember[] = [{ id: "a", name: "Ali Raza", number: 7, answer: "in", role: null, saved: 0 }];
  const mount = () => render(
    <SnackbarProvider>
      <LineupPicker communityId="c1" matchId="m1" sides={[T, R]} max={2} members={MEMBERS} guests={[]} fixed={[0, 0]} notice={null} editHref="/e" />
    </SnackbarProvider>,
  );
  const dirtyIt = () => fireEvent.click(screen.getByLabelText(`Ali Raza: play for ${T}`));
  const back = () => act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
  const title = { name: "Leave without saving?" };

  it("does nothing when nothing changed", () => {
    const push = vi.spyOn(window.history, "pushState");
    mount();
    back();
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog", title)).toBeNull();
  });
  it("pushes one guard entry when dirty, asks on Back, Keep editing stays", () => {
    const pushS = vi.spyOn(window.history, "pushState");
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    mount();
    dirtyIt();
    expect(pushS).toHaveBeenCalledTimes(1);
    back();
    const dlg = screen.getByRole("alertdialog", title);
    expect(within(dlg).getByRole("button", { name: "Keep editing" })).toBeTruthy();
    expect(within(dlg).getByRole("button", { name: "Leave" })).toBeTruthy();
    expect(pushS).toHaveBeenCalledTimes(2); // guard put back so the page stays
    fireEvent.click(within(dlg).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog", title)).toBeNull();
    expect(go).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
  it("Leave goes back past the guard", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    mount();
    dirtyIt();
    back();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(go).toHaveBeenCalledWith(-2);
    expect(push).not.toHaveBeenCalled();
  });
  it("no guard after the change is undone", () => {
    mount();
    dirtyIt();
    fireEvent.click(screen.getByLabelText("Ali Raza: not playing"));
    back();
    expect(screen.queryByRole("alertdialog", title)).toBeNull();
  });
});
