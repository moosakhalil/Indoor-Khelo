import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportTabs } from "@/components/ReportClient";
import { AppMark } from "@/components/RpBrand";
import { AppPromoCard, BallsTab, ChangesTab, OversTab, PdfCard, REPORT_TABS, ScoreHeader, ScorecardTab, StatsTab, SummaryTab, WinPanel, WormPanel, reportTab } from "@/components/ReportParts";
import RpIcon from "@/components/RpIcons";
import { buildState } from "@/lib/engine/engine";
import { getOrigin } from "@/lib/origin";
import { formatWhen } from "@/lib/matchRules";
import { matchByShareToken } from "@/lib/reports";
import { loadEvents, scorersOf } from "@/lib/scoring";
import { getZone } from "@/lib/zone";
import "@/components/rp.css";

// A shared match report: read-only, opens without signing in, never listed by search engines.
// It shows exactly what it showed before (names, scores, scorecards, every ball, the log); only the look is new.
// An old or stopped link ends in not-found.tsx next to this file.
export const metadata: Metadata = { title: "Match report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicReport({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { token } = await params;
  const { tab: tabRaw } = await searchParams;
  const match = await matchByShareToken(token);
  if (!match) notFound();
  const [events, scorers, tz, origin] = await Promise.all([loadEvents(match.id), scorersOf(match.id), getZone(), getOrigin()]);
  const built = buildState(events);
  if (!built.ok || !built.state.started) notFound();
  const m = built.state;
  const tab = reportTab(tabRaw);
  const title = `${match.side1} v ${match.side2}`;
  return (
    <main className="app rp-pub">
      <header className="rp-pub-bar">
        <Link href="/" className="rp-pub-brand"><AppMark /> <span>Indoor Khelo</span></Link>
        <span className="rp-pub-ro"><RpIcon name="eye" size={14} /> Shared report · read only</span>
      </header>
      <h1 className="rp-sr">Match report: {title}</h1>
      <div className="rp-pub-grid">
        <div className="rp-report">
          <ScoreHeader m={m} whenText={formatWhen(match.when, tz)} venue={match.venue} overs={match.overs} />
          <ReportTabs tabs={REPORT_TABS} active={tab} base={`/r/${token}`} />
          <div className={tab === "summary" ? undefined : "rp-cq"}>
            {tab === "summary" && <SummaryTab m={m} communityId={null} scorers={scorers} createdBy={match.created_by} showResult={false} />}
            {tab === "scorecard" && <ScorecardTab m={m} communityId={null} />}
            {tab === "balls" && <BallsTab m={m} communityId={null} matchId={match.id} />}
            {tab === "overs" && <OversTab m={m} />}
            {tab === "stats" && <StatsTab m={m} communityId={null} />}
            {tab === "worm" && <WormPanel m={m} />}
            {tab === "win" && <WinPanel m={m} />}
            {tab === "changes" && <ChangesTab m={m} />}
          </div>
        </div>
        <aside className="rp-pub-side" aria-label="PDF and Indoor Khelo">
          <PdfCard pdfBase={`/r/${token}/pdf`} shareUrl={`${origin}/r/${token}`} title={title} fileName={`${match.side1}-v-${match.side2}.pdf`.replace(/[^A-Za-z0-9.-]+/g, "-")} />
          <AppPromoCard />
          <p className="rp-pub-foot muted">This link shows the scorecard and ball-by-ball record with player names. Nothing else in the community can be reached from it.</p>
        </aside>
      </div>
    </main>
  );
}
