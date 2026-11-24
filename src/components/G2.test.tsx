// @vitest-environment jsdom
// Phase G2 (UI redesign): Waiting for approval, Pick or change player number, Player numbers, Leave community, Delete community.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push, replace: vi.fn() }), usePathname: () => "/c/c1/number" }));

const leaveAction = vi.fn();
const setRoleAction = vi.fn();
const deleteCommunityAction = vi.fn();
vi.mock("@/app/actions2", () => ({
  leaveAction: (...a: unknown[]) => leaveAction(...a),
  setRoleAction: (...a: unknown[]) => setRoleAction(...a),
  deleteCommunityAction: (...a: unknown[]) => deleteCommunityAction(...a),
}));
const chooseNumberAction = vi.fn();
vi.mock("@/app/actions", () => ({ chooseNumberAction: (...a: unknown[]) => chooseNumberAction(...a) }));
const resetNumberB3 = vi.fn();
vi.mock("@/app/actionsB3", () => ({ resetNumberB3: (...a: unknown[]) => resetNumberB3(...a) }));

import CnDelete from "@/components/CnDelete";
import { LeaveCard, OnlyAdminCard } from "@/components/CnLeave";
import CnNumberPicker from "@/components/CnNumberPicker";
import CnNumbers, { NumberMap } from "@/components/CnNumbers";
import { RejectedCard, WaitingCard } from "@/components/CnWaiting";
import { SnackbarProvider } from "@/components/Snackbar";
import { communityAbbr, matchesJump, matchesPerson, matchesSuccessor, nearestFree, plural, sameName, sortByNumber } from "@/lib/cn";

beforeEach(() => {
  [refresh, push, leaveAction, setRoleAction, deleteCommunityAction, chooseNumberAction, resetNumberB3].forEach((f) => f.mockReset());
});
afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) => render(<SnackbarProvider>{ui}</SnackbarProvider>);
const CID = "11111111-1111-4111-8111-111111111111";

/* ---------------- helpers ---------------- */
describe("G2 helpers", () => {
  it("nearestFree offers the closest free numbers, smaller first on a tie, and skips the person's own number", () => {
    const taken = new Set([12, 14, 16, 18]);
    expect(nearestFree(12, taken, 3)).toEqual([10, 11, 13]);
    expect(nearestFree(12, taken, 3, 11)).toEqual([9, 10, 13]);
    expect(nearestFree(1, new Set([2, 3]), 3)).toEqual([4, 5, 6]);
  });
  it("jump matches by digits, communityAbbr, plural, sameName, sortByNumber and the two searches", () => {
    expect(matchesJump(12, "1")).toBe(true);
    expect(matchesJump(23, "1")).toBe(false);
    expect(matchesJump(5, "")).toBe(true);
    expect(communityAbbr("Karachi Indoor Cricket Club")).toBe("KICC");
    expect(communityAbbr("Falcons")).toBe("Falcons");
    expect(plural(1, "team", "teams")).toBe("1 team");
    expect(plural(0, "team", "teams")).toBe("0 teams");
    expect(sameName("  karachi   INDOOR cricket club ", "Karachi Indoor Cricket Club")).toBe(true);
    expect(sameName("Karachi Indoor", "Karachi Indoor Cricket Club")).toBe(false);
    expect(sameName("", "")).toBe(false);
    const sorted = sortByNumber([{ name: "B", player_number: 5 }, { name: "A", player_number: null }, { name: "C", player_number: 3 }]);
    expect(sorted.map((x) => x.name)).toEqual(["A", "C", "B"]);
    expect(matchesPerson("Hamza Khan", 10, "ham")).toBe(true);
    expect(matchesPerson("Hamza Khan", 10, "10")).toBe(true);
    expect(matchesPerson("Hamza Khan", 10, "1")).toBe(false); // exact number only
    expect(matchesSuccessor("Hamza Khan", 10, "1")).toBe(true);
  });
});

