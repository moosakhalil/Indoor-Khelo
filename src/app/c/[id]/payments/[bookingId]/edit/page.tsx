import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { BookingForm } from "@/components/Forms7";
import { getBooking, listVenues } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { toLocalInput } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Edit booking" };
export const dynamic = "force-dynamic";

export default async function EditBookingPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [b, venues, tz] = await Promise.all([getBooking(id, bookingId), listVenues(id), getZone()]);
  if (!b) notFound();
  return (
    <Frame communityId={id} title="Edit booking" back={`/c/${id}/payments/${bookingId}`}>
      <div className="stack">
        <BookingForm mode="edit" communityId={id} bookingId={bookingId} venues={venues.map((v) => ({ id: v.id, name: v.name }))}
          defaults={{ venueId: b.venue_id, when: toLocalInput(b.starts_at, tz), durationMinutes: b.duration_minutes, totalCost: b.total_cost, reference: b.reference, notes: b.notes }} />
        <p className="muted small" style={{ margin: 0 }}>If you change the cost, every suggested share is worked out again, the new amount is shown clearly, and the people sharing are told.</p>
      </div>
    </Frame>
  );
}
