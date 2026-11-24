"use client";
// Phase 7: forms for venues, bookings and payments. Recording a payment also works with no signal: it is saved on the phone,
// marked "not synced", and sent later (the same record sent twice is saved once).
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useCallback, useEffect, useId, useState } from "react";
import { createBookingAction, createVenueAction, deletePaymentAction, updateBookingAction, updatePaymentAction, updateVenueAction } from "@/app/actions7";
import type { FormState } from "@/app/actions";
import ConfirmDialog from "@/components/ConfirmDialog";
import PbIcon from "@/components/PbIcons";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import { DURATIONS, METHODS, money, validatePayment } from "@/lib/payments";
import { flushPayments, queuePayment, readQueuedPayments, removeQueuedPayment, sendPayment, type QueuedPayment } from "@/lib/outbox";
import "./pb.css";

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
// Phase F4: the form is a sheet on a phone and a panel on a desktop (the wrapper is RecordSheet in BookingActions.tsx). The fields,
// the checks (validatePayment) and the offline queue are exactly as before; the new parts are the method chips, the big amount
// with quick suggestions, the reference label that follows the method, and the notes with icons.
type Person = { value: string; label: string; number?: number | null };
/** What the form may suggest for one person: what is still to the suggested share, and what they have paid in (the most a refund can be). */
export type PayHint = { still: number; paidIn: number };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const FieldErr = ({ text }: { text?: string }) => (text ? <p className="err pb-err" role="alert"><PbIcon name="alert" size={15} />{text}</p> : null);

function KindTabs({ kind, onChange }: { kind: "payment" | "refund"; onChange: (k: "payment" | "refund") => void }) {
  return (
    <div className="pb-tabs" role="group" aria-label="Payment or refund">
      <button type="button" className={`pb-tab${kind === "payment" ? " on" : ""}`} aria-pressed={kind === "payment"} onClick={() => onChange("payment")}><PbIcon name="plus" size={16} />Payment received</button>
      <button type="button" className={`pb-tab refund${kind === "refund" ? " on" : ""}`} aria-pressed={kind === "refund"} onClick={() => onChange("refund")}><PbIcon name="refund" size={16} />Refund given back</button>
    </div>
  );
}

function MethodChips({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <div>
      <span className="pb-lb" id={id}>Method</span>
      <div className="pb-methods" role="radiogroup" aria-labelledby={id}>
        {METHODS.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={value === m.value} className={`pb-mchip${value === m.value ? " on" : ""}`} onClick={() => onChange(m.value)}>
            {value === m.value && <PbIcon name="check" size={14} />}{m.label}
          </button>
        ))}
      </div>
      <FieldErr text={error} />
    </div>
  );
}

function AmountBox({ id, value, onChange, error, placeholder, name }: { id: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; name?: string }) {
  return (
    <>
      <label className="lb" htmlFor={id}>Amount (PKR)</label>
      <div className={`pb-amount${error ? " bad" : ""}`}>
        <span aria-hidden="true">PKR</span>
        <input id={id} name={name} inputMode="numeric" maxLength={10} value={value} placeholder={placeholder} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      </div>
      <FieldErr text={error} />
    </>
  );
}

function QuickChips({ items, onPick }: { items: { label: string; amount: number }[]; onPick: (n: number) => void }) {
  const shown = items.filter((i) => i.amount > 0);
  if (!shown.length) return null;
  return (
    <div className="pb-quick" role="group" aria-label="Quick suggestions">
      {shown.map((i) => <button key={i.label} type="button" className="pb-qchip" onClick={() => onPick(i.amount)}>{i.label}<b>{money(i.amount)}</b></button>)}
    </div>
  );
}

/** "Note" for cash, "Transaction ID" for the others: the same optional field underneath. */
const refLabel = (method: string) => (method === "cash" ? "Note (optional)" : "Transaction ID (optional)");
const refHint = (method: string) => (method === "cash" ? "A note" : method === "bank_transfer" ? "HBL 4471" : method === "card" ? "Last 4 digits" : "Transaction ID");

