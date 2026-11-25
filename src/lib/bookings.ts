// Phase 7: venues, bookings, cost sharing and contributions. Any approved member can create and change them (open community);
// every change shows a name and is kept in the booking's history. Nothing here touches scores or statistics.
import type { PoolClient } from "pg";
import { isUniqueViolation, one, query, tx } from "@/lib/db";
import { isUuid } from "@/lib/community";
import { isAdminMember, mayManage } from "@/lib/ownerRule";
import {
  BOOKING_LABEL, memberStatus, money, netFor, suggestedShare, summarize, type BookingInput, type BookingStatus, type Contribution, type PaymentInput, type VenueInput,
} from "@/lib/payments";

/* ---------- shapes ---------- */
// `created_by` is who added the record: they, or an Admin, may delete it (venue, booking) or change / remove it (payment), see lib/ownerRule.ts.
export type VenueRow = { id: string; name: string; address: string; contact: string; created_by: string | null; created_by_name: string | null; changed_by_name: string | null; updated_at: Date; booking_count: number };
export type BookingRow = {
  id: string; community_id: string; venue_id: string; venue_name: string; venue_address: string; venue_contact: string; starts_at: Date; duration_minutes: number; total_cost: number;
  reference: string; notes: string; status: BookingStatus; created_by: string | null; created_by_name: string | null; changed_by_name: string | null; created_at: Date; updated_at: Date; last_reminder_at: Date | null;
  contributed: number; member_count: number;
};
export type SharingRow = { id: string; user_id: string | null; name: string; guest: boolean; player_number: number | null };
export type PaymentRow = {
  id: string; booking_id: string; payer_user_id: string | null; payer_name: string; kind: "payment" | "refund"; amount: number; paid_on: string; method: string; reference: string;
  verified_by_name: string | null; verified_at: Date | null; created_by: string | null; created_by_name: string | null; changed_by_name: string | null; created_at: Date; updated_at: Date;
};
export type HistoryRow = { id: number; actor_name: string; action: string; details: Record<string, unknown>; created_at: Date };

const isApproved = async (c: PoolClient, communityId: string, userId: string) =>
  (await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and status = 'approved'", [communityId, userId])).rows.length > 0;

async function nameOf(c: PoolClient, userId: string): Promise<string> {
  return (await c.query<{ name: string }>("select name from app_user where id = $1", [userId])).rows[0]?.name ?? "Someone";
}
async function hist(c: PoolClient, bookingId: string, userId: string, action: string, details: Record<string, unknown> = {}) {
  await c.query("insert into booking_history (booking_id, actor_id, actor_name, action, details) values ($1, $2, $3, $4, $5)", [bookingId, userId, await nameOf(c, userId), action, JSON.stringify(details)]);
}
async function alert(c: PoolClient, communityId: string, bookingId: string, kind: string, message: string, userIds: string[]) {
  if (!userIds.length) return;
  await c.query(
    `insert into app_alert (community_id, user_id, booking_id, kind, message)
     select $1, u, $2, $3, $4 from unnest($5::uuid[]) as u`, [communityId, bookingId, kind, message, userIds]);
}

/* ---------- venues ---------- */
export type VenueOutcome = "ok" | "forbidden" | "not_found" | "name_taken" | "in_use" | "not_owner";

export async function listVenues(communityId: string): Promise<VenueRow[]> {
  return query<VenueRow>(
    `select v.id, v.name, v.address, v.contact, v.created_by, ab.name as created_by_name, cb.name as changed_by_name, v.updated_at,
            (select count(*)::int from booking b where b.venue_id = v.id) as booking_count
       from venue v left join app_user ab on ab.id = v.created_by left join app_user cb on cb.id = v.changed_by
      where v.community_id = $1 order by lower(v.name)`, [communityId]);
}
export async function getVenue(communityId: string, id: string): Promise<VenueRow | null> {
  if (!isUuid(id)) return null;
  return (await listVenues(communityId)).find((v) => v.id === id) ?? null;
}
export async function createVenue(userId: string, communityId: string, v: VenueInput): Promise<{ outcome: VenueOutcome; id?: string }> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      const r = await c.query<{ id: string }>("insert into venue (community_id, name, address, contact, created_by, changed_by) values ($1, $2, $3, $4, $5, $5) returning id", [communityId, v.name, v.address, v.contact, userId]);
      return { outcome: "ok" as const, id: r.rows[0]!.id };
    });
  } catch (e) { if (isUniqueViolation(e)) return { outcome: "name_taken" }; throw e; }
}
export async function updateVenue(userId: string, communityId: string, id: string, v: VenueInput): Promise<VenueOutcome> {
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return "forbidden";
      const r = await c.query("update venue set name = $3, address = $4, contact = $5, changed_by = $6, updated_at = now() where id = $1 and community_id = $2", [id, communityId, v.name, v.address, v.contact, userId]);
      return r.rowCount ? "ok" : "not_found";
    });
  } catch (e) { if (isUniqueViolation(e)) return "name_taken"; throw e; }
}
export async function deleteVenue(userId: string, communityId: string, id: string): Promise<VenueOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    // Only the person who added the venue, or an Admin, can delete it (ownerRule.ts).
    const own = await c.query<{ created_by: string | null }>("select created_by from venue where id = $1 and community_id = $2", [id, communityId]);
    if (!own.rows.length) return "not_found";
    if (!mayManage({ id: userId, admin: await isAdminMember(c, communityId, userId) }, own.rows[0]!.created_by)) return "not_owner";
    const used = await c.query("select 1 from booking where venue_id = $1 limit 1", [id]);
    if (used.rows.length) return "in_use";
    const r = await c.query("delete from venue where id = $1 and community_id = $2", [id, communityId]);
    return r.rowCount ? "ok" : "not_found";
  });
}

