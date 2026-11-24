// Phase F3: small shared pieces of the Payments screens (no hooks, safe in server and client components).
import { IconCheck, IconCross, IconWarn } from "@/components/B4Icons";
import { IconClock } from "@/components/CrIcons";
import { IconFlag } from "@/components/PvIcons";
import { BOOKING_LABEL, STATUS_WORDS, type BookingStatus, type MemberStatus } from "@/lib/payments";
import { venueInitials } from "@/lib/pv";
import "./pv.css";

/** Progress ring with the percentage printed inside, so nothing is colour only. */
export function Ring({ percent, size = 56, label }: { percent: number; size?: number; label?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const r = 22, c = 2 * Math.PI * r;
  return (
    <span className="pv-ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${p} percent contributed`}>
      <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true" focusable="false">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="pv-ring-bg" />
        {p > 0 && <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="pv-ring-fg" strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 28 28)" />}
      </svg>
      <b className="pv-ring-n" aria-hidden="true">{p}<small>%</small></b>
    </span>
  );
}

const STATUS_ICON: Record<BookingStatus, React.ReactNode> = {
  pending: <IconClock size={14} />, confirmed: <IconCheck size={14} />, completed: <IconFlag size={14} />, cancelled: <IconCross size={14} />,
};
/** Booking status as an icon plus a word (never colour alone). */
export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`pv-status ${status}`}>{STATUS_ICON[status]}{BOOKING_LABEL[status].toUpperCase()}</span>;
}

/** Gold initials mark for a venue (venues have no picture). */
export function VenueMark({ name, size = 44 }: { name: string; size?: number }) {
  return <span className="pv-mark" style={{ width: size, height: size, fontSize: size > 50 ? "1.2rem" : "0.9rem" }} aria-hidden="true">{venueInitials(name)}</span>;
}

/** A red banner with an alert icon (never colour only). */
export function AlertBanner({ children, retry }: { children: React.ReactNode; retry?: React.ReactNode }) {
  return (
    <div className="pv-banner red" role="alert" tabIndex={-1} data-pv-summary>
      <IconWarn size={18} />
      <div className="pv-banner-t">{children}</div>
      {retry}
    </div>
  );
}
export function OkBanner({ children }: { children: React.ReactNode }) {
  return <div className="pv-banner green" role="status"><IconCheck size={18} /><div className="pv-banner-t">{children}</div></div>;
}

/** A field error with an alert icon. `id` is used by aria-describedby on the field. */
export function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p className="pv-err" id={id}><IconWarn size={15} /><span>{text}</span></p> : null;
}

/** The three steps of a new booking: Details now, then Who shares and Payments (they are chosen after saving). */
export function StepBar({ now = 1 }: { now?: number }) {
  const steps = ["Details", "Who shares", "Payments"];
  return (
    <ol className="pv-steps" aria-label={`Step ${now} of 3`}>
      {steps.map((s, i) => <li key={s} className={i + 1 === now ? "now" : i + 1 < now ? "done" : ""} aria-current={i + 1 === now ? "step" : undefined}><span>{s}</span></li>)}
    </ol>
  );
}

const PILL: Record<MemberStatus, string> = { unpaid: "red", pending: "orange", partial: "orange", paid: "green" };
/** One person's status as words (Unpaid, Pending check, Partly paid, Paid), never colour alone. */
export function MemberPill({ status }: { status: MemberStatus }) {
  return <span className={`pill ${PILL[status]}`}>{STATUS_WORDS[status].toUpperCase()}</span>;
}
