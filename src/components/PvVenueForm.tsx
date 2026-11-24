"use client";
// Phase F3: the venue form for Add a venue and Edit venue. Same server actions, field names (name, address, contact) and validation as VenueForm
// in Forms7.tsx. Adding succeeds by redirecting to the list (Next rejects the action with a redirect, which remounts this form: it comes back empty and
// the sheet is closed). New: a hint before any error, a summary banner on top, a red ring plus an alert icon on failing fields, pin and person icons.
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createVenueAction, updateVenueAction } from "@/app/actions7";
import type { FormState } from "@/app/actions";
import { IconUser } from "@/components/B4Icons";
import { IconPin } from "@/components/CrIcons";
import { AlertBanner, FieldError, OkBanner } from "@/components/PvParts";
import { useSnackbar } from "@/components/Snackbar";
import "./pv.css";

const initial: FormState = {};

export default function PvVenueForm({ mode, communityId, venueId, venue, idp = "pv-v" }: {
  mode: "create" | "edit"; communityId: string; venueId?: string; venue?: { name: string; address: string; contact: string }; idp?: string;
}) {
  const snack = useSnackbar();
  const [state, action, pending] = useActionState(mode === "create" ? createVenueAction : updateVenueAction, initial);
  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [contact, setContact] = useState(venue?.contact ?? "");
  const root = useRef<HTMLFormElement>(null);
    const fe = state.fieldErrors ?? {};
  const bad = Object.keys(fe).length > 0;

  useEffect(() => {
    if (state.message) snack.show({ message: state.message === "Saved." ? "Venue saved." : state.message, tone: "success" });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a refusal, move to the summary banner.
  const seen = useRef(state);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.error || bad) root.current?.querySelector<HTMLElement>("[data-pv-summary]")?.focus();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };

  return (
    <form ref={root} onSubmit={submit} noValidate className="pv-vform">
      <input type="hidden" name="communityId" value={communityId} />
      {venueId && <input type="hidden" name="venueId" value={venueId} />}
      {(bad || state.error) && <AlertBanner><b>{bad ? "Please fix the highlighted fields." : state.error}</b></AlertBanner>}
      {state.message && !bad && <OkBanner>{state.message}</OkBanner>}

      <label className="pv-lb" htmlFor={`${idp}-name`}>Venue name</label>
      <input id={`${idp}-name`} name="name" className={`pv-input${fe.name ? " bad" : ""}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Arena One" autoComplete="off"
        aria-invalid={!!fe.name || undefined} aria-describedby={`${idp}-name-d`} />
      {fe.name ? <FieldError id={`${idp}-name-d`} text={fe.name} /> : <p className="pv-hint" id={`${idp}-name-d`}>2 to 60 characters. Each name can be used once.</p>}

      <label className="pv-lb" htmlFor={`${idp}-addr`}>Address (optional)</label>
      <div className={`pv-if${fe.address ? " bad" : ""}`}>
        <IconPin size={17} />
        <input id={`${idp}-addr`} name="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} placeholder="Street, area, city" autoComplete="off" aria-invalid={!!fe.address || undefined} aria-describedby={fe.address ? `${idp}-addr-d` : undefined} />
      </div>
      <FieldError id={`${idp}-addr-d`} text={fe.address} />

      <label className="pv-lb" htmlFor={`${idp}-contact`}>Contact (optional)</label>
      <div className={`pv-if${fe.contact ? " bad" : ""}`}>
        <IconUser size={17} />
        <input id={`${idp}-contact`} name="contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={60} placeholder="Phone or name of the person to call" autoComplete="off" aria-invalid={!!fe.contact || undefined} aria-describedby={fe.contact ? `${idp}-contact-d` : undefined} />
      </div>
      <FieldError id={`${idp}-contact-d`} text={fe.contact} />

      <button className="btn gold pv-vsave" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Add venue" : "Save venue"}</button>
    </form>
  );
}
