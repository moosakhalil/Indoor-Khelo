"use client";
// "Group matches I have": tick free matches (also ones already played) and make a series from them. The teams are taken from the matches.
// An error from the server comes back as a banner above the list and the ticks stay.
import "./sr.css";
import Link from "next/link";
import { startTransition, useActionState, useId, useState } from "react";
import { groupMatchesF1Action, type SeriesPickState } from "@/app/actionsF1";
import { IconFilter, IconTrophy, IconWarn } from "@/components/SrIcons";
import { SideBadge } from "@/components/SrParts";
import { NewMatchLink, PickEmpty, PickRow } from "@/components/SrPick";
import { STATUS_FILTERS, autoName, statusFilterMatch, teamsFromMatches, teamsText, withCount, matchesText, type FreeMatch, type StatusFilter } from "@/lib/seriesView";

const initial: SeriesPickState = {};

export default function GroupMatches({ communityId, matches, initialError }: { communityId: string; matches: FreeMatch[]; initialError?: string }) {
  const [state, action, pending] = useActionState(groupMatchesF1Action, initial);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [name, setName] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const uid = useId();
  const error = state.error ?? initialError;
  const chosen = matches.filter((m) => picked.has(m.id));
  const teams = teamsFromMatches(chosen);
  const shown = matches.filter((m) => statusFilterMatch(m.status, filter));
  const toggle = (id: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <div className="sr-formwrap"><div className="sr-formgrid">
      <form onSubmit={submit} className="sr-form" noValidate>
        <input type="hidden" name="communityId" value={communityId} />
        {Array.from(picked).map((id) => <input key={id} type="hidden" name="match" value={id} />)}
        {error && <div className="banner red sr-banner" role="alert"><IconWarn /><span>{error}</span></div>}
        <section className="card sr-fcard">
          <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>Choose matches, including ones already played. The teams are taken from them. A match can be in one series only.</p>
          <label className="lb" htmlFor={`${uid}-g`}>Series name (optional)</label>
          <input id={`${uid}-g`} name="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Automatic: Alpha v Bravo" autoComplete="off" />

          {matches.length === 0 ? (
            <PickEmpty title="No matches are free to group" text="Every match is already in a series or was cancelled or abandoned.">
              <NewMatchLink communityId={communityId} />
            </PickEmpty>
          ) : (
            <div className="sr-picklist">
              <div className="sr-pick-head">
                <b>{matches.length} free {matches.length === 1 ? "match" : "matches"}</b>
                <label className="sr-filter"><IconFilter size={15} /><span className="sr-sr">Filter by status</span>
                  <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}>
                    {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.key === "all" ? "Status: all" : f.label}</option>)}
                  </select>
                </label>
              </div>
              {shown.length === 0 && <p className="muted small" role="status">No free match has this status.</p>}
              <div className="sr-picks">
                {shown.map((m) => <PickRow key={m.id} m={{ id: m.id, side1: m.side1, side2: m.side2, when: m.when, status: m.status }} checked={picked.has(m.id)} onChange={(on) => toggle(m.id, on)} />)}
              </div>
            </div>
          )}
        </section>
        <div className="sr-sticky">
          <Link href={`/c/${communityId}/series`} className="btn ghost sr-cancelbtn">Cancel</Link>
          <button className="btn gold" disabled={pending || picked.size === 0}>{pending ? "Saving…" : withCount("Group into a series", picked.size)}</button>
        </div>
      </form>
      <aside className="sr-preview" aria-label="Preview">
        <small className="sr-preview-h">Preview</small>
        {teams.length === 0 ? <span className="sr-preview-icon"><IconTrophy size={24} /></span> : <div className="sr-preview-badges">{teams.map((t) => <SideBadge key={t.name} name={t.name} size="lg" />)}</div>}
        <b>{autoName(teams, chosen.length, name)}</b>
        <small>{teams.length < 2 ? "Choose at least 2 teams" : teamsText(teams.length)} · {matchesText(chosen.length)}</small>
      </aside>
    </div></div>
  );
}
