// Phase 7: the money rules, with no database in here so each one can be tested alone.
// Paying is a convenience, never a rule: the equal split is a suggestion, and any member can record any amount from anyone.
import { checkWhen, validTimeZone, zonedToUtc } from "@/lib/matchRules";
import { clean } from "@/lib/validation";

export const CURRENCY = "PKR";
export const COST_MAX = 10_000_000;
export const DURATIONS = [30, 45, 60, 90, 120, 180] as const;
export const METHODS = [
  { value: "cash", label: "Cash" }, { value: "bank_transfer", label: "Bank transfer" }, { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" }, { value: "card", label: "Card" }, { value: "other", label: "Other" },
] as const;
export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BOOKING_LABEL: Record<BookingStatus, string> = { pending: "Pending", confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed" };

export const money = (n: number) => `${CURRENCY} ${Math.round(n).toLocaleString("en-US")}`;

/* ---------- the split ---------- */
/** Equal split, rounded UP to a whole rupee. */
export function suggestedShare(total: number, people: number): number {
  return people <= 0 ? 0 : Math.ceil(total / people);
}
/** What the rounding adds on top of the real cost (shown as a surplus on the booking). */
export function surplus(total: number, people: number): number {
  return people <= 0 ? 0 : suggestedShare(total, people) * people - total;
}

export type Contribution = { payerKey: string; kind: "payment" | "refund"; amount: number; verified: boolean };

/** Net contributed by one payer: payments minus refunds. */
export function netFor(list: Contribution[], payerKey: string, verifiedOnly = false): number {
  return list.filter((c) => c.payerKey === payerKey && (!verifiedOnly || c.verified)).reduce((a, c) => a + (c.kind === "payment" ? c.amount : -c.amount), 0);
}

export type MemberStatus = "unpaid" | "pending" | "partial" | "paid";
export const STATUS_WORDS: Record<MemberStatus, string> = { unpaid: "Unpaid", pending: "Pending check", partial: "Partly paid", paid: "Paid" };

/**
 * One person's status against the suggested share. "Pending check" means money was recorded but nobody has checked it yet.
 * A person who paid more than their share is simply "Paid": covering for others is allowed and never blocked.
 */
export function memberStatus(share: number, net: number, verifiedNet: number): MemberStatus {
  if (net <= 0) return "unpaid";
  if (verifiedNet <= 0) return "pending";
  if (verifiedNet < share) return "partial";
  return "paid";
}

export type Summary = { total: number; contributed: number; verified: number; balance: number; overBy: number; percent: number; refunded: number };
/** Totals for the whole booking: total cost, contributed so far, and what is still open. */
export function summarize(total: number, list: Contribution[]): Summary {
  const contributed = list.reduce((a, c) => a + (c.kind === "payment" ? c.amount : -c.amount), 0);
  const verified = list.filter((c) => c.verified).reduce((a, c) => a + (c.kind === "payment" ? c.amount : -c.amount), 0);
  const refunded = list.filter((c) => c.kind === "refund").reduce((a, c) => a + c.amount, 0);
  const balance = Math.max(0, total - contributed);
  return { total, contributed, verified, balance, overBy: Math.max(0, contributed - total), percent: total === 0 ? (contributed > 0 ? 100 : 0) : Math.min(100, Math.round((Math.max(0, contributed) * 100) / total)), refunded };
}

/* ---------- venues ---------- */
type Errors = Record<string, string>;
type Result<T> = { ok: true; value: T } | { ok: false; errors: Errors };

export type VenueInput = { name: string; address: string; contact: string };
export function validateVenue(raw: { name?: unknown; address?: unknown; contact?: unknown }): Result<VenueInput> {
  const name = clean(raw.name), address = clean(raw.address), contact = clean(raw.contact);
  const errors: Errors = {};
  if (name.length < 2) errors.name = "Give the venue a name (at least 2 letters).";
  else if (name.length > 60) errors.name = "The venue name can be at most 60 characters.";
  if (address.length > 120) errors.address = "The address can be at most 120 characters.";
  if (contact.length > 60) errors.contact = "The contact can be at most 60 characters.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, address, contact } };
}

/* ---------- bookings ---------- */
export type BookingInput = { venueId: string; startsAt: Date; durationMinutes: number; totalCost: number; reference: string; notes: string };

export function parseWholeAmount(v: unknown, min: number, max: number): number | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.replace(/[,\s]/g, "") : "";
  if (!/^\d{1,8}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

export function validateBooking(raw: Record<string, unknown>, tz: string, now: Date, uuid: (s: string) => boolean): Result<BookingInput> {
  const errors: Errors = {};
  const venueId = typeof raw.venueId === "string" ? raw.venueId : "";
  if (!uuid(venueId)) errors.venueId = "Choose a venue (add one first if the list is empty).";
  const zone = validTimeZone(tz) ?? "UTC";
  const when = clean(raw.when);
  let startsAt = new Date(0);
  if (!when) errors.when = "Choose the date and start time.";
  else {
    const d = zonedToUtc(when, zone);
    if (!d) errors.when = "Choose a real date and time.";
    else {
      // a booking can be for earlier today (recording one that happened), but not months ago, and not years ahead
      const bad = checkWhen(d, now);
      if (bad) errors.when = bad;
      else startsAt = d;
    }
  }
  const dur = parseWholeAmount(raw.durationMinutes, 15, 720);
  if (dur === null) errors.durationMinutes = "Duration must be a whole number of minutes, from 15 to 720.";
  const cost = parseWholeAmount(raw.totalCost, 0, COST_MAX);
  if (cost === null) errors.totalCost = `Total cost must be a whole number of rupees from 0 to ${COST_MAX.toLocaleString("en-US")}.`;
  const reference = clean(raw.reference), notes = clean(raw.notes);
  if (reference.length > 40) errors.reference = "The booking reference can be at most 40 characters.";
  if (notes.length > 300) errors.notes = "Notes can be at most 300 characters.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { venueId, startsAt, durationMinutes: dur!, totalCost: cost!, reference, notes } };
}

/* ---------- payments ---------- */
export type PaymentInput = { kind: "payment" | "refund"; amount: number; paidOn: string; method: string; reference: string; payerUserId: string | null; payerName: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validatePayment(raw: Record<string, unknown>, today: Date, uuid: (s: string) => boolean): Result<PaymentInput> {
  const errors: Errors = {};
  const kind = raw.kind === "refund" ? "refund" : "payment";
  const amount = parseWholeAmount(raw.amount, 1, COST_MAX);
  if (amount === null) errors.amount = `Amount must be a whole number of rupees from 1 to ${COST_MAX.toLocaleString("en-US")}.`;
  const paidOn = clean(raw.paidOn);
  const parts = DATE.test(paidOn) ? paidOn.split("-").map(Number) : null;
  const real = parts ? new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!)) : null;
  if (!parts || !real || real.getUTCFullYear() !== parts[0] || real.getUTCMonth() !== parts[1]! - 1 || real.getUTCDate() !== parts[2]) errors.paidOn = "Choose a real date.";
  else {
    const t = real.getTime();
    if (t > today.getTime() + 36 * 3_600_000) errors.paidOn = "The date cannot be in the future.";
    else if (t < today.getTime() - 5 * 366 * 86_400_000) errors.paidOn = "That date is too long ago. Please check the year.";
  }
  const method = clean(raw.method);
  if (!METHODS.some((m) => m.value === method)) errors.method = "Choose how it was paid.";
  const reference = clean(raw.reference);
  if (reference.length > 60) errors.reference = "The reference can be at most 60 characters.";
  const who = clean(raw.payer);
  let payerUserId: string | null = null, payerName = "";
  if (!who) errors.payer = kind === "refund" ? "Choose who the refund went to." : "Choose who paid.";
  else if (who.startsWith("u:")) { const id = who.slice(2); if (uuid(id)) payerUserId = id; else errors.payer = "Choose who paid."; }
  else if (who.startsWith("g:")) {
    payerName = clean(who.slice(2));
    if (!payerName || payerName.length > 60) errors.payer = "A guest name is 1 to 60 characters.";
  } else errors.payer = "Choose who paid.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { kind, amount: amount!, paidOn, method, reference, payerUserId, payerName } };
}

export type GuestInput = { ok: true; value: string } | { ok: false; error: string };
export function validateGuest(v: unknown): GuestInput {
  const n = clean(v);
  if (!n) return { ok: false, error: "Type the guest's name." };
  if (n.length > 60) return { ok: false, error: "A guest name can be at most 60 characters." };
  return { ok: true, value: n };
}
