import type { Metadata } from "next";
import Link from "next/link";
import { IconPin } from "@/components/CrIcons";
import Frame from "@/components/Frame";
import PvBookingForm from "@/components/PvBookingForm";
import { StepBar } from "@/components/PvParts";
import { listVenues } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "New booking" };
export const dynamic = "force-dynamic";

// Phase F3: step 1 of 3 (Details). Who shares and Payments come after saving. Same action and validation as before.
export default async function NewBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const venues = await listVenues(id);
  const subtitle = <small className="muted">Step 1 of 3 · Details</small>;
  return (
    <Frame communityId={id} title="New booking" subtitle={subtitle} back={`/c/${id}/payments`}>
      {venues.length === 0 ? (
        <div className="pv-formroot">
          <StepBar now={1} />
          <div className="pv-start">
            <span className="pv-start-ic"><IconPin size={26} /></span>
            <h2>Add a venue first</h2>
            <p className="muted">A booking needs a place. Add the venue you play at once, then come back to create the booking.</p>
            <Link href={`/c/${id}/payments/venues`} className="btn gold pv-start-btn">+ Add a venue</Link>
          </div>
        </div>
      ) : (
        <PvBookingForm mode="create" communityId={id} venues={venues.map((v) => ({ id: v.id, name: v.name, address: v.address }))} cancelHref={`/c/${id}/payments`} />
      )}
    </Frame>
  );
}
