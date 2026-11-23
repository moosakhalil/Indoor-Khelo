import type { Metadata } from "next";
import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { listTeams } from "@/lib/teams";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const teams = await listTeams(id);
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
        <Link href={`/c/${id}/teams/new`} className="btn gold">New team</Link>
        <p className="muted small" style={{ margin: "0 2px" }}>Any member can create teams. Each team shows who created it and who changed it last.</p>
        <section className="card list">
          <Link href={`/c/${id}/members`} className="item"><span className="t grow"><b>Members</b><small>Everyone in this community</small></span><span aria-hidden="true">›</span></Link>
          <div className="item muted"><span className="t grow"><b>Leaderboards</b><small>Arrive with match stats (a later phase)</small></span></div>
        </section>
      </div>
    </Frame>
  );
}
