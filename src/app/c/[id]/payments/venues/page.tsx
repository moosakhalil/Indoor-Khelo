import type { Metadata } from "next";
import Frame from "@/components/Frame";
import PvVenues, { PvAddVenueButton } from "@/components/PvVenues";
import { listVenues } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { mayManage } from "@/lib/ownerRule";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Venues" };
export const dynamic = "force-dynamic";

// Phase F3: venues with an initials mark and a booking count, search, edit and delete on every row, and the Add form (sheet on phones, card on wide screens).
export default async function VenuesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { id } = await params;
  const { added } = await searchParams;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const admin = membership.role === "admin";
  const venues = await listVenues(id);
  return (
    <Frame communityId={id} title="Venues" back={`/c/${id}/payments`} right={<PvAddVenueButton />}>
      <PvVenues communityId={id} added={!!added} venues={venues.map((v) => ({ id: v.id, name: v.name, address: v.address, contact: v.contact, booking_count: v.booking_count, can_delete: mayManage({ id: user.id, admin }, v.created_by) }))} />
    </Frame>
  );
}
