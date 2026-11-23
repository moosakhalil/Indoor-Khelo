import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { TeamForm } from "@/components/Forms3";
import { deleteTeamAction } from "@/app/actions3";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { getTeam } from "@/lib/teams";

export const metadata: Metadata = { title: "Edit team" };

export default async function EditTeamPage({ params }: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const team = await getTeam(id, teamId);
  if (!team) notFound();
  const members = await listApprovedMembers(id);
  return (
    <Frame communityId={id} title="Edit team" back={`/c/${id}/teams/${teamId}`}>
      <div className="stack">
        <TeamForm mode="edit" communityId={id} teamId={teamId} members={members} team={team} />
        <section className="card">
          <b>Delete this team</b>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>Removes the team and its squad. Matches already played stay on record once matches exist.</p>
          <details>
            <summary className="btn red small" style={{ listStyle: "none", cursor: "pointer" }}>Delete {team.name}…</summary>
            <form action={deleteTeamAction} style={{ marginTop: 10 }}>
              <input type="hidden" name="communityId" value={id} />
              <input type="hidden" name="teamId" value={teamId} />
              <button className="btn red small">Yes, delete {team.name}</button>
            </form>
          </details>
        </section>
      </div>
    </Frame>
  );
}
