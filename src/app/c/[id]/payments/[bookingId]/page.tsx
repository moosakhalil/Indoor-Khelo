import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatusChip, MoneyCard, StatusPill } from "@/components/BookingBits";
import Frame from "@/components/Frame";
import { PaymentForm, QueuedPayments } from "@/components/Forms7";
import Shirt from "@/components/Shirt";
import { bookingStatusAction, deleteBookingAction, deletePaymentAction, remindPaymentsAction, verifyPaymentAction } from "@/app/actions7";
import { getBooking, linkedMatches, listHistory, listPayments, listSharing, moneyView } from "@/lib/bookings";
import { describeHistory } from "@/lib/bookingText";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { BOOKING_STATUSES, METHODS, money, surplus } from "@/lib/payments";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Booking" };
export const dynamic = "force-dynamic";

type Q = { created?: string; saved?: string; status?: string; shared?: string; linked?: string; removed?: string; reminded?: string; e?: string; n?: string };
const E: Record<string, string> = {
  nobody: "Everyone's suggested share is covered, so there is nobody to remind.", bad_state: "That cannot be done in this booking's current state.", forbidden: "Only members of this community can do that.",
  not_found: "That could not be found.",
};

// Everything about one booking: the cost, who shares it, what has been contributed, and the history. Visible to members only.
export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string; bookingId: string }>; searchParams: Promise<Q> }) {
  const { id, bookingId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const b = await getBooking(id, bookingId);
  if (!b) notFound();
  const [sharing, payments, history, matches, members, tz] = await Promise.all([listSharing(bookingId), listPayments(bookingId), listHistory(bookingId), linkedMatches(bookingId), listApprovedMembers(id), getZone()]);
  const view = moneyView(b, sharing, payments);
  const sur = surplus(b.total_cost, sharing.length);
  const memberName = new Map(members.map((m) => [m.user_id, m.name]));
  // who can be picked in the payment form: everyone in the sharing list, then the other members
  const people = [
    ...sharing.map((s) => ({ value: s.user_id ? `u:${s.user_id}` : `g:${s.name}`, label: `${s.name}${s.guest ? " (guest)" : ""}` })),
    ...members.filter((m) => !sharing.some((s) => s.user_id === m.user_id)).map((m) => ({ value: `u:${m.user_id}`, label: m.name })),
  ];
  const notice = q.e === "too_soon" ? `A reminder was sent recently. You can send another in about ${q.n ?? "60"} minutes.` : q.e ? E[q.e] ?? null : null;
  const done = b.status === "cancelled";
  const method = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;
  const base = `/c/${id}/payments/${bookingId}`;

  return (
    <Frame communityId={id} title="Booking" back={`/c/${id}/payments`} right={<BookingStatusChip status={b.status} />}>
      <div className="stack">
        {q.created && <div className="banner green" role="status">Booking created. Next: choose who shares the cost.</div>}
        {q.saved && <div className="banner green" role="status">Saved.</div>}
        {q.status && <div className="banner green" role="status">Status changed.</div>}
        {q.shared && <div className="banner green" role="status">Saved. The people added were told their suggested share.</div>}
        {q.linked && <div className="banner green" role="status">Linked matches saved.</div>}
        {q.removed && <div className="banner green" role="status">Record removed.</div>}
        {q.reminded && <div className="banner green" role="status">Reminder sent to {q.reminded} {q.reminded === "1" ? "person" : "people"}.</div>}
        {notice && <div className="banner mute" role="status">{notice}</div>}
        {done && <div className="banner red">This booking is cancelled. Its payment records are kept, and refunds can still be recorded by hand.</div>}

        <section className="card">
          <b style={{ fontSize: "1.1rem" }}>{b.venue_name}</b>
          <small className="muted" style={{ display: "block" }}>{b.venue_address || "No address"}{b.venue_contact ? ` · ${b.venue_contact}` : ""}</small>
          <div className="list" style={{ marginTop: 8 }}>
            <div className="item space"><span className="muted">When</span><b>{formatWhen(b.starts_at, tz)}</b></div>
            <div className="item space"><span className="muted">Duration</span><b>{b.duration_minutes} minutes</b></div>
            {b.reference && <div className="item space"><span className="muted">Reference</span><b>{b.reference}</b></div>}
            {b.notes && <div className="item" style={{ display: "block" }}><span className="muted">Notes</span><p style={{ margin: "4px 0 0" }}>{b.notes}</p></div>}
          </div>
          <p className="muted small" style={{ margin: "8px 0 0" }}>Added by <b style={{ color: "var(--white)" }}>{b.created_by_name ?? "—"}</b> · Changed by <b style={{ color: "var(--white)" }}>{b.changed_by_name ?? "—"}</b> ({formatWhen(b.updated_at, tz)})</p>
          <div className="two" style={{ marginTop: 10 }}>
            <Link href={`${base}/edit`} className="btn ghost small" style={{ width: "100%" }}>Edit booking</Link>
            <Link href={`${base}/link`} className="btn ghost small" style={{ width: "100%" }}>Link matches</Link>
          </div>
          {matches.length > 0 && <div className="row wrap" style={{ marginTop: 8 }}>{matches.map((m) => <Link key={m.id} href={`/c/${id}/matches/${m.id}`} className="chip">{m.name}</Link>)}</div>}
        </section>

        <MoneyCard s={view.summary} share={view.share} people={sharing.length} surplusAmount={sur} />

        <section className="card" id="sharing">
          <div className="row space"><h2 style={{ fontSize: "1rem" }}>Who shares the cost <small className="muted">({sharing.length})</small></h2><Link href={`${base}/share`} className="chip gold">Choose people</Link></div>
          {view.people.length === 0 ? <p className="muted small" style={{ margin: "8px 0 0" }}>Nobody chosen yet.</p> : (
            <div className="list" style={{ marginTop: 6 }}>
              {view.people.map((p) => (
                <div key={p.id} className="item" style={{ alignItems: "flex-start" }}>
                  <Shirt number={p.player_number} size="small" label={p.guest ? "Guest, no player number" : undefined} />
                  <span className="t grow"><b>{p.name}{p.guest ? " (guest)" : ""}</b><small>Suggested {money(p.share)} · paid {money(Math.max(0, p.net))}{p.stillSuggested > 0 && p.net < p.share ? ` · ${money(p.stillSuggested)} to suggested` : ""}</small></span>
                  <StatusPill status={p.status} />
                </div>
              ))}
            </div>
          )}
          {view.summary.contributed > 0 && <p className="muted small" style={{ margin: "8px 0 0" }}>Someone who has paid more than their share is simply shown as paid. “Pending check” means the money was recorded and nobody has marked it checked yet.</p>}
        </section>

        <QueuedPayments bookingId={bookingId} />

        <section className="card" id="record">
          <h2 style={{ fontSize: "1rem", marginBottom: 8 }}>Record a payment or refund</h2>
          <PaymentForm communityId={id} bookingId={bookingId} people={people} share={view.share} />
        </section>

        <section className="card" id="payments">
          <h2 style={{ fontSize: "1rem" }}>Payment records <small className="muted">({payments.length})</small></h2>
          {payments.length === 0 ? <p className="muted small" style={{ margin: "6px 0 0" }}>Nothing recorded yet.</p> : (
            <div className="list" style={{ marginTop: 6 }}>
              {payments.map((p) => (
                <div key={p.id} className="item" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
                  <div className="row space" style={{ width: "100%" }}>
                    <span><b>{p.payer_user_id ? <Link href={`/c/${id}/players/${p.payer_user_id}`}>{memberName.get(p.payer_user_id) ?? p.payer_name}</Link> : p.payer_name}</b> <small className="muted">{p.kind === "refund" ? "refund" : "paid"} · {method(p.method)}</small></span>
                    <b style={{ color: p.kind === "refund" ? "#ff9a9e" : "#4be38a" }}>{p.kind === "refund" ? "−" : "+"}{money(p.amount)}</b>
                  </div>
                  <small className="muted">{p.paid_on}{p.reference ? ` · ${p.reference}` : ""} · recorded by {p.created_by_name ?? "—"}{p.changed_by_name && p.changed_by_name !== p.created_by_name ? `, changed by ${p.changed_by_name}` : ""}</small>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className={`pill ${p.verified_at ? "green" : "orange"}`}>{p.verified_at ? `CHECKED BY ${(p.verified_by_name ?? "A MEMBER").toUpperCase()}` : "NOT CHECKED YET"}</span>
                    <form action={verifyPaymentAction}>
                      <input type="hidden" name="communityId" value={id} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="on" value={p.verified_at ? "0" : "1"} />
                      <button className="chip" style={{ minHeight: 30 }}>{p.verified_at ? "Mark not checked" : "Mark checked"}</button>
                    </form>
                    <Link href={`${base}/pay/${p.id}`} className="chip" style={{ minHeight: 30 }}>Edit</Link>
                    <details>
                      <summary className="chip" style={{ minHeight: 30, listStyle: "none", cursor: "pointer" }}>Remove</summary>
                      <form action={deletePaymentAction} style={{ marginTop: 6 }}>
                        <input type="hidden" name="communityId" value={id} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="paymentId" value={p.id} />
                        <button className="btn red small">Yes, remove this record</button>
                      </form>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!done && (
          <section className="card">
            <h2 style={{ fontSize: "1rem" }}>Reminders</h2>
            <p className="muted small" style={{ margin: "4px 0 8px" }}>Sends an alert to the people whose suggested share is not covered yet. It does not make anyone pay: it only reminds. At most once an hour.</p>
            <form action={remindPaymentsAction}>
              <input type="hidden" name="communityId" value={id} /><input type="hidden" name="bookingId" value={bookingId} />
              <button className="btn ghost small">Remind everyone who has not paid</button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>Booking status</h2>
          <div className="row wrap" style={{ marginTop: 8 }}>
            {BOOKING_STATUSES.filter((s) => s !== b.status).map((s) => (
              <form key={s} action={bookingStatusAction}>
                <input type="hidden" name="communityId" value={id} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="status" value={s} />
                <button className={`chip${s === "cancelled" ? " red" : ""}`}>Mark {s}</button>
              </form>
            ))}
          </div>
          {payments.length === 0 && (
            <details style={{ marginTop: 10 }}>
              <summary className="btn red small" style={{ listStyle: "none", cursor: "pointer" }}>Delete booking…</summary>
              <form action={deleteBookingAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="communityId" value={id} /><input type="hidden" name="bookingId" value={bookingId} />
                <p className="muted small" style={{ margin: "0 0 8px" }}>Only a booking with no payment records can be deleted. Otherwise cancel it, and the records are kept.</p>
                <button className="btn red small">Yes, delete this booking</button>
              </form>
            </details>
          )}
        </section>

        <section className="card" id="history">
          <h2 style={{ fontSize: "1rem" }}>History</h2>
          <ul className="muted small" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
            {history.map((h) => <li key={h.id}>{describeHistory(h)} <span style={{ opacity: 0.7 }}>({formatWhen(h.created_at, tz)})</span></li>)}
          </ul>
        </section>
        <p className="muted small" style={{ margin: 0 }}>Bookings and payments are kept apart from match results. They never change a score or a statistic.</p>
      </div>
    </Frame>
  );
}
