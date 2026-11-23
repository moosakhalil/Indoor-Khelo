import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { VenueForm } from "@/components/Forms7";
import { deleteVenueAction } from "@/app/actions7";
import { getVenue } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Venue" };
export const dynamic = "force-dynamic";

export default async function VenuePage({ params, searchParams }: { params: Promise<{ id: string; venueId: string }>; searchParams: Promise<{ e?: string }> }) {
  const { id, venueId } = await params;
  const { e } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const v = await getVenue(id, venueId);
  if (!v) notFound();
  return (
    <Frame communityId={id} title="Venue" back={`/c/${id}/payments/venues`}>
      <div className="stack">
        {e === "in_use" && <div className="banner red" role="alert">This venue has bookings, so it cannot be deleted.</div>}
        <VenueForm mode="edit" communityId={id} venueId={venueId} venue={v} />
        <p className="muted small" style={{ margin: 0 }}>Added by <b style={{ color: "var(--white)" }}>{v.created_by_name ?? "—"}</b> · Changed by <b style={{ color: "var(--white)" }}>{v.changed_by_name ?? "—"}</b></p>
        <section className="card">
          <b>Delete this venue</b>
          {v.booking_count > 0 ? (
            <p className="muted small" style={{ margin: "4px 0 0" }}>It has {v.booking_count} booking{v.booking_count === 1 ? "" : "s"}, so it stays.</p>
          ) : (
            <details style={{ marginTop: 8 }}>
              <summary className="btn red small" style={{ listStyle: "none", cursor: "pointer" }}>Delete {v.name}…</summary>
              <form action={deleteVenueAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="communityId" value={id} /><input type="hidden" name="venueId" value={venueId} />
                <button className="btn red small">Yes, delete this venue</button>
              </form>
            </details>
          )}
        </section>
      </div>
    </Frame>
  );
}
