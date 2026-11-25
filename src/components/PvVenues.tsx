"use client";
// Phase F3: the Venues screen. A searchable list (gold initials mark, "6 bookings" badge, edit and delete on every row) and the Add form: a bottom
// sheet on phones and tablets, a sticky card beside the list on wide screens. Same server actions as before (createVenueAction, deleteVenueAction).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteVenueAction } from "@/app/actions7";
import ActionMenu from "@/components/ActionMenu";
import { IconPencil, IconPlus, IconSearch, IconTrash } from "@/components/B4Icons";
import { IconPin } from "@/components/CrIcons";
import ConfirmDialog from "@/components/ConfirmDialog";
import { OkBanner, VenueMark } from "@/components/PvParts";
import PvSheet from "@/components/PvSheet";
import PvVenueForm from "@/components/PvVenueForm";
import { useSnackbar } from "@/components/Snackbar";
import { bookingsText, PV_ADD_VENUE, searchVenues } from "@/lib/pv";
import "./pv.css";

/** `can_delete` false: only the person who added the venue, or an Admin, may delete it (lib/ownerRule.ts). Missing means yes. */
export type PvVenue = { id: string; name: string; address: string; contact: string; booking_count: number; can_delete?: boolean };

/** The "Add" button for the top bar of the Venues page (phones and tablets). It opens the sheet that lives in the page body. */
export function PvAddVenueButton() {
  return <button type="button" className="btn gold small pv-topadd" onClick={() => window.dispatchEvent(new Event(PV_ADD_VENUE))}><IconPlus size={16} /> Add</button>;
}

export default function PvVenues({ communityId, venues, added }: { communityId: string; venues: PvVenue[]; added: boolean }) {
  const snack = useSnackbar();
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState("");
  const [del, setDel] = useState<PvVenue | null>(null);
  const delForm = useRef<HTMLFormElement>(null);
  const base = `/c/${communityId}/payments`;

  useEffect(() => { if (added) snack.show({ message: "Venue added.", tone: "success" }); }, [added]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const open = () => setSheet(true);
    window.addEventListener(PV_ADD_VENUE, open);
    return () => window.removeEventListener(PV_ADD_VENUE, open);
  }, []);

  const shown = searchVenues(venues, q);
  const top = Math.max(0, ...venues.map((v) => v.booking_count));

  const addCard = (
    <section className="pv-addcard card" aria-label="Add a venue">
      <h2>Add a venue</h2>
      <p className="muted small" style={{ margin: "2px 0 0" }}>Any member can. Your name is kept with it.</p>
      <PvVenueForm mode="create" communityId={communityId} idp="pv-vc" />
    </section>
  );

  return (
    <div className="pv-root pv-wide">
      {added && <OkBanner>Venue added.</OkBanner>}
      <div className="pv-vsplit">
        <div className="pv-vleft stack">
          {venues.length === 0 ? (
            <div className="pv-start">
              <span className="pv-start-ic"><IconPin size={26} /></span>
              <h2>No venues yet</h2>
              <p className="muted">Add the places your community plays at. Any member can.</p>
              <button type="button" className="btn gold pv-start-btn pv-sheetonly" onClick={() => setSheet(true)}><IconPlus size={18} /> Add a venue</button>
            </div>
          ) : (
            <>
              <div className="pv-search">
                <IconSearch size={17} />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search venues" aria-label="Search venues" />
              </div>
              {shown.length === 0 ? <p className="pv-none">No venue matches “{q.trim()}”.</p> : (
                <ul className="pv-vlist card" aria-label="Venues">
                  {shown.map((v) => {
                    const used = v.booking_count > 0;
                    return (
                      <li key={v.id} className="pv-vrow">
                        <Link href={`${base}/venues/${v.id}`} className="pv-vlink">
                          <VenueMark name={v.name} />
                          <span className="pv-vt"><b>{v.name}</b><small className="muted">{v.address || "No address"}{v.contact ? ` · ${v.contact}` : ""}</small></span>
                        </Link>
                        <span className={`pv-badge${used && v.booking_count === top ? " top" : ""}`}>{bookingsText(v.booking_count)}</span>
                        <span className="pv-vact">
                          <Link href={`${base}/venues/${v.id}`} className="pv-ib" aria-label={`Edit ${v.name}`}><IconPencil size={17} /></Link>
                          {v.can_delete !== false && <button type="button" className="pv-ib danger" aria-label={used ? `Delete ${v.name} (not available: ${bookingsText(v.booking_count)})` : `Delete ${v.name}`} disabled={used} title={used ? `It has ${bookingsText(v.booking_count)}, so it stays` : undefined} onClick={() => setDel(v)}><IconTrash size={17} /></button>}
                        </span>
                        <span className="pv-vmenu">
                          <ActionMenu label={`Actions for ${v.name}`} items={[
                            { label: "Edit venue", href: `${base}/venues/${v.id}` },
                            ...(v.can_delete === false ? [] : [{ label: "Delete venue", danger: true, disabled: used, hint: used ? `It has ${bookingsText(v.booking_count)}, so it stays` : undefined, onSelect: () => setDel(v) }]),
                          ]} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="pv-vright">{addCard}</div>
      </div>

      <PvSheet open={sheet} title="Add a venue" sub="Any member can. Your name is kept with it." onClose={() => setSheet(false)}>
        <PvVenueForm mode="create" communityId={communityId} idp="pv-vs" />
      </PvSheet>

      <form ref={delForm} action={deleteVenueAction} hidden>
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="venueId" value={del?.id ?? ""} />
      </form>
      <ConfirmDialog
        open={!!del}
        title={`Delete ${del?.name ?? "this venue"}?`}
        body={<>This venue has no bookings. Its name, address and contact are removed for everyone in the community. This cannot be undone.</>}
        confirmLabel="Delete venue"
        cancelLabel="Keep venue"
        danger
        typeToConfirm={del?.name}
        onConfirm={() => { delForm.current?.requestSubmit(); }}
        onClose={() => setDel(null)}
      />
    </div>
  );
}
