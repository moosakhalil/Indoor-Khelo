// Phase 7: small pieces shared by the booking screens. Server components.
// Phase F4 (UI redesign) adds the money card with a ring, the status badges with an icon and the hint box. The first three exports
// (BookingStatusChip, StatusPill, MoneyCard) are unchanged because the Payments list still uses them.
import PbIcon, { type PbIconName } from "@/components/PbIcons";
import Shirt from "@/components/Shirt";
import { BOOKING_LABEL, money, type BookingStatus, type MemberStatus, STATUS_WORDS, type Summary } from "@/lib/payments";
import { heroNumbers } from "@/lib/pbBooking";
import "./pb.css";

const TONE: Record<BookingStatus, string> = { pending: "", confirmed: "green", cancelled: "red", completed: "gold" };
export function BookingStatusChip({ status }: { status: BookingStatus }) {
  return <span className={`chip ${TONE[status]}`}>{BOOKING_LABEL[status]}</span>;
}

const PILL: Record<MemberStatus, string> = { unpaid: "red", pending: "orange", partial: "orange", paid: "green" };
/** Statuses are always words, never colour alone. */
export function StatusPill({ status }: { status: MemberStatus }) {
  return <span className={`pill ${PILL[status]}`}>{STATUS_WORDS[status].toUpperCase()}</span>;
}

/** Total cost, what has been contributed, what is still open, with a progress bar. */
export function MoneyCard({ s, share, people, surplusAmount }: { s: Summary; share: number; people: number; surplusAmount: number }) {
  return (
    <section className="card">
      <div className="row space"><b>Cost</b><b style={{ fontSize: "1.2rem" }}>{money(s.total)}</b></div>
      <div className="progress" role="progressbar" aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.percent} percent contributed`}><span style={{ width: `${s.percent}%` }} /></div>
      <div className="two" style={{ marginTop: 10 }}>
        <div><small className="muted">Contributed</small><br /><b style={{ color: "#4be38a", fontSize: "1.1rem" }}>{money(s.contributed)}</b></div>
        <div style={{ textAlign: "right" }}>
          <small className="muted">{s.overBy > 0 ? "Over the cost by" : "Still open"}</small><br />
          <b style={{ fontSize: "1.1rem", color: s.overBy > 0 ? "var(--gold)" : s.balance > 0 ? "var(--orange)" : "#4be38a" }}>{money(s.overBy > 0 ? s.overBy : s.balance)}</b>
        </div>
      </div>
      {s.refunded > 0 && <p className="muted small" style={{ margin: "6px 0 0" }}>{money(s.refunded)} has been refunded.</p>}
      {people > 0 ? (
        <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
          Suggested share if {people} {people === 1 ? "person shares" : "people share"}: <b style={{ color: "var(--white)" }}>{money(share)}</b> each
          {surplusAmount > 0 ? ` (rounded up, so ${money(surplusAmount)} extra is collected)` : ""}. It is only a suggestion: paying is up to the group. Some can pay more, some less, or one person can cover it all.
        </p>
      ) : <p className="muted small" style={{ margin: "8px 0 0" }}>Choose who shares the cost to see a suggested share. Paying is up to the group.</p>}
    </section>
  );
}

/* ---------- Phase F4 ---------- */
const MEMBER_ICON: Record<MemberStatus, PbIconName> = { paid: "check", pending: "clock", partial: "half", unpaid: "alert" };
/** A person's status as an icon and a word (never colour alone). */
export function StatusBadge({ status }: { status: MemberStatus }) {
  return <span className={`pb-badge ${PILL[status]}`}><PbIcon name={MEMBER_ICON[status]} size={14} />{STATUS_WORDS[status].toUpperCase()}</span>;
}

const BOOKING_ICON: Record<BookingStatus, PbIconName> = { pending: "clock", confirmed: "check", completed: "flag", cancelled: "ban" };
const BOOKING_TONE: Record<BookingStatus, string> = { pending: "orange", confirmed: "green", completed: "gold", cancelled: "red" };
/** The booking's own status (Pending, Confirmed, Completed, Cancelled) as an icon and a word. */
export function BookingBadge({ status }: { status: BookingStatus }) {
  return <span className={`pb-badge ${BOOKING_TONE[status]}`}><PbIcon name={BOOKING_ICON[status]} size={14} />{BOOKING_LABEL[status].toUpperCase()}</span>;
}

const R = 40, C = 2 * Math.PI * R;
/** The ring with the percent in it. Tone decides the colour; the words around it say the same thing. */
export function MoneyRing({ percent, tone }: { percent: number; tone: "empty" | "partial" | "full" | "over" | "held" }) {
  const pct = tone === "over" || tone === "full" ? 100 : Math.max(0, Math.min(100, percent));
  const colour = tone === "full" ? "var(--green)" : tone === "held" ? "var(--mute)" : "var(--gold)";
  return (
    <div className="pb-ring" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${percent} percent contributed`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="11" stroke={tone === "empty" ? "var(--red)" : "var(--line)"} opacity={tone === "empty" ? 0.55 : 1} />
        {pct > 0 && <circle cx="50" cy="50" r={R} fill="none" strokeWidth="11" stroke={colour} strokeLinecap="round" strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 50 50)" />}
      </svg>
      <span className="pb-ring-n">{tone === "held" ? <PbIcon name="wallet" size={24} /> : <>{percent}<small>%</small></>}</span>
    </div>
  );
}

