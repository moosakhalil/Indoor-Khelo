"use client";
// Phase F4 (UI redesign, payments): the parts of the booking page that need the browser. Every action here calls the SAME server action as
// before (record goes through the offline-capable API route; check, remove, remind, status and delete are the existing actions7 actions).
// Nothing here adds a permission: any approved member can do all of it, exactly as today.
import Link from "next/link";
import { startTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import { bookingStatusAction, deleteBookingAction, deletePaymentAction, remindPaymentsAction, verifyPaymentAction } from "@/app/actions7";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PaymentForm, type PayHint } from "@/components/Forms7";
import PbIcon from "@/components/PbIcons";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import { ownerReason } from "@/lib/ownerRule";
import { BOOKING_LABEL, money, type BookingStatus } from "@/lib/payments";
import "./pb.css";

/* ---------- record a payment: a sheet on a phone, a panel on a wide screen ---------- */
export type RecordDetail = { payer?: string; kind?: "payment" | "refund"; amount?: number };
const RECORD_EVENT = "pb-record";
type Person = { value: string; label: string; number?: number | null };
export type FormProps = { communityId: string; bookingId: string; people: Person[]; share: number; suggest: Record<string, PayHint>; remaining: number };

const wide = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1360px)").matches;

/** A button anywhere on the page that opens the record form, already set to a person, a kind or an amount. */
export function RecordTrigger({ detail, className, label, children }: { detail?: RecordDetail; className?: string; label?: string; children: React.ReactNode }) {
  return <button type="button" className={className} aria-label={label} onClick={() => window.dispatchEvent(new CustomEvent<RecordDetail>(RECORD_EVENT, { detail: detail ?? {} }))}>{children}</button>;
}

export function RecordSheet({ mode, form, autoOpen }: { mode: "sheet" | "panel"; form: FormProps; autoOpen?: RecordDetail | null }) {
  const snack = useSnackbar();
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [preset, setPreset] = useState<{ payer?: string; kind?: "payment" | "refund"; amount?: string }>({});
  const box = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<RecordDetail>).detail ?? {};
      if (mode === "sheet" && wide()) return;      // on a wide screen the panel on the right answers instead
      setPreset({ payer: d.payer, kind: d.kind, amount: d.amount && d.amount > 0 ? String(d.amount) : undefined });
      setNonce((n) => n + 1);
      if (mode === "sheet") { before.current = document.activeElement as HTMLElement | null; setOpen(true); }
      else setTimeout(() => document.querySelector<HTMLElement>(".pb-panel-card select")?.focus(), 0);
    };
    window.addEventListener(RECORD_EVENT, h);
    return () => window.removeEventListener(RECORD_EVENT, h);
  }, [mode]);

  useEffect(() => {
    if (mode === "sheet" && autoOpen) { const t = setTimeout(() => window.dispatchEvent(new CustomEvent<RecordDetail>(RECORD_EVENT, { detail: autoOpen })), 0); return () => clearTimeout(t); }
  }, [mode, autoOpen]);

  const close = useCallback(() => { setOpen(false); before.current?.focus?.(); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("select")?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const undoRecord = (id: string) => {
    const fd = new FormData();
    fd.set("communityId", form.communityId); fd.set("bookingId", form.bookingId); fd.set("paymentId", id);
    startTransition(() => { void deletePaymentAction(fd); });
  };
  const recorded = (info: { id: string; text: string }) => {
    if (mode === "sheet") setOpen(false);
    // The record is already saved. Undo takes it back out (and the history shows both lines).
    snack.undoable({ message: info.text, undoLabel: "Undo", ms: 8000, commit: () => {}, onUndo: () => undoRecord(info.id) });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const nodes = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select, input, a[href]") ?? []);
    if (!nodes.length) return;
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && at <= 0) { e.preventDefault(); nodes[nodes.length - 1]!.focus(); }
    else if (!e.shiftKey && at === nodes.length - 1) { e.preventDefault(); nodes[0]!.focus(); }
  };

  const body = <PaymentForm key={nonce} {...form} initial={preset} onRecorded={recorded} />;
  if (mode === "panel") {
    return (
      <section className="card pb-panel-card" aria-labelledby={`${titleId}-p`}>
        <h2 id={`${titleId}-p`}>Record a payment or refund</h2>
        <p className="muted small">Money is handed over outside the app. This only writes it down.</p>
        {body}
      </section>
    );
  }
  if (!open) return null;
  return (
    <div className="pb-sheet-wrap" onKeyDown={onKey}>
      <div className="pb-sheet-bg" aria-hidden="true" onClick={close} />
      <div ref={box} className="pb-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="pb-grab" aria-hidden="true" />
        <div className="pb-sheet-head">
          <div>
            <h2 id={titleId}>Record a payment</h2>
            <p className="muted small">Pick who paid, the amount and how. Money is handed over outside the app.</p>
          </div>
          <button type="button" className="pb-x" aria-label="Close" onClick={close}><PbIcon name="x" size={20} /></button>
        </div>
        {body}
      </div>
    </div>
  );
}

