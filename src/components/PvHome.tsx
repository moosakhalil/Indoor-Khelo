"use client";
// Phase F3: Payments home. A list of bookings with the money first (ring, "PKR 8,500 of PKR 12,000", who still owes), filter tabs, one gold
// "New booking", and on a wide screen a preview of the selected booking beside the list. Paying is a convenience: nothing here bills anyone.
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconPin } from "@/components/CrIcons";
import { IconPlus } from "@/components/B4Icons";
import { IconArrow, IconWallet } from "@/components/PvIcons";
import { MemberPill, OkBanner, Ring, StatusBadge } from "@/components/PvParts";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import { money } from "@/lib/payments";
import { cardLine, defaultSelected, filterTab, sharingText, type PvTab } from "@/lib/pv";
import type { PvBooking } from "@/lib/pvData";
import "./pv.css";

const TABS: { id: PvTab; label: string }[] = [{ id: "all", label: "All" }, { id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past and cancelled" }];
const wide = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1280px)").matches;

const STEPS = ["Venue", "Booking", "People", "Payments"];

export default function PvHome({ communityId, upcoming, past, venueCount, deleted }: { communityId: string; upcoming: PvBooking[]; past: PvBooking[]; venueCount: number; deleted: boolean }) {
  const snack = useSnackbar();
  const [tab, setTab] = useState<PvTab>("all");
  const ordered = [...upcoming, ...past];
  const [sel, setSel] = useState<string | null>(defaultSelected(ordered));
  useEffect(() => { if (deleted) snack.show({ message: "Booking deleted.", tone: "success" }); }, [deleted]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = `/c/${communityId}/payments`;
  const banner = deleted ? <OkBanner>Booking deleted.</OkBanner> : null;
  const rule = <p className="pv-rule">Payment records are only visible to members of this community, and only here. They never appear on stats pages and never change scores.</p>;

  // ---- first time: no bookings at all ----
  if (ordered.length === 0) {
    const hasVenue = venueCount > 0;
    return (
      <div className="pv-root stack">
        {banner}
        <div className="pv-start">
          <span className="pv-start-ic"><IconWallet size={26} /></span>
          <h2>No bookings yet</h2>
          <p className="muted">Add the venue you play at, then create a booking with the date, time and cost. Choose who shares the cost and record what people pay. Paying is up to the group: nobody is forced, and one person can cover it all.</p>
          {hasVenue ? (
            <>
              <Link href={`${base}/new`} className="btn gold pv-start-btn"><IconPlus size={18} /> 1 · Create a booking</Link>
              <Link href={`${base}/venues`} className="btn ghost pv-start-btn"><IconPin size={18} /> Venues ({venueCount})</Link>
            </>
          ) : (
            <>
              <Link href={`${base}/venues`} className="btn gold pv-start-btn"><IconPin size={18} /> 1 · Add your venue</Link>
              <span className="btn ghost pv-start-btn pv-dim" aria-disabled="true"><IconPlus size={18} /> 2 · Create a booking</span>
            </>
          )}
          <ol className="pv-steps pv-start-steps" aria-label="The four steps">
            {STEPS.map((s, i) => <li key={s} className={i === (hasVenue ? 1 : 0) ? "now" : i < (hasVenue ? 1 : 0) ? "done" : ""}><span>{s}</span></li>)}
          </ol>
        </div>
        {rule}
      </div>
    );
  }

  const visible = filterTab(ordered, tab);
  const shown = visible.find((b) => b.id === sel) ?? visible[0] ?? null;
  const counts = { all: ordered.length, upcoming: upcoming.length, past: past.length };
  const showUp = tab !== "past", showPast = tab !== "upcoming";
  const pick = (id: string) => (e: React.MouseEvent) => { if (wide()) { e.preventDefault(); setSel(id); } };

  const card = (b: PvBooking) => {
    const line = cardLine({ status: b.status, total: b.total, contributed: b.contributed, members: b.members, owing: b.owing, overBy: b.overBy });
    const on = shown?.id === b.id;
    return (
      <li key={b.id}>
        <Link href={`${base}/${b.id}`} className={`pv-card${on ? " on" : ""}${b.status === "cancelled" ? " off" : ""}`} onClick={pick(b.id)} aria-current={on ? "true" : undefined}>
          <Ring percent={b.percent} />
          <span className="pv-card-b">
            <b className="pv-card-n">{b.venue}</b>
            <small className="muted">{b.whenText} · {b.duration} min</small>
            <span className="pv-card-m"><b className="pv-num">{money(b.contributed)}</b> <small className="muted">of {money(b.total)}</small></span>
            <span className="pv-card-f">
              <StatusBadge status={b.status} />
              <small className="pv-card-l"><span className="muted">{sharingText(b.members)}</span>{" · "}<span className={`pv-tone ${line.tone}`}>{line.text}</span></small>
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="pv-root pv-wide">
      <div className="stack">
        {banner}
        <div className="pv-top">
          <div className="pv-seg" role="group" aria-label="Show bookings">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-pressed={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label} <span className="pv-seg-n">{counts[t.id]}</span></button>
            ))}
          </div>
          <Link href={`${base}/new`} className="btn gold pv-newtop"><IconPlus size={18} /> New booking</Link>
        </div>
      </div>
      <div className="pv-split">
        <div className="pv-listcol stack">
          {showUp && (upcoming.length > 0 ? (
            <section aria-label="Upcoming bookings"><h2 className="pv-h">Upcoming · {upcoming.length}</h2><ul className="pv-list">{upcoming.map(card)}</ul></section>
          ) : tab === "all" ? <p className="pv-none">Nothing upcoming right now. <Link href={`${base}/new`}>Create a booking</Link></p> : (
            <div className="pv-empty"><b>No upcoming bookings</b><p className="muted">Pending and confirmed bookings show here.</p><Link href={`${base}/new`} className="btn gold small">New booking</Link></div>
          ))}
          {showPast && past.length > 0 && <section aria-label="Past and cancelled bookings"><h2 className="pv-h">Past and cancelled · {past.length}</h2><ul className="pv-list">{past.map(card)}</ul></section>}
          {tab === "past" && past.length === 0 && <div className="pv-empty"><b>No past or cancelled bookings</b><p className="muted">Completed and cancelled bookings show here.</p></div>}
          {rule}
        </div>
        {shown && <Preview b={shown} base={base} />}
      </div>
      <Link href={`${base}/new`} className="pv-fab"><IconPlus size={18} /> New booking</Link>
    </div>
  );
}