/* ---------- bookings: reading ---------- */
const BOOKING_SELECT = `
  select b.id, b.community_id, b.venue_id, v.name as venue_name, v.address as venue_address, v.contact as venue_contact, b.starts_at, b.duration_minutes, b.total_cost,
         b.reference, b.notes, b.status, b.created_by, ab.name as created_by_name, cb.name as changed_by_name, b.created_at, b.updated_at, b.last_reminder_at,
         coalesce((select sum(case when p.kind = 'payment' then p.amount else -p.amount end) from booking_payment p where p.booking_id = b.id), 0)::int as contributed,
         (select count(*)::int from booking_member m where m.booking_id = b.id) as member_count
    from booking b join venue v on v.id = b.venue_id
    left join app_user ab on ab.id = b.created_by left join app_user cb on cb.id = b.changed_by`;

export async function listBookings(communityId: string): Promise<BookingRow[]> {
  return query<BookingRow>(`${BOOKING_SELECT} where b.community_id = $1 order by b.starts_at desc`, [communityId]);
}
export async function getBooking(communityId: string, id: string): Promise<BookingRow | null> {
  if (!isUuid(id)) return null;
  return one<BookingRow>(`${BOOKING_SELECT} where b.community_id = $1 and b.id = $2`, [communityId, id]);
}
export async function listSharing(bookingId: string): Promise<SharingRow[]> {
  return query<SharingRow>(
    `select m.id, m.user_id, coalesce(u.name, m.guest_name) as name, (m.user_id is null) as guest, cm.player_number
       from booking_member m left join app_user u on u.id = m.user_id
       left join booking b on b.id = m.booking_id left join community_member cm on cm.community_id = b.community_id and cm.user_id = m.user_id
      where m.booking_id = $1 order by cm.player_number nulls last, lower(coalesce(u.name, m.guest_name))`, [bookingId]);
}
export async function listPayments(bookingId: string): Promise<PaymentRow[]> {
  return query<PaymentRow>(
    `select p.id, p.booking_id, p.payer_user_id, p.payer_name, p.kind, p.amount, to_char(p.paid_on, 'YYYY-MM-DD') as paid_on, p.method, p.reference,
            vb.name as verified_by_name, p.verified_at, p.created_by, ab.name as created_by_name, cb.name as changed_by_name, p.created_at, p.updated_at
       from booking_payment p left join app_user vb on vb.id = p.verified_by left join app_user ab on ab.id = p.created_by left join app_user cb on cb.id = p.changed_by
      where p.booking_id = $1 order by p.paid_on desc, p.created_at desc`, [bookingId]);
}
export async function listHistory(bookingId: string, limit = 100): Promise<HistoryRow[]> {
  return query<HistoryRow>("select id, actor_name, action, details, created_at from booking_history where booking_id = $1 order by id desc limit $2", [bookingId, limit]);
}
export async function linkedMatches(bookingId: string): Promise<{ id: string; name: string; status: string; scheduled_at: Date | null }[]> {
  return query(`select m.id, s1.name || ' v ' || s2.name as name, m.status, m.scheduled_at from booking_match bm join cricket_match m on m.id = bm.match_id
                 join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
                where bm.booking_id = $1 order by m.scheduled_at nulls last`, [bookingId]);
}
export async function matchesToLink(communityId: string): Promise<{ id: string; name: string; status: string; scheduled_at: Date | null }[]> {
  return query(`select m.id, s1.name || ' v ' || s2.name as name, m.status, m.scheduled_at from cricket_match m
                 join match_side s1 on s1.match_id = m.id and s1.position = 1 join match_side s2 on s2.match_id = m.id and s2.position = 2
                where m.community_id = $1 and m.status <> 'cancelled' order by m.scheduled_at desc nulls last limit 60`, [communityId]);
}