export function PaymentForm({ communityId, bookingId, people, share, suggest, remaining = 0, initial, onRecorded }: {
  communityId: string; bookingId: string; people: Person[]; share: number;
  suggest?: Record<string, PayHint>; remaining?: number;
  initial?: { kind?: "payment" | "refund"; payer?: string; amount?: string };
  onRecorded?: (info: { id: string; text: string }) => void;
}) {
  const router = useRouter();
  const uid = useId();
  const [kind, setKind] = useState<"payment" | "refund">(initial?.kind ?? "payment");
  const [payer, setPayer] = useState(initial?.payer ?? "");
  const [other, setOther] = useState("");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [touched, setTouched] = useState(!!initial?.amount);   // once the amount is typed or picked, choosing a person no longer overwrites it
  const [method, setMethod] = useState("cash");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ tone: "green" | "mute" | "red"; text: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestion = (k: "payment" | "refund", who: string): string => {
    const h = suggest?.[who];
    const n = k === "refund" ? h?.paidIn : h?.still;
    return n && n > 0 ? String(n) : "";
  };
  function pick(who: string) { setPayer(who); if (!touched) setAmount(suggestion(kind, who)); }
  function changeKind(k: "payment" | "refund") { setKind(k); if (!touched) setAmount(suggestion(k, payer)); }
  const hint = suggest?.[payer];
  const personLabel = payer === "__other" ? other.trim() : people.find((p) => p.value === payer)?.label.replace(/ \(guest\)$/, "") ?? "";

  function clear() { setPayer(""); setOther(""); setAmount(""); setTouched(false); setMethod("cash"); setPaidOn(today()); setReference(""); }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw: Record<string, string> = {
      kind, amount, paidOn, method, reference,
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
      const detail = `${money(v.value.amount)} ${kind === "refund" ? "to" : "from"} ${personLabel || "that person"}.`;
      setNote({ tone: "green", text: "Recorded.", detail });
      clear();
      onRecorded?.({ id: item.id, text: `${kind === "refund" ? "Refund" : "Payment"} recorded: ${detail}` });
      router.refresh();
    } else if (res.kind === "refused") {
      await removeQueuedPayment(item.id);
      setNote({ tone: "red", text: res.message });
    } else {
      setNote({ tone: "mute", text: stored ? "No signal. Saved on this phone and marked “not synced”. It will be sent when you are back online." : "No signal, and this phone could not save it. Keep this screen open and try again." });
      if (stored) clear();
      window.dispatchEvent(new Event("ik-queued-payments"));
    }
    setBusy(false);
  }

  const quick = kind === "refund"
    ? [{ label: "All they paid in", amount: hint?.paidIn ?? 0 }]
    : [{ label: "Suggested share", amount: share }, { label: "Still to suggested", amount: hint?.still ?? 0 }, { label: "Rest of the booking", amount: remaining }];
  const tone = note?.tone === "red" ? "red" : note?.tone === "green" ? "green" : "mute";

  return (
    <form onSubmit={submit} noValidate className="pb-form">
      <KindTabs kind={kind} onChange={changeKind} />
      <label className="lb" htmlFor={`${uid}-payer`}>{kind === "refund" ? "Refunded to" : "Who paid?"}</label>
      <select id={`${uid}-payer`} className={`field${errors.payer ? " bad" : ""}`} value={payer} onChange={(e) => pick(e.target.value)}>
        <option value="">Choose a person</option>
        {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        <option value="__other">Someone else (type a name)</option>
      </select>
      {payer === "__other" && <input className="field" style={{ marginTop: 8 }} value={other} onChange={(e) => setOther(e.target.value)} maxLength={60} placeholder="Name" aria-label="Name of the person" />}
      <FieldErr text={errors.payer} />
      <AmountBox id={`${uid}-amount`} value={amount} onChange={(v) => { setAmount(v); setTouched(true); }} error={errors.amount} placeholder={share > 0 ? String(share) : "600"} />
      <QuickChips items={quick} onPick={(n) => { setAmount(String(n)); setTouched(true); }} />
      <MethodChips value={method} onChange={setMethod} error={errors.method} />
      <div className="two pb-two">
        <div>
          <label className="lb" htmlFor={`${uid}-date`}>Date</label>
          <input id={`${uid}-date`} type="date" className={`field${errors.paidOn ? " bad" : ""}`} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          <FieldErr text={errors.paidOn} />
        </div>
        <div>
          <label className="lb" htmlFor={`${uid}-ref`}>{refLabel(method)}</label>
          <input id={`${uid}-ref`} className={`field${errors.reference ? " bad" : ""}`} maxLength={60} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={refHint(method)} />
          <FieldErr text={errors.reference} />
        </div>
      </div>
      {note && (
        <div className={`pb-note ${tone}`} role={note.tone === "red" ? "alert" : "status"}>
          <PbIcon name={note.tone === "green" ? "check" : note.tone === "red" ? "alert" : "phone"} size={18} />
          <span>{note.tone === "green" ? <><b>{note.text}</b> {note.detail}</> : note.text}</span>
        </div>
      )}
      <button className="btn gold pb-submit" disabled={busy}>{busy ? "Saving…" : kind === "refund" ? "Record refund" : "Record payment"}</button>
    </form>
  );
}

