"use client";
// Phase F3: the booking form for New booking and Edit booking. Same server actions, same field names and same validation as BookingForm in
// Forms7.tsx (venueId, when, durationMinutes, totalCost, reference, notes, tz); only the controls are new: a venue pick list, a date field and a
// time field, duration chips, a big cost with a live example, a notes counter, a sticky action bar, and for edits a "What this changes" panel and
// a confirm before a cost change that affects the people sharing.
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createBookingAction, updateBookingAction } from "@/app/actions7";
import type { FormState } from "@/app/actions";
import { IconCalendar, IconPlus } from "@/components/B4Icons";
import { IconClock } from "@/components/CrIcons";
import ConfirmDialog from "@/components/ConfirmDialog";
import { AlertBanner, FieldError, StepBar } from "@/components/PvParts";
import { money } from "@/lib/payments";
import { costEffect, DURATION_CHIPS, isPresetDuration, joinWhen, parseCost, splitExample, splitWhen } from "@/lib/pv";
import "./pv.css";

const initial: FormState = {};
export type PvVenueOption = { id: string; name: string; address: string };
export type PvBookingDefaults = { venueId: string; when: string; durationMinutes: number; totalCost: number; reference: string; notes: string };

const draftKey = (communityId: string) => `pv-booking-draft-${communityId}`;

function TzField() {
  const [tz, setTz] = useState("");
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTz(""); } }, []);
  return <input type="hidden" name="tz" value={tz} />;
}

