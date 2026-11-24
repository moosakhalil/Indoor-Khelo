"use client";
// Phase F4 (UI redesign, payments): the rows of "My payments" with the All / To cover / Paid tabs. The numbers come from myPayments() in
// bookings.ts (unchanged); this only arranges them. A booking is "to cover" by the same rule as "Still suggested": I am in the sharing
// list, it is not cancelled and my suggested share is not reached.
import Link from "next/link";
import { useState } from "react";
import PbIcon from "@/components/PbIcons";
import { StatusBadge } from "@/components/BookingBits";
import { BOOKING_LABEL, memberStatus, money, type BookingStatus } from "@/lib/payments";
import { needsCover } from "@/lib/pbBooking";
import "./pb.css";

export type MyRow = { bookingId: string; venue: string; when: string; status: BookingStatus; owner: "member" | "payer"; share: number; paid: number; checked: number };
type Tab = "all" | "cover" | "paid";

export default function MyPaymentsView({ communityId, rows }: { communityId: string; rows: MyRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const cover = rows.filter(needsCover);
  const shown = tab === "all" ? rows : tab === "cover" ? cover : rows.filter((r) => !needsCover(r));
  const counts = { all: rows.length, cover: cover.length, paid: rows.length - cover.length };
  return (
    <>
      <div className="pb-ftabs" role="tablist" aria-label="Filter my bookings">
        {(["all", "cover", "paid"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`pb-ftab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
            {t === "all" ? "All" : t === "cover" ? "To cover" : "Paid"} <b>{counts[t]}</b>
          </button>
        ))}
      </div>
      <section className="card">
        {shown.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>{tab === "cover" ? "Nothing left to cover." : "Nothing here."}</p>
        ) : (
          <div className="pb-rows">
            {shown.map((r) => {
              const base = `/c/${communityId}/payments/${r.bookingId}`;
              const toCover = needsCover(r);
              return (
                <div key={r.bookingId} className="pb-my">
                  <Link href={base} className="pb-my-main">
                    <span className="t grow">
                      <b>{r.venue}</b>
                      <small className="muted">{r.when}{r.status === "pending" || r.status === "confirmed" ? ` · ${BOOKING_LABEL[r.status]}` : ""}</small>
                      <small className="muted">{r.owner === "member" ? <>Suggested <b className="pb-n">{money(r.share)}</b> · </> : null}Paid <b className="pb-n">{money(Math.max(0, r.paid))}</b></small>
                      <span className="pb-badges">
                        {r.owner === "member" ? <StatusBadge status={memberStatus(r.share, r.paid, r.checked)} /> : <span className="pb-badge blue"><PbIcon name="users" size={14} />PAID FOR OTHERS</span>}
                        {r.status === "completed" && <span className="pb-badge gold"><PbIcon name="flag" size={14} />COMPLETED</span>}
                        {r.status === "cancelled" && <span className="pb-badge red"><PbIcon name="ban" size={14} />CANCELLED</span>}
                      </span>
                    </span>
                    <PbIcon name="chevron" size={18} />
                  </Link>
                  {toCover && <Link href={`${base}?record=me`} className="btn ghost small pb-my-pay"><PbIcon name="wallet" size={16} />Record my payment</Link>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