/** Everything the booking screen shows about money: each person's suggested share and status, and the totals. */
export function moneyView(b: Pick<BookingRow, "total_cost">, sharing: SharingRow[], payments: PaymentRow[]) {
  const list: Contribution[] = payments.map((p) => ({ payerKey: p.payer_user_id ? `u:${p.payer_user_id}` : `g:${p.payer_name.toLowerCase()}`, kind: p.kind, amount: p.amount, verified: !!p.verified_at }));
  const share = suggestedShare(b.total_cost, sharing.length);
  const people = sharing.map((s) => {
    const key = s.user_id ? `u:${s.user_id}` : `g:${s.name.toLowerCase()}`;
    const net = netFor(list, key), ver = netFor(list, key, true);
    return { ...s, key, net, verified: ver, share, status: memberStatus(share, net, ver), stillSuggested: Math.max(0, share - Math.max(0, net)) };
  });
  return { share, people, summary: summarize(b.total_cost, list), list };
}

/* ---------- bookings: changing ---------- */
export type BookingOutcome = "ok" | "forbidden" | "not_found" | "bad_venue" | "bad_state" | "bad_person" | "too_soon" | "nobody" | "duplicate" | "too_much" | "not_owner";

export async function createBooking(userId: string, communityId: string, b: BookingInput): Promise<{ outcome: BookingOutcome; id?: string }> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
    const v = await c.query("select 1 from venue where id = $1 and community_id = $2", [b.venueId, communityId]);
    if (!v.rows.length) return { outcome: "bad_venue" as const };
    const r = await c.query<{ id: string }>(
      `insert into booking (community_id, venue_id, starts_at, duration_minutes, total_cost, reference, notes, created_by, changed_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $8) returning id`,
      [communityId, b.venueId, b.startsAt, b.durationMinutes, b.totalCost, b.reference, b.notes, userId]);
    await hist(c, r.rows[0]!.id, userId, "created", { total: b.totalCost });
    return { outcome: "ok" as const, id: r.rows[0]!.id };
  });
}

