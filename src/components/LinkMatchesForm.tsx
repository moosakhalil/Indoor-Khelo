"use client";
// Phase F4 (UI redesign, payments): "Link matches to a booking". Posts to the SAME action as before (linkMatchesAction): one `match`
// value per ticked match. Saving with nothing ticked clears the links. Linking never changes a score or a statistic.
import Link from "next/link";
import { useState } from "react";
import { linkMatchesAction } from "@/app/actions7";
import PbIcon from "@/components/PbIcons";
import TeamBadge from "@/components/TeamBadge";
import { splitTeams } from "@/lib/pbBooking";
import "./pb.css";

export type LinkMatch = { id: string; name: string; status: string; statusLabel: string; when: string };
type Tab = "all" | "scheduled" | "completed";

export default function LinkMatchesForm({ communityId, bookingId, matches, linked, createHref }: {
  communityId: string; bookingId: string; matches: LinkMatch[]; linked: string[]; createHref: string;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(linked));
  const [tab, setTab] = useState<Tab>("all");
  const counts = { all: matches.length, scheduled: matches.filter((m) => m.status === "scheduled").length, completed: matches.filter((m) => m.status === "completed").length };
  const shown = matches.filter((m) => tab === "all" || m.status === tab);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const n = picked.size;

  return (
    <form action={linkMatchesAction} className="stack pb-link">
      <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="bookingId" value={bookingId} />
      {Array.from(picked).map((id) => <input key={id} type="hidden" name="match" value={id} />)}
      <p className="muted" style={{ margin: 0 }}>Choose the matches played in this booking: one, or several (for example three on a Saturday).</p>

      {matches.length === 0 ? (
        <div className="card pb-empty">
          <PbIcon name="calendar" size={28} />
          <p><b>No matches yet.</b> Create a match first, then link it here.</p>
          <Link href={createHref} className="btn gold small"><PbIcon name="plus" size={16} />Create a match</Link>
        </div>
      ) : (
        <>
          <div className="pb-ftabs" role="tablist" aria-label="Filter matches">
            {(["all", "scheduled", "completed"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`pb-ftab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
                {t === "all" ? "All" : t === "scheduled" ? "Scheduled" : "Completed"} <b>{counts[t]}</b>
              </button>
            ))}
          </div>
          <section className="card">
            {shown.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No {tab} matches.</p> : (
              <div className="pb-members">
                {shown.map((m) => {
                  const t = splitTeams(m.name);
                  const on = picked.has(m.id);
                  return (
                    <label key={m.id} className={`pb-mem pb-lm${on ? " on" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(m.id)} />
                      <span className="pb-tick" aria-hidden="true">{on && <PbIcon name="check" size={16} />}</span>
                      {t ? <span className="pb-pair"><TeamBadge name={t[0]} size="sm" /><TeamBadge name={t[1]} size="sm" /></span> : null}
                      <span className="grow pb-lm-t"><b>{m.name}</b><small className="muted">{m.when}</small></span>
                      <span className={`pb-badge ${m.status === "completed" ? "green" : m.status === "scheduled" ? "blue" : ""}`}>
                        <PbIcon name={m.status === "completed" ? "check" : "clock"} size={13} />{m.statusLabel.toUpperCase()}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <div className="pb-sticky">
        <div className="pb-sum" aria-live="polite">
          <b>{n} {n === 1 ? "match" : "matches"} linked</b>
          <small className="muted">{n === 0 ? "Saving with nothing ticked clears the links. " : ""}Linking never changes a score or statistic.</small>
        </div>
        <button className="btn gold pb-save"><PbIcon name="check" size={18} />Save linked matches</button>
      </div>
    </form>
  );
}
