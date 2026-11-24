// The body of the Home screen: every card in order. Pure layout (no data loading), so it can be rendered in tests.
// src/app/c/[id]/page.tsx loads the data, puts this inside the Frame and fills the side panel.
import { Banners, CommunityCard, LinkList, LiveCard, MatchDayCard, NewMatchFab, NextMatchCard, NoMatchCard, QuickActions, ResultsCard, type ResultItem } from "@/components/HomeParts";
import OfflineBanner from "@/components/OfflineBanner";
import type { LineupEntry, MatchRow } from "@/lib/matches";
import type { ScoreLine } from "@/lib/scoreLine";
import "./home.css";

export type HomeData = {
  id: string;
  tz: string;
  isAdmin: boolean;
  pending: number;
  alerts: number;
  members: number;
  cap: number;
  community: { name: string; location: string | null; description: string | null };
  number: number | null;
  live: MatchRow | null;
  liveLine: ScoreLine | null;
  next: MatchRow | null;
  /** The next match, when it is dated today in the viewer's own time zone. */
  today: MatchRow | null;
  todayLineup: LineupEntry[];
  mySide: 1 | 2 | null;
  results: ResultItem[];
};

/** Community card and link list: shown in the page, or in the side panel on a very wide screen. */
export function HomeSide({ d }: { d: HomeData }) {
  return (
    <>
      <CommunityCard id={d.id} name={d.community.name} members={d.members} cap={d.cap} location={d.community.location} description={d.community.description} number={d.number} isAdmin={d.isAdmin} />
      <LinkList id={d.id} members={d.members} alerts={d.alerts} pending={d.pending} isAdmin={d.isAdmin} />
    </>
  );
}

export default function HomeView({ d }: { d: HomeData }) {
  const showBanners = (d.isAdmin && d.pending > 0) || d.alerts > 0;
  return (
    <>
      <div className="hm-grid">
        <div className="hm-span"><OfflineBanner communityId={d.id} /></div>

        {showBanners && (
          <div className="hm-span stack" style={{ gap: 8 }}>
            <Banners id={d.id} pending={d.pending} alerts={d.alerts} isAdmin={d.isAdmin} />
          </div>
        )}

        {d.live && <div className="hm-span"><LiveCard id={d.id} live={d.live} line={d.liveLine} /></div>}

        {d.today ? (
          <div className="hm-span"><MatchDayCard id={d.id} today={d.today} lineup={d.todayLineup} tz={d.tz} mySide={d.mySide} /></div>
        ) : d.next ? (
          <NextMatchCard id={d.id} next={d.next} tz={d.tz} />
        ) : !d.live ? (
          <NoMatchCard id={d.id} />
        ) : null}

        <QuickActions id={d.id} live={d.live} next={d.next} />

        <ResultsCard id={d.id} results={d.results} tz={d.tz} />

        {/* on a very wide screen these two live in the side panel instead */}
        <div className="hm-inpage"><HomeSide d={d} /></div>
      </div>
      <NewMatchFab id={d.id} />
    </>
  );
}
