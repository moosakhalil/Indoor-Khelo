"use client";
// Phase F3: the pieces of the Venue page that need the browser: the top bar menu and the delete section with its confirm dialog.
// A venue that has bookings cannot be deleted (the server refuses too): the button is locked and the reason is written next to it.
import { useEffect, useRef, useState } from "react";
import { deleteVenueAction } from "@/app/actions7";
import ActionMenu from "@/components/ActionMenu";
import { IconLock, IconTrash } from "@/components/B4Icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ownerReason } from "@/lib/ownerRule";
import { bookingsText, PV_DELETE_VENUE } from "@/lib/pv";
import "./pv.css";

/** The three-dots menu in the top bar: Edit venue (jumps to the form) and Delete venue (opens the same confirm as the button below). */
export function PvVenueMenu({ name, bookingCount, canDelete = true }: { name: string; bookingCount: number; canDelete?: boolean }) {
  const used = bookingCount > 0;
  return (
    <ActionMenu label={`More actions for ${name}`} items={[
      { label: "Edit venue", onSelect: () => { const el = document.getElementById("pv-ve-name"); el?.scrollIntoView?.({ block: "center" }); el?.focus(); } },
      // Only the person who added the venue, or an Admin, is offered Delete (lib/ownerRule.ts).
      ...(canDelete ? [{ label: "Delete venue", danger: true, disabled: used, hint: used ? `It has ${bookingsText(bookingCount)}, so it stays` : undefined, onSelect: () => window.dispatchEvent(new Event(PV_DELETE_VENUE)) }] : []),
    ]} />
  );
}

export function PvVenueDelete({ communityId, venueId, name, bookingCount, canDelete = true, addedBy = null }: { communityId: string; venueId: string; name: string; bookingCount: number; canDelete?: boolean; addedBy?: string | null }) {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const used = bookingCount > 0;
  useEffect(() => {
    const on = () => { if (!used && canDelete) setOpen(true); };
    window.addEventListener(PV_DELETE_VENUE, on);
    return () => window.removeEventListener(PV_DELETE_VENUE, on);
  }, [used, canDelete]);
  if (!canDelete) {
    return (
      <section className="pv-card2" aria-label="Delete this venue">
        <h2>Delete this venue</h2>
        <p className="pv-lockline"><IconLock size={16} /><span>{ownerReason("delete", addedBy)}</span></p>
      </section>
    );
  }
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
