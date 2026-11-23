import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/BookingBits";
import Frame from "@/components/Frame";
import { myPayments } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { memberStatus, money } from "@/lib/payments";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "My payments" };
export const dynamic = "force-dynamic";

// What I have paid and my suggested share across the community's bookings. Only I can see this page, and only inside the community.
export default async function MyPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [{ rows, paid, stillSuggested }, tz] = await Promise.all([myPayments(id, user.id), getZone()]);
  return (
    <Frame communityId={id} title="My payments" back={`/c/${id}/profile`}>
      <div className="stack">
        <div className="statgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="statcell"><b>{money(paid)}</b><small className="muted">I have paid</small></div>
          <div className="statcell"><b>{money(stillSuggested)}</b><small className="muted">Still suggested</small></div>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Paying is a convenience, not a rule. “Still suggested” is only the equal-split suggestion for the bookings you are sharing: the group decides who pays what.</p>
        {rows.length === 0 ? (
          <div className="card center"><b>Nothing yet</b><p className="muted small" style={{ margin: "6px 0 0" }}>Bookings you share, or have paid for, will show here.</p></div>
        ) : (
          <section className="card list">
            {rows.map((r) => (
              <Link key={r.bookingId} href={`/c/${id}/payments/${r.bookingId}`} className="item" style={{ alignItems: "flex-start" }}>
                <span className="t grow">
                  <b>{r.venue}</b>
                  <small>{formatWhen(r.starts_at, tz)} · {r.status}</small>
                  <small>{r.owner === "member" ? `Suggested ${money(r.share)} · ` : ""}paid {money(Math.max(0, r.paid))}</small>
                </span>
                {r.owner === "member" ? <StatusPill status={memberStatus(r.share, r.paid, r.checked)} /> : <span className="pill green">PAID FOR OTHERS</span>}
              </Link>
            ))}
          </section>
        )}
      </div>
    </Frame>
  );
}
