import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DuelTable, FormChart, RunSourcesCard } from "@/components/AnalyticsParts";
import Frame from "@/components/Frame";
import { batterVsBowler, bowlerVsBatters, formSeries, runSources } from "@/lib/analytics";
import { loadCommunityStates } from "@/lib/analyticsData";
import { requireMember } from "@/lib/community";
import { getPlayerInCommunity } from "@/lib/profile";
import { playerLines } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Player analytics" };
export const dynamic = "force-dynamic";

const TABS = [["form", "Form"], ["runs", "Where the runs come from"], ["duels", "Batter v bowler"]] as const;

// Charts and breakdowns for one player, worked out from the ball-by-ball record of finished matches.
export default async function PlayerAnalyticsPage({ params, searchParams }: { params: Promise<{ id: string; userId: string }>; searchParams: Promise<{ tab?: string; metric?: string }> }) {
  const { id, userId } = await params;
  const q = await searchParams;
  const me = await requireAcceptedUser();
  await requireMember(id, me.id);
  const p = await getPlayerInCommunity(id, userId);
  if (!p) notFound();
  const tab = TABS.some(([k]) => k === q.tab) ? (q.tab as (typeof TABS)[number][0]) : "form";
  const metric = q.metric === "wickets" ? "wickets" : "runs";
  const base = `/c/${id}/players/${userId}/analytics`;

  const lines = tab === "form" ? await playerLines(id, userId) : [];
  const states = tab === "form" ? [] : await loadCommunityStates(id);

  return (
    <Frame communityId={id} title="Analytics" back={`/c/${id}/players/${userId}`}>
      <div className="stack">
        <section className="card center"><b style={{ fontSize: "1.1rem" }}>{p.name}</b><small className="muted" style={{ display: "block" }}>From finished matches only. Nothing is added by hand.</small></section>
        <nav className="row wrap" aria-label="Analytics sections">
          {TABS.map(([k, label]) => <Link key={k} href={`${base}?tab=${k}`} className={`chip${tab === k ? " gold" : ""}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
        </nav>

        {tab === "form" && (
          <>
            <div className="row wrap" role="group" aria-label="Chart of">
              <Link href={`${base}?tab=form&metric=runs`} className={`chip${metric === "runs" ? " gold" : ""}`}>Runs</Link>
              <Link href={`${base}?tab=form&metric=wickets`} className={`chip${metric === "wickets" ? " gold" : ""}`}>Wickets</Link>
            </div>
            <FormChart points={formSeries(lines, metric)} metric={metric} />
          </>
        )}
        {tab === "runs" && <RunSourcesCard s={runSources(states, userId)} />}
        {tab === "duels" && (
          <>
            <h2 style={{ fontSize: "1rem" }}>{p.name} batting against…</h2>
            <DuelTable rows={batterVsBowler(states, userId)} kind="bat" communityId={id} />
            <h2 style={{ fontSize: "1rem" }}>{p.name} bowling to…</h2>
            <DuelTable rows={bowlerVsBatters(states, userId)} kind="bowl" communityId={id} />
          </>
        )}
        <Link href={`/c/${id}/players/${userId}`} className="btn ghost">Back to the stats page</Link>
      </div>
    </Frame>
  );
}
