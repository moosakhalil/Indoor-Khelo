// @vitest-environment jsdom
// Builder 3 (UI redesign): Members, Manage member, Join requests and Community settings.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
const push = vi.fn();
const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, replace }), usePathname: () => "/c/c1/members" }));

const setRoleB3 = vi.fn();
const removeMemberB3 = vi.fn();
const resetNumberB3 = vi.fn();
const decideRequestB3 = vi.fn();
const approveManyB3 = vi.fn();
const reopenRequestB3 = vi.fn();
vi.mock("@/app/actionsB3", () => ({
  setRoleB3: (...a: unknown[]) => setRoleB3(...a),
  removeMemberB3: (...a: unknown[]) => removeMemberB3(...a),
  resetNumberB3: (...a: unknown[]) => resetNumberB3(...a),
  decideRequestB3: (...a: unknown[]) => decideRequestB3(...a),
  approveManyB3: (...a: unknown[]) => approveManyB3(...a),
  reopenRequestB3: (...a: unknown[]) => reopenRequestB3(...a),
}));
const updateCommunityAction = vi.fn();
vi.mock("@/app/actions2", () => ({ updateCommunityAction: (...a: unknown[]) => updateCommunityAction(...a) }));

import ManageMember from "@/components/ManageMember";
import MembersList from "@/components/MembersList";
import RequestsList from "@/components/RequestsList";
import { DangerZone, SettingsForm, SettingsPreview, SettingsProvider } from "@/components/SettingsB3";
import { SnackbarProvider } from "@/components/Snackbar";
import type { MemberItem } from "@/lib/b3";

