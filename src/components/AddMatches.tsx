"use client";
// "Add matches to a series": free matches with both badges and a state chip, All / Can be added / Cannot be added, the count on the button.
// A match that does not fit says why and links to the place where the missing team is added. A server error comes back above the list and the ticks stay.
import "./sr.css";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { addMatchesF1Action, type SeriesPickState } from "@/app/actionsF1";
import { ReopenBanner } from "@/components/SeriesActions";
import { IconWarn } from "@/components/SrIcons";
import { SideBadge } from "@/components/SrParts";
import { NewMatchLink, PickEmpty, PickRow } from "@/components/SrPick";
import { addCounts, addFilter, withCount, type AddChip, type AvailItem } from "@/lib/seriesView";

const initial: SeriesPickState = {};
const CHIPS: { key: AddChip; label: string }[] = [{ key: "all", label: "All" }, { key: "fit", label: "Can be added" }, { key: "nofit", label: "Cannot be added" }];

export type AddSeries = { id: string; name: string; open: boolean; matchCount: number; sides: { name: string; mine: boolean }[] };

export default function AddMatches({ communityId, series, items, initialError }: { communityId: string; series: AddSeries; items: AvailItem[]; initialError?: string }) {
  const [state, action, pending] = useActionState(addMatchesF1Action, initial);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [chip, setChip] = useState<AddChip>("all");
  const error = state.error ?? initialError;
  const counts = addCounts(items);
  const shown = addFilter(items, chip);
  const base = `/c/${communityId}/series/${series.id}`;
  const toggle = (id: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  const ref = { id: series.id, name: series.name, open: series.open, matchCount: series.matchCount };
  return (
    <div className="sr-formwrap"><div className="sr-formgrid">
      <form onSubmit={submit} className="sr-form" noValidate>
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="seriesId" value={series.id} />
        {Array.from(picked).map((id) => <input key={id} type="hidden" name="match" value={id} />)}
        {error && <div className="banner red sr-banner" role="alert"><IconWarn /><span>{error}</span></div>}
        {!series.open && <ReopenBanner communityId={communityId} series={ref} />}
        <p className="muted sr-intro">Add matches that already exist, including ones already played. Both teams must be teams of this series ({series.sides.map((x) => x.name).join(", ")}). A match can be in one series only.</p>

        {items.length === 0 ? (
          <PickEmpty title="No free matches" text="Create a match first, or use “Play another match in this series” on the series page.">
            <NewMatchLink communityId={communityId} />
            <Link href={base} className="btn ghost small">Back to series</Link>
          </PickEmpty>
        ) : (
          <>
            <div className="sr-chipbar" role="group" aria-label="Show matches">
              {CHIPS.map((c) => (
                <button key={c.key} type="button" className={`sr-chipbtn${chip === c.key ? " on" : ""}`} aria-pressed={chip === c.key} onClick={() => setChip(c.key)}>{c.label} <span className="sr-n">{counts[c.key]}</span></button>
              ))}
            </div>
            <section className="card sr-picks sr-fcard" aria-label="Matches">
              {shown.length === 0 && <p className="muted small" role="status">Nothing in this view.</p>}
              {shown.map((m) => (
                <PickRow key={m.id} m={{ id: m.id, side1: m.side1, side2: m.side2, when: m.when, status: m.status }} checked={picked.has(m.id)} onChange={(on) => toggle(m.id, on)} locked={!m.fits} reason={m.reason} fixHref={`${base}/edit`} />
              ))}
            </section>
          </>
        )}
        <div className="sr-sticky">
          <Link href={base} className="btn ghost sr-cancelbtn">Cancel</Link>
          <button className="btn gold" disabled={pending || !series.open || picked.size === 0}>{pending ? "Saving…" : withCount("Add to the series", picked.size)}</button>
        </div>
      </form>
      <aside className="sr-preview sr-summary" aria-label="This series">
        <div className="sr-preview-badges">{series.sides.map((s) => <SideBadge key={s.name} name={s.name} mine={s.mine} size="lg" />)}</div>
        <b>{series.name}</b>
        <small>{series.sides.map((s) => s.name).join(" · ")}</small>
        <div className="sr-counts"><div><b>{series.matchCount}</b><small>In the series</small></div><div><b>{picked.size}</b><small>Selected</small></div></div>
      </aside>
    </div></div>
  );
}