/* ---------- remind everyone ---------- */
export type DuePerson = { name: string; net: number };
export function RemindControl({ communityId, bookingId, venue, share, balance, due, guests, selfDue, waitMinutes, noPeople }: {
  communityId: string; bookingId: string; venue: string; share: number; balance: number; due: DuePerson[]; guests: string[]; selfDue: boolean; waitMinutes: number; noPeople: boolean;
}) {
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const send = () => {
    const fd = new FormData();
    fd.set("communityId", communityId); fd.set("bookingId", bookingId);
    startTransition(() => { void remindPaymentsAction(fd); });
  };
  let reason: string | null = null;
  let label = `Remind ${due.length}`;
  let disabled = false;
  if (waitMinutes > 0) { disabled = true; label = `Again in ${waitMinutes} min`; reason = "A reminder was sent recently. Reminders can go out once an hour."; }
  else if (noPeople) { disabled = true; label = "Nobody to remind"; reason = "Nobody is chosen yet. Choose who shares the cost first."; }
  else if (due.length === 0) { disabled = true; label = "All covered"; reason = "Everyone’s suggested share is covered, so there is nobody to remind."; }
  return (
    <>
      <button type="button" className="btn ghost pb-remind" disabled={disabled} aria-describedby={reason ? reasonId : undefined} onClick={() => setOpen(true)}>
        <PbIcon name="bell" size={18} />{label}
      </button>
      {reason && <p id={reasonId} className="pb-reason">{reason}</p>}
      <ConfirmDialog
        open={open} title={`Remind ${due.length} ${due.length === 1 ? "person" : "people"}?`} confirmLabel={`Send ${due.length} ${due.length === 1 ? "reminder" : "reminders"}`} cancelLabel="Not now"
        body={
          <>
            <p style={{ margin: "0 0 10px" }}>Each gets an in-app alert: “Reminder: {venue} still has {money(balance)} open. Your suggested share is {money(share)}. Paying is up to you and the group.” At most once an hour.</p>
            <ul className="pb-remind-list">
              {due.map((p) => <li key={p.name}><b>{p.name}</b><small>Paid {money(Math.max(0, p.net))} of {money(share)}</small></li>)}
            </ul>
            {guests.length > 0 && <p className="small" style={{ margin: "10px 0 0" }}>{guests.join(", ")} {guests.length === 1 ? "is a guest and has" : "are guests and have"} no account, so cannot be alerted.</p>}
            {selfDue && <p className="small" style={{ margin: "6px 0 0" }}>You are not alerted yourself.</p>}
          </>
        }
        onClose={() => setOpen(false)} onConfirm={() => { setOpen(false); send(); }} />
    </>
  );
}

/* ---------- one payment record ---------- */
export type RecordRowData = {
  id: string; payerName: string; payerHref: string | null; number: number | null; guest: boolean; kind: "payment" | "refund"; amount: number; methodLabel: string; paidOn: string; reference: string;
  recordedBy: string; changedBy: string | null; checkedBy: string | null;
  /** false: only the person who recorded it, or an Admin, may edit or remove it (lib/ownerRule.ts). Anyone may still mark it checked. Missing means yes. */
  canChange?: boolean;
};

