"use client";
// Phase F4 (UI redesign, payments): "Who shares the cost". It posts to the SAME action as before (sharingAction): `member` once per ticked
// member and `guests` as one name per line. The page only decides the suggested equal share, rounded up; nobody is forced to pay.
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { sharingAction } from "@/app/actions7";
import PbIcon from "@/components/PbIcons";
import Shirt from "@/components/Shirt";
import { money } from "@/lib/payments";
import { checkGuestName, splitPreview } from "@/lib/pbBooking";
import "./pb.css";

export type ShareMember = { user_id: string; name: string; number: number | null };
export type LastBooking = { label: string; members: string[]; guests: string[] };

export default function ShareForm({ communityId, bookingId, total, members, selected, guests: startGuests, last, error }: {
  communityId: string; bookingId: string; total: number; members: ShareMember[]; selected: string[]; guests: string[]; last: LastBooking | null; error: string | null;
}) {
  const formId = useId();
  const searchId = useId();
  const guestId = useId();
  const known = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  // someone who left the community cannot be shown or kept: saving simply leaves them out
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selected.filter((id) => known.has(id))));
  const [guests, setGuests] = useState<string[]>(startGuests);
  const [query, setQuery] = useState("");
  const [guestText, setGuestText] = useState("");
  const [guestError, setGuestError] = useState<string | null>(error === "guest" ? "A guest name must be 1 to 60 characters." : null);
  const [panel, setPanel] = useState<Element | null>(null);
  useEffect(() => { setPanel(document.getElementById("pb-share-panel")); }, []);

  const q = query.trim().toLowerCase();
  const shown = q ? members.filter((m) => m.name.toLowerCase().includes(q) || String(m.number ?? "") === q) : members;
  const count = picked.size + guests.length;
  const split = splitPreview(total, count);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll = () => setPicked((s) => { const n = new Set(s); shown.forEach((m) => n.add(m.user_id)); return n; });
  const sameAsLast = () => {
    if (!last) return;
    setPicked(new Set(last.members.filter((id) => known.has(id))));
    setGuests(last.guests.slice());
  };
  function addGuest() {
    if (guestText.includes(",")) { setGuestError("A guest name cannot contain a comma. Add one name at a time."); return; }
    const r = checkGuestName(guestText, guests);
    if (!r.ok) { setGuestError(r.error); return; }
    setGuests((g) => [...g, r.name]); setGuestText(""); setGuestError(null);
  }

  const summary = (
    <div className="pb-sum" aria-live="polite">
      {count === 0 ? (
        <b>Choose at least one person to see a suggested share.</b>
      ) : (
        <>
          <b>{count} {count === 1 ? "person" : "people"} · {money(split.share)} each</b>
          <small className="muted">{money(total)} total{split.extra > 0 ? ` · rounded up, so ${money(split.extra)} extra is collected` : ""}</small>
        </>
      )}
      <small className="muted">Newly added people are told their share.</small>
    </div>
  );

  return (
    <form id={formId} action={sharingAction} className="stack pb-share">
      <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="guests" value={guests.join("\n")} />
      {Array.from(picked).map((id) => <input key={id} type="hidden" name="member" value={id} />)}

      {error === "bad_person" && <div className="pb-banner red" role="alert"><PbIcon name="alert" size={18} /><span className="grow">Someone in the list is not a member of this community any more. Untick them, then save again.</span></div>}
      {error === "forbidden" && <div className="pb-banner red" role="alert"><PbIcon name="alert" size={18} /><span className="grow">Only members of this community can do that.</span></div>}
      {error === "not_found" && <div className="pb-banner red" role="alert"><PbIcon name="alert" size={18} /><span className="grow">That could not be found.</span></div>}

      <div className="pb-banner mute" role="note">
        <PbIcon name="info" size={18} />
        <span className="grow"><b>{money(total)} ÷ people = the suggested share</b>, rounded up to a whole rupee. Nobody is forced to pay it: the group decides who pays what.</span>
      </div>

      <section className="card">
        <div className="pb-search">
          <label className="pb-sr" htmlFor={searchId}>Search members</label>
          <PbIcon name="search" size={18} />
          <input id={searchId} type="search" className="field" placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <div className="pb-bulk">
          <button type="button" className="chip" onClick={selectAll}><PbIcon name="check" size={15} />Select all{q ? ` (${shown.length})` : ""}</button>
          <button type="button" className="chip" onClick={() => setPicked(new Set())}><PbIcon name="x" size={15} />Clear</button>
          {last && <button type="button" className="chip" onClick={sameAsLast}><PbIcon name="undo" size={15} />Same as last booking<small className="muted"> · {last.label}</small></button>}
        </div>
        <h2 className="pb-h2" style={{ marginTop: 12 }}>Members <small className="muted">({picked.size} of {members.length} chosen)</small></h2>
        {shown.length === 0 ? <p className="muted small" style={{ margin: "8px 0 0" }}>Nobody matches “{query}”.</p> : (
          <div className="pb-members">
            {shown.map((m) => (
              <label key={m.user_id} className={`pb-mem${picked.has(m.user_id) ? " on" : ""}`}>
                <input type="checkbox" checked={picked.has(m.user_id)} onChange={() => toggle(m.user_id)} />
                <span className="pb-tick" aria-hidden="true">{picked.has(m.user_id) && <PbIcon name="check" size={16} />}</span>
                <Shirt number={m.number} size="small" />
                <span className="grow"><b>{m.name}</b></span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="pb-h2">Guests <small className="muted">({guests.length})</small></h2>
        <p className="muted small" style={{ margin: "4px 0 8px" }}>A guest has no account. They are counted in the split and their payments are tracked by name.</p>
        <div className="pb-guest-add">
          <label className="pb-sr" htmlFor={guestId}>Guest name</label>
          <input id={guestId} className={`field${guestError ? " bad" : ""}`} placeholder="Guest name" value={guestText} maxLength={80} autoComplete="off" aria-invalid={guestError ? true : undefined}
            onChange={(e) => { setGuestText(e.target.value); setGuestError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGuest(); } }} />
          <button type="button" className="btn ghost small" onClick={addGuest}><PbIcon name="plus" size={16} />Add</button>
        </div>
        {guestError && <p className="err pb-err" role="alert"><PbIcon name="alert" size={15} />{guestError}</p>}
        {guests.length > 0 && (
          <ul className="pb-guests">
            {guests.map((g) => (
              <li key={g}><Shirt number={null} size="small" label="Guest, no player number" /><span>{g}</span>
                <button type="button" className="pb-gx" aria-label={`Remove guest ${g}`} onClick={() => setGuests((x) => x.filter((n) => n !== g))}><PbIcon name="x" size={16} /></button></li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted small" style={{ margin: 0 }}>Everyone newly added is told their suggested share. If the number of people changes, the people already in the list are told the new amount.</p>
      <div className="pb-sticky">
        {summary}
        <button className="btn gold pb-save"><PbIcon name="check" size={18} />Save who shares</button>
      </div>
      {panel && createPortal(
        <div className="card pb-panel-card">
          <h2>Split</h2>
          {summary}
          <button className="btn gold pb-save" form={formId}><PbIcon name="check" size={18} />Save who shares</button>
        </div>, panel)}
    </form>
  );
}
