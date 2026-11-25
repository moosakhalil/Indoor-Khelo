// The Series page body and its side column, drawn from plain data (the page prepares the data). No hooks here: it is a server-safe layout
// that places the client parts (menu, close and delete, match rows with Undo). Kept apart from the page so it can be looked at and tested without a database.
import "./sr.css";
import Link from "next/link";
import { CloseCard, DeleteCard, StatusBanner } from "@/components/SeriesActions";
import SeriesAward, { type AwardView } from "@/components/SeriesAward";
import SeriesMatches, { type SeriesRow } from "@/components/SeriesMatches";
import { IconBars, IconCheck, IconChevron, IconInfo, IconPencil, IconPlus, IconWarn } from "@/components/SrIcons";
import { PointsTable, SeriesHero, type HeroData, type TableItem } from "@/components/SrParts";

export type SeriesViewData = {
  id: string; name: string; open: boolean; matchCount: number;
  hero: HeroData;
  /** The match "Play another match" copies, or null when the series has no match yet. */
  latestId: string | null;
  clinchedWinner: string | null; drawn: boolean;
  showTable: boolean; table: TableItem[];
  fixtures: SeriesRow[]; results: SeriesRow[];
  notes: string; createdBy: string; changedBy: string; changedAt: string;
  created: boolean; error: string | null;
  /** Player of the Series (leading while open, final once closed). Null until a member has earned points in a finished match. */
  award?: AwardView | null;
  /** The viewer may delete this series: they added it, or they are an Admin (lib/ownerRule.ts). Missing means yes. */
  canDelete?: boolean;
};

export function SeriesSide({ communityId, d }: { communityId: string; d: SeriesViewData }) {
  const ref = { id: d.id, name: d.name, open: d.open, matchCount: d.matchCount, canDelete: d.canDelete, addedBy: d.createdBy };
  return (
    <>
      {d.showTable && <PointsTable rows={d.table} />}
      <section className="card list sr-leader">
        <Link href={`/c/${communityId}/leaderboard?series=${d.id}`} className="item">
          <span className="sr-lead-icon"><IconBars /></span>
          <span className="t grow"><b>Series leaderboard</b><small>Rank every member by any stat, in this series only</small></span>
          <IconChevron />
        </Link>
      </section>
      {d.notes && <section className="card sr-notes"><small className="muted">Notes</small><p>{d.notes}</p></section>}
      <CloseCard communityId={communityId} series={ref} />
      <DeleteCard communityId={communityId} series={ref} />
      <p className="muted small sr-by">Added by <b>{d.createdBy}</b> · Changed by <b>{d.changedBy}</b> ({d.changedAt})</p>
    </>
  );
}

export default function SeriesView({ communityId, d }: { communityId: string; d: SeriesViewData }) {
  const ref = { id: d.id, name: d.name, open: d.open, matchCount: d.matchCount, canDelete: d.canDelete, addedBy: d.createdBy };
  const base = `/c/${communityId}/series/${d.id}`;
  return (
    <div className="stack sr-page">
      {d.created && <div className="banner green sr-banner" role="status"><IconCheck /><span><b>Series created.</b> Add matches, or play the first one.</span></div>}
      {d.error && <div className="banner red sr-banner" role="alert"><IconWarn /><span>{d.error}</span></div>}

      <SeriesHero d={d.hero} />

      <div className="stack">
        {d.open && d.latestId && <Link href={`/c/${communityId}/matches/${d.latestId}/rematch`} className="btn gold sr-play"><IconPencil />Play another match in this series</Link>}
        <div className="two">
          <Link href={`${base}/add`} className="btn ghost sr-secondary"><IconPlus />Add matches</Link>
          <Link href={`${base}/edit`} className="btn ghost sr-secondary"><IconPencil />Edit series</Link>
        </div>
      </div>

      {d.open && !d.latestId && (
        <div className="sr-callout" role="status">
          <IconInfo />
          <span className="grow"><b>Add a match to get started</b><br />Add a match to the series, then you can play another one with one tap.</span>
        </div>
      )}
      {d.open && d.clinchedWinner && <StatusBanner communityId={communityId} series={ref} kind="clinched" winner={d.clinchedWinner} />}
      {!d.open && d.drawn && <StatusBanner communityId={communityId} series={ref} kind="drawn" />}

      {d.award && <SeriesAward a={d.award} />}

      <SeriesMatches communityId={communityId} seriesId={d.id} fixtures={d.fixtures} results={d.results} />

      <div className="sr-inline-side stack"><SeriesSide communityId={communityId} d={d} /></div>
    </div>
  );
}
