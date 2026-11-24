// Builder 3 (UI redesign): the pure rules behind the Members, Manage member, Join requests and Settings screens.
import { describe, expect, it } from "vitest";
import { askedAgo, counterTone, countFor, firstName, manageNotice, matchesSearch, sortMembers, visibleMembers, type MemberItem } from "@/lib/b3";

const m = (name: string, n: number | null, role: "admin" | "member" = "member", pr: string | null = null): MemberItem => ({ user_id: name, name, role, player_number: n, playing_role: pr });

describe("members search, filter and sort", () => {
  it("a name matches on any part, a number only exactly", () => {
    expect(matchesSearch(m("Hamza Khan", 10), "ha")).toBe(true);
    expect(matchesSearch(m("Bilal", 77), "7")).toBe(false);
    expect(matchesSearch(m("Bilal", 7), " 7 ")).toBe(true);
    expect(matchesSearch(m("Arsalan", null), "0")).toBe(false);
    expect(matchesSearch(m("Anyone", null), "")).toBe(true);
  });
  it("filters by Admin and by playing role, with counts", () => {
    const list = [m("A", 1, "admin", "batter"), m("B", 2, "member", "bowler"), m("C", 3, "member", "wicket_keeper")];
    expect(countFor(list, "all")).toBe(3);
    expect(countFor(list, "admin")).toBe(1);
    expect(countFor(list, "bowler")).toBe(1);
    expect(visibleMembers(list, "", "wicket_keeper", "name").map((x) => x.name)).toEqual(["C"]);
    expect(visibleMembers(list, "b", "bowler", "name").map((x) => x.name)).toEqual(["B"]);
  });
  it("sorts by name, by number (no number last) and Admins first", () => {
    const list = [m("Zed", 3), m("Amy", null), m("Bob", 1, "admin")];
    expect(sortMembers(list, "name").map((x) => x.name)).toEqual(["Amy", "Bob", "Zed"]);
    expect(sortMembers(list, "number").map((x) => x.name)).toEqual(["Bob", "Zed", "Amy"]);
    expect(sortMembers(list, "admins").map((x) => x.name)).toEqual(["Bob", "Amy", "Zed"]);
  });
  it("first name for buttons", () => {
    expect(firstName("Bilal Ahmed")).toBe("Bilal");
    expect(firstName("   ")).toBe("Member");
  });
});

describe("askedAgo", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  it("says it in plain words", () => {
    expect(askedAgo("2026-11-24T11:59:40Z", now)).toBe("just now");
    expect(askedAgo("2026-11-24T11:15:00Z", now)).toBe("45 min ago");
    expect(askedAgo("2026-11-24T10:00:00Z", now)).toBe("2 h ago");
    expect(askedAgo("2026-11-23T08:00:00Z", now)).toBe("yesterday");
    expect(askedAgo("2026-11-20T08:00:00Z", now)).toBe("4 days ago");
    expect(askedAgo("2026-11-01T08:00:00Z", now)).toBe("on 1 Nov");
  });
});

describe("settings counters and manage notices", () => {
  it("counter turns orange at 80% and red above the limit", () => {
    expect(counterTone(10, 60)).toBe("ok");
    expect(counterTone(48, 60)).toBe("warn");
    expect(counterTone(60, 60)).toBe("warn");
    expect(counterTone(61, 60)).toBe("over");
    expect(counterTone(252, 300)).toBe("warn");
  });
  it("every server code has a headline and a reason; only no_change is neutral; is_admin and last_admin carry a fix button", () => {
    for (const code of ["is_admin", "is_self", "last_admin", "not_found", "forbidden", "no_change", "weird"]) {
      const n = manageNotice(code, "Hamza")!;
      expect(n.headline.length).toBeGreaterThan(3);
      expect(n.body.length).toBeGreaterThan(5);
      expect(n.tone).toBe(code === "no_change" ? "mute" : "red");
    }
    expect(manageNotice("is_admin", "Hamza")!.action).toBe("take_admin");
    expect(manageNotice("is_admin", "Hamza")!.body).toContain("Hamza is an Admin");
    expect(manageNotice("last_admin", "Ali")!.action).toBe("choose_admin");
    expect(manageNotice(undefined, "x")).toBeNull();
  });
});
