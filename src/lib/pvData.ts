// Phase F3: everything Payments home needs about each booking in ONE read (who still has to cover their share, the totals).
// Read only. The numbers come from the existing money functions (moneyView / summarize), nothing is computed a new way.
import { query } from "@/lib/db";
import { listBookings, moneyView, type BookingRow, type PaymentRow, type SharingRow } from "@/lib/bookings";
import { formatWhen } from "@/lib/matchRules";
import type { BookingStatus, MemberStatus } from "@/lib/payments";
import { bySeverity } from "@/lib/pv";

export type PvPerson = { key: string; name: string; number: number | null; guest: boolean; net: number; share: number; status: MemberStatus };
export type PvBooking = {
  id: string; venue: string; address: string; whenText: string; duration: number; status: BookingStatus; total: number; contributed: number; members: number; share: number; extra: number;
  percent: number; verified: number; balance: number; overBy: number; refunded: number;
  /** People whose recorded money is below their share (unpaid or partly paid). */
  owing: number;
  /** Everyone who is not fully paid, most urgent first (unpaid, partly paid, pending check). */
  toCover: PvPerson[];
};

type SharingWithBooking = SharingRow & { booking_id: string };

export async function listBookingsWithMoney(communityId: string, tz: string): Promise<{ upcoming: PvBooking[]; past: PvBooking[]; all: number }> {
  const [bookings, sharing, payments] = await Promise.all([
    listBookings(communityId),
    query<SharingWithBooking>(
      `select m.id, m.booking_id, m.user_id, coalesce(u.name, m.guest_name) as name, (m.user_id is null) as guest, cm.player_number
         from booking_member m join booking b on b.id = m.booking_id
         left join app_user u on u.id = m.user_id
         left join community_member cm on cm.community_id = b.community_id and cm.user_id = m.user_id
        where b.community_id = $1 order by cm.player_number nulls last, lower(coalesce(u.name, m.guest_name))`, [communityId]),
    query<PaymentRow>(
      `select p.id, p.booking_id, p.payer_user_id, p.payer_name, p.kind, p.amount, to_char(p.paid_on, 'YYYY-MM-DD') as paid_on, p.method, p.reference,
              vb.name as verified_by_name, p.verified_at, ab.name as created_by_name, cb.name as changed_by_name, p.created_at, p.updated_at
         from booking_payment p join booking b on b.id = p.booking_id
         left join app_user vb on vb.id = p.verified_by left join app_user ab on ab.id = p.created_by left join app_user cb on cb.id = p.changed_by
        where b.community_id = $1`, [communityId]),
  ]);
  const group = <T extends { booking_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.booking_id) ?? m.set(r.booking_id, []).get(r.booking_id)!).push(r);
    return m;
  };
  const sh = group(sharing), pay = group(payments);
  const view = (b: BookingRow): PvBooking => {
    const mv = moneyView(b, sh.get(b.id) ?? [], pay.get(b.id) ?? []);
    const toCover: PvPerson[] = mv.people
      .filter((p) => p.status !== "paid")
      .map((p) => ({ key: p.key, name: p.name, number: p.guest ? null : p.player_number, guest: p.guest, net: p.net, share: p.share, status: p.status }))
      .sort(bySeverity);
    const owing = mv.people.filter((p) => p.status === "unpaid" || p.status === "partial" || p.net < p.share).length;
    const people = mv.people.length;
    return {
      id: b.id, venue: b.venue_name, address: b.venue_address, whenText: formatWhen(b.starts_at, tz), duration: b.duration_minutes, status: b.status, total: b.total_cost,
      contributed: mv.summary.contributed, members: people, share: mv.share, extra: people > 0 ? mv.share * people - b.total_cost : 0,
      percent: mv.summary.percent, verified: mv.summary.verified, balance: mv.summary.balance, overBy: mv.summary.overBy, refunded: mv.summary.refunded, owing, toCover,
    };
  };
  const all = bookings.map(view);
  const open = (s: BookingStatus) => s === "pending" || s === "confirmed";
  const startOf = new Map(bookings.map((b) => [b.id, b.starts_at.getTime()]));
  const upcoming = all.filter((b) => open(b.status)).sort((a, b) => startOf.get(a.id)! - startOf.get(b.id)!);
  const past = all.filter((b) => !open(b.status));
  return { upcoming, past, all: all.length };
}