export function PaymentRecordRow({ communityId, bookingId, base, r }: { communityId: string; bookingId: string; base: string; r: RecordRowData }) {
  const snack = useSnackbar();
  const [hidden, setHidden] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fd = (extra?: Record<string, string>) => {
    const f = new FormData();
    f.set("communityId", communityId); f.set("bookingId", bookingId); f.set("paymentId", r.id);
    for (const [k, v] of Object.entries(extra ?? {})) f.set(k, v);
    return f;
  };
  const doRemove = () => startTransition(() => { void deletePaymentAction(fd()); });
  const remove = () => {
    if (r.checkedBy) { setConfirm(true); return; }
    // an unchecked record: gone from the screen at once, deleted for real after 8 seconds unless Undo is pressed
    setHidden(true);
    snack.undoable({ message: `${r.kind === "refund" ? "Refund" : "Payment"} of ${money(r.amount)} removed.`, ms: 8000, commit: doRemove, onUndo: () => setHidden(false) });
  };
  const mine = r.canChange !== false;
  const items: ActionItem[] = [
    ...(mine ? [{ label: "Edit record", href: `${base}/pay/${r.id}` }] : []),
    { label: r.checkedBy ? "Mark not checked" : "Mark checked", onSelect: () => startTransition(() => { void verifyPaymentAction(fd({ on: r.checkedBy ? "0" : "1" })); }) },
    ...(mine ? [{ label: "Remove record", danger: true, onSelect: remove }] : []),
  ];
  if (hidden) return null;
  const refund = r.kind === "refund";
  return (
    <div className="pb-prec">
      <Shirt number={r.number} size="small" label={r.guest ? "Guest, no player number" : undefined} />
      <div className="pb-prec-main">
        <div className="pb-prec-top">
          <b className="pb-prec-name">{r.payerHref ? <Link href={r.payerHref}>{r.payerName}</Link> : r.payerName}{r.guest && <small className="muted"> (guest)</small>}</b>
          <b className={`pb-amt ${refund ? "refund" : "pay"}`}>{refund ? "−" : "+"}{money(r.amount)}</b>
        </div>
        <small className="muted">{refund ? "Refund" : "Paid"} · {r.methodLabel} · {r.paidOn}{r.reference ? ` · ${r.reference}` : ""}</small>
        <small className="muted">Recorded by {r.recordedBy}{r.changedBy && r.changedBy !== r.recordedBy ? `, changed by ${r.changedBy}` : ""}</small>
        {r.checkedBy
          ? <span className="pb-chk ok"><PbIcon name="check" size={14} />Checked by {r.checkedBy}</span>
          : <span className="pb-chk wait"><PbIcon name="clock" size={14} />Not checked yet</span>}
        {!r.checkedBy && (
          <form action={verifyPaymentAction}>
            <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="paymentId" value={r.id} /><input type="hidden" name="on" value="1" />
            <button className="pb-mark"><PbIcon name="check" size={16} />Mark checked</button>
          </form>
        )}
      </div>
      <ActionMenu items={items} label={`Actions for the ${money(r.amount)} record from ${r.payerName}`} />
      <ConfirmDialog
        open={confirm} danger title="Remove a checked record?" confirmLabel={`Remove this ${refund ? "refund" : "payment"}`}
        body={<>{r.checkedBy} checked this {money(r.amount)} {refund ? "refund" : "payment"}. Removing it {refund ? "adds the money back to" : "takes it off"} {r.payerName}’s paid amount and changes the checked total of the booking. The removal is written in the history and cannot be undone.</>}
        onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); doRemove(); }} />
    </div>
  );
}

/* ---------- booking status and delete ---------- */
const STATUS_ORDER: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"];

export function StatusControl({ communityId, bookingId, status }: { communityId: string; bookingId: string; status: BookingStatus }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = (s: BookingStatus) => {
    const fd = new FormData();
    fd.set("communityId", communityId); fd.set("bookingId", bookingId); fd.set("status", s);
    setBusy(true);
    startTransition(() => { void bookingStatusAction(fd); });
  };
  return (
    <>
      <div className="pb-segctl" role="radiogroup" aria-label="Booking status">
        {STATUS_ORDER.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={s === status} disabled={busy} className={`pb-segbtn${s === status ? " on" : ""}${s === "cancelled" ? " cancel" : ""}`}
            onClick={() => { if (s === status) return; if (s === "cancelled") setConfirm(true); else go(s); }}>
            {BOOKING_LABEL[s]}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>Cancelling keeps every payment record. Refunds are recorded by hand.</p>
      <ConfirmDialog
        open={confirm} danger title="Mark this booking cancelled?" confirmLabel="Mark cancelled"
        body={<>Reminders stop and a list of refunds to give back appears. Every payment record is kept. The app does not move money: refunds are given back by hand and written down here. You can change the status back later.</>}
        onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); go("cancelled"); }} />
    </>
  );
}

export function DeleteBooking({ communityId, bookingId, venue, when, canDelete = true, addedBy = null }: { communityId: string; bookingId: string; venue: string; when: string; canDelete?: boolean; addedBy?: string | null }) {
  const [open, setOpen] = useState(false);
  const go = () => {
    const fd = new FormData();
    fd.set("communityId", communityId); fd.set("bookingId", bookingId);
    startTransition(() => { void deleteBookingAction(fd); });
  };
  // Only the person who added the booking, or an Admin, can delete it (lib/ownerRule.ts).
  if (!canDelete) return <p className="pb-lock"><PbIcon name="lock" size={16} />{ownerReason("delete", addedBy)}</p>;
  return (
    <>
      <button type="button" className="btn red small pb-del" onClick={() => setOpen(true)}><PbIcon name="trash" size={16} />Delete booking</button>
      <ConfirmDialog
        open={open} danger title="Delete this booking?" confirmLabel="Delete booking"
        body={<>This deletes the booking at {venue} on {when}. It has no payment records, so no money is lost. Who was chosen to share the cost and any linked matches are removed with it. This cannot be undone.</>}
        onClose={() => setOpen(false)} onConfirm={() => { setOpen(false); go(); }} />
    </>
  );
}

/** The banner stays on the page; on a long page a toast at the bottom says it too. */
export function FlashToast({ message }: { message: string }) {
  const snack = useSnackbar();
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.documentElement.scrollHeight > window.innerHeight * 1.3) snack.show({ message, tone: "success" });
    // once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
