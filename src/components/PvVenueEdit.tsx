"use client";
// Phase F3: the pieces of the Venue page that need the browser: the top bar menu and the delete section with its confirm dialog.
// A venue that has bookings cannot be deleted (the server refuses too): the button is locked and the reason is written next to it.
import { useEffect, useRef, useState } from "react";
import { deleteVenueAction } from "@/app/actions7";
import ActionMenu from "@/components/ActionMenu";
import { IconLock, IconTrash } from "@/components/B4Icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import { bookingsText, PV_DELETE_VENUE } from "@/lib/pv";
import "./pv.css";

/** The three-dots menu in the top bar: Edit venue (jumps to the form) and Delete venue (opens the same confirm as the button below). */
export function PvVenueMenu({ name, bookingCount }: { name: string; bookingCount: number }) {
  const used = bookingCount > 0;
  return (
    <ActionMenu label={`More actions for ${name}`} items={[
      { label: "Edit venue", onSelect: () => { const el = document.getElementById("pv-ve-name"); el?.scrollIntoView?.({ block: "center" }); el?.focus(); } },
      { label: "Delete venue", danger: true, disabled: used, hint: used ? `It has ${bookingsText(bookingCount)}, so it stays` : undefined, onSelect: () => window.dispatchEvent(new Event(PV_DELETE_VENUE)) },
    ]} />
  );
}

export function PvVenueDelete({ communityId, venueId, name, bookingCount }: { communityId: string; venueId: string; name: string; bookingCount: number }) {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const used = bookingCount > 0;
  useEffect(() => {
    const on = () => { if (!used) setOpen(true); };
    window.addEventListener(PV_DELETE_VENUE, on);
    return () => window.removeEventListener(PV_DELETE_VENUE, on);
  }, [used]);
  return (
    <section className="pv-card2" aria-label="Delete this venue">
      <h2>Delete this venue</h2>
      {used ? (
        <>
          <p className="pv-lockline"><IconLock size={16} /><span>It has {bookingsText(bookingCount)}, so it stays. Delete or cancel those bookings first.</span></p>
          <button type="button" className="btn red pv-delbtn" disabled aria-disabled="true"><IconTrash size={16} /> Delete venue (not available)</button>
        </>
      ) : (
        <>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>No bookings use this venue, so it can be deleted.</p>
          <button type="button" className="btn red pv-delbtn" onClick={() => setOpen(true)}><IconTrash size={16} /> Delete {name}</button>
        </>
      )}
      <form ref={form} action={deleteVenueAction} hidden>
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="venueId" value={venueId} />
      </form>
      <ConfirmDialog
        open={open}
        title={`Delete ${name}?`}
        body={<>This venue has no bookings. Its name, address and contact are removed for everyone in the community. This cannot be undone.</>}
        confirmLabel="Delete venue"
        cancelLabel="Keep venue"
        danger
        typeToConfirm={name}
        onConfirm={() => { form.current?.requestSubmit(); }}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
