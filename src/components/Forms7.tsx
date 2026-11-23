"use client";
// Phase 7: forms for venues, bookings and payments. Recording a payment also works with no signal: it is saved on the phone,
// marked "not synced", and sent later (the same record sent twice is saved once).
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useCallback, useEffect, useState } from "react";
import { createBookingAction, createVenueAction, updateBookingAction, updatePaymentAction, updateVenueAction } from "@/app/actions7";
import type { FormState } from "@/app/actions";
import { DURATIONS, METHODS, money, validatePayment } from "@/lib/payments";
import { flushPayments, queuePayment, readQueuedPayments, removeQueuedPayment, sendPayment, type QueuedPayment } from "@/lib/outbox";

const initial: FormState = {};
const Err = ({ text }: { text?: string }) => (text ? <p className="err" role="alert">{text}</p> : null);
const submitWith = (action: (fd: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => action(fd));
};
const uuidOk = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function TzField() {
  const [tz, setTz] = useState("");
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTz(""); } }, []);
  return <input type="hidden" name="tz" value={tz} />;
}

/* ---------- venue ---------- */
export function VenueForm({ mode, communityId, venueId, venue }: { mode: "create" | "edit"; communityId: string; venueId?: string; venue?: { name: string; address: string; contact: string } }) {
  const [state, action, pending] = useActionState(mode === "create" ? createVenueAction : updateVenueAction, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      {venueId && <input type="hidden" name="venueId" value={venueId} />}
      <label className="lb" htmlFor="v-name" style={{ marginTop: 0 }}>Venue name</label>
      <input id="v-name" name="name" className={`field${fe.name ? " bad" : ""}`} defaultValue={venue?.name} maxLength={60} placeholder="Arena One" autoComplete="off" />
      <Err text={fe.name} />
      <label className="lb" htmlFor="v-addr">Address (optional)</label>
      <input id="v-addr" name="address" className={`field${fe.address ? " bad" : ""}`} defaultValue={venue?.address} maxLength={120} />
      <Err text={fe.address} />
      <label className="lb" htmlFor="v-contact">Contact (optional)</label>
      <input id="v-contact" name="contact" className={`field${fe.contact ? " bad" : ""}`} defaultValue={venue?.contact} maxLength={60} placeholder="Phone or name of the person to call" />
      <Err text={fe.contact} />
      {state.error && !state.fieldErrors && <Err text={state.error} />}
      {state.message && <p className="banner green" role="status">{state.message}</p>}
      <button className="btn gold" disabled={pending} style={{ marginTop: 12 }}>{pending ? "Saving…" : mode === "create" ? "Add venue" : "Save venue"}</button>
    </form>
  );
}