/** Payment records waiting on this phone for this booking: clearly marked "not synced". Orange while waiting, red only for one the server refused. */
export function QueuedPayments({ bookingId, people }: { bookingId: string; people?: Person[] }) {
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
  const who = (value: string) => {
    const hit = people?.find((p) => p.value === value);
    return { name: hit?.label ?? (value.startsWith("g:") ? value.slice(2) : ""), number: hit?.number ?? null };
  };
  const methodName = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;
  return (
    <section className="card pb-queue" aria-label="Payments not synced yet">
      <div className="pb-queue-head">
        <span className="pb-badge orange"><PbIcon name="clock" size={14} />NOT SYNCED</span>
        <b className="grow">{items.length} on this phone</b>
        <button type="button" className="btn ghost small" onClick={async () => { const r = await flushPayments(); setMsg(r.sent ? `Sent ${r.sent}.` : "Still waiting for a signal."); await load(); if (r.sent) router.refresh(); }}><PbIcon name="undo" size={16} />Send now</button>
      </div>
      <div className="pb-queue-list">
        {items.map((i) => {
          const w = who(i.payment.payer ?? "");
          const refused = i.status === "refused";
          return (
            <div key={i.id} className="pb-queue-item">
              <Shirt number={w.number} size="small" label={w.name || "Person"} />
              <span className="t grow">
                <b>{i.payment.kind === "refund" ? "Refund" : "Payment"} {money(Number(i.payment.amount.replace(/[,\s]/g, "")) || 0)}{w.name ? ` · ${w.name}` : ""}</b>
                {refused
                  ? <small className="pb-red"><PbIcon name="alert" size={14} />The server did not accept it: {i.reason}</small>
                  : <small className="pb-orange"><PbIcon name="clock" size={14} />Saved on this phone · waiting to sync</small>}
                <small className="muted">{i.payment.paidOn} · {methodName(i.payment.method ?? "")}</small>
              </span>
              {refused && <button type="button" className="btn red small" onClick={async () => { await removeQueuedPayment(i.id); await load(); }}><PbIcon name="trash" size={16} />Discard</button>}
            </div>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>Do not close this booking page until it has sent. Each one is sent by itself when you are back online.</p>
      {msg && <p className="muted small" role="status" style={{ margin: "6px 0 0" }}>{msg}</p>}
    </section>
  );
}

/* ---------- editing an existing payment record ---------- */
export function EditPaymentForm({ communityId, bookingId, paymentId, people, current, checkedBy, suggest, share = 0, payerLabel }: {
  communityId: string; bookingId: string; paymentId: string; people: Person[];
  current: { payer: string; kind: "payment" | "refund"; amount: number; paidOn: string; method: string; reference: string };
  /** Who checked the record earlier (it loses that check when saved), or null when nobody has. */
  checkedBy?: string | null;
  suggest?: Record<string, PayHint>; share?: number;
  /** Name for the removal sentences. */
  payerLabel?: string;
}) {
  const [state, action, pending] = useActionState(updatePaymentAction, initial);
  const snack = useSnackbar();
  const uid = useId();
  const [kind, setKind] = useState(current.kind);
  const [method, setMethod] = useState(current.method);
  const [payer, setPayer] = useState(current.payer);
  const [amount, setAmount] = useState(String(current.amount));
  const [paidOn, setPaidOn] = useState(current.paidOn);
  const [reference, setReference] = useState(current.reference);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fe = { ...(state.fieldErrors ?? {}), ...local };
  const hint = suggest?.[payer];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = { kind, amount, paidOn, method, reference, payer };
    const v = validatePayment(raw, new Date(), uuidOk);
    if (!v.ok) { setLocal(v.errors); return; }
    setLocal({});
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };

  const removeFd = () => {
    const fd = new FormData();
    fd.set("communityId", communityId); fd.set("bookingId", bookingId); fd.set("paymentId", paymentId);
    return fd;
  };
  const doRemove = () => startTransition(() => { void deletePaymentAction(removeFd()); });
  const startRemove = () => {
    if (checkedBy) { setConfirm(true); return; }
    // an unchecked record: the delete waits 8 seconds in the browser, so Undo is possible and the database is untouched until then
    setRemoving(true);
    snack.undoable({ message: "Record removed. It is gone for good in a few seconds.", ms: 8000, commit: doRemove, onUndo: () => setRemoving(false) });
  };

  if (removing) {
    return (
      <div className="pb-note mute" role="status">
        <PbIcon name="trash" size={18} />
        <span>This record is being removed. Press Undo at the bottom of the screen to keep it.</span>
      </div>
    );
  }
  const verb = kind === "refund" ? "refund" : "payment";
  return (
    <>
      <form onSubmit={onSubmit} noValidate className="card pb-form">
        <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="method" value={method} />
        {checkedBy && (
          <div className="pb-note gold" role="status">
            <PbIcon name="info" size={18} />
            <span><b>Saving will mark this as not checked again.</b> {checkedBy} checked it earlier.</span>
          </div>
        )}
        <KindTabs kind={kind} onChange={setKind} />
        <label className="lb" htmlFor={`${uid}-payer`}>{kind === "refund" ? "Refunded to" : "Who paid?"}</label>
        <select id={`${uid}-payer`} name="payer" className={`field${fe.payer ? " bad" : ""}`} value={payer} onChange={(e) => setPayer(e.target.value)}>
          {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          {!people.some((p) => p.value === current.payer) && <option value={current.payer}>{current.payer.slice(2)}</option>}
        </select>
        <FieldErr text={fe.payer} />
        <AmountBox id={`${uid}-amount`} name="amount" value={amount} onChange={setAmount} error={fe.amount} />
        <QuickChips
          items={kind === "refund" ? [{ label: "All they paid in", amount: hint?.paidIn ?? 0 }] : [{ label: "Suggested share", amount: share }, { label: "Still to suggested", amount: hint?.still ?? 0 }]}
          onPick={(n) => setAmount(String(n))} />
        <MethodChips value={method} onChange={setMethod} error={fe.method} />
        <div className="two pb-two">
          <div>
            <label className="lb" htmlFor={`${uid}-date`}>Date</label>
            <input id={`${uid}-date`} name="paidOn" type="date" className={`field${fe.paidOn ? " bad" : ""}`} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            <FieldErr text={fe.paidOn} />
          </div>
          <div>
            <label className="lb" htmlFor={`${uid}-ref`}>{refLabel(method)}</label>
            <input id={`${uid}-ref`} name="reference" className={`field${fe.reference ? " bad" : ""}`} value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} placeholder={refHint(method)} />
            <FieldErr text={fe.reference} />
          </div>
        </div>
        <p className="muted small" style={{ margin: "10px 2px" }}>Your name is saved with the change, and the old and new values go in the history. An edited record needs checking again.</p>
        {state.error && <div className="pb-note red" role="alert"><PbIcon name="alert" size={18} /><span>{state.error}</span></div>}
        <button className="btn gold pb-submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
      </form>

      <section className="card pb-remove">
        <h2>Remove this record</h2>
        <p className="muted small">Removed records disappear from the totals. The removal is written in the booking history.{checkedBy ? ` ${checkedBy} checked this one, so you will be asked to confirm.` : " You can undo it for a few seconds."}</p>
        <button type="button" className="btn red" onClick={startRemove}><PbIcon name="trash" size={18} />Remove record</button>
      </section>
      <ConfirmDialog
        open={confirm} danger confirmLabel={`Remove this ${verb}`} title="Remove a checked record?"
        body={<>{checkedBy} checked this {verb}. Removing it changes {payerLabel ? `${payerLabel}’s paid amount` : "the person’s paid amount"} and the checked total of the booking. The removal is written in the history and cannot be undone.</>}
        onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); doRemove(); }} />
    </>
  );
}
