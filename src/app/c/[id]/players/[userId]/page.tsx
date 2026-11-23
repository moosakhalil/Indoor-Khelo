import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import PlayerStats, { STAT_TABS, type StatTab } from "@/components/PlayerStats";
import Shirt from "@/components/Shirt";
import { careerOf } from "@/lib/career";
import { requireMember } from "@/lib/community";
import { getPlayerInCommunity } from "@/lib/profile";
import { playerLines } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";
import { listTeams, teamsOfPlayer } from "@/lib/teams";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Player" };
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Q = { tab?: string; lines?: string; scope?: string; team?: string; from?: string; to?: string };

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string; userId: string }>; searchParams: Promise<Q> }) {
  const { id, userId } = await params;
  const q = await searchParams;
  const me = await requireAcceptedUser();
  const { membership } = await requireMember(id, me.id);
  const p = await getPlayerInCommunity(id, userId);
  if (!p) notFound();
  const [teams, allTeams] = await Promise.all([teamsOfPlayer(id, userId), listTeams(id)]);
  const isMe = me.id === userId;

  // filters live in the address, so a stats page can be shared or reloaded exactly as it is
  const from = q.from && DATE.test(q.from) ? q.from : null;
  const to = q.to && DATE.test(q.to) ? q.to : null;
  const teamId = q.team && allTeams.some((t) => t.id === q.team) ? q.team : null;
  const allCommunities = q.scope === "all";
  const hasFilters = !!(from || to || teamId || allCommunities);
  const lines = await playerLines(id, userId, { allCommunities, teamId, from, to });
  const career = careerOf(lines);
  const tab: StatTab = STAT_TABS.some(([k]) => k === q.tab) ? (q.tab as StatTab) : "overview";
  const linesFilter = q.lines === "bat" || q.lines === "bowl" ? q.lines : "all";
  const keep = new URLSearchParams();
  if (allCommunities) keep.set("scope", "all");
  if (teamId) keep.set("team", teamId);
  if (from) keep.set("from", from);
  if (to) keep.set("to", to);
  const base = `/c/${id}/players/${userId}${keep.toString() ? `?${keep.toString()}` : ""}`;

  const rows: [string, string | null][] = [
    ["Playing role", labelOf(PLAYING_ROLES, p.playing_role)],
    ["Batting hand", labelOf(BATTING_HANDS, p.batting_hand)],
    ["Batting position", labelOf(BATTING_POSITIONS, p.batting_position)],
    ["Bowling style", labelOf(BOWLING_STYLES, p.bowling_style)],
  ];

  return (
    <Frame communityId={id} title="Player" back={`/c/${id}/members`}>
      <div className="stack">
        <section className="card center">
          <div style={{ display: "flex", justifyContent: "center" }}><Shirt number={p.player_number} size="big" /></div>
          <h2 style={{ marginTop: 8 }}>{p.name}{isMe ? " (you)" : ""}</h2>
          <p className="muted small" style={{ margin: "2px 0 0" }}>{p.community_role === "admin" ? "Admin · " : ""}Number {p.player_number}</p>
        </section>

        <section className="card list">
          {rows.map(([label, value]) => (
            <div key={label} className="item space"><span className="muted">{label}</span><b>{value ?? "Not set"}</b></div>
          ))}
          <div className="item" style={{ alignItems: "flex-start" }}>
            <span className="muted" style={{ width: "40%" }}>Teams</span>
            <span className="row wrap grow" style={{ justifyContent: "flex-end" }}>
              {teams.length === 0 ? <b>None yet</b> : teams.map((t) => <Link key={t.id} href={`/c/${id}/teams/${t.id}`} className="chip">{t.name}</Link>)}
            </span>
          </div>
        </section>

        <form method="get" className="card" aria-label="Filter the statistics">
          <input type="hidden" name="tab" value={tab} />
          <b>Filters</b>
          <div className="two" style={{ marginTop: 6 }}>
            <div>
              <label className="lb" htmlFor="f-scope" style={{ marginTop: 0 }}>Where</label>
              <select id="f-scope" name="scope" className="field" defaultValue={allCommunities ? "all" : "community"}><option value="community">This community</option><option value="all">All time, every community</option></select>
            </div>
            <div>
              <label className="lb" htmlFor="f-team" style={{ marginTop: 0 }}>Team</label>
              <select id="f-team" name="team" className="field" defaultValue={teamId ?? ""}><option value="">Any team</option>{allTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
          </div>
          <div className="two">
            <div><label className="lb" htmlFor="f-from">From</label><input id="f-from" type="date" name="from" className="field" defaultValue={from ?? ""} /></div>
            <div><label className="lb" htmlFor="f-to">To</label><input id="f-to" type="date" name="to" className="field" defaultValue={to ?? ""} /></div>
          </div>
          <div className="two" style={{ marginTop: 10 }}>
            <button className="btn gold small" style={{ width: "100%" }}>Apply</button>
            {hasFilters && <Link href={`/c/${id}/players/${userId}?tab=${tab}`} className="btn ghost small" style={{ width: "100%" }}>Clear filters</Link>}
          </div>
        </form>

        {career.matches === 0 ? (
          <section className="card center">
            <b>{hasFilters ? "No matches for these filters" : "Stats start here"}</b>
            <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
              {hasFilters ? "Try clearing a filter." : "Records build only from matches scored in Indoor Khelo. Nothing is added by hand. Runs, wickets, catches and awards appear here after this player’s first finished match."}
            </p>
          </section>
        ) : (
          <PlayerStats c={career} lines={lines} tab={tab} base={base} linesFilter={linesFilter} communityId={id} />
        )}

        {isMe && <Link href={`/c/${id}/profile/edit`} className="btn gold">Edit my profile</Link>}
        {membership.role === "admin" && !isMe && <Link href={`/c/${id}/members/${userId}`} className="btn ghost">Manage this member (Admin)</Link>}
      </div>
    </Frame>
  );
}
