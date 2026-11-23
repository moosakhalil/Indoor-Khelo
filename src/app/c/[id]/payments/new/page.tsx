import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { BookingForm } from "@/components/Forms7";
import { listVenues } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "New booking" };
export const dynamic = "force-dynamic";

export default async function NewBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const venues = await listVenues(id);
  return (
    <Frame communityId={id} title="New booking" back={`/c/${id}/payments`}>
      {venues.length === 0 ? (
        <div className="stack">
          <div className="banner mute">Add a venue first, then come back to create the booking.</div>
          <Link href={`/c/${id}/payments/venues`} className="btn gold">Add a venue</Link>
        </div>
      ) : (
        <BookingForm mode="create" communityId={id} venues={venues.map((v) => ({ id: v.id, name: v.name }))} />
      )}
    </Frame>
  );
}