/** Change a booking. What changed is written to the history; if the cost changed, every suggested share is worked out again and the people in it are told. */
export async function updateBooking(userId: string, communityId: string, id: string, b: BookingInput): Promise<BookingOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const old = await c.query<{ venue_id: string; starts_at: Date; duration_minutes: number; total_cost: number; reference: string; notes: string }>("select venue_id, starts_at, duration_minutes, total_cost, reference, notes from booking where id = $1 and community_id = $2 for update", [id, communityId]);
    if (!old.rows.length) return "not_found";
    const v = await c.query<{ name: string }>("select name from venue where id = $1 and community_id = $2", [b.venueId, communityId]);
    if (!v.rows.length) return "bad_venue";
    const o = old.rows[0]!;
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    if (o.venue_id !== b.venueId) changes.push({ field: "venue", from: o.venue_id, to: v.rows[0]!.name });
    if (o.starts_at.getTime() !== b.startsAt.getTime()) changes.push({ field: "starts_at", from: o.starts_at.toISOString(), to: b.startsAt.toISOString() });
    if (o.duration_minutes !== b.durationMinutes) changes.push({ field: "duration_minutes", from: o.duration_minutes, to: b.durationMinutes });
    if (o.total_cost !== b.totalCost) changes.push({ field: "total_cost", from: o.total_cost, to: b.totalCost });
    if (o.reference !== b.reference) changes.push({ field: "reference", from: o.reference, to: b.reference });
    if (o.notes !== b.notes) changes.push({ field: "notes", from: o.notes, to: b.notes });
    await c.query("update booking set venue_id = $3, starts_at = $4, duration_minutes = $5, total_cost = $6, reference = $7, notes = $8, changed_by = $9, updated_at = now() where id = $1 and community_id = $2",
      [id, communityId, b.venueId, b.startsAt, b.durationMinutes, b.totalCost, b.reference, b.notes, userId]);
    if (changes.length) await hist(c, id, userId, "changed", { changes });
    if (o.total_cost !== b.totalCost) {
      const people = await c.query<{ user_id: string | null }>("select user_id from booking_member where booking_id = $1", [id]);
      if (people.rows.length) {
        const from = suggestedShare(o.total_cost, people.rows.length), to = suggestedShare(b.totalCost, people.rows.length);
        await hist(c, id, userId, "share_recalculated", { from, to, people: people.rows.length });
        await alert(c, communityId, id, "booking_changed", `The cost for ${v.rows[0]!.name} changed to ${money(b.totalCost)}. The suggested share is now ${money(to)} (it was ${money(from)}).`,
          people.rows.map((r) => r.user_id).filter((x): x is string => !!x && x !== userId));
      }
    }
    return "ok";
  });
}

export async function setBookingStatus(userId: string, communityId: string, id: string, status: string): Promise<BookingOutcome> {
  if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) return "bad_state";
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const r = await c.query<{ status: string }>("select status from booking where id = $1 and community_id = $2 for update", [id, communityId]);
    if (!r.rows.length) return "not_found";
    if (r.rows[0]!.status === status) return "bad_state";
    await c.query("update booking set status = $3, changed_by = $4, updated_at = now() where id = $1 and community_id = $2", [id, communityId, status, userId]);
    await hist(c, id, userId, "status", { from: r.rows[0]!.status, to: status });
    return "ok";
  });
}

export async function deleteBooking(userId: string, communityId: string, id: string): Promise<BookingOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    // Only the person who added the booking, or an Admin, can delete it (ownerRule.ts).
    const own = await c.query<{ created_by: string | null }>("select created_by from booking where id = $1 and community_id = $2", [id, communityId]);
    if (!own.rows.length) return "not_found";
    if (!mayManage({ id: userId, admin: await isAdminMember(c, communityId, userId) }, own.rows[0]!.created_by)) return "not_owner";
    const pay = await c.query("select 1 from booking_payment where booking_id = $1 limit 1", [id]);
    if (pay.rows.length) return "bad_state";   // a booking with money recorded is cancelled, never deleted, so the records stay
    const r = await c.query("delete from booking where id = $1 and community_id = $2", [id, communityId]);
    return r.rowCount ? "ok" : "not_found";
  });
}

