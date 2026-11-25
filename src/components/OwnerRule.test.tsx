// @vitest-environment jsdom
// The screens follow the rule "the person who added it, or an Admin, can cancel or delete it": the button is replaced by the reason.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/c/c1", useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/app/actions4", () => ({ cancelAction: vi.fn(), deleteMatchAction: vi.fn(), postponeAction: vi.fn() }));
vi.mock("@/app/actions7", () => ({ deleteVenueAction: vi.fn(), deleteBookingAction: vi.fn(), deletePaymentAction: vi.fn(), bookingStatusAction: vi.fn(), remindPaymentsAction: vi.fn(), verifyPaymentAction: vi.fn() }));
vi.mock("@/app/actionsSeries", () => ({ deleteSeriesAction: vi.fn() }));
vi.mock("@/app/actionsF1", () => ({ seriesStatusQuietAction: vi.fn(async () => ({ ok: true })), removeMatchQuietAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/app/actions3", () => ({ deleteTeamAction: vi.fn() }));
vi.mock("@/app/actionsB4", () => ({ removeFromSquadAction: vi.fn(), setTeamRoleAction: vi.fn() }));

import { DeleteBooking, PaymentRecordRow, type RecordRowData } from "@/components/BookingActions";
import MatchManage from "@/components/MatchManage";
import { PvVenueDelete } from "@/components/PvVenueEdit";
import { DeleteCard, SeriesMenu, SeriesQuickTools } from "@/components/SeriesActions";
import { SnackbarProvider } from "@/components/Snackbar";
import TeamDangerZone from "@/components/TeamDangerZone";
import { TeamTopActions } from "@/components/TeamPageBits";

afterEach(cleanup);
const wrap = (ui: React.ReactNode) => <SnackbarProvider>{ui}</SnackbarProvider>;

describe("Match: Manage match", () => {
  const draw = (canManage?: boolean) => render(<MatchManage communityId="c1" matchId="m1" status="scheduled" title="Alpha v Bravo" whenLabel="Fri 8 pm" keys={["postpone", "cancel", "delete"]} canManage={canManage} />);
  it("the person who added it (or an Admin) can press Cancel and Delete", () => {
    draw(true);
    expect(screen.getByRole("button", { name: /Cancel match/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Delete match/ })).toBeTruthy();
  });
  it("another member sees Cancel and Delete dimmed with the reason, and can still postpone", () => {
    draw(false);
    expect(screen.queryByRole("button", { name: /Cancel match/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete match/ })).toBeNull();
    expect(screen.getByText("Only the person who added this match, or an Admin, can cancel it.")).toBeTruthy();
    expect(screen.getByText("Only the person who added this match, or an Admin, can delete it.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Postpone/ })).toBeTruthy();
  });
});

describe("Team", () => {
  it("the delete card is replaced by the reason for another member", () => {
    render(<TeamDangerZone communityId="c1" teamId="t1" name="Thunder" matchCount={0} canDelete={false} addedBy="Ali Raza" />);
    expect(screen.queryByRole("button", { name: /Delete Thunder/ })).toBeNull();
    expect(screen.getByText("Only Ali Raza (who added this) or an Admin can delete it.")).toBeTruthy();
  });
  it("and is the same as before for the person who added it", () => {
    render(<TeamDangerZone communityId="c1" teamId="t1" name="Thunder" matchCount={0} />);
    expect(screen.getByRole("button", { name: /Delete Thunder/ })).toBeTruthy();
  });
  it("the team page menu has no Delete team for another member", () => {
    const { container } = render(<TeamTopActions communityId="c1" teamId="t1" name="Thunder" matchCount={0} canDelete={false} />);
    expect(container.textContent).not.toContain("Delete team");
  });
});

describe("Series", () => {
  const ref = (canDelete?: boolean) => ({ id: "s1", name: "Alpha v Bravo", open: true, matchCount: 3, canDelete, addedBy: "Ali Raza" });
  it("the Delete card shows the reason and no button for another member", () => {
    render(wrap(<DeleteCard communityId="c1" series={ref(false)} />));
    expect(screen.queryByRole("button", { name: /Delete series/ })).toBeNull();
    expect(screen.getByText(/Only Ali Raza \(who added this\) or an Admin can delete it\./)).toBeTruthy();
  });
  it("the bin button is gone for another member and present for the creator", () => {
    render(wrap(<SeriesQuickTools communityId="c1" series={ref(false)} />));
    expect(screen.queryByRole("button", { name: /Delete Alpha v Bravo/ })).toBeNull();
    cleanup();
    render(wrap(<SeriesQuickTools communityId="c1" series={ref(true)} />));
    expect(screen.getByRole("button", { name: /Delete Alpha v Bravo/ })).toBeTruthy();
    cleanup();
    render(wrap(<SeriesMenu communityId="c1" series={ref(undefined)} />));   // missing means yes
    expect(screen.getByRole("button", { name: /Actions for Alpha v Bravo/ })).toBeTruthy();
  });
});

describe("Venue and booking", () => {
  it("the venue delete card is the reason, with no button, for another member", () => {
    render(wrap(<PvVenueDelete communityId="c1" venueId="v1" name="Indoor Arena" bookingCount={0} canDelete={false} addedBy="Hamza" />));
    expect(screen.queryByRole("button", { name: /Delete Indoor Arena/ })).toBeNull();
    expect(screen.getByText("Only Hamza (who added this) or an Admin can delete it.")).toBeTruthy();
  });
  it("the booking delete is the reason for another member, and the button for the creator", () => {
    render(wrap(<DeleteBooking communityId="c1" bookingId="b1" venue="Arena" when="Fri 8 pm" canDelete={false} addedBy="Hamza" />));
    expect(screen.queryByRole("button", { name: /Delete booking/ })).toBeNull();
    expect(screen.getByText("Only Hamza (who added this) or an Admin can delete it.")).toBeTruthy();
    cleanup();
    render(wrap(<DeleteBooking communityId="c1" bookingId="b1" venue="Arena" when="Fri 8 pm" />));
    expect(screen.getByRole("button", { name: /Delete booking/ })).toBeTruthy();
  });
});

describe("Payment record", () => {
  const row = (canChange?: boolean): RecordRowData => ({
    id: "p1", payerName: "Ali Raza", payerHref: null, number: 7, guest: false, kind: "payment", amount: 500, methodLabel: "Cash", paidOn: "2026-11-25", reference: "",
    recordedBy: "Hamza", changedBy: null, checkedBy: null, canChange,
  });
  const menuLabels = async (canChange?: boolean) => {
    render(wrap(<PaymentRecordRow communityId="c1" bookingId="b1" base="/c/c1/payments/b1" r={row(canChange)} />));
    screen.getByRole("button", { name: /Actions for the/ }).click();
    return (await screen.findAllByRole("menuitem")).map((m) => m.textContent);
  };
  it("the recorder (or an Admin) can edit, check and remove", async () => {
    expect(await menuLabels(true)).toEqual(["Edit record", "Mark checked", "Remove record"]);
  });
  it("another member can only mark it checked", async () => {
    expect(await menuLabels(false)).toEqual(["Mark checked"]);
  });
});