/* ---------------- Waiting for approval ---------------- */
describe("Waiting for approval", () => {
  it("shows the status timeline, a Pending badge, the Admin with a shirt, Check again as the main action and Back", () => {
    const { container } = render(<WaitingCard communityId={CID} communityName="Karachi Indoor Cricket Club" adminName="Ali Raza" adminNumber={7} />);
    expect(screen.getByRole("heading", { name: "Karachi Indoor Cricket Club" })).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText(/Ali Raza will approve you soon/)).toBeTruthy();
    expect(screen.getByText("Request sent")).toBeTruthy();
    expect(screen.getByText("Admin approves")).toBeTruthy();
    expect(screen.getByText("Pick your player number")).toBeTruthy();
    expect(container.querySelector("li.now")?.textContent).toContain("Admin approves");
    expect(container.querySelector("li.now")?.getAttribute("aria-current")).toBe("step");
    expect(container.querySelector("svg.shirt")?.getAttribute("aria-label")).toBe("Player number 7");
    const check = screen.getByRole("link", { name: "Check again" });
    expect(check.getAttribute("href")).toBe(`/c/${CID}/waiting`);
    expect(check.className).toContain("gold");
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/choose");
  });

  it("a grey shirt when the Admin's number is unknown, and a plain name when the Admin is unknown", () => {
    const { container } = render(<WaitingCard communityId={CID} communityName="KICC" adminName={null} adminNumber={null} />);
    expect(container.querySelector("svg.shirt")?.getAttribute("aria-label")).toBe("No player number");
    expect(screen.getByText(/The Admin will approve you soon/)).toBeTruthy();
  });

  it("Cancel my request asks first: Keep request leaves everything as it is, Cancel request sends the existing leaveAction", async () => {
    const { container } = render(<WaitingCard communityId={CID} communityName="KICC" adminName="Ali Raza" adminNumber={7} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel my request" }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Cancel your request?")).toBeTruthy();
    expect(within(dlg).getByText(/Ali Raza will no longer see it/)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Keep request" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(leaveAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel my request" }));
    await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel request" })); });
    await waitFor(() => expect(leaveAction).toHaveBeenCalledTimes(1));
    const fd = leaveAction.mock.calls[0]![0] as FormData;
    expect(fd.get("communityId")).toBe(CID);
    expect(container.querySelector("form input[name=communityId]")).toBeTruthy();
  });

  it("not approved: red outcome, same message, Ask again links to the invite, Back goes to /choose", () => {
    const { container } = render(<RejectedCard communityName="Karachi Indoor Cricket Club" inviteCode="ABCD1234" />);
    expect(screen.getByRole("heading", { name: "Your request was not approved" })).toBeTruthy();
    expect(screen.getByText("The Admin of Karachi Indoor Cricket Club did not approve this request. You can ask again later.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ask again" }).getAttribute("href")).toBe("/join/ABCD1234");
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/choose");
    expect(container.querySelector(".cn-rej-x")).toBeTruthy();
  });
});

/* ---------------- Pick or change player number ---------------- */
const some = [3, 4, 5, 8, 9, 10, 11, 14];

function picker(over: Partial<React.ComponentProps<typeof CnNumberPicker>> = {}) {
  return render(<CnNumberPicker communityId={CID} taken={some} mine={null} isNew={false} {...over} />);
}

