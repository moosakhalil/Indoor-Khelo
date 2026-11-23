import type { Metadata } from "next";
import Link from "next/link";
import { BowlOverTable, PairsList, RecordsList } from "@/components/AnalyticsParts";
import Frame from "@/components/Frame";
import { bowlingByOver, communityRecords, partnershipPairs } from "@/lib/analytics";
import { loadCommunityStates } from "@/lib/analyticsData";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const TABS = [["records", "Records"], ["partnerships", "Partnerships"], ["bowling", "Bowling by over"]] as const;

// Community-wide records, the best partnerships, and who bowls best at the start and the end of an innings.
export default async function InsightsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const tab = TABS.some(([k]) => k === q.tab) ? (q.tab as (typeof TABS)[number][0]) : "records";
  const states = await loadCommunityStates(id);
  return (
    <Frame communityId={id} title="Insights" back={`/c/${id}/teams`}>
      <div className="stack">
        <nav className="row wrap" aria-label="Insight sections">
          {TABS.map(([k, label]) => <Link key={k} href={`/c/${id}/insights?tab=${k}`} className={`chip${tab === k ? " gold" : ""}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
          <Link href={`/c/${id}/compare`} className="chip">Compare two players</Link>
        </nav>
        {states.length === 0 && <div className="card center muted small">No finished matches yet. Everything here is worked out from finished matches.</div>}
        {tab === "records" && (() => { const r = communityRecords(states); return (
          <>
            <RecordsList lines={r.lines} communityId={id} />
            {r.streaks.length > 1 && (
              <section className="card">
                <b>Unbeaten runs by team</b>
                <div className="list" style={{ marginTop: 6 }}>{r.streaks.map((s) => <div key={s.team} className="item space"><span>{s.team}</span><b>{s.length}</b></div>)}</div>
                <p className="muted small" style={{ margin: "6px 0 0" }}>Wins and ties in a row. A match with no result neither breaks nor extends a run. Guests are not in records.</p>
              </section>
            )}
          </>
        ); })()}
        {tab === "partnerships" && (
          <>
            <p className="muted small" style={{ margin: 0 }}>Which two batters have scored the most together, across all finished matches. Extras count towards the pair. Guests are left out.</p>
            <PairsList rows={partnershipPairs(states)} communityId={id} />
          </>
        )}
        {tab === "bowling" && (() => { const b = bowlingByOver(states); return (
          <>
            <p className="muted small" style={{ margin: 0 }}>Start is the first two overs of an innings, end is the last two. A bowler needs 12 balls in that part of an innings to be ranked; others are listed after, in grey. Best economy first.</p>
            <BowlOverTable rows={b.start} title="At the start (overs 1 and 2)" communityId={id} />
            <BowlOverTable rows={b.end} title="At the end (last two overs)" communityId={id} />
          </>
        ); })()}
      </div>
    </Frame>
  );
}