/** The money first: ring, big numbers, a three-part bar with its legend, and the hint about the suggested share. `actions` holds the Record and Remind buttons. */
export function MoneyHero({ s, status, share, people, surplusAmount, actions }: { s: Summary; status: BookingStatus; share: number; people: number; surplusAmount: number; actions?: React.ReactNode }) {
  const cancelled = status === "cancelled";
  const h = heroNumbers(s, cancelled);
  return (
    <section className="card pb-hero" id="money" aria-label="The money">
      <div className="pb-hero-top"><span className="pb-eyebrow">Booking status</span><BookingBadge status={status} /></div>
      <div className="pb-hero-main">
        <MoneyRing percent={h.percent} tone={h.tone} />
        <div className="pb-hero-num">
          <span className="pb-eyebrow">{h.bigLabel}</span>
          <b className={`pb-big${h.tone === "over" ? " gold" : ""}`}>{money(h.big)}</b>
          {h.ofLine && <small className="muted">{h.ofLine}</small>}
        </div>
      </div>
      <div className="pb-bar" aria-hidden="true">
        <span className="pb-seg checked" style={{ width: `${h.bar.checked}%` }} />
        <span className="pb-seg waiting" style={{ width: `${h.bar.waiting}%` }} />
      </div>
      <ul className="pb-legend">
        <li><i className="pb-dot checked" />Checked <b>{money(h.checked)}</b></li>
        <li><i className="pb-dot waiting" />Waiting for check <b>{money(h.waiting)}</b></li>
        {!cancelled && h.over > 0 ? <li><i className="pb-dot over" />Over by <b className="gold">{money(h.over)}</b></li>
          : !cancelled ? <li><i className="pb-dot open" />Still open <b>{money(h.open)}</b></li> : null}
        {h.refunded > 0 && <li><i className="pb-dot refunded" />Refunded by hand <b>{money(h.refunded)}</b></li>}
      </ul>
      {cancelled ? (
        <div className="pb-hint"><PbIcon name="info" size={18} /><div><b>Cancelled.</b> The money listed here is still with the people who paid. Refunds are given back by hand and recorded below.</div></div>
      ) : people > 0 ? (
        <div className="pb-hint">
          <PbIcon name="info" size={18} />
          <div>
            <b>Suggested share: {money(share)} each</b> · {people} {people === 1 ? "person" : "people"}
            {surplusAmount > 0 && <span className="pb-round"> Rounded up, so {money(surplusAmount)} extra is collected.</span>}
            <span className="pb-sub">Only a suggestion. Some pay more, some less, or one person covers it all. Paying is up to the group.</span>
          </div>
        </div>
      ) : (
        <div className="pb-hint"><PbIcon name="info" size={18} /><div>Choose who shares the cost to see a suggested share. Paying is up to the group.</div></div>
      )}
      {actions}
    </section>
  );
}

/** A message on the page: icon, words and a coloured edge. `red` is for refusals only; a friendly notice is never red. */
export function Notice({ tone, children, role, action }: { tone: "green" | "gold" | "red" | "mute"; children: React.ReactNode; role?: "status" | "alert"; action?: React.ReactNode }) {
  const icon: PbIconName = tone === "green" ? "check" : tone === "red" ? "alert" : "info";
  return (
    <div className={`pb-banner ${tone}`} role={role ?? (tone === "red" ? "alert" : "status")}>
      <PbIcon name={icon} size={18} />
      <span className="grow">{children}</span>
      {action}
    </div>
  );
}

/** One payment record, shown first on the Edit page: who, the signed amount, method, date, whether it is checked and who recorded it. */
export function RecordSummary({ name, number, guest, kind, amount, methodLabel, paidOn, checkedBy, recordedBy, changedBy, className }: {
  name: string; number: number | null; guest: boolean; kind: "payment" | "refund"; amount: number; methodLabel: string; paidOn: string; checkedBy: string | null; recordedBy: string; changedBy: string | null; className?: string;
}) {
  const refund = kind === "refund";
  return (
    <section className={`card pb-recsum ${className ?? ""}`} aria-label="The record">
      <Shirt number={number} size="normal" label={guest ? "Guest, no player number" : undefined} />
      <div className="grow">
        <b>{name}{guest ? " (guest)" : ""}</b>
        <b className={`pb-amt big ${refund ? "refund" : "pay"}`}>{refund ? "−" : "+"}{money(amount)}</b>
        <small className="muted">{refund ? "Refund" : "Payment"} · {methodLabel} · {paidOn}</small>
        <div className="pb-recsum-state">
          {checkedBy ? <span className="pb-chk ok"><PbIcon name="check" size={14} />Checked by {checkedBy}</span> : <span className="pb-chk wait"><PbIcon name="clock" size={14} />Not checked yet</span>}
          <small className="muted">Recorded by {recordedBy}{changedBy && changedBy !== recordedBy ? `, changed by ${changedBy}` : ""}</small>
        </div>
      </div>
    </section>
  );
}
