import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import MyPaymentsView, { type MyRow } from "@/components/MyPaymentsView";
import PbIcon from "@/components/PbIcons";
import { myPayments } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { money } from "@/lib/payments";
import { needsCover } from "@/lib/pbBooking";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";
import "@/components/pb.css";

export const metadata: Metadata = { title: "My payments" };
export const dynamic = "force-dynamic";

// What I have paid and my suggested share across the community's bookings. Only I can see this page, and only inside the community.
export default async function MyPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [{ rows, paid, stillSuggested }, tz] = await Promise.all([myPayments(id, user.id), getZone()]);
  const list: MyRow[] = rows.map((r) => ({ bookingId: r.bookingId, venue: r.venue, when: formatWhen(r.starts_at, tz), status: r.status, owner: r.owner, share: r.share, paid: r.paid, checked: r.checked }));
  const cover = list.filter(needsCover);
  const first = cover[0];
  // the "Needs you" panel on a wide screen
  const panel = (
    <section className="card pb-panel-card" aria-label="Needs you">
      <h2>Needs you</h2>
      {cover.length === 0 ? (
        <p className="pb-settled"><PbIcon name="check" size={18} />Nothing left to cover.</p>
      ) : (
        <>
          <p className="muted small">{cover.length} {cover.length === 1 ? "booking is" : "bookings are"} still to cover. Paying is up to you and the group.</p>
          <div className="pb-rows">
            {cover.map((r) => (
              <Link key={r.bookingId} href={`/c/${id}/payments/${r.bookingId}`} className="pb-need">
                <span className="grow"><b>{r.venue}</b><small className="muted">{r.when}</small></span>
                <b className="pb-n">{money(Math.max(0, r.share - Math.max(0, r.paid)))}</b>
              </Link>
            ))}
          </div>
          {first && <Link href={`/c/${id}/payments/${first.bookingId}?record=me`} className="btn gold small" style={{ marginTop: 10, width: "100%" }}><PbIcon name="wallet" size={16} />Open the first</Link>}
        </>
      )}
    </section>
  );
  return (
    <Frame communityId={id} title="My payments" subtitle={<small className="muted pb-sub1">Only you can see this</small>} back={`/c/${id}/profile`} panel={panel}>
      <div className="stack pb-page">
        <section className="card pb-two-big">
          <div className="pb-statbig"><b className="pb-big3">{money(paid)}</b><small className="muted">I have paid</small></div>
          <div className="pb-statbig"><b className={`pb-big3${stillSuggested > 0 ? " gold" : ""}`}>{money(stillSuggested)}</b><small className="muted">{stillSuggested > 0 ? "Still suggested" : "Nothing left to cover"}</small></div>
          <p className="muted small pb-two-note">Paying is a convenience, not a rule. “Still suggested” is only the equal-split suggestion for the bookings you are sharing: the group decides who pays what. Cancelled bookings are not counted.</p>
        </section>
        {list.length === 0 ? (
          <div className="card pb-empty">
            <PbIcon name="wallet" size={28} />
            <p><b>Nothing yet</b></p>
            <p className="muted small" style={{ margin: 0 }}>Bookings you share, or have paid for, will show here.</p>
            <Link href={`/c/${id}/payments`} className="btn gold small">See all bookings</Link>
          </div>
        ) : <MyPaymentsView communityId={id} rows={list} />}
      </div>
    </Frame>
  );
}