export default function PvBookingForm({ mode, communityId, bookingId, venues, defaults, people = 0, cancelHref }: {
  mode: "create" | "edit"; communityId: string; bookingId?: string; venues: PvVenueOption[]; defaults?: PvBookingDefaults; people?: number; cancelHref: string;
}) {
  const [state, action, pending] = useActionState(mode === "create" ? createBookingAction : updateBookingAction, initial);
  const fe = state.fieldErrors ?? {};
  const start = splitWhen(defaults?.when);
  const [venueId, setVenueId] = useState(defaults?.venueId ?? "");
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [dur, setDur] = useState(String(defaults?.durationMinutes ?? 60));
  const [other, setOther] = useState(defaults ? !isPresetDuration(String(defaults.durationMinutes)) : false);
  const [cost, setCost] = useState(defaults ? String(defaults.totalCost) : "");
  const [reference, setReference] = useState(defaults?.reference ?? "");
  const [notes, setNotes] = useState(defaults?.notes ?? "");
  const [confirm, setConfirm] = useState<{ fd: FormData; to: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(state);

  // Coming back from "Add another venue": put back what was typed (kept only for that one round trip).
  useEffect(() => {
    if (mode !== "create") return;
    try {
      const raw = sessionStorage.getItem(draftKey(communityId));
      if (!raw) return;
      sessionStorage.removeItem(draftKey(communityId));
      const d = JSON.parse(raw) as Record<string, string>;
      if (typeof d.venueId === "string" && venues.some((v) => v.id === d.venueId)) setVenueId(d.venueId);
      if (typeof d.date === "string") setDate(d.date);
      if (typeof d.time === "string") setTime(d.time);
      if (typeof d.dur === "string") { setDur(d.dur); setOther(d.other === "1" || !isPresetDuration(d.dur)); }
      if (typeof d.cost === "string") setCost(d.cost);
      if (typeof d.reference === "string") setReference(d.reference);
      if (typeof d.notes === "string") setNotes(d.notes);
    } catch { /* storage can be blocked: the form simply starts empty */ }
  }, [mode, communityId, venues]);

  // After a refusal, move to the summary so it is not missed (the keyboard may have closed).
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    const el = root.current?.querySelector<HTMLElement>("[data-pv-summary]");
    el?.focus();
  }, [state]);

  const saveDraft = () => {
    try { sessionStorage.setItem(draftKey(communityId), JSON.stringify({ venueId, date, time, dur, other: other ? "1" : "0", cost, reference, notes })); } catch { /* ignore */ }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    if (mode === "edit" && people > 0 && defaults) {
      const to = parseCost(cost);
      if (to !== null && to !== defaults.totalCost) { setConfirm({ fd, to }); return; }
    }
    startTransition(() => action(fd));
  };

  const example = splitExample(cost);
  const showExample = mode === "create" || people === 0;
  const effect = defaults ? costEffect(defaults.totalCost, parseCost(cost), people) : null;
  const hasFieldErrors = Object.keys(fe).length > 0;
  const tzFail = !!state.error && state.error.startsWith("We could not read");
  const dateBad = !!fe.when;

  return (
    <div className={`pv-formroot${mode === "edit" ? " pv-wide pv-wideform" : ""}`} ref={root}>
      {mode === "create" && <StepBar now={1} />}
      {(state.error || hasFieldErrors) && (
        <AlertBanner retry={tzFail ? <button type="button" className="btn ghost small" onClick={() => window.location.reload()}>Reload page</button> : undefined}>
          <b>{hasFieldErrors ? "Please fix the highlighted fields." : state.error}</b>
        </AlertBanner>
      )}
      <div className="pv-grid2">
        <form onSubmit={submit} noValidate className="pv-form">
          <input type="hidden" name="communityId" value={communityId} />
          {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
          <TzField />
          <input type="hidden" name="when" value={joinWhen(date, time)} />
          <input type="hidden" name="durationMinutes" value={dur} />

          <div className="pv-fs">
            <div className="pv-lb">Venue</div>
            <div className="pv-venues" role="radiogroup" aria-label="Venue" aria-describedby={fe.venueId ? "pv-e-venue" : undefined}>
              {venues.map((v) => (
                <label key={v.id} className={`pv-venue${venueId === v.id ? " on" : ""}${fe.venueId && !venueId ? " bad" : ""}`}>
                  <input type="radio" name="venueId" value={v.id} checked={venueId === v.id} onChange={() => setVenueId(v.id)} />
                  <span className="pv-venue-t"><b>{v.name}</b><small className="muted">{v.address || "No address"}</small></span>
                </label>
              ))}
            </div>
            <Link href={`/c/${communityId}/payments/venues`} className="pv-link" onClick={mode === "create" ? saveDraft : undefined}><IconPlus size={15} /> Add another venue</Link>
            <FieldError id="pv-e-venue" text={fe.venueId} />
          </div>

          <div className="pv-two">
            <div>
              <label className="pv-lb" htmlFor="pv-date">Date</label>
              <div className={`pv-if${dateBad ? " bad" : ""}`}><IconCalendar size={17} /><input id="pv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={dateBad || undefined} aria-describedby={dateBad ? "pv-e-when" : undefined} /></div>
            </div>
            <div>
              <label className="pv-lb" htmlFor="pv-time">Start time</label>
              <div className={`pv-if${dateBad ? " bad" : ""}`}><IconClock size={17} /><input id="pv-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={dateBad || undefined} aria-describedby={dateBad ? "pv-e-when" : undefined} /></div>
            </div>
          </div>
          <FieldError id="pv-e-when" text={fe.when} />

          <div className="pv-fs">
            <div className="pv-lb">Duration</div>
            <div className="pv-chips" role="group" aria-label="Duration in minutes">
              {DURATION_CHIPS.map((d) => {
                const on = !other && dur === String(d);
                return <button key={d} type="button" className={`pv-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => { setOther(false); setDur(String(d)); }}>{on && <span aria-hidden="true">✓ </span>}{d} min</button>;
              })}
              <button type="button" className={`pv-chip${other ? " on" : ""}`} aria-pressed={other} onClick={() => setOther(true)}>{other && <span aria-hidden="true">✓ </span>}Other</button>
            </div>
            {other && (
              <div className={`pv-if pv-other${fe.durationMinutes ? " bad" : ""}`}>
                <input inputMode="numeric" value={dur} maxLength={3} onChange={(e) => setDur(e.target.value)} aria-label="Duration in minutes" aria-invalid={!!fe.durationMinutes || undefined} aria-describedby={fe.durationMinutes ? "pv-e-dur" : undefined} />
                <span className="muted">minutes (15 to 720)</span>
              </div>
            )}
            <FieldError id="pv-e-dur" text={fe.durationMinutes} />
          </div>

          <label className="pv-lb" htmlFor="pv-cost">Total cost</label>
          <div className={`pv-cost${fe.totalCost ? " bad" : ""}`}>
            <span className="pv-cost-c" aria-hidden="true">PKR</span>
            <input id="pv-cost" name="totalCost" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="6000" maxLength={10} autoComplete="off"
              aria-label="Total cost (PKR)" aria-invalid={!!fe.totalCost || undefined} aria-describedby={fe.totalCost ? "pv-e-cost" : "pv-h-cost"} />
          </div>
          {fe.totalCost ? <FieldError id="pv-e-cost" text={fe.totalCost} /> : <p className="pv-hint" id="pv-h-cost">Whole rupees, 0 to 10,000,000.</p>}
          {showExample && example && (
            <div className="pv-example" role="status">
              <b>Example split</b>
              <span>If {example.people} people share: <b>{money(example.share)}</b> each{example.extra > 0 ? ` (rounded up, ${money(example.extra)} extra)` : ""}. {mode === "create" ? "Pick the real people after saving." : "Pick the real people on the booking."} Paying stays up to the group.</span>
            </div>
          )}

          <label className="pv-lb" htmlFor="pv-ref">Booking reference (optional)</label>
          <input id="pv-ref" name="reference" className={`pv-input${fe.reference ? " bad" : ""}`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={40} placeholder="From the venue" aria-invalid={!!fe.reference || undefined} aria-describedby={fe.reference ? "pv-e-ref" : undefined} />
          <FieldError id="pv-e-ref" text={fe.reference} />

          <label className="pv-lb" htmlFor="pv-notes">Notes (optional)</label>
          <textarea id="pv-notes" name="notes" className={`pv-input pv-ta${fe.notes ? " bad" : ""}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Court number, how to pay at the counter…" aria-invalid={!!fe.notes || undefined} aria-describedby={fe.notes ? "pv-e-notes" : "pv-c-notes"} />
          <div className="pv-count" id="pv-c-notes">{notes.length} / 300</div>
          <FieldError id="pv-e-notes" text={fe.notes} />

          <p className="pv-hint">Type the venue, date and time by hand after arranging it with the venue. Choose who shares the cost, and link matches, after saving.</p>

          <div className="pv-actions">
            <Link href={cancelHref} className="btn ghost pv-cancel">Cancel</Link>
            <button className="btn gold" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create booking" : "Save changes"}</button>
          </div>
        </form>

        {mode === "edit" && effect && (
          <aside className="pv-effect" aria-label="What this changes">
            <h2>What this changes</h2>
            {people > 0 ? (
              <dl>
                <div><dt>People sharing</dt><dd>{people}</dd></div>
                <div><dt>Suggested share now</dt><dd>{money(effect.now)}</dd></div>
                <div><dt>Suggested share after</dt><dd className={effect.changed ? "chg" : ""}>{effect.valid ? money(effect.after) : "—"}</dd></div>
                <div><dt>Rounding extra</dt><dd>{money(effect.extra)}</dd></div>
              </dl>
            ) : <p className="muted small" style={{ margin: 0 }}>Nobody has been chosen to share the cost yet, so a cost change tells no one.</p>}
            <p className="pv-hint">If you change the cost, every suggested share is worked out again, the new amount is shown clearly, and the people sharing are told. Payments already recorded stay as they are.</p>
          </aside>
        )}
      </div>

      {confirm && defaults && (() => {
        const e = costEffect(defaults.totalCost, confirm.to, people);
        return (
          <ConfirmDialog
            open
            title={`Change the cost to ${money(confirm.to)}?`}
            body={<>The suggested share for the {people} {people === 1 ? "person" : "people"} goes from <b className="pv-gold">{money(e.now)}</b> to <b className="pv-gold">{money(e.after)}</b> each (rounded up, {money(e.extra)} extra). The members sharing will be told. Payments already recorded stay as they are, so some people may move between Paid and Partly paid.</>}
            confirmLabel="Change the cost"
            cancelLabel={`Keep ${money(defaults.totalCost)}`}
            onConfirm={() => { const fd = confirm.fd; setConfirm(null); startTransition(() => action(fd)); }}
            onClose={() => { setConfirm(null); setCost(String(defaults.totalCost)); }}
          />
        );
      })()}
    </div>
  );
}
