import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import Frame from "@/components/Frame";
import { BallsTab, ChangesTab, OversTab, ScorecardTab, StatsTab, SummaryTab } from "@/components/ReportParts";
import { shareReportAction } from "@/app/actions6";
import { requireMember } from "@/lib/community";
import { buildState } from "@/lib/engine/engine";
import { getMatch } from "@/lib/matches";
import { formatWhen } from "@/lib/matchRules";
import { getOrigin } from "@/lib/origin";
import { shareTokenOf } from "@/lib/reports";
import { loadEvents, scorersOf } from "@/lib/scoring";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Match report" };
export const dynamic = "force-dynamic";

const TABS = [["summary", "Summary"], ["scorecard", "Scorecard"], ["balls", "Ball by ball"], ["overs", "Over by over"], ["stats", "Match stats"], ["changes", "Changes"]] as const;

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
  const tab = TABS.some(([k]) => k === tabRaw) ? (tabRaw as (typeof TABS)[number][0]) : "summary";
  const link = `${origin}/c/${id}/matches/${matchId}/report`;
  return (
    <Frame communityId={id} title="Match report" back={`/c/${id}/matches/${matchId}`}>
      <div className="stack">
        {corrected && <div className="banner green" role="status">Correction saved. Everything was worked out again, including the stats and the Player of the Match.</div>}
        <section className="card center">
          <b style={{ fontSize: "1.1rem" }}>{match.side1_name} v {match.side2_name}</b>
          <small className="muted" style={{ display: "block" }}>{formatWhen(match.scheduled_at, tz)}{match.venue ? ` · ${match.venue}` : ""} · {match.overs} overs</small>
          {m.toss && <small className="muted" style={{ display: "block" }}>{m.sides[m.toss.winner - 1]} won the toss and chose to {m.toss.decision}</small>}
        </section>
        <nav className="row wrap" aria-label="Report sections">
          {TABS.map(([k, label]) => <Link key={k} href={`/c/${id}/matches/${matchId}/report?tab=${k}`} className={`chip${tab === k ? " gold" : ""}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
        </nav>
        {tab === "summary" && <SummaryTab m={m} communityId={id} scorers={scorers} createdBy={match.created_by_name} />}
        {tab === "scorecard" && <ScorecardTab m={m} communityId={id} />}
        {tab === "balls" && (
          <>
            <p className="muted small" style={{ margin: 0 }}>Every delivery, in order. Spotted a mistake? Tap Correct on that ball: any member can, and the change is logged with their name.</p>
            <BallsTab m={m} communityId={id} matchId={matchId} />
          </>
        )}
        {tab === "overs" && <OversTab m={m} />}
        {tab === "stats" && <StatsTab m={m} communityId={id} />}
        {tab === "changes" && <ChangesTab m={m} />}
        <section className="card" id="share">
          <b>Share this report</b>
          {token ? (
            <>
              <p className="muted small" style={{ margin: "6px 0" }}>Public link: anyone who has it can read this match without signing in. Nothing else in the community is reachable from it.</p>
              <div className="row space">
                <span className="mono" style={{ fontSize: "0.75rem", overflowWrap: "anywhere" }}>{`${origin}/r/${token}`}</span>
                <CopyButton text={`${origin}/r/${token}`} />
              </div>
              <form action={shareReportAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="communityId" value={id} /><input type="hidden" name="matchId" value={matchId} /><input type="hidden" name="on" value="0" />
                <button className="btn ghost small">Stop sharing (the public link stops working)</button>
              </form>
            </>
          ) : (
            <>
              <p className="muted small" style={{ margin: "6px 0" }}>The link below opens only for signed-in members of this community. To let anyone read it, for example in a WhatsApp group, create a public link. It shows the scorecard and ball-by-ball record with player names. You can stop sharing at any time.</p>
              <div className="row space"><span className="mono" style={{ fontSize: "0.75rem", overflowWrap: "anywhere" }}>{link}</span><CopyButton text={link} /></div>
              <form action={shareReportAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="communityId" value={id} /><input type="hidden" name="matchId" value={matchId} /><input type="hidden" name="on" value="1" />
                <button className="btn gold small">Create a public link</button>
              </form>
            </>
          )}
        </section>
        <Link href={`/c/${id}/matches/${matchId}/rematch`} className="btn gold">Rematch</Link>
      </div>
    </Frame>
  );
}
