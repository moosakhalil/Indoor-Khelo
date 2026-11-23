// Phase 7: the change history of a booking in plain words (who, what, from, to). Pure.
import { BOOKING_LABEL, METHODS, money, type BookingStatus } from "@/lib/payments";

export type HistoryLike = { actor_name: string; action: string; details: Record<string, unknown> };

const num = (v: unknown) => money(Number(v) || 0);
const method = (v: unknown) => METHODS.find((m) => m.value === v)?.label ?? String(v);
const status = (v: unknown) => BOOKING_LABEL[v as BookingStatus] ?? String(v);

const FIELD: Record<string, (f: unknown, t: unknown) => string> = {
  total_cost: (f, t) => `the cost from ${num(f)} to ${num(t)}`,
  starts_at: () => "the date or time",
  duration_minutes: (f, t) => `the duration from ${f} to ${t} minutes`,
  venue: (_f, t) => `the venue to ${t}`,
  reference: (f, t) => `the reference from “${f || "none"}” to “${t || "none"}”`,
  notes: () => "the notes",
  payer: (f, t) => `the person from ${f} to ${t}`,
  kind: (f, t) => `the kind from ${f} to ${t}`,
  amount: (f, t) => `the amount from ${num(f)} to ${num(t)}`,
  date: (f, t) => `the date from ${f} to ${t}`,
  method: (f, t) => `the method from ${method(f)} to ${method(t)}`,
};

export function describeHistory(h: HistoryLike): string {
  const a = h.actor_name;
  const d = h.details as Record<string, unknown>;
  switch (h.action) {
    case "created": return `${a} created the booking (${num(d.total)})`;
    case "changed": {
      const parts = ((d.changes as { field: string; from: unknown; to: unknown }[]) ?? []).map((c) => (FIELD[c.field] ?? (() => c.field))(c.from, c.to));
      return `${a} changed ${parts.join(", ") || "the booking"}`;
    }
    case "status": return `${a} changed the status from ${status(d.from)} to ${status(d.to)}`;
    case "share_recalculated": return `The suggested share changed from ${num(d.from)} to ${num(d.to)} (${d.people} ${d.people === 1 ? "person" : "people"})`;
    case "sharing": return `${a} changed who shares the cost: ${d.added} added, ${d.removed} removed (${d.people} now). Suggested share ${num(d.shareFrom)} to ${num(d.shareTo)}`;
    case "matches": return `${a} changed the linked matches: ${d.added} added, ${d.removed} removed`;
    case "payment_recorded": return `${a} recorded a payment of ${num(d.amount)} from ${d.payer} (${method(d.method)}, ${d.on})`;
    case "refund_recorded": return `${a} recorded a refund of ${num(d.amount)} to ${d.payer} (${method(d.method)}, ${d.on})`;
    case "payment_changed": return `${a} changed a record for ${d.payer}: ${((d.changes as { field: string; from: unknown; to: unknown }[]) ?? []).map((c) => (FIELD[c.field] ?? (() => c.field))(c.from, c.to)).join(", ")}`;
    case "payment_removed": return `${a} removed a ${d.kind === "refund" ? "refund" : "payment"} of ${num(d.amount)} from ${d.payer}`;
    case "payment_checked": return `${a} checked the ${num(d.amount)} from ${d.payer}`;
    case "payment_unchecked": return `${a} marked the ${num(d.amount)} from ${d.payer} as not checked`;
    default: return `${a} made a change`;
  }
}
