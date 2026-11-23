import type { Metadata } from "next";
import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { teamTable } from "@/lib/reports";
import { listTeams } from "@/lib/teams";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const teams = await listTeams(id);
  const table = (await teamTable(id, teams.map((t) => ({ id: t.id, name: t.name })))).filter((t) => t.played > 0);
  return (
    <Frame communityId={id} title="Teams">
      <div className="stack">
        {teams.length === 0 ? (
          <section className="card center" style={{ padding: "24px 14px" }}>
            <h2 style={{ fontSize: "1.1rem" }}>Make your first team</h2>
            <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>Teams keep a regular squad. Each match picks its own lineup, so the squad never changes by accident.</p>
          </section>
        ) : (
          <section className="card list">
            {teams.map((t) => (
              <Link key={t.id} href={`/c/${id}/teams/${t.id}`} className="item">
                <CommunityLogo name={t.name} />
                <span className="t grow">
                  <b>{t.name}</b>
                  <small>{t.captain_name ? `Captain ${t.captain_name}` : "No captain yet"}{t.vice_name ? ` · Vice ${t.vice_name}` : ""} · {t.squad_count} player{t.squad_count === 1 ? "" : "s"}</small>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </section>
        )}
        {table.length > 0 && (
          <section className="card">
            <b>Team table</b>
            <table className="board" aria-label="Team table">
              <thead><tr><td className="muted small">Team</td><td className="muted small">P</td><td className="muted small">W</td><td className="muted small">L</td><td className="muted small">T</td><td className="muted small">Win %</td><td className="muted small">Runs</td></tr></thead>
              <tbody>
                {table.map((t) => (
                  <tr key={t.id}><td><Link href={`/c/${id}/teams/${t.id}`}><b>{t.name}</b></Link></td><td>{t.played}</td><td>{t.won}</td><td>{t.lost}</td><td>{t.tied}</td><td>{t.winPercent === null ? "–" : t.winPercent.toFixed(0)}</td><td>{t.totalRuns}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="muted small" style={{ margin: "6px 0 0" }}>Ranked by wins, then win percentage, then runs.</p>
          </section>
        )}
        <Link href={`/c/${id}/teams/new`} className="btn gold">New team</Link>
        <p className="muted small" style={{ margin: "0 2px" }}>Any member can create teams. Each team shows who created it and who changed it last.</p>
        <section className="card list">
          <Link href={`/c/${id}/members`} className="item"><span className="t grow"><b>Members</b><small>Everyone in this community</small></span><span aria-hidden="true">›</span></Link>
          <Link href={`/c/${id}/series`} className="item"><span className="t grow"><b>Series</b><small>Group matches: best of 3, tournaments</small></span><span aria-hidden="true">›</span></Link>
          <Link href={`/c/${id}/leaderboard`} className="item"><span className="t grow"><b>Leaderboards</b><small>Rank every member by any stat</small></span><span aria-hidden="true">›</span></Link>
          <Link href={`/c/${id}/insights`} className="item"><span className="t grow"><b>Insights</b><small>Records, partnerships, bowling by over</small></span><span aria-hidden="true">›</span></Link>
          <Link href={`/c/${id}/compare`} className="item"><span className="t grow"><b>Compare two players</b><small>Side by side</small></span><span aria-hidden="true">›</span></Link>
        </section>
      </div>
    </Frame>
  );
}
