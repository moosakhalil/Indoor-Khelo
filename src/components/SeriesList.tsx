"use client";
// The Series list: a card per series with both team badges and the series score, All / Open / Closed, search, and the menu on every card.
// It works on plain data prepared by the server page, so a filter never asks the server for anything.
import "./sr.css";
import Link from "next/link";
import { useState } from "react";
import { SeriesMenu, SeriesQuickTools } from "@/components/SeriesActions";
import { IconList, IconPlus, IconSearch, IconTrophy } from "@/components/SrIcons";
import { OpenChip, SideBadge, StatePill } from "@/components/SrParts";
import { filterSeries, formatShort, matchesText, scoreWord, segmentCounts, seriesState, type Segment, type SeriesCardItem } from "@/lib/seriesView";

const SEGMENTS: { key: Segment; label: string }[] = [{ key: "all", label: "All" }, { key: "open", label: "Open" }, { key: "closed", label: "Closed" }];

export function SeriesEmpty({ communityId }: { communityId: string }) {
  return (
    <section className="sr-empty" aria-labelledby="sr-empty-h">
      <span className="sr-empty-icon"><IconTrophy size={28} /></span>
      <h2 id="sr-empty-h">No series yet</h2>
      <p>A series groups matches, for example best of 3 between two teams. It is optional: you never need one to play a match. Start one now, or group matches you already played.</p>
      <Link href={`/c/${communityId}/series/new`} className="btn gold sr-act"><IconPlus /> Start a series</Link>
      <Link href={`/c/${communityId}/series/new?tab=group`} className="btn ghost sr-act"><IconList /> Group matches I already played</Link>
    </section>
  );
}

export function SeriesCard({ communityId, s }: { communityId: string; s: SeriesCardItem }) {
  const state = seriesState(s.open, s.status, s.counted);
  const ref = { id: s.id, name: s.name, open: s.open, matchCount: s.matchCount };
  const href = `/c/${communityId}/series/${s.id}`;
  const two = s.sides.length === 2 && s.wins;
  const lead = two && s.wins![0] !== s.wins![1] ? (s.wins![0] > s.wins![1] ? 0 : 1) : -1;
  return (
    <article className={`sr-card${state.kind === "won" ? " won" : ""}`} data-state={state.kind}>
      <div className="sr-card-head">
        <div className="sr-badges">
          {s.sides.slice(0, 4).map((x) => <SideBadge key={x.name} name={x.name} mine={x.mine} size="sm" />)}
          {s.sides.length > 4 && <span className="sr-more">+{s.sides.length - 4}</span>}
        </div>
        <div className="sr-title">
          <Link href={href} className="sr-name">{s.name}</Link>
          <small>{matchesText(s.matchCount)} · {formatShort(s.format, s.bestOf)}</small>
        </div>
        <div className="sr-tools">
          <SeriesQuickTools communityId={communityId} series={ref} />
          <SeriesMenu communityId={communityId} series={ref} />
        </div>
      </div>
      {two ? (
        <div className="sr-score" aria-label={`${s.sides[0]!.name} ${s.wins![0]}, ${s.sides[1]!.name} ${s.wins![1]}`}>
          <SideBadge name={s.sides[0]!.name} mine={s.sides[0]!.mine} size="md" />
          <b className={lead === 0 ? "lead" : undefined}>{s.wins![0]}</b>
          <small>{scoreWord(s.wins!, s.counted)}</small>
          <b className={lead === 1 ? "lead" : undefined}>{s.wins![1]}</b>
          <SideBadge name={s.sides[1]!.name} mine={s.sides[1]!.mine} size="md" />
        </div>
      ) : (
        <p className="sr-line">{s.line}</p>
      )}
      <div className="sr-chips"><OpenChip open={s.open} /><StatePill state={state} /></div>
    </article>
  );
}

export default function SeriesList({ communityId, items }: { communityId: string; items: SeriesCardItem[] }) {
  const [seg, setSeg] = useState<Segment>("all");
  const [q, setQ] = useState("");
  const counts = segmentCounts(items);
  const shown = filterSeries(items, seg, q);
  return (
    <div className="sr-list">
      <div className="sr-seg" role="group" aria-label="Show series">
        {SEGMENTS.map((x) => (
          <button key={x.key} type="button" className={seg === x.key ? "on" : undefined} aria-pressed={seg === x.key} onClick={() => setSeg(x.key)}>
            {x.label} <span className="sr-n">{counts[x.key]}</span>
          </button>
        ))}
      </div>
      <div className="sr-search">
        <IconSearch />
        <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search series or teams" aria-label="Search series or teams" autoComplete="off" />
        {q && <button type="button" className="sr-clear" onClick={() => setQ("")}>Clear</button>}
      </div>
      {shown.length === 0 ? (
        <div className="sr-none" role="status">
          <b>No series match</b>
          <p>{q.trim() ? `Nothing matches “${q.trim()}”.` : seg === "open" ? "Every series is closed." : "No series is closed yet."}</p>
          <button type="button" className="btn ghost small" onClick={() => { setQ(""); setSeg("all"); }}>Show all series</button>
        </div>
      ) : (
        <div className="sr-grid">{shown.map((s) => <SeriesCard key={s.id} communityId={communityId} s={s} />)}</div>
      )}
      <Link href={`/c/${communityId}/series/new`} className="btn gold sr-fab"><IconPlus /> New series</Link>
    </div>
  );
}
