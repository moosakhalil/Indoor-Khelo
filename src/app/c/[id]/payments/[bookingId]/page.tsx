import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ActionMenu from "@/components/ActionMenu";
import { BookingBadge, MoneyHero, Notice, StatusBadge } from "@/components/BookingBits";
import { DeleteBooking, FlashToast, PaymentRecordRow, RecordSheet, RecordTrigger, RemindControl, StatusControl, type FormProps, type RecordRowData } from "@/components/BookingActions";
import Frame from "@/components/Frame";
import { QueuedPayments, type PayHint } from "@/components/Forms7";
import PbIcon from "@/components/PbIcons";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { getBooking, linkedMatches, listHistory, listPayments, listSharing, moneyView } from "@/lib/bookings";
import { describeHistory } from "@/lib/bookingText";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { mayManage } from "@/lib/ownerRule";
import { METHODS, money, netFor, surplus } from "@/lib/payments";
import { payerKey, personLine, refundHolders, remindPlan, reminderWait, splitTeams } from "@/lib/pbBooking";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Booking" };
export const dynamic = "force-dynamic";

type Q = { created?: string; saved?: string; status?: string; shared?: string; linked?: string; removed?: string; reminded?: string; record?: string; e?: string; n?: string };
// Refusals (red) and plain notices (not red). Same wording as before.
const REFUSALS: Record<string, string> = {
  bad_state: "That cannot be done in this booking's current state.", forbidden: "Only members of this community can do that.", not_found: "That could not be found.",
  not_owner: "Only the person who added this, or an Admin, can do that.",
};
const NOTICES: Record<string, string> = { nobody: "Everyone's suggested share is covered, so there is nobody to remind." };

