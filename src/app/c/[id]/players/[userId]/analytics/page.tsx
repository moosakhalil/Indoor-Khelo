import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AnalyticsTabs, { type TabKey } from "@/components/AnalyticsTabs";
import { IconStats } from "@/components/LdIcons";
import { BoundariesCard, DuelCard, HowOutCard, PartnershipCard, PlayerHeader, RunSourcesPanel, formViews } from "@/components/PlayerAnalyticsParts";
import Frame from "@/components/Frame";
import { batterVsBowler, bowlerVsBatters, formSeries, runSources } from "@/lib/analytics";
import { loadCommunityStates } from "@/lib/analyticsData";
import { careerOf } from "@/lib/career";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { roleLabel } from "@/lib/ldView";
import { getPlayerInCommunity } from "@/lib/profile";
import { playerLines } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Player analytics" };
export const dynamic = "force-dynamic";

const TAB_KEYS: TabKey[] = ["form", "runs", "duels"];

// Charts and breakdowns for one player, worked out from the ball-by-ball record of finished matches.
// Phone and tablet: three tabs. Wide screens: every card at once (a dashboard), so every card's data is loaded here.
export default async function PlayerAnalyticsPage({ params, searchParams }: { params: Promise<{ id: string; userId: string }>; searchParams: Promise<{ tab?: string; metric?: string }> }) {
  const { id, userId } = await params;
  const q = await searchParams;
  const me = await requireAcceptedUser();
  await requireMember(id, me.id);
  const p = await getPlayerInCommunity(id, userId);
  if (!p) notFound();
  const tab = TAB_KEYS.find((k) => k === q.tab) ?? "form";
  const metric = q.metric === "wickets" ? "wickets" : "runs";

  const [lines, states, members] = await Promise.all([playerLines(id, userId), loadCommunityStates(id), listApprovedMembers(id)]);
  const numbers = new Map(members.map((m) => [m.user_id, m.player_number] as const));
  const numberOf = (uid: string) => numbers.get(uid) ?? null;
  const career = careerOf(lines);

  return (
    <Frame communityId={id} title="Analytics" subtitle={<small className="muted">{p.name}</small>} back={`/c/${id}/players/${userId}`}
      right={<Link href={`/c/${id}/players/${userId}`} className="btn ghost small ld-top-btn"><IconStats size={16} /> Stats page</Link>}>
      <div className="stack ld-page ld-analytics">
        <PlayerHeader name={p.name} number={p.player_number} role={roleLabel(p.playing_role)} />
        <AnalyticsTabs
          initialTab={tab}
          initialMetric={metric}
          form={formViews(formSeries(lines, "runs"), formSeries(lines, "wickets"))}
          runs={
            <>
              <RunSourcesPanel s={runSources(states, userId)} />
              <BoundariesCard c={career} />
              <HowOutCard c={career} />
              <PartnershipCard c={career} name={p.name} number={p.player_number} />
            </>
          }
          duels={
            <div className="ld-duels-pair">
              <DuelCard rows={batterVsBowler(states, userId)} kind="bat" communityId={id} title={`${p.name} batting against…`} numberOf={numberOf} />
              <DuelCard rows={bowlerVsBatters(states, userId)} kind="bowl" communityId={id} title={`${p.name} bowling to…`} numberOf={numberOf} />
            </div>
          }
        />
      </div>
    </Frame>
  );
}
