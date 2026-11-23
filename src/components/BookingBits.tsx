// Phase 7: small pieces shared by the booking screens. Server components.
import { BOOKING_LABEL, money, type BookingStatus, type MemberStatus, STATUS_WORDS, type Summary } from "@/lib/payments";

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
