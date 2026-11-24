"use client";
// The matches list: segments with counts, search, quick chips, groups, and the empty states.
// It works on plain data prepared by the server page, so a filter never asks the server for anything.
import "./b4.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconBall, IconCalendar, IconPlus, IconSearch } from "@/components/B4Icons";
import MatchItemCard from "@/components/MatchItemCard";
import { useSnackbar } from "@/components/Snackbar";
import { chipCounts, counts, filterMatches, groupMatches, type ChipKey, type MatchItem, type Segment } from "@/lib/matchList";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "All" }, { key: "live", label: "Live" }, { key: "upcoming", label: "Upcoming" }, { key: "past", label: "Past" },
];
const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "reply", label: "Needs my reply" }, { key: "mine", label: "My teams" }, { key: "drafts", label: "Drafts" }, { key: "week", label: "This week" },
];

export function MatchesEmpty({ communityId }: { communityId: string }) {
  return (
    <section className="ml-empty" aria-labelledby="ml-empty-h">
      <span className="ml-empty-icon"><IconBall size={30} /></span>
      <h2 id="ml-empty-h">No matches yet</h2>
      <p>Create one match, or plan several at once (for example three over a weekend). You can pick the lineups later, even on match day.</p>
      <Link href={`/c/${communityId}/matches/new`} className="btn gold ml-act"><IconPlus /> New match</Link>
      <Link href={`/c/${communityId}/matches/several`} className="btn ghost ml-act"><IconCalendar /> Plan several</Link>
      <small>Playing without signal? Open “New match with no signal”.</small>
    </section>
  );
}

export default function MatchList({ communityId, items, deleted, initialQuery = "" }: { communityId: string; items: MatchItem[]; deleted?: boolean; initialQuery?: string }) {
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState(initialQuery);
  const [chips, setChips] = useState<ChipKey[]>([]);
  const snack = useSnackbar();

  // "Match deleted." is a short message, not a banner that stays. A deleted match cannot be brought back, so there is no Undo.
  useEffect(() => {
    if (deleted) snack.show({ message: "Match deleted.", tone: "success" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleted]);

  const seg = useMemo(() => counts(items), [items]);
  const chipN = useMemo(() => chipCounts(items), [items]);
  const shown = useMemo(() => filterMatches(items, { segment, query, chips }), [items, segment, query, chips]);
  const groups = useMemo(() => groupMatches(shown), [shown]);
  const filtering = segment !== "all" || query.trim() !== "" || chips.length > 0;
  const toggle = (k: ChipKey) => setChips((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const clear = () => { setSegment("all"); setQuery(""); setChips([]); };

  if (items.length === 0) return <MatchesEmpty communityId={communityId} />;

  return (
    <div className="ml-list">
      <div className="ml-seg" role="group" aria-label="Show">
        {SEGMENTS.map((s) => (
          <button key={s.key} type="button" aria-pressed={segment === s.key} className={segment === s.key ? "on" : ""} onClick={() => setSegment(s.key)}>
            {s.label} <span className="ml-n">{seg[s.key]}</span>
          </button>
        ))}
      </div>
      <div className="ml-search">
        <IconSearch />
        <input type="search" className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teams or venue" aria-label="Search matches by team or venue" autoComplete="off" />
        {query && <button type="button" className="ml-clear" onClick={() => setQuery("")} aria-label="Clear what you typed">Clear</button>}
      </div>
      <div className="ml-chips" role="group" aria-label="Quick views">
        {CHIPS.map((c) => (
          <button key={c.key} type="button" aria-pressed={chips.includes(c.key)} className={`ml-chip${chips.includes(c.key) ? " on" : ""}`} onClick={() => toggle(c.key)}>
            {c.label} {chipN[c.key] > 0 && <span className="ml-n">{chipN[c.key]}</span>}
          </button>
        ))}
      </div>
      {chips.includes("reply") && shown.length > 0 && <p className="muted small ml-note" role="status">Showing {shown.length} match{shown.length === 1 ? "" : "es"} you have not answered.</p>}

      {shown.length === 0 ? (
        <section className="ml-none" role="status">
          <span className="ml-empty-icon"><IconSearch size={26} /></span>
          {query.trim() ? (
            <>
              <b>No match for “{query.trim()}”</b>
              <p>No team or venue has that name. Check the spelling or clear the search.</p>
            </>
          ) : chips.includes("reply") ? (
            <>
              <b>Nothing is waiting for your reply</b>
              <p>You have answered every match that has not started.</p>
            </>
          ) : (
            <>
              <b>No matches here</b>
              <p>Nothing fits the filters you chose.</p>
            </>
          )}
          {filtering && <button type="button" className="btn ghost small" onClick={clear}>{query.trim() ? "Clear the search" : "Show all matches"}</button>}
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="ml-group" aria-label={g.title}>
            <h2>{g.title} <span className="ml-n">{g.items.length}</span></h2>
            <div className="ml-cards">
              {g.items.map((m) => <MatchItemCard key={m.id} communityId={communityId} m={m} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
