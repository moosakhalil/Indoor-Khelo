import type { Metadata } from "next";
import Link from "next/link";
import { BookingStatusChip } from "@/components/BookingBits";
import Frame from "@/components/Frame";
import { listBookings } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { money } from "@/lib/payments";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const { id } = await params;
  const { deleted } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [all, tz] = await Promise.all([listBookings(id), getZone()]);
  const open = all.filter((b) => b.status === "pending" || b.status === "confirmed").sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  const past = all.filter((b) => b.status === "completed" || b.status === "cancelled");
  const card = (b: (typeof all)[number]) => {
    const pct = b.total_cost === 0 ? 0 : Math.max(0, Math.min(100, Math.round((b.contributed * 100) / b.total_cost)));
    return (
      <Link key={b.id} href={`/c/${id}/payments/${b.id}`} className="card" style={{ display: "block" }}>
        <div className="row space"><b>{b.venue_name}</b><BookingStatusChip status={b.status} /></div>
        <small className="muted" style={{ display: "block" }}>{formatWhen(b.starts_at, tz)} · {b.duration_minutes} min</small>
        <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <small className="muted" style={{ display: "block", marginTop: 6 }}>{money(b.contributed)} of {money(b.total_cost)} contributed · {b.member_count} sharing</small>
      </Link>
    );
  };
  return (
    <Frame communityId={id} title="Payments">
      <div className="stack">
        {deleted && <div className="banner green" role="status">Booking deleted.</div>}
        <div className="two">
          <Link href={`/c/${id}/payments/new`} className="btn gold">New booking</Link>
          <Link href={`/c/${id}/payments/venues`} className="btn ghost">Venues</Link>
        </div>
        {all.length === 0 && (
          <div className="card center">
            <b>No bookings yet</b>
            <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>Add the venue you play at, then create a booking with the date, time and cost. Choose who shares the cost and record what people pay. Paying is up to the group: nobody is forced, and one person can cover it all.</p>
          </div>
        )}
        {open.length > 0 && <section className="stack"><h2 style={{ fontSize: "1rem" }}>Upcoming <small className="muted">({open.length})</small></h2>{open.map(card)}</section>}
        {past.length > 0 && <section className="stack"><h2 style={{ fontSize: "1rem" }}>Past and cancelled <small className="muted">({past.length})</small></h2>{past.map(card)}</section>}
        <p className="muted small" style={{ margin: 0 }}>Payment records are only visible to members of this community, and only here. They never appear on stats pages and never change scores.</p>
      </div>
    </Frame>
  );
}