/** Who the cost is suggested to be shared between. Replaces the list; everyone newly added is told their share, everyone else is told if their share changed. */
export async function setSharing(userId: string, communityId: string, id: string, memberIds: string[], guests: string[]): Promise<BookingOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const b = await c.query<{ total_cost: number; venue_name: string }>("select b.total_cost, v.name as venue_name from booking b join venue v on v.id = b.venue_id where b.id = $1 and b.community_id = $2 for update of b", [id, communityId]);
    if (!b.rows.length) return "not_found";
    const wanted = Array.from(new Set(memberIds.filter(isUuid)));
    const valid = wanted.length ? (await c.query<{ user_id: string }>("select user_id from community_member where community_id = $1 and status = 'approved' and user_id = any($2::uuid[])", [communityId, wanted])).rows.map((r) => r.user_id) : [];
    if (valid.length !== wanted.length) return "bad_person";
    const names: string[] = [];
    for (const g of guests) { const t = g.trim(); if (t && !names.some((n) => n.toLowerCase() === t.toLowerCase())) names.push(t); }   // the first spelling of a guest name wins
    const before = await c.query<{ id: string; user_id: string | null; guest_name: string | null }>("select id, user_id, guest_name from booking_member where booking_id = $1", [id]);
    const had = new Set(before.rows.map((r) => r.user_id ?? `g:${r.guest_name!.toLowerCase()}`));
    const want = new Set([...valid, ...names.map((n) => `g:${n.toLowerCase()}`)]);
    const removed = before.rows.filter((r) => !want.has(r.user_id ?? `g:${r.guest_name!.toLowerCase()}`));
    if (removed.length) await c.query("delete from booking_member where id = any($1::uuid[])", [removed.map((r) => r.id)]);
    const addedUsers = valid.filter((u) => !had.has(u));
    for (const u of addedUsers) await c.query("insert into booking_member (booking_id, user_id, added_by) values ($1, $2, $3)", [id, u, userId]);
    const addedGuests = names.filter((n) => !had.has(`g:${n.toLowerCase()}`));
    for (const n of addedGuests) await c.query("insert into booking_member (booking_id, guest_name, added_by) values ($1, $2, $3)", [id, n, userId]);
    const total = b.rows[0]!.total_cost;
    const oldN = before.rows.length, newN = want.size;
    if (addedUsers.length || addedGuests.length || removed.length) {
      await hist(c, id, userId, "sharing", { added: addedUsers.length + addedGuests.length, removed: removed.length, people: newN, shareFrom: suggestedShare(total, oldN), shareTo: suggestedShare(total, newN) });
    }
    const venue = b.rows[0]!.venue_name;
    await alert(c, communityId, id, "booking_share", `You are in the cost sharing for ${venue}. The suggested share is ${money(suggestedShare(total, newN))}. Paying is up to you and the group.`, addedUsers.filter((u) => u !== userId));
    if (oldN !== newN && oldN > 0) {
      const stay = valid.filter((u) => had.has(u) && u !== userId);
      await alert(c, communityId, id, "booking_changed", `The people sharing ${venue} changed. The suggested share is now ${money(suggestedShare(total, newN))} (it was ${money(suggestedShare(total, oldN))}).`, stay);
    }
    await c.query("update booking set changed_by = $2, updated_at = now() where id = $1", [id, userId]);
    return "ok";
  });
}

export async function linkMatches(userId: string, communityId: string, id: string, matchIds: string[]): Promise<BookingOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const b = await c.query("select 1 from booking where id = $1 and community_id = $2 for update", [id, communityId]);
    if (!b.rows.length) return "not_found";
    const wanted = Array.from(new Set(matchIds.filter(isUuid)));
    const ok = wanted.length ? (await c.query<{ id: string }>("select id from cricket_match where community_id = $1 and id = any($2::uuid[])", [communityId, wanted])).rows.map((r) => r.id) : [];
    const before = new Set((await c.query<{ match_id: string }>("select match_id from booking_match where booking_id = $1", [id])).rows.map((r) => r.match_id));
    await c.query("delete from booking_match where booking_id = $1 and not (match_id = any($2::uuid[]))", [id, ok]);
    for (const m of ok) await c.query("insert into booking_match (booking_id, match_id) values ($1, $2) on conflict do nothing", [id, m]);
    const added = ok.filter((m) => !before.has(m)).length, removed = Array.from(before).filter((m) => !ok.includes(m)).length;
    if (added || removed) { await hist(c, id, userId, "matches", { added, removed }); await c.query("update booking set changed_by = $2, updated_at = now() where id = $1", [id, userId]); }
    return "ok";
  });
}