/* ---------- booking ---------- */
export function BookingForm({ mode, communityId, bookingId, venues, defaults }: {
  mode: "create" | "edit"; communityId: string; bookingId?: string; venues: { id: string; name: string }[];
  defaults?: { venueId: string; when: string; durationMinutes: number; totalCost: number; reference: string; notes: string };
}) {
  const [state, action, pending] = useActionState(mode === "create" ? createBookingAction : updateBookingAction, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
      <TzField />
      <label className="lb" htmlFor="b-venue" style={{ marginTop: 0 }}>Venue</label>
      <select id="b-venue" name="venueId" className={`field${fe.venueId ? " bad" : ""}`} defaultValue={defaults?.venueId ?? ""}>
        <option value="">Choose a venue</option>
        {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <Err text={fe.venueId} />
      <label className="lb" htmlFor="b-when">Date and start time</label>
      <input id="b-when" type="datetime-local" name="when" className={`field${fe.when ? " bad" : ""}`} defaultValue={defaults?.when} />
      <Err text={fe.when} />
      <label className="lb" htmlFor="b-dur">Duration</label>
      <div className="two">
        <select id="b-dur" className="field" aria-label="Choose a duration" onChange={(e) => { const el = document.getElementById("b-dur-n") as HTMLInputElement | null; if (el && e.target.value) el.value = e.target.value; }}
          defaultValue={DURATIONS.includes((defaults?.durationMinutes ?? 60) as never) ? String(defaults?.durationMinutes ?? 60) : ""}>
          <option value="">Other (type minutes)</option>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
        </select>
        <input id="b-dur-n" name="durationMinutes" inputMode="numeric" className={`field${fe.durationMinutes ? " bad" : ""}`} defaultValue={String(defaults?.durationMinutes ?? 60)} aria-label="Duration in minutes" maxLength={3} />
      </div>
      <Err text={fe.durationMinutes} />
      <label className="lb" htmlFor="b-cost">Total cost (PKR)</label>
      <input id="b-cost" name="totalCost" inputMode="numeric" className={`field${fe.totalCost ? " bad" : ""}`} defaultValue={defaults ? String(defaults.totalCost) : ""} placeholder="6000" maxLength={10} />
      <Err text={fe.totalCost} />
      <label className="lb" htmlFor="b-ref">Booking reference (optional)</label>
      <input id="b-ref" name="reference" className={`field${fe.reference ? " bad" : ""}`} defaultValue={defaults?.reference} maxLength={40} placeholder="From the venue" />
      <Err text={fe.reference} />
      <label className="lb" htmlFor="b-notes">Notes (optional)</label>
      <textarea id="b-notes" name="notes" className={`field${fe.notes ? " bad" : ""}`} defaultValue={defaults?.notes} maxLength={300} />
      <Err text={fe.notes} />
      <p className="muted small" style={{ margin: "10px 2px" }}>Type the venue, date and time by hand after arranging it with the venue. Choose who shares the cost, and link matches, after saving.</p>
      {state.error && <Err text={state.error} />}
      <button className="btn gold" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create booking" : "Save changes"}</button>
    </form>
  );
}

/* ---------- recording a payment (works offline) ---------- */
type Person = { value: string; label: string };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function PaymentForm({ communityId, bookingId, people, share }: { communityId: string; bookingId: string; people: Person[]; share: number }) {
  const router = useRouter();
  const [kind, setKind] = useState<"payment" | "refund">("payment");
  const [payer, setPayer] = useState("");
  const [other, setOther] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ tone: "green" | "mute" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);   // changing this clears the form after a save

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw: Record<string, string> = {
      kind, amount: String(fd.get("amount") ?? ""), paidOn: String(fd.get("paidOn") ?? ""), method: String(fd.get("method") ?? ""), reference: String(fd.get("reference") ?? ""),
      payer: payer === "__other" ? (other.trim() ? `g:${other.trim()}` : "") : payer,
    };
    const v = validatePayment(raw, new Date(), uuidOk);
    if (!v.ok) { setErrors(v.errors); setNote(null); return; }
    setErrors({}); setBusy(true);
    const item: QueuedPayment = { id: crypto.randomUUID(), communityId, bookingId, createdAt: Date.now(), status: "waiting", reason: null, payment: raw };
    // Saved on the phone first, then sent. If there is no signal it simply waits, marked "not synced".
    const stored = await queuePayment(item);
    const res = await sendPayment(item);
    if (res.kind === "sent" || res.kind === "duplicate") {
      await removeQueuedPayment(item.id);
      setNote({ tone: "green", text: "Recorded." });
      setPayer(""); setOther(""); setVersion((x) => x + 1);
      router.refresh();
    } else if (res.kind === "refused") {
      await removeQueuedPayment(item.id);
      setNote({ tone: "red", text: res.message });
    } else {
      setNote({ tone: "mute", text: stored ? "No signal. Saved on this phone and marked “not synced”. It will be sent when you are back online." : "No signal, and this phone could not save it. Keep this screen open and try again." });
      if (stored) { setPayer(""); setOther(""); setVersion((x) => x + 1); }
      window.dispatchEvent(new Event("ik-queued-payments"));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate key={version}>
      <div className="row wrap" role="group" aria-label="Payment or refund" style={{ marginBottom: 6 }}>
        <button type="button" className={`chip${kind === "payment" ? " gold" : ""}`} aria-pressed={kind === "payment"} onClick={() => setKind("payment")}>Payment received</button>
        <button type="button" className={`chip${kind === "refund" ? " gold" : ""}`} aria-pressed={kind === "refund"} onClick={() => setKind("refund")}>Refund given back</button>
      </div>
      <label className="lb" htmlFor="p-payer" style={{ marginTop: 0 }}>{kind === "refund" ? "Refunded to" : "Who paid?"}</label>
      <select id="p-payer" className={`field${errors.payer ? " bad" : ""}`} value={payer} onChange={(e) => setPayer(e.target.value)}>
        <option value="">Choose</option>
        {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        <option value="__other">Someone else (type a name)</option>
      </select>
      {payer === "__other" && <input className="field" style={{ marginTop: 8 }} value={other} onChange={(e) => setOther(e.target.value)} maxLength={60} placeholder="Name" aria-label="Name of the person" />}
      <Err text={errors.payer} />
      <label className="lb" htmlFor="p-amount">Amount (PKR){share > 0 ? ` · suggested share ${money(share)}` : ""}</label>
      <input id="p-amount" name="amount" inputMode="numeric" className={`field${errors.amount ? " bad" : ""}`} maxLength={10} placeholder={share > 0 ? String(share) : "600"} />
      <Err text={errors.amount} />
      <div className="two">
        <div>
          <label className="lb" htmlFor="p-date">Date</label>
          <input id="p-date" name="paidOn" type="date" className={`field${errors.paidOn ? " bad" : ""}`} defaultValue={today()} />
          <Err text={errors.paidOn} />
        </div>
        <div>
          <label className="lb" htmlFor="p-method">Method</label>
          <select id="p-method" name="method" className={`field${errors.method ? " bad" : ""}`} defaultValue="cash">{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          <Err text={errors.method} />
        </div>
      </div>
      <label className="lb" htmlFor="p-ref">Reference (optional)</label>
      <input id="p-ref" name="reference" className={`field${errors.reference ? " bad" : ""}`} maxLength={60} placeholder="Transaction id or a note" />
      <Err text={errors.reference} />
      {note && <p className={note.tone === "red" ? "err" : `banner ${note.tone}`} role="status" style={{ marginTop: 10 }}>{note.text}</p>}
      <button className="btn gold" disabled={busy} style={{ marginTop: 12 }}>{busy ? "Saving…" : kind === "refund" ? "Record the refund" : "Record the payment"}</button>
    </form>
  );
}

/** Payment records waiting on this phone for this booking: clearly marked "not synced". */
export function QueuedPayments({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<QueuedPayment[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => setItems(await readQueuedPayments(bookingId)), [bookingId]);
  useEffect(() => {
    void load();
    const t = () => void load();
    window.addEventListener("ik-queued-payments", t);
    window.addEventListener("online", t);
    return () => { window.removeEventListener("ik-queued-payments", t); window.removeEventListener("online", t); };
  }, [load]);
  if (!items.length) return null;
  return (
    <section className="card" style={{ borderColor: "var(--orange)" }} aria-label="Payments not synced yet">
      <b>Not synced yet ({items.length})</b>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>These are saved on this phone and have not reached the server. They are sent by themselves when you are online.</p>
      <div className="list">
        {items.map((i) => (
          <div key={i.id} className="item space" style={{ alignItems: "flex-start" }}>
            <span className="t grow">
              <b>{i.payment.kind === "refund" ? "Refund" : "Payment"} {money(Number(i.payment.amount.replace(/[,\s]/g, "")) || 0)}</b>
              <small>{i.payment.paidOn} · {i.payment.method}{i.status === "refused" ? ` · The server did not accept it: ${i.reason}` : " · waiting to sync"}</small>
            </span>
            {i.status === "refused" && <button className="chip" onClick={async () => { await removeQueuedPayment(i.id); await load(); }}>Discard</button>}
          </div>
        ))}
      </div>
      <button className="btn ghost small" style={{ marginTop: 8 }} onClick={async () => { const r = await flushPayments(); setMsg(r.sent ? `Sent ${r.sent}.` : "Still waiting for a signal."); await load(); if (r.sent) router.refresh(); }}>Send now</button>
      {msg && <p className="muted small" role="status" style={{ margin: "6px 0 0" }}>{msg}</p>}
    </section>
  );
}

/* ---------- editing an existing payment record ---------- */
export function EditPaymentForm({ communityId, bookingId, paymentId, people, current }: {
  communityId: string; bookingId: string; paymentId: string; people: Person[];
  current: { payer: string; kind: "payment" | "refund"; amount: number; paidOn: string; method: string; reference: string };
}) {
  const [state, action, pending] = useActionState(updatePaymentAction, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="paymentId" value={paymentId} />
      <label className="lb" htmlFor="e-kind" style={{ marginTop: 0 }}>Kind</label>
      <select id="e-kind" name="kind" className="field" defaultValue={current.kind}><option value="payment">Payment received</option><option value="refund">Refund given back</option></select>
      <label className="lb" htmlFor="e-payer">Person</label>
      <select id="e-payer" name="payer" className={`field${fe.payer ? " bad" : ""}`} defaultValue={current.payer}>
        {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        {!people.some((p) => p.value === current.payer) && <option value={current.payer}>{current.payer.slice(2)}</option>}
      </select>
      <Err text={fe.payer} />
      <label className="lb" htmlFor="e-amount">Amount (PKR)</label>
      <input id="e-amount" name="amount" inputMode="numeric" className={`field${fe.amount ? " bad" : ""}`} defaultValue={String(current.amount)} maxLength={10} />
      <Err text={fe.amount} />
      <div className="two">
        <div><label className="lb" htmlFor="e-date">Date</label><input id="e-date" name="paidOn" type="date" className={`field${fe.paidOn ? " bad" : ""}`} defaultValue={current.paidOn} /><Err text={fe.paidOn} /></div>
        <div><label className="lb" htmlFor="e-method">Method</label><select id="e-method" name="method" className="field" defaultValue={current.method}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
      </div>
      <label className="lb" htmlFor="e-ref">Reference (optional)</label>
      <input id="e-ref" name="reference" className={`field${fe.reference ? " bad" : ""}`} defaultValue={current.reference} maxLength={60} />
      <Err text={fe.reference} />
      <p className="muted small" style={{ margin: "10px 2px" }}>Your name is saved with the change, and the old and new values go in the history. An edited record needs checking again.</p>
      {state.error && <Err text={state.error} />}
      <button className="btn gold" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
