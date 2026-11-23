import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BallsTab, ChangesTab, OversTab, ScorecardTab, StatsTab, SummaryTab } from "@/components/ReportParts";
import { buildState } from "@/lib/engine/engine";
import { formatWhen } from "@/lib/matchRules";
import { matchByShareToken } from "@/lib/reports";
import { loadEvents, scorersOf } from "@/lib/scoring";
import { getZone } from "@/lib/zone";

// A shared match report: read-only, opens without signing in, never listed by search engines.
export const metadata: Metadata = { title: "Match report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [["summary", "Summary"], ["scorecard", "Scorecard"], ["balls", "Ball by ball"], ["overs", "Over by over"], ["stats", "Match stats"], ["changes", "Changes"]] as const;

export default async function PublicReport({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { token } = await params;
  const { tab: tabRaw } = await searchParams;
  const match = await matchByShareToken(token);
  if (!match) notFound();
  const [events, scorers, tz] = await Promise.all([loadEvents(match.id), scorersOf(match.id), getZone()]);
  const built = buildState(events);
  if (!built.ok || !built.state.started) notFound();
  const m = built.state;
  const tab = TABS.some(([k]) => k === tabRaw) ? (tabRaw as (typeof TABS)[number][0]) : "summary";
  return (
    <main className="app">
      <header className="topbar">
        <h1>Match report</h1>
        <Link href="/" className="chip gold">Indoor Khelo</Link>
      </header>
      <div className="stack" style={{ paddingBottom: 24 }}>
        <section className="card center">
          <b style={{ fontSize: "1.1rem" }}>{match.side1} v {match.side2}</b>
          <small className="muted" style={{ display: "block" }}>{formatWhen(match.when, tz)}{match.venue ? ` · ${match.venue}` : ""} · {match.overs} overs</small>
          {m.toss && <small className="muted" style={{ display: "block" }}>{m.sides[m.toss.winner - 1]} won the toss and chose to {m.toss.decision}</small>}
        </section>
        <nav className="row wrap" aria-label="Report sections">
          {TABS.map(([k, label]) => <Link key={k} href={`/r/${token}?tab=${k}`} className={`chip${tab === k ? " gold" : ""}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
        </nav>
        {tab === "summary" && <SummaryTab m={m} communityId={null} scorers={scorers} createdBy={match.created_by} />}
        {tab === "scorecard" && <ScorecardTab m={m} communityId={null} />}
        {tab === "balls" && <BallsTab m={m} communityId={null} matchId={match.id} />}
        {tab === "overs" && <OversTab m={m} />}
        {tab === "stats" && <StatsTab m={m} communityId={null} />}
        {tab === "changes" && <ChangesTab m={m} />}
        <section className="card center">
          <b>Scored with Indoor Khelo</b>
          <p className="muted small" style={{ margin: "6px 0 10px" }}>Score your own indoor cricket matches, with live scoring, stats and leaderboards.</p>
          <Link href="/" className="btn gold">Open Indoor Khelo</Link>
        </section>
      </div>
    </main>
  );
}