/** The selected booking beside the list (wide screens only). Everything here comes from the booking's own money figures. */
function Preview({ b, base }: { b: PvBooking; base: string }) {
  const waiting = Math.max(0, b.contributed - b.verified);
  const pct = (n: number) => (b.total > 0 ? Math.min(100, (Math.max(0, n) * 100) / b.total) : 0);
  const checked = Math.min(100, pct(b.verified)), wait = Math.min(100 - checked, pct(waiting));
  const cover = b.toCover;
  return (
    <aside className="pv-prev" aria-label="Selected booking">
      <p className="pv-eyebrow">Selected booking</p>
      <div className="row space pv-prev-h">
        <div className="grow"><h2>{b.venue}</h2><small className="muted">{b.whenText} · {b.duration} min</small></div>
        <StatusBadge status={b.status} />
      </div>
      <div className="pv-prev-card">
        <div className="row" style={{ gap: 14 }}>
          <Ring percent={b.percent} size={72} />
          <div><small className="pv-eyebrow">Contributed</small><div className="pv-big">{money(b.contributed)}</div><small className="muted">of {money(b.total)} total cost</small></div>
        </div>
        <div className="pv-bar" role="img" aria-label={`Checked ${money(b.verified)}, waiting for check ${money(waiting)}, still open ${money(b.balance)}`}>
          <span className="ck" style={{ width: `${checked}%` }} /><span className="wt" style={{ width: `${wait}%` }} />
        </div>
        <p className="pv-legend"><span><i className="ck" /> Checked {money(b.verified)}</span><span><i className="wt" /> Waiting for check {money(waiting)}</span><span><i className="op" /> {b.overBy > 0 ? `Over the cost by ${money(b.overBy)}` : `Still open ${money(b.balance)}`}</span></p>
        <p className="pv-note">{b.members > 0
          ? <><b>Suggested share: {money(b.share)} each</b> · {b.members} {b.members === 1 ? "person" : "people"}{b.extra > 0 ? ` (rounded up, ${money(b.extra)} extra)` : ""}<br /><span className="muted">Only a suggestion. Some pay more, some less, or one person covers it all.</span></>
          : <span className="muted">Nobody has been chosen to share the cost yet. Paying is up to the group.</span>}</p>
      </div>
      {b.status === "cancelled" && b.contributed > 0 && <p className="pv-note gold">This booking is cancelled. Refunds are done by hand, outside the app, and then recorded here.</p>}
      {b.members > 0 && b.status !== "cancelled" && (
        <section className="pv-cover" aria-label="Still to cover">
          <h3>Still to cover <span className="muted">({b.balance === 0 ? 0 : cover.length})</span></h3>
          {b.balance === 0 || cover.length === 0 ? <p className="muted pv-ok">All covered. The full cost has been contributed.</p> : (
            <ul>
              {cover.slice(0, 6).map((p) => (
                <li key={p.key}>
                  <Shirt number={p.guest ? null : p.number} size="normal" label={p.guest ? `${p.name}, guest` : undefined} />
                  <span className="grow pv-cover-t"><b>{p.name}{p.guest ? " (guest)" : ""}</b><small className="muted">Paid {money(Math.max(0, p.net))} of {money(p.share)}</small></span>
                  <MemberPill status={p.status} />
                </li>
              ))}
            </ul>
          )}
          {cover.length > 6 && <p className="muted small" style={{ margin: "8px 0 0" }}>And {cover.length - 6} more. Open the booking to see everyone.</p>}
        </section>
      )}
      <div className="pv-prev-a">
        <Link href={`${base}/${b.id}`} className="btn gold">Open booking <IconArrow size={16} /></Link>
        <Link href={`${base}/${b.id}?record=me`} className="btn ghost"><IconPlus size={16} /> Record payment</Link>
      </div>
    </aside>
  );
}
