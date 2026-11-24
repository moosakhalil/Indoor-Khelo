// Phase F3 (UI redesign): small pure helpers for Payments home, New booking, Venues and Edit booking. No database in here.
// Money rules stay in payments.ts (round UP, contributions not bills, PKR); this file only words and groups them.
import { COST_MAX, DURATIONS, money, parseWholeAmount, suggestedShare, surplus, type BookingStatus, type MemberStatus } from "@/lib/payments";

/* ---------- Payments home: tabs ---------- */
export type PvTab = "all" | "upcoming" | "past";
/** A booking is "upcoming" while it is pending or confirmed (as today); completed and cancelled go under "Past and cancelled". */
export const isUpcoming = (s: BookingStatus) => s === "pending" || s === "confirmed";
export function filterTab<T extends { status: BookingStatus }>(list: T[], tab: PvTab): T[] {
  if (tab === "upcoming") return list.filter((b) => isUpcoming(b.status));
  if (tab === "past") return list.filter((b) => !isUpcoming(b.status));
  return list;
}
/** The booking the desktop preview opens first: the soonest upcoming one, else the latest past one. `ordered` is already upcoming-first. */
export function defaultSelected<T extends { id: string }>(ordered: T[]): string | null {
  return ordered[0]?.id ?? null;
}

/* ---------- Payments home: the one line on each card ---------- */
export type CardLine = { text: string; tone: "bad" | "good" | "gold" | "mute" };
/**
 * "5 unpaid", "all covered", "over by PKR 500", "refunds by hand", or "nobody chosen yet".
 * `owing` counts the people whose recorded money is below their suggested share (unpaid or partly paid). Paying is a convenience: when the
 * contributions already reach the cost (one person may have covered it all) the booking is "all covered", whatever the individual shares say.
 */
export function cardLine(b: { status: BookingStatus; total: number; contributed: number; members: number; owing: number; overBy: number }): CardLine {
  if (b.status === "cancelled") return b.contributed > 0 ? { text: "refunds by hand", tone: "gold" } : { text: "nothing was paid", tone: "mute" };
  if (b.overBy > 0) return { text: `over by ${money(b.overBy)}`, tone: "gold" };
  const covered = b.contributed >= b.total && (b.total > 0 || b.members > 0);
  if (covered) return { text: "all covered", tone: "good" };
  if (b.members === 0) return { text: "nobody chosen yet", tone: "mute" };
  if (b.owing > 0) return { text: `${b.owing} unpaid`, tone: "bad" };
  return { text: "all covered", tone: "good" };
}
export const sharingText = (n: number) => (n === 1 ? "1 sharing" : `${n} sharing`);

/* ---------- forms: date, time, duration, cost ---------- */
/** "2026-11-28T20:00" to its two halves for the two separate fields. */
export function splitWhen(when: string | undefined): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(when ?? "");
  return m ? { date: m[1]!, time: m[2]! } : { date: "", time: "" };
}
/** The single `when` value the server action expects. Empty when either half is missing, so the server says "Choose the date and start time." */
export function joinWhen(date: string, time: string): string {
  return date && time ? `${date}T${time}` : "";
}
export const DURATION_CHIPS: readonly number[] = DURATIONS;
/** True when the minutes are one of the preset chips. Anything else selects the "Other" chip and shows the number. */
export const isPresetDuration = (minutes: string) => DURATION_CHIPS.includes(Number(minutes)) && /^\d+$/.test(minutes);

/** The cost as a whole number of rupees, or null when it is not valid yet (same rule as the server). */
export const parseCost = (text: string): number | null => parseWholeAmount(text, 0, COST_MAX);

export const EXAMPLE_PEOPLE = 10;
/** "If 10 people share: PKR 1,200 each". Only an example: the real people are chosen on the next step and paying stays optional. */
export function splitExample(costText: string, people = EXAMPLE_PEOPLE): { people: number; share: number; extra: number; text: string } | null {
  const cost = parseCost(costText);
  if (cost === null || cost <= 0) return null;
  const share = suggestedShare(cost, people);
  return { people, share, extra: surplus(cost, people), text: `If ${people} people share: ${money(share)} each` };
}

/** What a cost change does to the suggested share of the people already chosen to share (edit booking). */
export function costEffect(oldCost: number, newCost: number | null, people: number) {
  const now = suggestedShare(oldCost, people);
  const valid = newCost !== null;
  const after = valid ? suggestedShare(newCost, people) : now;
  return { people, now, after, extra: valid ? surplus(newCost, people) : surplus(oldCost, people), changed: valid && newCost !== oldCost, valid };
}

/* ---------- venues ---------- */
export const bookingsText = (n: number) => `${n} booking${n === 1 ? "" : "s"}`;
export const venueInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => Array.from(p)[0]!.toUpperCase()).join("");
};
export function searchVenues<T extends { name: string; address: string; contact: string }>(list: T[], q: string): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((v) => `${v.name} ${v.address} ${v.contact}`.toLowerCase().includes(s));
}

/* ---------- people to cover (preview) ---------- */
const SEVERITY: Record<MemberStatus, number> = { unpaid: 0, partial: 1, pending: 2, paid: 3 };
export const bySeverity = (a: { status: MemberStatus; name: string }, b: { status: MemberStatus; name: string }) =>
  SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name);

/* ---------- window events (the top bar button / menu talk to the page body without sharing state) ---------- */
export const PV_ADD_VENUE = "pv-add-venue";
export const PV_DELETE_VENUE = "pv-delete-venue";
