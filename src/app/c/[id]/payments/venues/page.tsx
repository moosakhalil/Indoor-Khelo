import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { VenueForm } from "@/components/Forms7";
import { listVenues } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Venues" };
export const dynamic = "force-dynamic";

export default async function VenuesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { id } = await params;
  const { added } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const venues = await listVenues(id);
  return (
    <Frame communityId={id} title="Venues" back={`/c/${id}/payments`}>
      <div className="stack">
        {added && <div className="banner green" role="status">Venue added.</div>}
        {venues.length === 0 ? (
          <div className="card center"><b>No venues yet</b><p className="muted small" style={{ margin: "6px 0 0" }}>Add the places your community plays at. Any member can.</p></div>
        ) : (
          <section className="card list">
            {venues.map((v) => (
              <Link key={v.id} href={`/c/${id}/payments/venues/${v.id}`} className="item">
                <span className="t grow"><b>{v.name}</b><small>{v.address || "No address"}{v.contact ? ` · ${v.contact}` : ""} · {v.booking_count} booking{v.booking_count === 1 ? "" : "s"}</small></span>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </section>
        )}
        <section className="card">
          <h2 style={{ fontSize: "1rem", marginBottom: 6 }}>Add a venue</h2>
          <VenueForm mode="create" communityId={id} />
        </section>
      </div>
    </Frame>
  );
}
