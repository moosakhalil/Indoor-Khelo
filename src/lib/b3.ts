// Builder 3 (UI redesign): small pure rules for the Members, Manage member, Join requests and Settings screens.
// No database or network in here, so every rule can be tested on its own.
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

export type MemberItem = { user_id: string; name: string; role: "admin" | "member"; player_number: number | null; playing_role: string | null };

export type MemberFilter = "all" | "admin" | "batter" | "bowler" | "all_rounder" | "wicket_keeper";
export type MemberSort = "name" | "number" | "admins";

export const FILTER_CHIPS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "batter", label: "Batters" },
  { value: "bowler", label: "Bowlers" },
  { value: "all_rounder", label: "All-rounders" },
  { value: "wicket_keeper", label: "Keepers" },
];

export const SORTS: { value: MemberSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "number", label: "Number" },
  { value: "admins", label: "Admins first" },
];

/** Name: any part of the name. Number: the whole number only, so "7" never finds 77. */
export function matchesSearch(m: Pick<MemberItem, "name" | "player_number">, raw: string): boolean {
  const needle = raw.trim().toLowerCase();
  if (!needle) return true;
  return m.name.toLowerCase().includes(needle) || (m.player_number !== null && String(m.player_number) === needle);
}

export function matchesFilter(m: MemberItem, f: MemberFilter): boolean {
  if (f === "all") return true;
  if (f === "admin") return m.role === "admin";
  return m.playing_role === f;
}

export function countFor(members: MemberItem[], f: MemberFilter): number {
  return members.filter((m) => matchesFilter(m, f)).length;
}

const byName = (a: MemberItem, b: MemberItem) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
const byNumber = (a: MemberItem, b: MemberItem) => (a.player_number ?? 1000) - (b.player_number ?? 1000) || byName(a, b);

export function sortMembers(list: MemberItem[], sort: MemberSort): MemberItem[] {
  const out = [...list];
  if (sort === "number") return out.sort(byNumber);
  if (sort === "admins") return out.sort((a, b) => Number(b.role === "admin") - Number(a.role === "admin") || byName(a, b));
  return out.sort(byName);
}

export function visibleMembers(members: MemberItem[], q: string, filter: MemberFilter, sort: MemberSort): MemberItem[] {
  return sortMembers(members.filter((m) => matchesFilter(m, filter) && matchesSearch(m, q)), sort);
}

export const playingRoleLabel = (v: string | null | undefined) => labelOf(PLAYING_ROLES, v);

/** "Bilal Ahmed" becomes "Bilal": used in buttons and sentences. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Member";

/** How long ago a join request was made, in plain words. */
export function askedAgo(then: Date | string, now: Date = new Date()): string {
  const t = new Date(then).getTime();
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `on ${new Date(then).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

/** Counter colour: grey, then orange from 80% of the limit, red above it. */
export function counterTone(len: number, max: number): "ok" | "warn" | "over" {
  if (len > max) return "over";
  return len >= Math.ceil(max * 0.8) ? "warn" : "ok";
}

export type ManageNotice = { tone: "red" | "mute" | "green"; headline: string; body: string; action?: "take_admin" | "choose_admin" };

/** All server messages of the Manage member page, one pattern: a bold headline, then the reason. */
export function manageNotice(code: string | undefined, name: string): ManageNotice | null {
  if (!code) return null;
  switch (code) {
    case "is_admin": return { tone: "red", headline: "Cannot remove an Admin", body: `${name} is an Admin. Take Admin away first, then you can remove them.`, action: "take_admin" };
    case "is_self": return { tone: "red", headline: "You cannot remove yourself", body: "Use Leave community on the Community page." };
    case "last_admin": return { tone: "red", headline: "You are the only Admin", body: "A community must always have at least one Admin. Make someone else Admin first.", action: "choose_admin" };
    case "not_found": return { tone: "red", headline: "Member not found", body: "That person is no longer an approved member." };
    case "forbidden": return { tone: "red", headline: "Admins only", body: "Only an Admin can do that." };
    case "no_change": return { tone: "mute", headline: "No change", body: "Nothing changed." };
    default: return { tone: "red", headline: "That did not work", body: "Please try again." };
  }
}