/* ---------- contributions ---------- */
async function payerNet(c: PoolClient, bookingId: string, p: { payerUserId: string | null; payerName: string }, exceptPaymentId: string | null): Promise<number> {
  const r = await c.query<{ net: number }>(
    `select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)::int as net from booking_payment
      where booking_id = $1 and ($2::uuid is null or payer_user_id = $2) and ($2::uuid is not null or (payer_user_id is null and lower(payer_name) = lower($3)))
        and ($4::uuid is null or id <> $4)`, [bookingId, p.payerUserId, p.payerName, exceptPaymentId]);
  return r.rows[0]!.net;
}

/** Record a payment or a refund. The id comes from the phone, so a record that was sent twice (after a lost signal) is saved once. */
export async function addPayment(userId: string, communityId: string, bookingId: string, id: string, p: PaymentInput): Promise<{ outcome: BookingOutcome; duplicate?: boolean }> {
  if (!isUuid(id) || !isUuid(bookingId)) return { outcome: "not_found" };
  try {
    return await tx(async (c) => {
      if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
      const b = await c.query("select 1 from booking where id = $1 and community_id = $2 for update", [bookingId, communityId]);
      if (!b.rows.length) return { outcome: "not_found" as const };
      const dup = await c.query("select booking_id from booking_payment where id = $1", [id]);
      if (dup.rows.length) return dup.rows[0]!.booking_id === bookingId ? { outcome: "ok" as const, duplicate: true } : { outcome: "duplicate" as const };
      let payerName = p.payerName;
      if (p.payerUserId) {
        if (!(await isApproved(c, communityId, p.payerUserId))) return { outcome: "bad_person" as const };
        payerName = await nameOf(c, p.payerUserId);
      }
      if (p.kind === "refund") {
        const net = await payerNet(c, bookingId, { payerUserId: p.payerUserId, payerName }, null);
        if (p.amount > net) return { outcome: "too_much" as const };     // cannot refund more than that person has put in
      }
      await c.query(
        `insert into booking_payment (id, booking_id, payer_user_id, payer_name, kind, amount, paid_on, method, reference, created_by, changed_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [id, bookingId, p.payerUserId, payerName, p.kind, p.amount, p.paidOn, p.method, p.reference, userId]);
      await hist(c, bookingId, userId, p.kind === "refund" ? "refund_recorded" : "payment_recorded", { payer: payerName, amount: p.amount, method: p.method, on: p.paidOn });
      await c.query("update booking set changed_by = $2, updated_at = now() where id = $1", [bookingId, userId]);
      return { outcome: "ok" as const };
    });
  } catch (e) { if (isUniqueViolation(e)) return { outcome: "ok", duplicate: true }; throw e; }
}

export async function updatePayment(userId: string, communityId: string, bookingId: string, id: string, p: PaymentInput): Promise<BookingOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const b = await c.query("select 1 from booking where id = $1 and community_id = $2 for update", [bookingId, communityId]);
    if (!b.rows.length) return "not_found";
    const old = await c.query<{ payer_name: string; payer_user_id: string | null; kind: string; amount: number; paid_on: string; method: string; reference: string; created_by: string | null }>(
      "select payer_name, payer_user_id, kind, amount, to_char(paid_on, 'YYYY-MM-DD') as paid_on, method, reference, created_by from booking_payment where id = $1 and booking_id = $2", [id, bookingId]);
    if (!old.rows.length) return "not_found";
    // Only the person who recorded the payment, or an Admin, can change it (ownerRule.ts).
    if (!mayManage({ id: userId, admin: await isAdminMember(c, communityId, userId) }, old.rows[0]!.created_by)) return "not_owner";
    let payerName = p.payerName;
    if (p.payerUserId) {
      if (!(await isApproved(c, communityId, p.payerUserId))) return "bad_person";
      payerName = await nameOf(c, p.payerUserId);
    }
    if (p.kind === "refund") {
      const net = await payerNet(c, bookingId, { payerUserId: p.payerUserId, payerName }, id);
      if (p.amount > net) return "too_much";
    }
    const o = old.rows[0]!;
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    if (o.payer_name !== payerName) changes.push({ field: "payer", from: o.payer_name, to: payerName });
    if (o.kind !== p.kind) changes.push({ field: "kind", from: o.kind, to: p.kind });
    if (o.amount !== p.amount) changes.push({ field: "amount", from: o.amount, to: p.amount });
    if (o.paid_on !== p.paidOn) changes.push({ field: "date", from: o.paid_on, to: p.paidOn });
    if (o.method !== p.method) changes.push({ field: "method", from: o.method, to: p.method });
    if (o.reference !== p.reference) changes.push({ field: "reference", from: o.reference, to: p.reference });
    // an edited record needs a fresh check by someone
    await c.query(
      `update booking_payment set payer_user_id = $3, payer_name = $4, kind = $5, amount = $6, paid_on = $7, method = $8, reference = $9, verified_by = null, verified_at = null, changed_by = $10, updated_at = now()
        where id = $1 and booking_id = $2`, [id, bookingId, p.payerUserId, payerName, p.kind, p.amount, p.paidOn, p.method, p.reference, userId]);
    if (changes.length) await hist(c, bookingId, userId, "payment_changed", { payer: payerName, changes });
    await c.query("update booking set changed_by = $2, updated_at = now() where id = $1", [bookingId, userId]);
    return "ok";
  });
}

export async function deletePayment(userId: string, communityId: string, bookingId: string, id: string): Promise<BookingOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const b = await c.query("select 1 from booking where id = $1 and community_id = $2 for update", [bookingId, communityId]);
    if (!b.rows.length) return "not_found";
    // Only the person who recorded the payment, or an Admin, can remove it (ownerRule.ts).
    const own = await c.query<{ created_by: string | null }>("select created_by from booking_payment where id = $1 and booking_id = $2", [id, bookingId]);
    if (!own.rows.length) return "not_found";
    if (!mayManage({ id: userId, admin: await isAdminMember(c, communityId, userId) }, own.rows[0]!.created_by)) return "not_owner";
    const r = await c.query<{ payer_name: string; kind: string; amount: number }>("delete from booking_payment where id = $1 and booking_id = $2 returning payer_name, kind, amount", [id, bookingId]);
    if (!r.rows.length) return "not_found";
    await hist(c, bookingId, userId, "payment_removed", { payer: r.rows[0]!.payer_name, kind: r.rows[0]!.kind, amount: r.rows[0]!.amount });
    await c.query("update booking set changed_by = $2, updated_at = now() where id = $1", [bookingId, userId]);
    return "ok";
  });
}

/** Mark a recorded payment as checked (for example the cash was received or the transfer arrived). Any member can; their name is kept. */
export async function verifyPayment(userId: string, communityId: string, bookingId: string, id: string, on: boolean): Promise<BookingOutcome> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return "forbidden";
    const b = await c.query("select 1 from booking where id = $1 and community_id = $2 for update", [bookingId, communityId]);
    if (!b.rows.length) return "not_found";
    const r = await c.query<{ payer_name: string; amount: number }>(
      "update booking_payment set verified_by = $3, verified_at = case when $4 then now() else null end, changed_by = $5, updated_at = now() where id = $1 and booking_id = $2 returning payer_name, amount",
      [id, bookingId, on ? userId : null, on, userId]);
    if (!r.rows.length) return "not_found";
    await hist(c, bookingId, userId, on ? "payment_checked" : "payment_unchecked", { payer: r.rows[0]!.payer_name, amount: r.rows[0]!.amount });
    return "ok";
  });
}

/** One alert to every member in the sharing list whose suggested share is not covered yet. At most once an hour per booking. */
export const PAY_REMINDER_GAP_MINUTES = 60;
export async function remindUnpaid(userId: string, communityId: string, id: string): Promise<{ outcome: BookingOutcome; sent?: number; waitMinutes?: number }> {
  return tx(async (c) => {
    if (!(await isApproved(c, communityId, userId))) return { outcome: "forbidden" as const };
    const b = await c.query<{ total_cost: number; status: string; last_reminder_at: Date | null; venue_name: string }>(
      "select b.total_cost, b.status, b.last_reminder_at, v.name as venue_name from booking b join venue v on v.id = b.venue_id where b.id = $1 and b.community_id = $2 for update of b", [id, communityId]);
    if (!b.rows.length) return { outcome: "not_found" as const };
    const row = b.rows[0]!;
    if (row.status === "cancelled") return { outcome: "bad_state" as const };
    if (row.last_reminder_at) {
      const waited = (Date.now() - row.last_reminder_at.getTime()) / 60000;
      if (waited < PAY_REMINDER_GAP_MINUTES) return { outcome: "too_soon" as const, waitMinutes: Math.ceil(PAY_REMINDER_GAP_MINUTES - waited) };
    }
    const sharing = (await c.query<{ id: string; user_id: string | null; guest_name: string | null }>("select id, user_id, guest_name from booking_member where booking_id = $1", [id])).rows;
    const pays = (await c.query<{ payer_user_id: string | null; payer_name: string; kind: "payment" | "refund"; amount: number; verified_at: Date | null }>("select payer_user_id, payer_name, kind, amount, verified_at from booking_payment where booking_id = $1", [id])).rows;
    const list: Contribution[] = pays.map((p) => ({ payerKey: p.payer_user_id ? `u:${p.payer_user_id}` : `g:${p.payer_name.toLowerCase()}`, kind: p.kind, amount: p.amount, verified: !!p.verified_at }));
    const share = suggestedShare(row.total_cost, sharing.length);
    const due = sharing.filter((m) => m.user_id && m.user_id !== userId && (netFor(list, `u:${m.user_id}`) < share)).map((m) => m.user_id!);
    if (!due.length) return { outcome: "nobody" as const };
    await alert(c, communityId, id, "payment_reminder", `Reminder: ${row.venue_name} still has ${money(summarize(row.total_cost, list).balance)} open. Your suggested share is ${money(share)}. Paying is up to you and the group.`, due);
    await c.query("update booking set last_reminder_at = now() where id = $1", [id]);
    return { outcome: "ok" as const, sent: due.length };
  });
}
export { BOOKING_LABEL };


/* ---------- my payments: what I paid and my suggested share, across the community's bookings ---------- */
export type MyPaymentRow = { bookingId: string; venue: string; starts_at: Date; status: BookingStatus; total: number; share: number; paid: number; checked: number; owner: "member" | "payer" };

export async function myPayments(communityId: string, userId: string): Promise<{ rows: MyPaymentRow[]; paid: number; stillSuggested: number }> {
  const rows = await query<{ id: string; venue: string; starts_at: Date; status: BookingStatus; total_cost: number; people: number; in_list: boolean; paid: number; checked: number }>(
    `select b.id, v.name as venue, b.starts_at, b.status, b.total_cost,
            (select count(*)::int from booking_member m where m.booking_id = b.id) as people,
            exists (select 1 from booking_member m where m.booking_id = b.id and m.user_id = $2) as in_list,
            coalesce((select sum(case when p.kind = 'payment' then p.amount else -p.amount end) from booking_payment p where p.booking_id = b.id and p.payer_user_id = $2), 0)::int as paid,
            coalesce((select sum(case when p.kind = 'payment' then p.amount else -p.amount end) from booking_payment p where p.booking_id = b.id and p.payer_user_id = $2 and p.verified_at is not null), 0)::int as checked
       from booking b join venue v on v.id = b.venue_id
      where b.community_id = $1
        and (exists (select 1 from booking_member m where m.booking_id = b.id and m.user_id = $2)
          or exists (select 1 from booking_payment p where p.booking_id = b.id and p.payer_user_id = $2))
      order by b.starts_at desc`, [communityId, userId]);
  const out: MyPaymentRow[] = rows.map((r) => ({
    bookingId: r.id, venue: r.venue, starts_at: r.starts_at, status: r.status, total: r.total_cost,
    share: r.in_list ? suggestedShare(r.total_cost, r.people) : 0, paid: r.paid, checked: r.checked, owner: r.in_list ? "member" : "payer",
  }));
  // a cancelled booking has nothing left to suggest
  const stillSuggested = out.filter((r) => r.status !== "cancelled" && r.share > 0).reduce((a, r) => a + Math.max(0, r.share - Math.max(0, r.paid)), 0);
  return { rows: out, paid: out.reduce((a, r) => a + r.paid, 0), stillSuggested };
}