// Everything about one booking: the cost, who shares it, what has been contributed, and the history. Visible to members only.
export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string; bookingId: string }>; searchParams: Promise<Q> }) {
  const { id, bookingId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const me2 = { id: user.id, admin: membership.role === "admin" };   // delete the booking / change a payment: who added it, or an Admin (lib/ownerRule.ts)
  const b = await getBooking(id, bookingId);
  if (!b) notFound();
  const [sharing, payments, history, matches, members, tz] = await Promise.all([listSharing(bookingId), listPayments(bookingId), listHistory(bookingId), linkedMatches(bookingId), listApprovedMembers(id), getZone()]);
  const view = moneyView(b, sharing, payments);
  const sur = surplus(b.total_cost, sharing.length);
  const memberName = new Map(members.map((m) => [m.user_id, m.name]));
  const numberOf = new Map<string, number | null>([...members.map((m) => [m.user_id, m.player_number] as const), ...sharing.filter((s) => s.user_id).map((s) => [s.user_id!, s.player_number] as const)]);
  // who can be picked in the payment form: everyone in the sharing list, then the other members
  const people = [
    ...sharing.map((s) => ({ value: s.user_id ? `u:${s.user_id}` : `g:${s.name}`, label: `${s.name}${s.guest ? " (guest)" : ""}`, number: s.guest ? null : s.player_number })),
    ...members.filter((m) => !sharing.some((s) => s.user_id === m.user_id)).map((m) => ({ value: `u:${m.user_id}`, label: m.name, number: m.player_number })),
  ];
  // what the form may suggest for each person: what is still to the suggested share, and what they have paid in (the most a refund can be)
  const suggest: Record<string, PayHint> = {};
  for (const p of people) {
    const k = payerKey(p.value);
    suggest[p.value] = { still: view.people.find((v) => v.key === k)?.stillSuggested ?? 0, paidIn: Math.max(0, netFor(view.list, k)) };
  }
  const done = b.status === "cancelled";
  const method = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;
  const base = `/c/${id}/payments/${bookingId}`;
  const when = formatWhen(b.starts_at, tz);
  const form: FormProps = { communityId: id, bookingId, people, share: view.share, suggest, remaining: view.summary.balance };
  const me = view.people.find((p) => p.user_id === user.id) ?? null;
  const plan = remindPlan(view.people, user.id, view.share);
  const wait = reminderWait(b.last_reminder_at, Date.now());
  const remind = {
    communityId: id, bookingId, venue: b.venue_name, share: view.share, balance: view.summary.balance, due: plan.due.map((p) => ({ name: p.name, net: p.net })), guests: plan.guests, selfDue: plan.selfDue, waitMinutes: wait, noPeople: sharing.length === 0,
  };
  const holders = done ? refundHolders(payments, (uid) => memberName.get(uid)) : [];
  const heldTotal = holders.reduce((a, h) => a + h.held, 0);
  const refusal = q.e ? REFUSALS[q.e] ?? null : null;
  const info = q.e === "too_soon" ? `A reminder was sent recently. You can send another in about ${q.n ?? wait ?? 60} minutes.` : q.e ? NOTICES[q.e] ?? null : null;
  const flash = q.saved ? "Saved." : q.status ? "Status changed." : q.shared ? "Saved. The people added were told their suggested share." : q.linked ? "Linked matches saved." : q.removed ? "Record removed."
    : q.reminded ? `Reminder sent to ${q.reminded} ${q.reminded === "1" ? "person" : "people"}.` : null;

  const rows: RecordRowData[] = payments.map((p) => ({
    id: p.id, payerName: p.payer_user_id ? memberName.get(p.payer_user_id) ?? p.payer_name : p.payer_name, payerHref: p.payer_user_id ? `/c/${id}/players/${p.payer_user_id}` : null,
    number: p.payer_user_id ? numberOf.get(p.payer_user_id) ?? null : null, guest: !p.payer_user_id, kind: p.kind, amount: p.amount, methodLabel: method(p.method), paidOn: p.paid_on, reference: p.reference,
    recordedBy: p.created_by_name ?? "—", changedBy: p.changed_by_name, checkedBy: p.verified_at ? p.verified_by_name ?? "a member" : null,
    canChange: mayManage(me2, p.created_by),
  }));

  const actions = !done ? (
    <div className="pb-hero-actions">
      <RecordTrigger className="btn gold" detail={{}}><PbIcon name="plus" size={18} />Record payment</RecordTrigger>
      <RemindControl {...remind} />
    </div>
  ) : null;

  return (
    <Frame
      communityId={id} title={b.venue_name} back={`/c/${id}/payments`}
      subtitle={<small className="muted pb-sub1">{when} · {b.duration_minutes} min</small>}
      right={<ActionMenu label="Booking actions" items={[
        { label: "Edit booking", href: `${base}/edit` }, { label: "Who shares the cost", href: `${base}/share` }, { label: "Link matches", href: `${base}/link` },
      ]} />}
      panel={<div className="stack"><RecordSheet mode="panel" form={form} />
        {!done && <section className="card pb-panel-card"><h2>Reminders</h2><p className="muted small">An in-app alert to the people whose suggested share is not covered yet. It does not make anyone pay. At most once an hour.</p><RemindControl {...remind} /></section>}
      </div>}>
      <div className="stack pb-page">
        {q.created && <Notice tone="green" action={<Link href={`${base}/share`} className="btn gold small">Choose people</Link>}>Booking created. Next: choose who shares the cost.</Notice>}
        {q.saved && <Notice tone="green">Saved.</Notice>}
        {q.status && <Notice tone="green">Status changed.</Notice>}
        {q.shared && <Notice tone="green">Saved. The people added were told their suggested share.</Notice>}
        {q.linked && <Notice tone="green">Linked matches saved.</Notice>}
        {q.removed && <Notice tone="green">Record removed.</Notice>}
        {q.reminded && <Notice tone="green">Reminder sent to {q.reminded} {q.reminded === "1" ? "person" : "people"}. Another can go out in {wait || 60} minutes.</Notice>}
        {info && <Notice tone={q.e === "too_soon" ? "gold" : "mute"}>{info}</Notice>}
        {refusal && <Notice tone="red" role="alert">{refusal}</Notice>}
        {done && <Notice tone="red" role="status">This booking is cancelled. Its payment records are kept, and refunds can still be recorded by hand.</Notice>}
        {flash && <FlashToast message={flash} />}

        <nav className="pb-jump" aria-label="Jump to a section">
          <a href="#people" className="pb-jchip">People <b>{sharing.length}</b></a>
          <a href="#payments" className="pb-jchip">Payments <b>{payments.length}</b></a>
          <a href="#details" className="pb-jchip">Details</a>
          <a href="#history" className="pb-jchip">History</a>
        </nav>

        <QueuedPayments bookingId={bookingId} people={people} />

        <MoneyHero s={view.summary} status={b.status} share={view.share} people={sharing.length} surplusAmount={sur} actions={actions} />

        {me && !done && (
          <section className="card pb-yours" aria-label="Your share">
            <div className="row space"><b>Your share</b><StatusBadge status={me.status} /></div>
            <div className="pb-yours-n"><span className="pb-big2">{money(view.share)}</span><small className="muted">suggested for you</small><small className="muted">{personLine(me)}</small></div>
            <RecordTrigger className="btn gold" detail={{ payer: `u:${user.id}`, amount: me.stillSuggested }}><PbIcon name="wallet" size={18} />Record my payment</RecordTrigger>
          </section>
        )}

        {done && (
          <section className="card" id="refunds">
            <h2 className="pb-h2">Refunds to give back</h2>
            {holders.length === 0 ? (
              <p className="muted small" style={{ margin: "6px 0 0" }}>Nothing to give back. Everyone who paid has been refunded.</p>
            ) : (
              <>
                <p className="muted small" style={{ margin: "4px 0 0" }}>{holders.length} {holders.length === 1 ? "person still holds" : "people still hold"} {money(heldTotal)}. Hand it back yourself, then write it down here.</p>
                <div className="pb-rows">
                  {holders.map((h) => (
                    <div key={h.value} className="pb-person">
                      <Shirt number={h.userId ? numberOf.get(h.userId) ?? null : null} size="normal" label={h.userId ? undefined : "Guest, no player number"} />
                      <span className="t grow"><b>{h.name}{!h.userId ? " (guest)" : ""}</b><small>Paid in {money(h.held)}</small></span>
                      <RecordTrigger className="btn ghost small" detail={{ kind: "refund", payer: h.value, amount: h.held }} label={`Record a refund to ${h.name}`}><PbIcon name="refund" size={16} />Record refund</RecordTrigger>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <section className="card" id="people">
          <div className="row space"><h2 className="pb-h2">Who shares the cost <small className="muted">({sharing.length})</small></h2><Link href={`${base}/share`} className="chip gold pb-chip44"><PbIcon name="users" size={16} />Choose people</Link></div>
          {view.people.length === 0 ? (
            <div className="pb-empty">
              <PbIcon name="users" size={26} />
              <p><b>Nobody chosen yet.</b> Choose who shares the cost to see a suggested share and who has paid.</p>
              <Link href={`${base}/share`} className="btn gold small">Choose people</Link>
            </div>
          ) : (
            <div className="pb-rows">
              {view.people.map((p) => (
                <div key={p.id} className="pb-person">
                  <Shirt number={p.player_number} size="normal" label={p.guest ? "Guest, no player number" : undefined} />
                  <span className="t grow">
                    <b>{p.name}{p.guest ? " (guest)" : ""}{p.user_id === user.id && <span className="pb-you">You</span>}</b>
                    <small className="muted">{personLine(p)}</small>
                    <StatusBadge status={p.status} />
                  </span>
                  {!done && (
                    <RecordTrigger className="pb-plus" label={`Record a payment for ${p.name}`} detail={{ payer: p.user_id ? `u:${p.user_id}` : `g:${p.name}`, amount: p.stillSuggested }}><PbIcon name="plus" size={20} /></RecordTrigger>
                  )}
                </div>
              ))}
            </div>
          )}
          {view.summary.contributed > 0 && <p className="muted small" style={{ margin: "10px 0 0" }}>Someone who has paid more than their share is simply shown as paid. “Pending check” means the money was recorded and nobody has marked it checked yet.</p>}
        </section>

        <section className="card" id="payments">
          <div className="row space">
            <h2 className="pb-h2">Payment records <small className="muted">({payments.length})</small></h2>
            <RecordTrigger className="chip gold pb-chip44" detail={{}}><PbIcon name="plus" size={16} />Record</RecordTrigger>
          </div>
          {payments.length === 0 ? (
            <div className="pb-empty">
              <PbIcon name="wallet" size={26} />
              <p><b>Nothing recorded yet.</b> Recording works with no signal too: it is saved on the phone and sent later.</p>
            </div>
          ) : (
            <div className="pb-rows">
              {rows.map((r) => <PaymentRecordRow key={r.id} communityId={id} bookingId={bookingId} base={base} r={r} />)}
            </div>
          )}
        </section>

        <section className="card" id="details">
          <div className="row space"><h2 className="pb-h2">Details</h2><Link href={`${base}/edit`} className="chip pb-chip44"><PbIcon name="edit" size={16} />Edit</Link></div>
          <div className="pb-kv">
            <div><span className="muted">Venue</span><b>{b.venue_name}</b></div>
            <div><span className="muted">Address</span><b>{b.venue_address || "No address"}{b.venue_contact ? <small className="muted"> · {b.venue_contact}</small> : null}</b></div>
            <div><span className="muted">When</span><b>{when}</b></div>
            <div><span className="muted">Duration</span><b>{b.duration_minutes} minutes</b></div>
            {b.reference && <div><span className="muted">Reference</span><b>{b.reference}</b></div>}
            {b.notes && <div><span className="muted">Notes</span><b className="pb-notes">{b.notes}</b></div>}
          </div>
          <p className="muted small" style={{ margin: "10px 0 0" }}>Added by <b style={{ color: "var(--white)" }}>{b.created_by_name ?? "—"}</b> · Changed by <b style={{ color: "var(--white)" }}>{b.changed_by_name ?? "—"}</b> ({formatWhen(b.updated_at, tz)})</p>
        </section>

        <section className="card" id="matches">
          <div className="row space"><h2 className="pb-h2">Linked matches <small className="muted">({matches.length})</small></h2><Link href={`${base}/link`} className="chip pb-chip44"><PbIcon name="link" size={16} />Link matches</Link></div>
          {matches.length === 0 ? <p className="muted small" style={{ margin: "8px 0 0" }}>No matches linked yet. Linking never changes a score or a statistic.</p> : (
            <div className="pb-rows">
              {matches.map((m) => {
                const t = splitTeams(m.name);
                return (
                  <Link key={m.id} href={`/c/${id}/matches/${m.id}`} className="pb-match">
                    {t ? <span className="pb-pair"><TeamBadge name={t[0]} size="sm" /><TeamBadge name={t[1]} size="sm" /></span> : null}
                    <span className="grow pb-mname">{m.name}</span>
                    <PbIcon name="chevron" size={18} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="card" id="status">
          <h2 className="pb-h2">Booking status</h2>
          <div style={{ margin: "10px 0 6px" }}><BookingBadge status={b.status} /></div>
          <StatusControl communityId={id} bookingId={bookingId} status={b.status} />
          <div className="pb-delete">
            {payments.length === 0 ? (
              <>
                <p className="muted small" style={{ margin: "0 0 8px" }}>Only a booking with no payment records can be deleted. Otherwise cancel it, and the records are kept.</p>
                <DeleteBooking communityId={id} bookingId={bookingId} venue={b.venue_name} when={when} canDelete={mayManage(me2, b.created_by)} addedBy={b.created_by_name} />
              </>
            ) : (
              <p className="pb-lock"><PbIcon name="lock" size={16} />A booking with payment records cannot be deleted. Cancel it instead; the records are kept.</p>
            )}
          </div>
        </section>

        <section className="card" id="history">
          <h2 className="pb-h2">History</h2>
          <ol className="pb-hist">
            {history.map((h) => <li key={h.id}><span>{describeHistory(h)}</span><time>{formatWhen(h.created_at, tz)}</time></li>)}
          </ol>
        </section>
        <p className="muted small" style={{ margin: 0 }}>Bookings and payments are kept apart from match results. They never change a score or a statistic.</p>
      </div>
      <RecordSheet mode="sheet" form={form} autoOpen={q.record === "me" && !done ? { payer: `u:${user.id}`, amount: me?.stillSuggested } : null} />
    </Frame>
  );
}
