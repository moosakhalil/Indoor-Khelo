import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import PvBookingForm from "@/components/PvBookingForm";
import { getBooking, listSharing, listVenues } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { toLocalInput } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Edit booking" };
export const dynamic = "force-dynamic";

// Phase F3: the same fields as New booking, prefilled, plus a "What this changes" panel and a confirm before a cost change that affects the people sharing.
export default async function EditBookingPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [b, venues, tz] = await Promise.all([getBooking(id, bookingId), listVenues(id), getZone()]);
  if (!b) notFound();
  const sharing = await listSharing(bookingId);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(b.starts_at);
  return (
    <Frame communityId={id} title="Edit booking" subtitle={<small className="muted">{b.venue_name} · {day}</small>} back={`/c/${id}/payments/${bookingId}`}>
      <PvBookingForm mode="edit" communityId={id} bookingId={bookingId} cancelHref={`/c/${id}/payments/${bookingId}`} people={sharing.length}
        venues={venues.map((v) => ({ id: v.id, name: v.name, address: v.address }))}
        defaults={{ venueId: b.venue_id, when: toLocalInput(b.starts_at, tz), durationMinutes: b.duration_minutes, totalCost: b.total_cost, reference: b.reference, notes: b.notes }} />
    </Frame>
  );
}
