"use client";

// Phase F5: the filters of the Player page. Same fields and same address parameters as before (scope, team, series, from, to; the tab is kept).
// On a phone they open in a bottom sheet; at 1360 px and wider the same form sits in the right-hand panel.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import PfIcon from "@/components/PfIcons";
import "./pf.css";

export type PfFilterState = { allCommunities: boolean; teamId: string | null; seriesId: string | null; from: string | null; to: string | null };
type Named = { id: string; name: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09-01" as "1 Sep 2026" (worked out from the text, so the server and the browser always agree). */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1] ?? ""} ${y}`;
}

export function filterCount(s: PfFilterState): number {
  return (s.allCommunities ? 1 : 0) + (s.teamId ? 1 : 0) + (s.seriesId ? 1 : 0) + (s.from || s.to ? 1 : 0);
}

/** The fields. Posts as a GET form so the filters stay in the address. */
export function PfFilterFields({ prefix, tab, state, teams, series, onCancel, clearHref }: {
  prefix: string; tab: string; state: PfFilterState; teams: Named[]; series: Named[]; onCancel?: () => void; clearHref: string;
}) {
  const f = (k: string) => `${prefix}-${k}`;
  return (
    <form method="get" aria-label="Filter the statistics" className="pf-ffields">
      <input type="hidden" name="tab" value={tab} />
      <label className="lb" htmlFor={f("scope")}>Where</label>
      <select id={f("scope")} name="scope" className="field" defaultValue={state.allCommunities ? "all" : "community"}>
        <option value="community">This community</option>
        <option value="all">All time, every community</option>
      </select>
      <label className="lb" htmlFor={f("team")}>Team</label>
      <select id={f("team")} name="team" className="field" defaultValue={state.teamId ?? ""}>
        <option value="">Any team</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {series.length > 0 && (
        <>
          <label className="lb" htmlFor={f("series")}>Series</label>
          <select id={f("series")} name="series" className="field" defaultValue={state.seriesId ?? ""}>
            <option value="">Any match</option>
            {series.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </>
      )}
      <div className="two">
        <div><label className="lb" htmlFor={f("from")}>From</label><input id={f("from")} type="date" name="from" className="field" defaultValue={state.from ?? ""} /></div>
        <div><label className="lb" htmlFor={f("to")}>To</label><input id={f("to")} type="date" name="to" className="field" defaultValue={state.to ?? ""} /></div>
      </div>
      <div className="pf-factions">
        {onCancel ? <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button> : <Link href={clearHref} className="btn ghost">Clear all</Link>}
        <button className="btn gold">{onCancel ? "Apply filters" : "Apply"}</button>
      </div>
    </form>
  );
}

/** The right-hand panel at 1360 px and wider (Frame only shows it there). */
export function PfFilterPanel(props: { tab: string; state: PfFilterState; teams: Named[]; series: Named[]; clearHref: string }) {
  return (
    <section className="pf-box pf-panel" aria-label="Filters">
      <div className="pf-box-head"><h2>Filters</h2>{filterCount(props.state) > 0 && <span className="pf-state on">{filterCount(props.state)} on</span>}</div>
      <PfFilterFields prefix="pfp" {...props} />
    </section>
  );
}

/** The row of filter chips (always visible), and the sheet they open on a phone. */
export default function PfFilterBar({ tab, state, teams, series, clearHref }: {
  tab: string; state: PfFilterState; teams: Named[]; series: Named[]; clearHref: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const n = filterCount(state);
  const teamName = state.teamId ? teams.find((t) => t.id === state.teamId)?.name ?? "Team" : null;
  const seriesName = state.seriesId ? series.find((s) => s.id === state.seriesId)?.name ?? "Series" : null;
  const dates = state.from || state.to ? `${state.from ? dateLabel(state.from) : "Start"} to ${state.to ? dateLabel(state.to) : "today"}` : null;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    sheet.current?.querySelector<HTMLElement>("select, input")?.focus();
    return () => { (before ?? trigger.current)?.focus?.(); };
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); return; }
    if (e.key === "Tab") {
      const nodes = Array.from(sheet.current?.querySelectorAll<HTMLElement>("select, input, button, a[href]") ?? []);
      if (!nodes.length) return;
      const at = nodes.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && at <= 0) { e.preventDefault(); nodes[nodes.length - 1]!.focus(); }
      else if (!e.shiftKey && at === nodes.length - 1) { e.preventDefault(); nodes[0]!.focus(); }
    }
  };

  return (
    <div className="pf-fbar">
      <ul className="pf-fchips" aria-label="Filters">
        <li><button type="button" ref={trigger} className={`pf-fchip lead${n > 0 ? " on" : ""}`} onClick={() => setOpen(true)} aria-haspopup="dialog"><PfIcon name="filter" size={16} />Filters{n > 0 ? ` · ${n}` : ""}</button></li>
        <li><button type="button" className={`pf-fchip${state.allCommunities ? " on" : ""}`} onClick={() => setOpen(true)}>{state.allCommunities ? "All communities" : "This community"}</button></li>
        <li><button type="button" className={`pf-fchip${teamName ? " on" : ""}`} onClick={() => setOpen(true)}>{teamName ?? "Any team"}</button></li>
        {seriesName && <li><button type="button" className="pf-fchip on" onClick={() => setOpen(true)}>{seriesName}</button></li>}
        {dates && <li><button type="button" className="pf-fchip on" onClick={() => setOpen(true)}>{dates}</button></li>}
        {n > 0 && <li><Link href={clearHref} className="pf-fchip clear"><PfIcon name="x" size={14} />Clear all</Link></li>}
      </ul>
      {open && (
        <div className="pf-sheet-wrap" onKeyDown={onKey}>
          <div className="pf-sheet-bg" aria-hidden="true" onClick={() => setOpen(false)} />
          <div ref={sheet} className="pf-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <span className="pf-grab" aria-hidden="true" />
            <div className="pf-box-head"><h2 id={titleId}>Filters</h2>{n > 0 && <Link href={clearHref} className="pf-link">Clear all</Link>}</div>
            <PfFilterFields prefix="pfs" tab={tab} state={state} teams={teams} series={series} onCancel={() => setOpen(false)} clearHref={clearHref} />
          </div>
        </div>
      )}
    </div>
  );
}
