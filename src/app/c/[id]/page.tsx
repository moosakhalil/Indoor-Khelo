import type { Metadata } from "next";
import Link from "next/link";
import CacheRoster, { QuickMatchLink } from "@/components/CacheRoster";
import CommunityLogo from "@/components/CommunityLogo";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { approvedCount, listPending, requireMember } from "@/lib/community";
import { listLineup, liveMatch, nextMatch, unreadAlertCount } from "@/lib/matches";
import { rosterFor } from "@/lib/quickMatch";
import { recentResults } from "@/lib/reports";
import { formatWhen } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Home" };

export default async function CommunityHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const [members, pending, next, alerts, tz, live, results, roster] = await Promise.all([
    approvedCount(id),
    membership.role === "admin" ? listPending(id) : Promise.resolve([]),
    nextMatch(id, user.id),
    unreadAlertCount(user.id, id),
    getZone(),
    liveMatch(id, user.id),
    recentResults(id),
    rosterFor(id, user.id),
  ]);
  // a match is "today" if it is on today's date in the viewer's own time zone
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = next && next.scheduled_at && dayKey(next.scheduled_at) === dayKey(new Date()) ? next : null;
  const todayLineup = today ? await listLineup(id, today.id) : [];
  return (
    <Frame communityId={id} title={community.name}>
      <div className="stack">
        <CacheRoster communityId={id} me={user.id} members={roster.members} teams={roster.teams} />
        <QuickMatchLink communityId={id} onlyOffline />
        <Link href={`/c/${id}/community`} className="card" aria-label={`Open the community page for ${community.name}`}>
          <div className="row">
            <CommunityLogo name={community.name} />
            <span className="t grow">
              <b>{community.name}</b>
              <small className="muted">{members} of {COMMUNITY_MEMBER_CAP} members{community.location ? ` · ${community.location}` : ""}</small>
            </span>
            <Shirt number={membership.player_number} />
          </div>
          {community.description && <p className="muted" style={{ margin: "10px 0 0" }}>{community.description}</p>}
          <span className="btn gold small" style={{ marginTop: 10, width: "100%" }}>Open the community page ›</span>
        </Link>

        {membership.role === "admin" && pending.length > 0 && (
          <Link href={`/c/${id}/requests`} className="card gold row space">
            <span><b>{pending.length} join request{pending.length === 1 ? "" : "s"}</b><br /><small className="muted">Tap to approve or reject</small></span>
            <span aria-hidden="true">›</span>
          </Link>
        )}

        {alerts > 0 && (
          <Link href={`/c/${id}/alerts`} className="card gold row space">
            <span><b>{alerts} new alert{alerts === 1 ? "" : "s"}</b><br /><small className="muted">New matches, reminders and changes</small></span>
            <span aria-hidden="true">›</span>
          </Link>
        )}

        {today ? (
          <section className="card gold" aria-label="Match day">
            <small className="muted">Match day · {formatWhen(today.scheduled_at, tz)}</small>
            <b style={{ display: "block", fontSize: "1.2rem", margin: "2px 0 8px" }}>{today.side1_name} v {today.side2_name}</b>
            <small className="muted" style={{ display: "block" }}>{today.venue ? `${today.venue} · ` : ""}{today.overs} overs · {today.players_per_side} a side</small>
            <div className="two" style={{ marginTop: 10 }}>
              {([1, 2] as const).map((pos) => {
                const side = todayLineup.filter((l) => l.position === pos);
                return (
                  <div key={pos}>
                    <b>{pos === 1 ? today.side1_name : today.side2_name} <small className="muted">({side.length})</small></b>
                    <div className="muted small" style={{ lineHeight: 1.5 }}>{side.length ? side.map((l) => l.name).join(", ") : "No lineup yet"}</div>
                  </div>
                );
              })}
            </div>
            <div className="two" style={{ marginTop: 12 }}>
              <Link href={`/c/${id}/matches/${today.id}/score`} className="btn gold small" style={{ width: "100%" }}>Start scoring</Link>
              <Link href={`/c/${id}/matches/${today.id}/lineup`} className="btn ghost small" style={{ width: "100%" }}>Pick lineups</Link>
            </div>
            <Link href={`/c/${id}/matches/${today.id}#toss`} className="chip" style={{ marginTop: 10 }}>Toss the coin</Link>
          </section>
        ) : next ? (
          <Link href={`/c/${id}/matches/${next.id}`} className="card row space" aria-label="Next match">
            <span className="t grow"><small className="muted">Next match</small><b style={{ display: "block" }}>{next.side1_name} v {next.side2_name}</b><small className="muted">{formatWhen(next.scheduled_at, tz)}</small></span>
            <span className={`chip${next.my_answer ? " green" : " gold"}`}>{next.my_answer === "in" ? "You are in" : next.my_answer === "out" ? "You are out" : "Reply"} ›</span>
          </Link>
        ) : (
          <section className="card center muted">No match planned yet. Create one and everyone is asked if they are coming.</section>
        )}

        <div className="two">
          {live ? (
            <Link href={`/c/${id}/matches/${live.id}/score`} className="card gold" style={{ minHeight: 96 }}>
              <b><span className="live-dot" aria-hidden="true" /> Live now</b><br /><small className="muted">{live.side1_name} v {live.side2_name}: watch or score</small>
            </Link>
          ) : next ? (
            <Link href={`/c/${id}/matches/${next.id}/score`} className="card" style={{ minHeight: 96 }}>
              <b>Start scoring</b><br /><small className="muted">{next.side1_name} v {next.side2_name}</small>
            </Link>
          ) : (
            <div className="card" aria-disabled="true" style={{ opacity: 0.6, minHeight: 96 }}>
              <b>Start scoring</b><br /><small className="muted">Create a match first</small>
            </div>
          )}
          <Link href={`/c/${id}/matches/new`} className="card" style={{ minHeight: 96 }}>
            <b>New match</b><br /><small className="muted">Pick teams, overs and rules</small>
          </Link>
        </div>

        {results.length > 0 && (
          <section className="card">
            <b>Recent results</b>
            <div className="list" style={{ marginTop: 6 }}>
              {results.map((r) => (
                <Link key={r.id} href={`/c/${id}/matches/${r.id}/report`} className="item">
                  <span className="t grow"><b>{r.n1} v {r.n2}</b><small>{r.text}</small></span>
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="card list">
          <Link href={`/c/${id}/invite`} className="item"><span className="t grow"><b>Invite friends</b><small>Link and code</small></span><span aria-hidden="true">›</span></Link>
          <Link href={`/c/${id}/alerts`} className="item"><span className="t grow"><b>Alerts</b><small>{alerts ? `${alerts} unread` : "Nothing new"}</small></span><span aria-hidden="true">›</span></Link>
          <Link href={`/c/${id}/members`} className="item"><span className="t grow"><b>Members</b><small>{members} players</small></span><span aria-hidden="true">›</span></Link>
          {membership.role === "admin" && (
            <Link href={`/c/${id}/requests`} className="item"><span className="t grow"><b>Join requests</b><small>{pending.length ? `${pending.length} waiting` : "None waiting"}</small></span><span aria-hidden="true">›</span></Link>
          )}
        </section>
      </div>
    </Frame>
  );
}
