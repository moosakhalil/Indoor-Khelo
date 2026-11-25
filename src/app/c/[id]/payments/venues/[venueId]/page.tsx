import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { PvVenueMenu } from "@/components/PvVenueEdit";
import { PvVenueBody, PvVenuePanel } from "@/components/PvVenueView";
import { getVenue, listBookings } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { mayManage } from "@/lib/ownerRule";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Venue" };
export const dynamic = "force-dynamic";

// Phase F3: a header card for the venue, the edit form, and a delete that is locked (with the reason and the bookings listed) while bookings use it.
export default async function VenuePage({ params, searchParams }: { params: Promise<{ id: string; venueId: string }>; searchParams: Promise<{ e?: string }> }) {
  const { id, venueId } = await params;
  const { e } = await searchParams;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const v = await getVenue(id, venueId);
  if (!v) notFound();
  const canDelete = mayManage({ id: user.id, admin: membership.role === "admin" }, v.created_by);   // delete: who added the venue, or an Admin
  const [bookings, tz] = await Promise.all([listBookings(id), getZone()]);
  const here = bookings.filter((b) => b.venue_id === venueId).map((b) => ({ id: b.id, whenText: formatWhen(b.starts_at, tz), status: b.status, contributed: b.contributed, total: b.total_cost }));
  return (
    <Frame communityId={id} title={v.name} subtitle={<small className="muted">Venue</small>} back={`/c/${id}/payments/venues`}
      right={<PvVenueMenu name={v.name} bookingCount={v.booking_count} canDelete={canDelete} />}
      panel={<PvVenuePanel communityId={id} bookings={here} />}>
      <PvVenueBody communityId={id} inUse={e === "in_use"} bookings={here} venue={v} canDelete={canDelete} />
    </Frame>
  );
}
