import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecordSummary } from "@/components/BookingBits";
import Frame from "@/components/Frame";
import { EditPaymentForm, type PayHint } from "@/components/Forms7";
import { getBooking, listPayments, listSharing, moneyView } from "@/lib/bookings";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { mayManage } from "@/lib/ownerRule";
import { METHODS, money, netFor } from "@/lib/payments";
import { payerKey } from "@/lib/pbBooking";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit payment record" };
export const dynamic = "force-dynamic";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string; bookingId: string; paymentId: string }> }) {
  const { id, bookingId, paymentId } = await params;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const b = await getBooking(id, bookingId);
  if (!b) notFound();
  const [payments, sharing, members] = await Promise.all([listPayments(bookingId), listSharing(bookingId), listApprovedMembers(id)]);
  const p = payments.find((x) => x.id === paymentId);
  if (!p) notFound();
  // Only the person who recorded the payment, or an Admin, can change it (lib/ownerRule.ts).
  if (!mayManage({ id: user.id, admin: membership.role === "admin" }, p.created_by)) redirect(`/c/${id}/payments/${bookingId}?e=not_owner#payments`);
  const numberOf = new Map(members.map((m) => [m.user_id, m.player_number] as const));
  const people = [
    ...sharing.filter((s) => s.guest).map((s) => ({ value: `g:${s.name}`, label: `${s.name} (guest)`, number: null as number | null })),
    ...members.map((m) => ({ value: `u:${m.user_id}`, label: m.name, number: m.player_number as number | null })),
  ];
  // suggestions work out the money WITHOUT this record, because that is what the server checks a refund against
  const others = moneyView(b, sharing, payments.filter((x) => x.id !== paymentId));
  const suggest: Record<string, PayHint> = {};
  for (const o of [...people, { value: p.payer_user_id ? `u:${p.payer_user_id}` : `g:${p.payer_name}` }]) {
    const k = payerKey(o.value);
    suggest[o.value] = { still: others.people.find((v) => v.key === k)?.stillSuggested ?? 0, paidIn: Math.max(0, netFor(others.list, k)) };
  }
  const memberName = new Map(members.map((m) => [m.user_id, m.name]));
  const name = p.payer_user_id ? memberName.get(p.payer_user_id) ?? p.payer_name : p.payer_name;
  const checkedBy = p.verified_at ? p.verified_by_name ?? "A member" : null;
  const summary = (
    <RecordSummary name={name} number={p.payer_user_id ? numberOf.get(p.payer_user_id) ?? null : null} guest={!p.payer_user_id} kind={p.kind} amount={p.amount}
      methodLabel={METHODS.find((m) => m.value === p.method)?.label ?? p.method} paidOn={p.paid_on} checkedBy={checkedBy} recordedBy={p.created_by_name ?? "—"} changedBy={p.changed_by_name} />
  );
  return (
    <Frame communityId={id} title="Edit payment" subtitle={<small className="muted pb-sub1">{name} · {p.kind === "refund" ? "refund" : "payment"} {money(p.amount)}</small>} back={`/c/${id}/payments/${bookingId}#payments`} panel={summary}>
      <div className="stack pb-page">
        <div className="pb-hide-wide">{summary}</div>
          <EditPaymentForm communityId={id} bookingId={bookingId} paymentId={paymentId} people={people} suggest={suggest} share={others.share} checkedBy={checkedBy} payerLabel={name}
            current={{ payer: p.payer_user_id ? `u:${p.payer_user_id}` : `g:${p.payer_name}`, kind: p.kind, amount: p.amount, paidOn: p.paid_on, method: p.method, reference: p.reference }} />
      </div>
    </Frame>
  );
}