beforeEach(() => {
  [push, refresh, replace, setRoleB3, removeMemberB3, resetNumberB3, decideRequestB3, approveManyB3, reopenRequestB3, updateCommunityAction].forEach((f) => f.mockReset());
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const wrap = (ui: React.ReactNode) => render(<SnackbarProvider>{ui}</SnackbarProvider>);
const CID = "11111111-1111-4111-8111-111111111111";
const U1 = "22222222-2222-4222-8222-222222222222";

/* ---------------- Members ---------------- */
const members: MemberItem[] = [
  { user_id: "me", name: "Ali Raza", role: "admin", player_number: 7, playing_role: "batter" },
  { user_id: "u2", name: "Hamza Khan", role: "admin", player_number: 10, playing_role: "all_rounder" },
  { user_id: "u3", name: "Bilal Ahmed", role: "member", player_number: 18, playing_role: "bowler" },
  { user_id: "u4", name: "Hassan Raza", role: "member", player_number: 77, playing_role: "bowler" },
  { user_id: "u5", name: "Imran Javed", role: "member", player_number: 5, playing_role: "wicket_keeper" },
  { user_id: "u6", name: "Arsalan Mir", role: "member", player_number: null, playing_role: null },
];

describe("Members list", () => {
  it("every row is a gold shirt with the number, the name, an Admin badge and the playing role; a missing number is a grey shirt and says so", () => {
    const { container } = render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    expect(container.querySelectorAll("svg.shirt")).toHaveLength(6);
    expect(container.innerHTML).toContain("#8A97B5"); // grey shirt for Arsalan
    expect(screen.getByText("Choosing a new number")).toBeTruthy();
    expect(screen.getAllByText("Admin")).toHaveLength(2);
    expect(screen.getByLabelText("Open Ali Raza (you)")).toBeTruthy();
    expect(screen.getByText("YOU")).toBeTruthy();
    expect(container.querySelector(".mb-avatar, .avatar")).toBeNull(); // the shirt rule: no initials avatar
  });

  it("shows the count under the chips, with places left", () => {
    render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    expect(screen.getByRole("status").textContent).toBe("6 of 6 members · 93 places left");
  });

  it("role filters: Admins, Batters, Bowlers, All-rounders, Keepers, each with a count; the active one is solid (aria-pressed)", () => {
    render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    const group = screen.getByRole("group", { name: "Filter by role" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["All 6", "Admins 2", "Batters 1", "Bowlers 2", "All-rounders 1", "Keepers 1"]);
    fireEvent.click(screen.getByRole("button", { name: /^Admins/ }));
    expect(screen.getByRole("button", { name: /^Admins/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^Admins/ }).className).toContain("on");
    expect(screen.getByRole("status").textContent).toContain("2 of 6 members");
    expect(screen.queryByLabelText("Open Bilal Ahmed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Keepers/ }));
    expect(screen.getByLabelText("Open Imran Javed")).toBeTruthy();
  });

  it("name search is a substring; a number only matches exactly; an x clears the search", () => {
    render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    const box = screen.getByLabelText(/Search members/);
    fireEvent.change(box, { target: { value: "ha" } });
    expect(screen.getByLabelText("Open Hamza Khan")).toBeTruthy();
    expect(screen.getByLabelText("Open Hassan Raza")).toBeTruthy();
    expect(screen.queryByLabelText("Open Imran Javed")).toBeNull();
    fireEvent.change(box, { target: { value: "7" } });
    expect(screen.getByLabelText("Open Ali Raza (you)")).toBeTruthy();
    expect(screen.queryByLabelText("Open Hassan Raza")).toBeNull(); // 77 is not 7
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((box as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Open Hassan Raza")).toBeTruthy();
  });

  it("no result: a real empty state that names the rule, and a Clear search button that brings everyone back", () => {
    render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    fireEvent.change(screen.getByLabelText(/Search members/), { target: { value: "zzz" } });
    expect(screen.getByText("No one matches")).toBeTruthy();
    expect(screen.getByText(/name or an exact player number/)).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Clear search" });
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(screen.queryByText("No one matches")).toBeNull();
    expect(screen.getByLabelText("Open Bilal Ahmed")).toBeTruthy();
  });

  it("an Admin gets a menu on every row except their own; it links to the Manage page with the right anchor", () => {
    render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    expect(screen.queryByRole("button", { name: "Actions for Ali" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Actions for Bilal" }));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["View profile", "Make Admin", "Ask for a new number", "Remove from community"]);
    expect(items[0]!.getAttribute("href")).toBe("/c/c1/players/u3");
    expect(items[1]!.getAttribute("href")).toBe("/c/c1/members/u3?do=role");
    expect(items[2]!.getAttribute("href")).toBe("/c/c1/members/u3?do=number");
    expect(items[3]!.getAttribute("href")).toBe("/c/c1/members/u3?do=remove");
    expect(items[3]!.className).toContain("danger");
  });

  it("the menu of an Admin row offers Take Admin away and switches Remove off with the reason; no number means nothing to reset", () => {
    render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Hamza" }));
    const items = screen.getAllByRole("menuitem");
    expect(items[1]!.textContent).toBe("Take Admin away");
    expect(items[3]!.getAttribute("aria-disabled")).toBe("true");
    expect(items[3]!.textContent).toContain("Take Admin away first");
  });

  it("a member (not Admin) sees no menus, only chevrons and the same filters", () => {
    const { container } = render(<MembersList members={members} meId="u3" isAdmin={false} communityId="c1" />);
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    expect(container.querySelectorAll(".mb-chev")).toHaveLength(6);
    expect(screen.getByRole("button", { name: /^Bowlers/ })).toBeTruthy();
    expect(container.textContent).not.toContain("manage someone");
  });

  it("sort by number puts the people without a number last", () => {
    const { container } = render(<MembersList members={members} meId="me" isAdmin communityId="c1" />);
    fireEvent.change(screen.getByLabelText("Sort members"), { target: { value: "number" } });
    const names = Array.from(container.querySelectorAll(".mb-row .t b")).map((b) => b.firstChild?.textContent);
    expect(names[0]).toBe("Imran Javed"); // number 5
    expect(names[names.length - 1]).toBe("Arsalan Mir");
  });
});

/* ---------------- Manage member ---------------- */
const baseProps = { communityId: CID, communityName: "Karachi Indoor Cricket Club", userId: U1, name: "Bilal Ahmed", role: "member" as const, number: 18, isSelf: false, adminCount: 2 };

describe("Manage member", () => {
  it("shows the person first (big shirt with the number and initials), then three cards; no hidden expander", () => {
    const { container } = wrap(<ManageMember {...baseProps} />);
    expect(container.querySelector("svg.shirt.big")).toBeTruthy();
    expect(container.innerHTML).toContain(">BA<");
    expect(screen.getByRole("heading", { name: "Bilal Ahmed" })).toBeTruthy();
    expect(screen.getByText("Admin role")).toBeTruthy();
    expect(screen.getByText("Player number")).toBeTruthy();
    expect(screen.getByText("Remove from community")).toBeTruthy();
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByRole("link", { name: /View player profile/ }).getAttribute("href")).toBe(`/c/${CID}/players/${U1}`);
  });

  it("Remove opens a dialog that names the person; the button says what it does; it removes and goes back to the list", async () => {
    removeMemberB3.mockResolvedValue("ok");
    wrap(<ManageMember {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove Bilal/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Remove Bilal Ahmed?")).toBeTruthy();
    expect(dlg.textContent).toContain("Karachi Indoor Cricket Club");
    expect(dlg.textContent).toContain("number 18 is freed");
    expect(removeMemberB3).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Remove Bilal" }));
    await waitFor(() => expect(removeMemberB3).toHaveBeenCalledWith(CID, U1));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/c/${CID}/members`));
  });

  it("Remove is switched off for an Admin, with the reason", () => {
    wrap(<ManageMember {...baseProps} name="Hamza Khan" role="admin" />);
    const btn = screen.getByRole("button", { name: /Remove Hamza/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Hamza is an Admin. Take Admin away first.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Take Admin away/ })).toBeTruthy();
  });

  it("Take Admin away is switched off for the only Admin, with the reason", () => {
    wrap(<ManageMember {...baseProps} name="Ali Raza" role="admin" isSelf adminCount={1} />);
    expect((screen.getByRole("button", { name: /Take Admin away/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/You are the only Admin/)).toBeTruthy();
  });

  it("own page: a Leaving card points to the Community page and there is no Remove", () => {
    wrap(<ManageMember {...baseProps} name="Ali Raza" role="admin" isSelf adminCount={2} />);
    expect(screen.getByText("Leaving")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Go to Community/ }).getAttribute("href")).toBe(`/c/${CID}/community`);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByText("YOU")).toBeTruthy();
  });

  it("Ask for a new number opens a dialog with the consequence, then frees the number and shows the green notice", async () => {
    resetNumberB3.mockResolvedValue("ok");
    const { container } = wrap(<ManageMember {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Ask Bilal to choose a new number/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("blocked");
    fireEvent.click(within(dlg).getByRole("button", { name: "Ask for a new number" }));
    await waitFor(() => expect(resetNumberB3).toHaveBeenCalledWith(CID, U1));
    await waitFor(() => expect(container.querySelector(".mb-banner.green")?.textContent).toContain("must choose a new number"));
    expect(refresh).toHaveBeenCalled();
  });

  it("a member with no number: dashed grey shirt, 'Choosing a new number', and the number card says nothing to reset", () => {
    const { container } = wrap(<ManageMember {...baseProps} name="Arsalan Mir" number={null} />);
    expect(container.querySelector(".mb-shirt-none")).toBeTruthy();
    expect(container.innerHTML).toContain("#8A97B5");
    expect(screen.getByText("Choosing a new number")).toBeTruthy();
    expect(screen.getByText(/Nothing to reset/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /choose a new number/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Remove Arsalan/ })).toBeTruthy();
  });

  it("Make Admin happens at once, says so, and Undo calls the opposite action", async () => {
    setRoleB3.mockResolvedValue("ok");
    wrap(<ManageMember {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Make Admin/ }));
    await waitFor(() => expect(setRoleB3).toHaveBeenCalledWith(CID, U1, "admin"));
    await screen.findByText("Bilal Ahmed is now an Admin");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(setRoleB3).toHaveBeenLastCalledWith(CID, U1, "member"));
    await screen.findByText("Bilal Ahmed is a member again");
  });

  it("Take Admin away also gets an Undo that makes them Admin again", async () => {
    setRoleB3.mockResolvedValue("ok");
    wrap(<ManageMember {...baseProps} name="Hamza Khan" role="admin" />);
    fireEvent.click(screen.getByRole("button", { name: /Take Admin away/ }));
    await waitFor(() => expect(setRoleB3).toHaveBeenCalledWith(CID, U1, "member"));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(setRoleB3).toHaveBeenLastCalledWith(CID, U1, "admin"));
  });

  it("taking your own Admin away asks first (there is no Undo for it)", async () => {
    setRoleB3.mockResolvedValue("ok");
    wrap(<ManageMember {...baseProps} name="Ali Raza" role="admin" isSelf adminCount={2} />);
    fireEvent.click(screen.getByRole("button", { name: /Take Admin away/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Take my Admin away" }));
    await waitFor(() => expect(setRoleB3).toHaveBeenCalledWith(CID, U1, "member"));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/c/${CID}/members`));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("every server error shows in one banner pattern: a bold headline, then the reason", () => {
    const cases: [string, string][] = [
      ["is_admin", "Cannot remove an Admin"], ["is_self", "You cannot remove yourself"], ["last_admin", "You are the only Admin"],
      ["not_found", "Member not found"], ["forbidden", "Admins only"], ["no_change", "No change"],
    ];
    for (const [code, headline] of cases) {
      const { container, unmount } = wrap(<ManageMember {...baseProps} initialError={code} />);
      const b = container.querySelector(".mb-banner")!;
      expect(b.querySelector("b")!.textContent).toBe(headline);
      expect(b.querySelector("span")!.textContent!.length).toBeGreaterThan(5);
      unmount();
    }
  });

  it("is_admin banner carries a Take Admin away button; no_change is neutral, not red; last_admin offers Choose an Admin", async () => {
    setRoleB3.mockResolvedValue("ok");
    const a = wrap(<ManageMember {...baseProps} name="Hamza Khan" role="admin" initialError="is_admin" />);
    const bannerBtn = within(a.container.querySelector(".mb-banner") as HTMLElement).getByRole("button", { name: "Take Admin away" });
    fireEvent.click(bannerBtn);
    await waitFor(() => expect(setRoleB3).toHaveBeenCalledWith(CID, U1, "member"));
    a.unmount();
    const n = wrap(<ManageMember {...baseProps} initialError="no_change" />);
    expect(n.container.querySelector(".mb-banner")!.className).toContain("mute");
    expect(n.container.querySelector(".mb-banner")!.className).not.toContain("red");
    n.unmount();
    wrap(<ManageMember {...baseProps} name="Ali Raza" role="admin" isSelf adminCount={1} initialError="last_admin" />);
    expect(screen.getByRole("link", { name: "Choose an Admin" }).getAttribute("href")).toBe(`/c/${CID}/members`);
  });

  it("a server error from an action lands in the same banner (person left in the meantime)", async () => {
    removeMemberB3.mockResolvedValue("not_found");
    wrap(<ManageMember {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove Bilal/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove Bilal" }));
    await screen.findByText("Member not found");
    expect(push).not.toHaveBeenCalled();
  });

  it("?do=remove opens the Remove question on arrival (from the list menu) but never does anything by itself", () => {
    wrap(<ManageMember {...baseProps} autoOpen="remove" />);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(removeMemberB3).not.toHaveBeenCalled();
  });
});

/* ---------------- Join requests ---------------- */
const reqs = [
  { userId: "r1", name: "Zeeshan Anwar", asked: "2 h ago" },
  { userId: "r2", name: "Mubashir Hassan", asked: "5 h ago" },
  { userId: "r3", name: "Kashif Mehmood", asked: "yesterday" },
];

describe("Join requests", () => {
  it("each request shows when it was made; the grey shirt and the repeated 'Number chosen after approval' are gone (said once)", () => {
    const { container } = wrap(<RequestsList communityId="c1" requests={reqs} members={24} />);
    expect(screen.getByText("Asked 2 h ago")).toBeTruthy();
    expect(screen.getByText("Asked yesterday")).toBeTruthy();
    expect(container.querySelector("svg.shirt")).toBeNull();
    expect(container.textContent!.match(/Number chosen after approval/g) ?? []).toHaveLength(0);
    expect(container.textContent!.match(/choose their own player number/g)!.length).toBeLessThanOrEqual(2);
    expect(screen.getByText("3 waiting")).toBeTruthy();
  });

  it("shows places left (cap 99): members now and places left", () => {
    const { container } = wrap(<RequestsList communityId="c1" requests={reqs} members={24} />);
    expect(container.textContent).toContain("24 of 99");
    expect(container.querySelector(".rq-next dd:last-of-type")!.textContent).toBe("75");
  });

  it("Approve is the main button, then a message says who was approved and what happens next", async () => {
    decideRequestB3.mockResolvedValue("ok");
    wrap(<RequestsList communityId="c1" requests={reqs} members={24} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve Zeeshan Anwar" }));
    await waitFor(() => expect(decideRequestB3).toHaveBeenCalledWith("c1", "r1", "approve"));
    await screen.findByText("Zeeshan Anwar approved. They choose a player number next.");
    expect(screen.queryByRole("button", { name: "Approve Zeeshan Anwar" })).toBeNull();
    expect(screen.getByText("2 waiting")).toBeTruthy();
  });

  it("Reject has no dialog: it happens at once with an Undo that puts the request back", async () => {
    decideRequestB3.mockResolvedValue("ok");
    reopenRequestB3.mockResolvedValue("ok");
    wrap(<RequestsList communityId="c1" requests={reqs} members={24} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject Zeeshan Anwar" }));
    await waitFor(() => expect(decideRequestB3).toHaveBeenCalledWith("c1", "r1", "reject"));
    await screen.findByText("Zeeshan Anwar rejected");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(reopenRequestB3).toHaveBeenCalledWith("c1", "r1"));
    await screen.findByText("Zeeshan Anwar is waiting again");
    expect(screen.getByRole("button", { name: "Approve Zeeshan Anwar" })).toBeTruthy();
  });

  it("one request: no Select / Approve all bar", () => {
    wrap(<RequestsList communityId="c1" requests={[reqs[0]!]} members={24} />);
    expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Approve all/ })).toBeNull();
    expect(screen.getByText("1 waiting")).toBeTruthy();
  });

  it("Approve all asks first, then approves everybody in one call", async () => {
    approveManyB3.mockResolvedValue({ approved: ["r1", "r2", "r3"], failed: [] });
    wrap(<RequestsList communityId="c1" requests={reqs} members={24} />);
    fireEvent.click(screen.getByRole("button", { name: /Approve all 3/ }));
    const dlg = screen.getByRole("alertdialog");
    expect(dlg.textContent).toContain("72 places will be left");
    expect(approveManyB3).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Approve 3" }));
    await waitFor(() => expect(approveManyB3).toHaveBeenCalledWith("c1", ["r1", "r2", "r3"]));
    await screen.findByText(/3 people approved/);
  });

  it("select mode: tick two of three, the button counts them", async () => {
    approveManyB3.mockResolvedValue({ approved: ["r1", "r3"], failed: [] });
    wrap(<RequestsList communityId="c1" requests={reqs} members={24} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve 0" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Select Zeeshan Anwar"));
    fireEvent.click(screen.getByLabelText("Select Kashif Mehmood"));
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve 2" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Approve 2" }));
    await waitFor(() => expect(approveManyB3).toHaveBeenCalledWith("c1", ["r1", "r3"]));
  });

  it("when the community is full, Approve is switched off and the banner says why", () => {
    wrap(<RequestsList communityId="c1" requests={reqs} members={99} />);
    expect((screen.getByRole("button", { name: "Approve Zeeshan Anwar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("The community is full")).toBeTruthy();
  });

  it("empty: 'No one is waiting' with an Invite friends button, and the rules card", () => {
    wrap(<RequestsList communityId="c1" requests={[]} members={24} />);
    expect(screen.getByText("No one is waiting")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Invite friends/ }).getAttribute("href")).toBe("/c/c1/invite");
    expect(screen.getByText("What happens next")).toBeTruthy();
  });

  it("a decision that someone else already made says so instead of failing", async () => {
    decideRequestB3.mockResolvedValue("not_pending");
    wrap(<RequestsList communityId="c1" requests={reqs} members={24} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve Zeeshan Anwar" }));
    await screen.findByText("Zeeshan Anwar was already decided by someone else.");
  });
});

/* ---------------- Community settings ---------------- */
const init = { name: "Karachi Indoor Cricket Club", location: "Clifton, Karachi", description: "Weekly indoor cricket.", approval: true };
const settings = (extra?: React.ReactNode) => wrap(
  <SettingsProvider initial={init} memberCount={24}>
    <SettingsForm communityId="c1" />
    <SettingsPreview />
    {extra}
  </SettingsProvider>,
);

describe("Community settings", () => {
  it("two titled cards (Identity, Joining) hold every existing field", () => {
    settings();
    expect(screen.getByRole("heading", { name: "Identity" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Joining" })).toBeTruthy();
    expect((screen.getByLabelText("Community name") as HTMLInputElement).value).toBe(init.name);
    expect((screen.getByLabelText("Location") as HTMLInputElement).value).toBe(init.location);
    expect((screen.getByLabelText("Short description") as HTMLTextAreaElement).value).toBe(init.description);
    expect((screen.getByLabelText(/Admin approves new members/) as HTMLInputElement).checked).toBe(true);
  });

  it("counters show 27/60 style numbers and warn near the limit (and keep the browser limit as a safety net)", () => {
    const { container } = settings();
    expect(screen.getByLabelText("27 of 60 characters")).toBeTruthy();
    expect(container.querySelector("#s-name")!.getAttribute("maxlength")).toBe("60");
    expect(container.querySelector("#s-loc")!.getAttribute("maxlength")).toBe("80");
    expect(container.querySelector("#s-desc")!.getAttribute("maxlength")).toBe("300");
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "x".repeat(60) } });
    const c = screen.getByLabelText("60 of 60 characters, limit reached");
    expect(c.className).toContain("warn");
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "y".repeat(252) } });
    expect(screen.getByLabelText("252 of 300 characters").className).toContain("warn");
  });

  it("Save is off until something changes; then Save and Discard are on; Discard brings the saved text back", () => {
    settings();
    const save = () => screen.getByRole("button", { name: /Save changes|Saving/ }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "New name" } });
    expect(save().disabled).toBe(false);
    expect(screen.getByLabelText("Community name").className).toContain("st-changed");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect((screen.getByLabelText("Community name") as HTMLInputElement).value).toBe(init.name);
    expect(save().disabled).toBe(true);
  });

  it("the preview follows what is typed (name, members, place, description) and shows ? for an empty name", () => {
    settings();
    const prev = screen.getByLabelText("Preview");
    expect(prev.textContent).toContain("Karachi Indoor Cricket Club");
    expect(prev.textContent).toContain("24 of 99 members · Clifton, Karachi");
    expect(prev.textContent).toContain("KI");
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "" } });
    expect(prev.textContent).toContain("?");
    expect(prev.textContent).toContain("Community name");
  });

  it("switching approval off explains the result and shows the gold 'Open joining' warning", () => {
    settings();
    expect(screen.getByText("New people wait in Join requests until an Admin says yes.")).toBeTruthy();
    expect(screen.queryByText("Open joining")).toBeNull();
    fireEvent.click(screen.getByLabelText(/Admin approves new members/));
    expect(screen.getByText("Anyone with the link joins straight away.")).toBeTruthy();
    expect(screen.getByText("Open joining")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeTruthy();
  });

  it("a name that is too short shows the server text with an icon and a red ring; Save stays on so it can be fixed", async () => {
    updateCommunityAction.mockResolvedValue({ fieldErrors: { name: "Give your community a name (at least 2 letters)." }, error: "Please fix the highlighted fields." });
    const { container } = settings();
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Give your community a name (at least 2 letters).");
    expect(container.querySelector("#s-name")!.className).toContain("st-bad");
    expect(container.querySelector(".st-err svg")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "Ok" } });
    expect(container.querySelector(".st-err")).toBeNull(); // editing clears the error
  });

  it("saving: the button reads Saving… and is off; then a green 'Saved / Everyone now sees the new details' and Save returns to off", async () => {
    let done: (v: unknown) => void = () => {};
    updateCommunityAction.mockImplementation(() => new Promise((r) => { done = r; }));
    settings();
    fireEvent.change(screen.getByLabelText("Community name"), { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const busy = await screen.findByRole("button", { name: "Saving…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Community name") as HTMLInputElement).value).toBe("New name");
    await act(async () => { done({ message: "Saved." }); });
    await screen.findByText("Everyone now sees the new details.");
    expect(screen.getByText("Saved")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    const sent = updateCommunityAction.mock.calls[0]![1] as FormData;
    expect(sent.get("name")).toBe("New name");
    expect(sent.get("communityId")).toBe("c1");
    expect(sent.get("approvalRequired")).toBe("on");
  });

  it("the approval switch is sent as off when unticked (a missing value means off, as before)", async () => {
    updateCommunityAction.mockResolvedValue({ message: "Saved." });
    settings();
    fireEvent.click(screen.getByLabelText(/Admin approves new members/));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateCommunityAction).toHaveBeenCalled());
    expect((updateCommunityAction.mock.calls[0]![1] as FormData).get("approvalRequired")).toBeNull();
  });

  it("demoted while editing: a titled red banner, not a stray red line", async () => {
    updateCommunityAction.mockResolvedValue({ error: "Only an Admin can change the settings." });
    const { container } = settings();
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Karachi" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Only an Admin can change the settings.");
    const b = container.querySelector(".mb-banner.red")!;
    expect(b.querySelector("b")!.textContent).toBe("Could not save");
  });

  it("the danger zone is its own red card and still leads to the type-the-name delete page", () => {
    settings(<DangerZone communityId="c1" />);
    const link = screen.getByRole("link", { name: /Delete community/ });
    expect(link.getAttribute("href")).toBe("/c/c1/delete");
    expect(screen.getByLabelText("Danger zone").className).toContain("st-danger");
  });
});
