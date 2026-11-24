import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { shareReportAction } from "@/app/actions6";
import Frame from "@/components/Frame";
import { ReportTabs, ShareSwitch } from "@/components/ReportClient";
import { BallsTab, ChangesTab, OversTab, PdfCard, REPORT_TABS, ScoreHeader, ScorecardTab, StatsTab, SummaryTab, WinPanel, WormPanel, reportTab } from "@/components/ReportParts";
import RpIcon from "@/components/RpIcons";
import { requireMember } from "@/lib/community";
import { correctionsOf } from "@/lib/corrections";
import { buildState } from "@/lib/engine/engine";
import { getMatch } from "@/lib/matches";
import { formatWhen } from "@/lib/matchRules";
import { getOrigin } from "@/lib/origin";
import { shareTokenOf } from "@/lib/reports";
import { loadEvents, scorersOf } from "@/lib/scoring";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";
import "@/components/rp.css";

export const metadata: Metadata = { title: "Match report" };
export const dynamic = "force-dynamic";

// The full record of a finished match. Every member can open it, and it works offline once opened.
export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string; matchId: string }>; searchParams: Promise<{ tab?: string; corrected?: string }> }) {
  const { id, matchId } = await params;
  const { tab: tabRaw, corrected } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const match = await getMatch(id, matchId, user.id);
  if (!match) notFound();
  if (match.status !== "completed" && match.status !== "abandoned") redirect(`/c/${id}/matches/${matchId}`);
  const [events, scorers, tz, origin, token] = await Promise.all([loadEvents(matchId), scorersOf(matchId), getZone(), getOrigin(), shareTokenOf(id, matchId)]);
  const built = buildState(events);
  if (!built.ok || !built.state.started) notFound();
  const m = built.state;
  // Right after saving a correction the person is sent here with ?tab=balls&corrected=1 (by the existing action): show the Summary,
  // where the new figures are, with the banner. Any other tab asked for by name is respected.
  const asked = reportTab(tabRaw);
  const tab = corrected && (!tabRaw || tabRaw === "balls") ? "summary" : asked;
  const base = `/c/${id}/matches/${matchId}/report`;
  const link = `${origin}${base}`;
  const publicLink = token ? `${origin}/r/${token}` : null;
  const title = `${match.side1_name} v ${match.side2_name}`;
  const fileName = `${match.side1_name}-v-${match.side2_name}.pdf`.replace(/[^A-Za-z0-9.-]+/g, "-");
  const pdfBase = `/api/matches/${matchId}/pdf?communityId=${id}`;
  const mine = Object.values(m.players).find((p) => p.userId === user.id);
  const cards = (suffix: string) => (
    <>
      <PdfCard pdfBase={pdfBase} shareUrl={publicLink ?? link} title={title} fileName={fileName} idSuffix={suffix} />
      <ShareSwitch communityId={id} matchId={matchId} memberLink={link} publicLink={publicLink} idSuffix={suffix} action={shareReportAction} />
    </>
  );
  return (
    <Frame
      communityId={id}
      title="Match report"
      subtitle={<span className="muted small">{title}</span>}
      back={`/c/${id}/matches/${matchId}`}
      right={
        <span className="rp-topacts rp-narrow-only">
          <a href="#pdf" className="rp-topact" aria-label="PDF report"><RpIcon name="doc" size={22} /></a>
          <a href="#share" className="rp-topact" aria-label="Share this report"><RpIcon name="share" size={22} /></a>
        </span>
      }
      panel={<div className="rp-panel-cards">{cards("-panel")}</div>}
    >
      <div className="rp-report">
        {corrected && (
          <div className="rp-banner" role="status">
            <RpIcon name="check" size={20} />
            <div className="grow">
              <b>Correction saved</b>
              <p>Everything was worked out again, including the stats and the Player of the Match.</p>
            </div>
            <Link href={`${base}?tab=changes`} className="rp-banner-link">See changes</Link>
          </div>
        )}
        <ScoreHeader m={m} whenText={formatWhen(match.scheduled_at, tz)} venue={match.venue} overs={match.overs} mySide={mine?.side ?? null} />
        <ReportTabs tabs={REPORT_TABS} active={tab} base={base} />
        <div className={tab === "summary" ? undefined : "rp-cq"}>
          {tab === "summary" && <SummaryTab m={m} communityId={id} matchId={matchId} scorers={scorers} createdBy={match.created_by_name} showResult={false} />}
          {tab === "scorecard" && <ScorecardTab m={m} communityId={id} matchId={matchId} />}
          {tab === "balls" && <BallsTab m={m} communityId={id} matchId={matchId} />}
          {tab === "overs" && <OversTab m={m} />}
          {tab === "stats" && <StatsTab m={m} communityId={id} matchId={matchId} />}
          {tab === "worm" && <WormPanel m={m} />}
          {tab === "win" && <WinPanel m={m} />}
          {tab === "changes" && <ChangesTab m={m} corrections={correctionsOf(events)} tz={tz} />}
        </div>
        <div className="rp-inpage-cards stack">{cards("")}</div>
        <Link href={`/c/${id}/matches/${matchId}/rematch`} className="rp-rematch"><RpIcon name="refresh" size={18} /> Rematch</Link>
      </div>
    </Frame>
  );
}
