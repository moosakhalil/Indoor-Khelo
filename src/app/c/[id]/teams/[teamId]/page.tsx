import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityLogo from "@/components/CommunityLogo";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { getTeam, listSquad } from "@/lib/teams";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const team = await getTeam(id, teamId);
  if (!team) notFound();
  const squad = await listSquad(teamId);
  return (
    <Frame communityId={id} title={team.name} back={`/c/${id}/teams`} right={<Link href={`/c/${id}/teams/${teamId}/edit`} className="chip">Edit</Link>}>
      <div className="stack">
        <section className="card">
          <div className="row">
            <CommunityLogo name={team.name} big />
            <span className="t grow">
              <b style={{ fontSize: "1.15rem" }}>{team.name}</b>
              <small className="muted" style={{ display: "block" }}>{team.captain_name ? `Captain ${team.captain_name}` : "No captain yet"}{team.vice_name ? ` · Vice-captain ${team.vice_name}` : ""}</small>
            </span>
          </div>
          {team.description && <p className="muted" style={{ margin: "10px 0 0" }}>{team.description}</p>}
          <p className="muted small" style={{ margin: "10px 0 0" }}>Added by <b style={{ color: "var(--white)" }}>{team.added_by ?? "—"}</b> · Changed by <b style={{ color: "var(--white)" }}>{team.changed_by ?? "—"}</b></p>
        </section>

        <section>
          <h2 style={{ fontSize: "1rem", margin: "4px 0 2px" }}>Permanent squad <small className="muted">({squad.length})</small></h2>
          <p className="muted small" style={{ margin: "0 0 8px" }}>The regular players. For each match you pick the actual lineup separately, so changing a lineup never changes this squad.</p>
          <div className="card list">
            {squad.length === 0 && <div className="item muted">No players yet.</div>}
            {squad.map((m) => {
              const role = labelOf(PLAYING_ROLES, m.playing_role);
              const tag = [m.user_id === team.captain_id ? "Captain" : null, m.user_id === team.vice_captain_id ? "Vice-captain" : null, role].filter(Boolean).join(" · ");
              return (
                <Link key={m.user_id} href={`/c/${id}/players/${m.user_id}`} className="item">
                  <Shirt number={m.player_number} />
                  <span className="t grow"><b>{m.name}</b>{tag && <small>{tag}</small>}</span>
                  <span aria-hidden="true">›</span>
                </Link>
              );
            })}
          </div>
        </section>
        <Link href={`/c/${id}/teams/${teamId}/squad`} className="btn gold">Edit squad</Link>

        <section className="card center muted">Team record, head to head and recent matches arrive with match stats (a later phase).</section>
      </div>
    </Frame>
  );
}
