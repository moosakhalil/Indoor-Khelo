// Phase F3: the body and the side panel of the Venue page, as plain components so they can be tested with dummy data. Server-safe.
import Link from "next/link";
import { AlertBanner, StatusBadge, VenueMark } from "@/components/PvParts";
import PvVenueForm from "@/components/PvVenueForm";
import { PvVenueDelete } from "@/components/PvVenueEdit";
import type { BookingStatus } from "@/lib/payments";
import { money } from "@/lib/payments";
import { bookingsText } from "@/lib/pv";
import "./pv.css";

export type PvVenueData = { id: string; name: string; address: string; contact: string; booking_count: number; created_by_name: string | null; changed_by_name: string | null };
export type PvVenueBooking = { id: string; whenText: string; status: BookingStatus; contributed: number; total: number };

function BookingsHere({ communityId, bookings }: { communityId: string; bookings: PvVenueBooking[] }) {
  return (
    <>
      <h2 style={{ fontSize: "1rem" }}>Bookings here</h2>
      {bookings.length === 0 ? <p className="muted small" style={{ margin: "6px 0 0" }}>No bookings yet. This venue can be deleted.</p> : (
        <ul className="pv-bk">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/c/${communityId}/payments/${b.id}`}>
                <span className="pv-bk-t"><b>{b.whenText}</b><small className="muted">{money(b.contributed)} of {money(b.total)}</small></span>
                <StatusBadge status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The right-hand panel (shown from 1360 px up; below that the same list sits under the delete card). */
export function PvVenuePanel({ communityId, bookings }: { communityId: string; bookings: PvVenueBooking[] }) {
  return <section className="pv-card2 pv-bk-panel" aria-label="Bookings at this venue"><BookingsHere communityId={communityId} bookings={bookings} /></section>;
}

export function PvVenueBody({ communityId, venue: v, bookings, inUse, canDelete = true }: { communityId: string; venue: PvVenueData; bookings: PvVenueBooking[]; inUse: boolean; canDelete?: boolean }) {
  return (
    <div className="stack">
      {inUse && <AlertBanner><b>This venue has bookings, so it cannot be deleted.</b><br /><span style={{ fontWeight: 500 }}>Another member just booked it. Cancel or delete those bookings first.</span></AlertBanner>}
      <div className="pv-vhead">
        <VenueMark name={v.name} size={56} />
        <div style={{ minWidth: 0 }}><h2>{v.name}</h2><small className="muted">{bookingsText(v.booking_count)} · added by {v.created_by_name ?? "—"}</small></div>
      </div>
      <section className="pv-card2" id="edit" aria-label="Edit venue">
        <h2>Edit venue</h2>
        <PvVenueForm mode="edit" communityId={communityId} venueId={v.id} venue={{ name: v.name, address: v.address, contact: v.contact }} idp="pv-ve" />
        <p className="pv-by">Added by <b>{v.created_by_name ?? "—"}</b> · Changed by <b>{v.changed_by_name ?? "—"}</b></p>
      </section>
      <PvVenueDelete communityId={communityId} venueId={v.id} name={v.name} bookingCount={v.booking_count} canDelete={canDelete} addedBy={v.created_by_name} />
      <section className="pv-card2 pv-bk-inline" aria-label="Bookings at this venue"><BookingsHere communityId={communityId} bookings={bookings} /></section>
    </div>
  );
}
