// Phase F4 (UI redesign, payments): the small calculations the booking screens need, with no database so each one is tested alone.
// Nothing here changes how money is worked out: the numbers come from payments.ts / bookings.ts (moneyView); this only arranges them for the screen.
import { money, type Summary } from "@/lib/payments";

/** The reminder gap, the same 60 minutes as PAY_REMINDER_GAP_MINUTES in bookings.ts (that file talks to the database, so it is repeated here). */
export const REMIND_GAP_MINUTES = 60;

/** Minutes until another reminder is allowed (0 when one can be sent now). Same rounding as the server. */
export function reminderWait(last: Date | string | null | undefined, nowMs: number): number {
  if (!last) return 0;
  const t = last instanceof Date ? last.getTime() : new Date(last).getTime();
  if (!Number.isFinite(t)) return 0;
  const waited = (nowMs - t) / 60000;
  return waited < REMIND_GAP_MINUTES ? Math.ceil(REMIND_GAP_MINUTES - waited) : 0;
}

/* ---------- the money card ---------- */
export type RingTone = "empty" | "partial" | "full" | "over" | "held";

export type Hero = {
  tone: RingTone;
  /** The big number and what it is called. */
  big: number; bigLabel: string; ofLine: string | null;
  checked: number; waiting: number; open: number; over: number; refunded: number;
  /** Segment widths in percent of the bar. */
  bar: { checked: number; waiting: number; open: number };
  percent: number;
};

/** What the money card shows. A cancelled booking says what is still held, not "still open". */
export function heroNumbers(s: Summary, cancelled: boolean): Hero {
  const contributed = s.contributed;
  const checked = Math.max(0, Math.min(s.verified, contributed));
  const waiting = Math.max(0, contributed - checked);
  const refunded = s.refunded;
  if (cancelled) {
    const held = Math.max(0, contributed);
    const denom = Math.max(held, 1);
    return {
      tone: "held", big: held, bigLabel: "Held after cancelling", ofLine: `${money(s.total)} was the cost`, checked, waiting, open: 0, over: 0, refunded,
      bar: { checked: (checked / denom) * 100, waiting: (waiting / denom) * 100, open: 0 }, percent: s.percent,
    };
  }
  const denom = Math.max(s.total, contributed, 1);
  const tone: RingTone = s.overBy > 0 ? "over" : contributed <= 0 ? "empty" : s.balance === 0 && s.total > 0 ? "full" : s.total === 0 && contributed > 0 ? "full" : "partial";
  return {
    tone, big: Math.max(0, contributed), bigLabel: "Contributed", ofLine: `of ${money(s.total)} total cost`, checked, waiting, open: s.balance, over: s.overBy, refunded,
    bar: { checked: (checked / denom) * 100, waiting: (waiting / denom) * 100, open: (s.balance / denom) * 100 },
    percent: s.percent,
  };
}

/* ---------- people ---------- */
type PersonLike = { user_id: string | null; name: string; guest: boolean; net: number; share: number };

/** "Paid PKR 500 · PKR 500 to suggested" / "Paid PKR 2,000 · PKR 1,000 over" / "Paid PKR 1,000". */
export function personLine(p: Pick<PersonLike, "net" | "share">): string {
  const paid = Math.max(0, p.net);
  const parts = [`Paid ${money(paid)}`];
  if (p.share > 0 && paid < p.share) parts.push(`${money(p.share - paid)} to suggested`);
  else if (p.share > 0 && paid > p.share) parts.push(`${money(paid - p.share)} over`);
  return parts.join(" · ");
}

/** Who a reminder would reach: the same rule as remindUnpaid() in bookings.ts (members only, not the person pressing, suggested share not covered). */
export function remindPlan(people: PersonLike[], viewerId: string, share: number) {
  const open = people.filter((p) => p.net < share);
  const due = open.filter((p) => p.user_id && p.user_id !== viewerId);
  return { due, guests: open.filter((p) => p.guest).map((p) => p.name), selfDue: open.some((p) => p.user_id === viewerId) };
}

/* ---------- refunds to give back (cancelled booking) ---------- */
type PayLike = { payer_user_id: string | null; payer_name: string; kind: "payment" | "refund"; amount: number };
export type Holder = { value: string; name: string; held: number; userId: string | null };

/** Everyone who still holds money on this booking (payments minus refunds above zero), whether or not they are in the sharing list. */
export function refundHolders(payments: PayLike[], nameOf: (userId: string) => string | undefined): Holder[] {
  const map = new Map<string, Holder>();
  for (const p of payments) {
    const key = p.payer_user_id ? `u:${p.payer_user_id}` : `g:${p.payer_name.toLowerCase()}`;
    const cur = map.get(key) ?? { value: p.payer_user_id ? key : `g:${p.payer_name}`, name: (p.payer_user_id && nameOf(p.payer_user_id)) || p.payer_name, held: 0, userId: p.payer_user_id };
    cur.held += p.kind === "payment" ? p.amount : -p.amount;
    map.set(key, cur);
  }
  return Array.from(map.values()).filter((h) => h.held > 0).sort((a, b) => a.name.localeCompare(b.name));
}

/** The key moneyView uses for a person picked in the form ("u:id" or "g:Name"). */
export const payerKey = (value: string) => (value.startsWith("g:") ? `g:${value.slice(2).toLowerCase()}` : value);

/* ---------- the sharing screen ---------- */
export function splitPreview(total: number, count: number) {
  const share = count <= 0 ? 0 : Math.ceil(total / count);
  return { count, share, total, extra: count <= 0 ? 0 : share * count - total };
}

/** A guest name as the server checks it (validateGuest): 1 to 60 characters after trimming. */
export function checkGuestName(raw: string, existing: string[]): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) return { ok: false, error: "A guest name must be 1 to 60 characters." };
  if (existing.some((e) => e.toLowerCase() === name.toLowerCase())) return { ok: false, error: `${name} is already in the list.` };
  return { ok: true, name };
}

/* ---------- my payments ---------- */
export type MyRowLike = { owner: "member" | "payer"; status: string; share: number; paid: number };
/** A booking still to cover: I am in the sharing list, it is not cancelled and my suggested share is not reached. Same rule as "Still suggested". */
export const needsCover = (r: MyRowLike) => r.owner === "member" && r.status !== "cancelled" && r.share > 0 && Math.max(0, r.paid) < r.share;

/** "Desert Falcons v Blue Hawks" as two team names, or null when the name does not split cleanly (then it is shown as plain text). */
export function splitTeams(name: string): [string, string] | null {
  const parts = name.split(" v ");
  return parts.length === 2 && parts[0]!.trim() && parts[1]!.trim() ? [parts[0]!.trim(), parts[1]!.trim()] : null;
}