describe("Number picker", () => {
  it("first time: a board of 99 with a legend, TAKEN labels, the grey shirt and a disabled confirm; hidden fields keep the action's names", () => {
    const { container } = picker({ isNew: true });
    expect(container.querySelectorAll(".cn-grid button")).toHaveLength(99);
    expect(container.querySelectorAll(".cn-num.taken")).toHaveLength(some.length);
    expect(screen.getAllByText("TAKEN")).toHaveLength(some.length);
    ["Free", "Taken", "Yours", "Selected"].forEach((w) => expect(within(screen.getByRole("list", { name: "Legend" })).getByText(w)).toBeTruthy());
    expect(screen.getByText("No number yet")).toBeTruthy();
    expect(screen.getByText("Tap a free number")).toBeTruthy();
    expect(container.querySelector(".cn-confirm svg.shirt")?.getAttribute("aria-label")).toBe("No player number");
    const save = screen.getByRole("button", { name: "Choose a number" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect((container.querySelector("input[name=communityId]") as HTMLInputElement).value).toBe(CID);
    expect((container.querySelector("input[name=isNew]") as HTMLInputElement).value).toBe("1");
    expect((container.querySelector("input[name=number]") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: "3, already taken" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("picking 12 selects it (gold), shows the shirt and 'Number 12 is free' and enables Confirm; the form posts number 12", async () => {
    chooseNumberAction.mockResolvedValue({});
    const { container } = picker();
    fireEvent.click(screen.getByRole("button", { name: "12" }));
    expect(screen.getByRole("button", { name: "12" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Number 12")).toBeTruthy();
    expect(screen.getByText("This number is free")).toBeTruthy();
    expect(container.querySelector(".cn-confirm svg.shirt")?.getAttribute("aria-label")).toBe("Player number 12");
    const save = screen.getByRole("button", { name: "Confirm number 12" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await act(async () => { fireEvent.click(save); });
    await waitFor(() => expect(chooseNumberAction).toHaveBeenCalled());
    const fd = chooseNumberAction.mock.calls[0]![1] as FormData;
    expect(fd.get("number")).toBe("12");
    expect(fd.get("communityId")).toBe(CID);
    expect(fd.get("isNew")).toBe("0");
  });

  it("saving shows a spinner and a second tap is blocked", async () => {
    let done: (v: object) => void = () => {};
    chooseNumberAction.mockImplementation(() => new Promise((r) => { done = r; }));
    const { container } = picker();
    fireEvent.click(screen.getByRole("button", { name: "12" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm number 12" })); });
    const busy = await screen.findByRole("button", { name: "Saving…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector(".cn-save .cn-spin")).toBeTruthy();
    await act(async () => { done({}); });
  });

  it("jump to a number filters the board; Enter picks an exact free number without sending the form", async () => {
    const { container } = picker();
    const box = screen.getByPlaceholderText("Jump to a number");
    fireEvent.change(box, { target: { value: "1" } });
    const shown = Array.from(container.querySelectorAll(".cn-grid .cn-n")).map((e) => e.textContent);
    expect(shown).toContain("1");
    expect(shown).toContain("10");
    expect(shown).toContain("21");
    expect(shown).not.toContain("22");
    fireEvent.change(box, { target: { value: "21" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByRole("button", { name: "21" }).getAttribute("aria-pressed")).toBe("true");
    expect(chooseNumberAction).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "0" } });
    expect(screen.queryAllByRole("button", { name: /^\d+$/ }).every((b) => b.textContent?.includes("0"))).toBe(true);
  });

  it("Free only hides taken numbers and counts what is free", () => {
    const { container } = picker();
    const chip = screen.getByRole("button", { name: /Free only \(91\)/ });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll(".cn-grid button")).toHaveLength(91);
    expect(container.querySelector(".cn-num.taken")).toBeNull();
  });

  it("changing: your number is labelled YOU, Keep number 7 is offered, nothing is preselected, and your old number stays selectable", () => {
    const { container } = picker({ taken: [...some, 7], mine: 7, keepHref: `/c/${CID}/profile` });
    const mine = screen.getByRole("button", { name: "7, your current number" }) as HTMLButtonElement;
    expect(mine.disabled).toBe(false);
    expect(mine.textContent).toContain("YOU");
    expect(mine.className).toContain("mine");
    const keep = screen.getByRole("link", { name: "Keep number 7" });
    expect(keep.getAttribute("href")).toBe(`/c/${CID}/profile`);
    expect(container.querySelector(".cn-confirm svg.shirt")?.getAttribute("aria-label")).toBe("Player number 7");
    expect(screen.getByText(/Your current number/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Choose a number" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "15" }));
    expect(screen.getByRole("button", { name: "Confirm number 15" })).toBeTruthy();
    // the person's own number is not counted as taken
    expect(container.querySelectorAll(".cn-num.taken")).toHaveLength(some.length);
  });

  it("someone took it a moment ago: the board marks it TAKEN, clears the choice, offers the closest free numbers and reloads", async () => {
    chooseNumberAction.mockResolvedValue({ error: "Number 12 was just taken. Please choose another number." });
    const { container } = picker({ taken: [14, 16, 18] });
    fireEvent.click(screen.getByRole("button", { name: "12" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm number 12" })); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Number 12 was just taken. Please choose another number.");
    expect((screen.getByRole("button", { name: "12, already taken" }) as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector("input[name=number]") as HTMLInputElement).value).toBe("");
    const sugg = Array.from(alert.querySelectorAll(".cn-pill")).map((b) => b.textContent);
    expect(sugg).toEqual(["10", "11", "13"]);
    expect(refresh).toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "13" }));
    expect(screen.getByRole("button", { name: "Confirm number 13" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull(); // the old message goes once you choose again
  });

  it("the other server messages are still shown as they are (for example the match lock)", async () => {
    chooseNumberAction.mockResolvedValue({ error: "You are in a match that is being played, so your number is locked until it ends." });
    picker();
    fireEvent.click(screen.getByRole("button", { name: "12" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm number 12" })); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("locked until it ends");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("in a live match the lock is said before the tap: names the match, the button reads 'Locked until your match ends' and is off", () => {
    const { container } = picker({ taken: [...some, 7], mine: 7, liveMatch: { title: "Thunder Strikers v Royal Panthers" } });
    expect(screen.getByText(/You are in a match that is being played, so your number is locked until it ends\./)).toBeTruthy();
    expect(screen.getByText("Thunder Strikers v Royal Panthers")).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "15" }));
    const save = screen.getByRole("button", { name: "Locked until your match ends" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(container.querySelector(".cn-save")).toBe(save);
  });

  it("nearly full: a gold note lists the free numbers and Free only is on by itself", () => {
    const takenAll = Array.from({ length: 99 }, (_, i) => i + 1).filter((n) => ![6, 13, 47, 58, 81].includes(n));
    const { container } = picker({ taken: takenAll });
    expect(screen.getByText("Only 5 numbers left")).toBeTruthy();
    expect(screen.getByText("6, 13, 47, 58, 81 are free.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Free only \(5\)/ }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll(".cn-grid button")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "47" }));
    expect(screen.getByRole("button", { name: "Confirm number 47" })).toBeTruthy();
  });

  it("no free number at all says so", () => {
    const { container } = picker({ taken: Array.from({ length: 99 }, (_, i) => i + 1) });
    expect(screen.getByText("No numbers are left")).toBeTruthy();
    expect(container.querySelector(".cn-none")).toBeTruthy();
  });
});

/* ---------------- Player numbers (Admin) ---------------- */
const people = [
  { user_id: "u1", name: "Zain Malik", player_number: 3 },
  { user_id: "u2", name: "Hamza Khan", player_number: 10 },
  { user_id: "u3", name: "Moiz Abbasi", player_number: null },
  { user_id: "u4", name: "Ali Raza", player_number: 7 },
];

describe("Player numbers (Admin)", () => {
  it("lists members with people without a number first, a NO NUMBER badge, grey shirt and gold shirts for the rest", () => {
    const { container } = wrap(<CnNumbers communityId={CID} communityName="KICC" members={people} />);
    const rows = Array.from(container.querySelectorAll(".cn-row"));
    expect(rows[0]!.textContent).toContain("Moiz Abbasi");
    expect(rows[0]!.textContent).toContain("NO NUMBER");
    expect(rows[0]!.textContent).toContain("Has not picked a number yet");
    expect(rows[0]!.querySelector("svg.shirt")?.getAttribute("aria-label")).toBe("No player number");
    expect(rows[1]!.textContent).toContain("Zain Malik");
    expect(rows[1]!.querySelector("svg.shirt")?.getAttribute("aria-label")).toBe("Player number 3");
    expect(container.textContent).toContain("4 of 99 members, 3 with a number");
    expect(screen.getByText("No conflicts")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Hamza Khan/ });
    expect(link.getAttribute("href")).toBe(`/c/${CID}/members/u2`);
  });

  it("search by name or exact number; empty result text", () => {
    const { container } = wrap(<CnNumbers communityId={CID} communityName="KICC" members={people} />);
    const box = screen.getByPlaceholderText("Search by name or number");
    fireEvent.change(box, { target: { value: "ham" } });
    expect(container.querySelectorAll(".cn-row")).toHaveLength(1);
    fireEvent.change(box, { target: { value: "7" } });
    expect(container.querySelector(".cn-row")?.textContent).toContain("Ali Raza");
    fireEvent.change(box, { target: { value: "zzz" } });
    expect(screen.getByText(/No one matches/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(container.querySelectorAll(".cn-row")).toHaveLength(4);
  });

  it("Reset number asks first with the number and the person; confirming calls the existing reset action and reloads", async () => {
    resetNumberB3.mockResolvedValue("ok");
    wrap(<CnNumbers communityId={CID} communityName="Karachi Indoor Cricket Club" members={people} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset number 10 for Hamza Khan" }));
    const dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("Free number 10?")).toBeTruthy();
    expect(within(dlg).getByText(/Hamza Khan will have to pick a new number before using Karachi Indoor Cricket Club again\. Number 10 becomes free for everyone at once\. Past matches keep the number used at the time\./)).toBeTruthy();
    expect(resetNumberB3).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Yes, free number 10" })); });
    await waitFor(() => expect(resetNumberB3).toHaveBeenCalledWith(CID, "u2"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText("Number 10 freed. Hamza Khan must choose a new number.")).toBeTruthy();
  });

  it("Cancel in the reset box does nothing; a failed reset shows the real reason", async () => {
    resetNumberB3.mockResolvedValue("not_found");
    wrap(<CnNumbers communityId={CID} communityName="KICC" members={people} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset number 3 for Zain Malik" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(resetNumberB3).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset number 3 for Zain Malik" }));
    await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, free number 3" })); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Member not found");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("the row menu reaches Manage member and Reset number without hover; Reset is off for someone without a number", () => {
    const { container } = wrap(<CnNumbers communityId={CID} communityName="KICC" members={people} />);
    const none = container.querySelectorAll(".cn-row")[0]!;
    fireEvent.click(within(none as HTMLElement).getByRole("button", { name: "More actions for Moiz Abbasi" }));
    const reset = screen.getByRole("menuitem", { name: /Reset number/ });
    expect(reset.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Manage member" }).getAttribute("href")).toBe(`/c/${CID}/members/u3`);
  });

  it("the number map marks which numbers are used and which are free", () => {
    const { container } = render(<NumberMap used={[3, 7, 10]} />);
    expect(container.querySelectorAll(".cn-cell")).toHaveLength(99);
    expect(container.querySelectorAll(".cn-cell.used")).toHaveLength(3);
    expect(screen.getByText("In use (3)")).toBeTruthy();
    expect(screen.getByText("Free (96)")).toBeTruthy();
    expect(screen.getByLabelText("7, in use")).toBeTruthy();
    expect(screen.getByLabelText("8, free")).toBeTruthy();
  });
});

/* ---------------- Leave community ---------------- */
describe("Leave community", () => {
  it("member: four facts (a freed number in orange), a red leave button posting communityId, and Stay as the gold button", () => {
    const { container } = render(<LeaveCard communityId={CID} communityName="Karachi Indoor Cricket Club" role="member" number={3} />);
    expect(screen.getByRole("heading", { name: "Leave Karachi Indoor Cricket Club?" })).toBeTruthy();
    expect(screen.getByText("Member · number 3")).toBeTruthy();
    ["Your career stats stay with you", "Past scorecards keep your name and number", "Your number 3 becomes free at once", "Others can pick it straight away.", "You can ask to join again later"].forEach((t) => expect(screen.getByText(t)).toBeTruthy());
    expect(container.querySelectorAll(".cn-facts i.orange")).toHaveLength(1);
    expect(container.querySelectorAll(".cn-facts i.green")).toHaveLength(3);
    expect(container.querySelector("form input[name=communityId]")?.getAttribute("value")).toBe(CID);
    const leave = screen.getByRole("button", { name: "Yes, leave the community" });
    expect(leave.className).toContain("cn-leavebtn");
    const stay = screen.getByRole("link", { name: "Stay" });
    expect(stay.className).toContain("gold");
    expect(stay.getAttribute("href")).toBe(`/c/${CID}/community`);
    expect(screen.queryByText("You can leave now")).toBeNull();
  });

  it("an Admin with another Admin sees 'Admin · number 3'; after making someone Admin a green 'You can leave now' sits above the card", () => {
    render(<LeaveCard communityId={CID} communityName="KICC" role="admin" number={3} justUnblocked />);
    expect(screen.getByText("Admin · number 3")).toBeTruthy();
    expect(screen.getByText("You can leave now")).toBeTruthy();
    expect(screen.getByText("You are no longer the only Admin.")).toBeTruthy();
  });

  it("leaving sends the existing leaveAction", async () => {
    leaveAction.mockResolvedValue(undefined);
    render(<LeaveCard communityId={CID} communityName="KICC" role="member" number={3} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Yes, leave the community" })); });
    await waitFor(() => expect(leaveAction).toHaveBeenCalledTimes(1));
    expect((leaveAction.mock.calls[0]![0] as FormData).get("communityId")).toBe(CID);
  });

  const cands = [
    { user_id: "u2", name: "Hamza Khan", player_number: 10 },
    { user_id: "u3", name: "Bilal Ahmed", player_number: 18 },
    { user_id: "u4", name: "Usman Tariq", player_number: 45 },
  ];

  it("only Admin: gold warning, a counted and searchable list with gold shirts, Make Admin per person, Stay primary and Delete quiet", async () => {
    setRoleAction.mockResolvedValue(undefined);
    const { container } = render(<OnlyAdminCard communityId={CID} communityName="Karachi Indoor Cricket Club" candidates={cands} />);
    expect(screen.getByText("You are the only Admin of Karachi Indoor Cricket Club")).toBeTruthy();
    expect(screen.getByText("Make someone else Admin first, or delete the community.")).toBeTruthy();
    expect(screen.getByLabelText("3 members").textContent).toBe("3");
    expect(container.querySelectorAll(".cn-succ-row svg.shirt")).toHaveLength(3);
    fireEvent.change(screen.getByPlaceholderText("Search members"), { target: { value: "bil" } });
    expect(container.querySelectorAll(".cn-succ-row")).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText("Search members"), { target: { value: "45" } });
    expect(container.querySelector(".cn-succ-row")?.textContent).toContain("Usman Tariq");
    fireEvent.change(screen.getByPlaceholderText("Search members"), { target: { value: "nobody" } });
    expect(screen.getByText("No one matches that search.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(container.querySelectorAll(".cn-succ-row")).toHaveLength(3);
    // the form posts what setRoleAction expects
    const row = container.querySelectorAll(".cn-succ-row")[0] as HTMLFormElement;
    expect(row.querySelector("input[name=userId]")?.getAttribute("value")).toBe("u2");
    expect(row.querySelector("input[name=role]")?.getAttribute("value")).toBe("admin");
    expect(row.querySelector("input[name=next]")?.getAttribute("value")).toBe(`/c/${CID}/leave`);
    await act(async () => { fireEvent.click(within(row).getByRole("button", { name: /Make Admin/ })); });
    await waitFor(() => expect(setRoleAction).toHaveBeenCalledTimes(1));
    expect((setRoleAction.mock.calls[0]![0] as FormData).get("userId")).toBe("u2");
    expect(screen.getByRole("link", { name: "Stay" }).className).toContain("gold");
    const del = screen.getByRole("link", { name: "Delete the community" });
    expect(del.getAttribute("href")).toBe(`/c/${CID}/delete`);
    expect(del.className).toContain("cn-quiet-red");
  });

  it("only Admin with nobody else: an empty state explains the dead end; Stay and Delete remain", () => {
    const { container } = render(<OnlyAdminCard communityId={CID} communityName="KICC" candidates={[]} />);
    expect(screen.getByText("No other members yet")).toBeTruthy();
    expect(screen.getByText("Invite someone and make them Admin, or delete the community.")).toBeTruthy();
    expect(container.querySelector(".cn-succ")).toBeNull();
    expect(screen.getByRole("link", { name: "Stay" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Delete the community" })).toBeTruthy();
  });
});

/* ---------------- Delete community ---------------- */
const NAME = "Karachi Indoor Cricket Club";
const counts = { members: 24, teams: 5, series: 1, matches: 31, bookings: 6 };

describe("Delete community", () => {
  it("empty field: lists what will be lost with counts, the button is off, 'Keep KICC' is the way out and Leave is offered instead", () => {
    const { container } = render(<CnDelete communityId={CID} name={NAME} counts={counts} />);
    expect(screen.getByRole("heading", { name: `Delete ${NAME}?` })).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
    expect(screen.getByText("24 members leave")).toBeTruthy();
    expect(screen.getByText("5 teams, 1 series and 31 matches")).toBeTruthy();
    expect(screen.getByText("6 bookings and payment records")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Delete this community for everyone" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "Keep KICC" }).getAttribute("href")).toBe(`/c/${CID}/settings`);
    expect(screen.getByRole("link", { name: "Make someone else Admin and leave" }).getAttribute("href")).toBe(`/c/${CID}/leave`);
    expect(container.querySelector("input[name=communityId]")?.getAttribute("value")).toBe(CID);
    expect(container.querySelector("input[name=typedName]")).toBeTruthy();
    expect(screen.getByText("Type it exactly, including capital letters.")).toBeTruthy();
  });

  it("small communities: singular wording and an empty bookings line", () => {
    render(<CnDelete communityId={CID} name="Falcons" counts={{ members: 1, teams: 1, series: 0, matches: 1, bookings: 0 }} />);
    expect(screen.getByText("1 member leaves")).toBeTruthy();
    expect(screen.getByText("1 team, 0 series and 1 match")).toBeTruthy();
    expect(screen.getByText("Bookings and payment records")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Keep Falcons" })).toBeTruthy();
  });

  it("wrong name: after leaving the field the error shows with a red ring and the button stays off", () => {
    const { container } = render(<CnDelete communityId={CID} name={NAME} counts={counts} />);
    const box = screen.getByPlaceholderText("Type the community name");
    fireEvent.change(box, { target: { value: "Karachi Indoor Cricket" } });
    expect(screen.queryByRole("alert")).toBeNull(); // not while still typing
    fireEvent.blur(box);
    expect(screen.getByRole("alert").textContent).toContain("The name you typed does not match. Type the community name exactly.");
    expect(container.querySelector(".cn-typed.bad")).toBeTruthy();
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: "Delete this community for everyone" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("right name (case and spaces ignored like the server): a tick, 'The name matches.' and the red button works; sends communityId and typedName", async () => {
    deleteCommunityAction.mockResolvedValue({});
    const { container } = render(<CnDelete communityId={CID} name={NAME} counts={counts} />);
    fireEvent.change(screen.getByPlaceholderText("Type the community name"), { target: { value: "  karachi INDOOR cricket   club " } });
    expect(screen.getByText("The name matches.")).toBeTruthy();
    expect(container.querySelector(".cn-typed.ok .cn-tick")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Delete this community for everyone" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => expect(deleteCommunityAction).toHaveBeenCalled());
    const fd = deleteCommunityAction.mock.calls[0]![1] as FormData;
    expect(fd.get("communityId")).toBe(CID);
    expect(fd.get("typedName")).toBe("  karachi INDOOR cricket   club ");
  });

  it("deleting shows a spinner on the danger button and blocks a double tap", async () => {
    let done: (v: object) => void = () => {};
    deleteCommunityAction.mockImplementation(() => new Promise((r) => { done = r; }));
    const { container } = render(<CnDelete communityId={CID} name={NAME} counts={counts} />);
    fireEvent.change(screen.getByPlaceholderText("Type the community name"), { target: { value: NAME } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete this community for everyone" })); });
    const busy = await screen.findByRole("button", { name: "Deleting…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector(".cn-delbtn .cn-spin")).toBeTruthy();
    await act(async () => { done({}); });
  });

  it("a real server error is shown on the field with the server's own words; editing the name clears it", async () => {
    deleteCommunityAction.mockResolvedValue({ error: "Only an Admin can delete the community." });
    const { container } = render(<CnDelete communityId={CID} name={NAME} counts={counts} />);
    const box = screen.getByPlaceholderText("Type the community name");
    fireEvent.change(box, { target: { value: NAME } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete this community for everyone" })); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Only an Admin can delete the community.");
    expect(container.querySelector(".cn-typed.bad")).toBeTruthy();
    fireEvent.change(box, { target: { value: `${NAME} x` } });
    expect(screen.queryByText("Only an Admin can delete the community.")).toBeNull();
  });
});
