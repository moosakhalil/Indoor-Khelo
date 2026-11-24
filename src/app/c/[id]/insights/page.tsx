import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { BowlCard, CompareButton, InsightsTabs, PairRows, RecordTiles, StreakBars } from "@/components/InsightsParts";
import { IconInfo } from "@/components/LdIcons";
import { bowlingByOver, communityRecords, partnershipPairs } from "@/lib/analytics";
import { loadCommunityStates } from "@/lib/analyticsData";
import { listApprovedMembers, requireMember } from "@/lib/community";
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
  const [states, members] = await Promise.all([loadCommunityStates(id), listApprovedMembers(id)]);
  const numbers = new Map(members.map((m) => [m.user_id, m.player_number] as const));
  const numberOf = (userId: string) => numbers.get(userId) ?? null;
  return (
    <Frame communityId={id} title="Insights" subtitle={<small className="muted">Worked out from finished matches</small>} back={`/c/${id}/teams`} right={<CompareButton communityId={id} className="btn ghost small ld-top-btn" />}>
      <div className="stack ld-page">
        <InsightsTabs communityId={id} tab={tab} tabs={TABS} />
        {states.length === 0 && (
          <div className="ld-note" role="note"><IconInfo size={18} /><span>No finished matches yet. Everything here is worked out from finished matches.</span></div>
        )}
        {tab === "records" && (() => { const r = communityRecords(states); return (
          <>
            <RecordTiles lines={r.lines} communityId={id} numberOf={numberOf} />
            <StreakBars streaks={r.streaks} />
          </>
        ); })()}
        {tab === "partnerships" && (
          <>
            <p className="muted small" style={{ margin: 0 }}>Which two batters have scored the most together, across all finished matches. Extras count towards the pair. Guests are left out.</p>
            <PairRows rows={partnershipPairs(states)} communityId={id} numberOf={numberOf} />
          </>
        )}
        {tab === "bowling" && (() => { const b = bowlingByOver(states); return (
          <>
            <p className="muted small" style={{ margin: 0 }}>Start is the first two overs of an innings, end is the last two. A bowler needs 12 balls in that part of an innings to be ranked; others are listed after, in grey. Best economy first.</p>
            <div className="ld-two">
              <BowlCard rows={b.start} title="At the start (overs 1 and 2)" communityId={id} numberOf={numberOf} />
              <BowlCard rows={b.end} title="At the end (last two overs)" communityId={id} numberOf={numberOf} />
            </div>
          </>
        ); })()}
        <CompareButton communityId={id} className="btn ghost ld-bottom-btn" />
      </div>
    </Frame>
  );
}
