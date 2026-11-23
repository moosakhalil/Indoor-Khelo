import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { EditPaymentForm } from "@/components/Forms7";
import { getBooking, listPayments, listSharing } from "@/lib/bookings";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit payment record" };
export const dynamic = "force-dynamic";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string; bookingId: string; paymentId: string }> }) {
  const { id, bookingId, paymentId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const b = await getBooking(id, bookingId);
  if (!b) notFound();
  const [payments, sharing, members] = await Promise.all([listPayments(bookingId), listSharing(bookingId), listApprovedMembers(id)]);
  const p = payments.find((x) => x.id === paymentId);
  if (!p) notFound();
  const people = [
    ...sharing.filter((s) => s.guest).map((s) => ({ value: `g:${s.name}`, label: `${s.name} (guest)` })),
    ...members.map((m) => ({ value: `u:${m.user_id}`, label: m.name })),
  ];
  return (
    <Frame communityId={id} title="Edit payment record" back={`/c/${id}/payments/${bookingId}#payments`}>
      <EditPaymentForm communityId={id} bookingId={bookingId} paymentId={paymentId} people={people}
        current={{ payer: p.payer_user_id ? `u:${p.payer_user_id}` : `g:${p.payer_name}`, kind: p.kind, amount: p.amount, paidOn: p.paid_on, method: p.method, reference: p.reference }} />
    </Frame>
  );
}
