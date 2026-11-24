"use client";
// Phase D1: the lineups on the Match details page. One card per team (badge, "6 of 6 picked" and a progress bar), a gold shirt
// per member, a grey shirt with the name for a guest. A guest has a "Link to member" button that opens a search sheet; a guest
// that was linked has "Undo link". Both use the existing linkGuestAction / unlinkGuestAction (same permission checks, same notices).
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { linkGuestAction, unlinkGuestAction } from "@/app/actions4";
import { IconSearch } from "@/components/B4Icons";
import { MdLink } from "@/components/MdIcons";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { pickedPercent, pickedText } from "@/lib/md";
import "./md.css";

export type LineupRow = { id: string; name: string; userId: string | null; number: number | null; kind: "member" | "guest" | "linked"; sub: string };
export type LineupSide = { pos: 1 | 2; name: string; needed: number; mine: boolean; rows: LineupRow[] };
export type Linkable = { userId: string; name: string; number: number | null; role: string };

export default function MdLineups({ communityId, matchId, canPick, sides, linkable }: {
  communityId: string; matchId: string; canPick: boolean; sides: [LineupSide, LineupSide]; linkable: Linkable[];
}) {
  const [linking, setLinking] = useState<LineupRow | null>(null);
  return (
    <section className="md-lineups" aria-label="Lineups">
      {sides.map((side) => {
        const pct = pickedPercent(side.rows.length, side.needed);
        return (
          <div key={side.pos} className="md-card md-lcard">
            <div className="md-lhead">
              <span className={side.mine ? "md-own" : undefined}><TeamBadge name={side.name} size="sm" /></span>
              <span className="md-ltx"><b>{side.name}</b><small>{pickedText(side.rows.length, side.needed)}</small></span>
              {canPick && <Link href={`/c/${communityId}/matches/${matchId}/lineup`} className="md-pick">Pick lineups<span className="md-sr"> for {side.name}</span></Link>}
            </div>
            <div className="md-prog" role="progressbar" aria-label={`${side.name} lineup`} aria-valuemin={0} aria-valuemax={side.needed} aria-valuenow={Math.min(side.rows.length, side.needed)}><span className={pct >= 100 ? "full" : ""} style={{ width: `${pct}%` }} /></div>
            {side.rows.length === 0 && <p className="md-empty">No players picked yet.</p>}
            <ul className="md-rows">
              {side.rows.map((p) => (
                <li key={p.id} className="md-row">
                  <Shirt number={p.number} size="small" label={p.kind === "member" ? undefined : "Guest, no player number"} />
                  <span className="md-rtx">
                    {p.userId && p.kind === "member" ? <Link href={`/c/${communityId}/players/${p.userId}`}><b>{p.name}</b></Link> : <b>{p.name}</b>}
                    <small>{p.sub}</small>
                  </span>
                  {p.kind === "guest" && <button type="button" className="md-act" onClick={() => setLinking(p)}><MdLink size={16} />Link to member<span className="md-sr"> {p.name}</span></button>}
                  {p.kind === "linked" && (
                    <form action={unlinkGuestAction}>
                      <input type="hidden" name="communityId" value={communityId} />
                      <input type="hidden" name="matchId" value={matchId} />
                      <input type="hidden" name="entryId" value={p.id} />
                      <button className="md-act">Undo link<span className="md-sr"> for {p.name}</span></button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="muted small md-foot">Guest figures stay on this match&rsquo;s scorecard until a guest is linked to a member. The permanent squads are never changed by a lineup.</p>
      {linking && <LinkSheet key={linking.id} communityId={communityId} matchId={matchId} guest={linking} linkable={linkable} onClose={() => setLinking(null)} />}
    </section>
  );
}

function LinkSheet({ communityId, matchId, guest, linkable, onClose }: { communityId: string; matchId: string; guest: LineupRow; linkable: Linkable[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input[type=search]")?.focus();
    return () => before?.focus?.();
  }, []);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? linkable.filter((x) => x.name.toLowerCase().includes(t) || String(x.number ?? "").includes(t) || x.role.toLowerCase().includes(t)) : linkable;
  }, [q, linkable]);
  const chosen = linkable.find((x) => x.userId === pick) ?? null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const nodes = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not([type=hidden])") ?? []);
    if (!nodes.length) return;
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && at <= 0) { e.preventDefault(); nodes[nodes.length - 1]!.focus(); }
    else if (!e.shiftKey && at === nodes.length - 1) { e.preventDefault(); nodes[0]!.focus(); }
  };
  return (
    <div className="md-sheetwrap" onKeyDown={onKey}>
      <div className="md-sheetbg" aria-hidden="true" onClick={onClose} />
      <div ref={box} className="md-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="md-grip" aria-hidden="true" />
        <h2 id={titleId}>Link {guest.name} to a member</h2>
        <p className="md-help">Their figures from this match will count toward the member&rsquo;s career. You can undo the link.</p>
        <form action={linkGuestAction}>
          <input type="hidden" name="communityId" value={communityId} />
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="entryId" value={guest.id} />
          <input type="hidden" name="targetId" value={pick} />
          <label className="md-search"><IconSearch size={18} /><span className="md-sr">Search members</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" autoComplete="off" onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
          </label>
          <div className="md-pickList" role="radiogroup" aria-label="Members">
            {linkable.length === 0 && <p className="md-empty">Every member is already in this match, so there is nobody to link to.</p>}
            {linkable.length > 0 && shown.length === 0 && <p className="md-empty">Nobody matches “{q}”.</p>}
            {shown.map((x) => (
              <button key={x.userId} type="button" role="radio" aria-checked={pick === x.userId} className={`md-opt${pick === x.userId ? " on" : ""}`} onClick={() => setPick(x.userId)}>
                <Shirt number={x.number} size="small" />
                <span className="md-rtx"><b>{x.name}</b><small>{x.number !== null ? `#${x.number} · ` : ""}{x.role}</small></span>
                <span className="md-radio" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="md-sheetact">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn gold" disabled={!chosen}>{chosen ? `Link to ${chosen.name}` : "Choose a member"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
