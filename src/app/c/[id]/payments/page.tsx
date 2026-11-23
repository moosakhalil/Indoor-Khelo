import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  return (
    <Frame communityId={id} title="Payments">
      <div className="card center muted">Venue bookings and the cost split arrive in a later build phase.</div>
    </Frame>
  );
}
