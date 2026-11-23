import type { Metadata } from "next";
import Link from "next/link";
import CacheRoster, { QuickMatchLink } from "@/components/CacheRoster";
import Frame from "@/components/Frame";
import { MatchCard } from "@/components/MatchBits";
import { requireMember } from "@/lib/community";
import { listMatches } from "@/lib/matches";
import { rosterFor } from "@/lib/quickMatch";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ planned?: string; deleted?: string }> }) {
  const { id } = await params;
  const { planned, deleted } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [all, tz, roster] = await Promise.all([listMatches(id, user.id), getZone(), rosterFor(id, user.id)]);
  const live = all.filter((m) => m.status === "live" || m.status === "paused");
  const upcoming = all.filter((m) => ["draft", "scheduled", "postponed"].includes(m.status));
  const past = all.filter((m) => ["completed", "abandoned", "cancelled"].includes(m.status))
    .sort((a, b) => (b.scheduled_at?.getTime() ?? 0) - (a.scheduled_at?.getTime() ?? 0));
  const plannedCount = Number(planned);
  return (
    <Frame communityId={id} title="Matches">
      <div className="stack">
        {plannedCount > 0 && <div className="banner green" role="status">{plannedCount} match{plannedCount === 1 ? "" : "es"} planned. Each one is separate, with its own replies and lineup.</div>}
        {deleted && <div className="banner green" role="status">Match deleted.</div>}
        <div className="two">
          <Link href={`/c/${id}/matches/new`} className="btn gold">New match</Link>
          <Link href={`/c/${id}/matches/several`} className="btn ghost">Plan several</Link>
        </div>
        <QuickMatchLink communityId={id} />
        <CacheRoster communityId={id} me={user.id} members={roster.members} teams={roster.teams} />

        {all.length === 0 && (
          <div className="card center">
            <b>No matches yet</b>
            <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>Create one match, or plan several at once (for example three over a weekend). You can pick the lineups later, even on match day.</p>
          </div>
        )}

        {live.length > 0 && (
          <section className="stack">
            <h2 style={{ fontSize: "1rem" }}>Live <small className="muted">({live.length})</small></h2>
            {live.map((m) => <MatchCard key={m.id} communityId={id} m={m} tz={tz} />)}
          </section>
        )}
        {upcoming.length > 0 && (
          <section className="stack">
            <h2 style={{ fontSize: "1rem" }}>Upcoming <small className="muted">({upcoming.length})</small></h2>
            {upcoming.map((m) => <MatchCard key={m.id} communityId={id} m={m} tz={tz} />)}
          </section>
        )}
        {past.length > 0 && (
          <section className="stack">
            <h2 style={{ fontSize: "1rem" }}>Past <small className="muted">({past.length})</small></h2>
            {past.map((m) => <MatchCard key={m.id} communityId={id} m={m} tz={tz} />)}
          </section>
        )}
      </div>
    </Frame>
  );
}
