import type { Metadata } from "next";
import Link from "next/link";
import { IconPin } from "@/components/CrIcons";
import Frame from "@/components/Frame";
import PvHome from "@/components/PvHome";
import { listVenues } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { listBookingsWithMoney } from "@/lib/pvData";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

// Phase F3: bookings as cards that lead with the money (ring, "PKR 8,500 of PKR 12,000", who still owes), filter tabs, one gold "New booking",
// and a preview of the selected booking beside the list on wide screens. Any approved member sees and can use everything here.
export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const { id } = await params;
  const { deleted } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const tz = await getZone();
  const [{ upcoming, past }, venues] = await Promise.all([listBookingsWithMoney(id, tz), listVenues(id)]);
  return (
    <Frame communityId={id} title="Payments" right={<Link href={`/c/${id}/payments/venues`} className="btn ghost small" style={{ gap: 6 }}><IconPin size={16} /> Venues</Link>}>
      <PvHome communityId={id} upcoming={upcoming} past={past} venueCount={venues.length} deleted={!!deleted} />
    </Frame>
  );
}
