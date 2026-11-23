import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { setSquadAction } from "@/app/actions3";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { getTeam, listSquad } from "@/lib/teams";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit squad" };

// The permanent squad. Plain checkboxes, so it works on any phone.
export default async function SquadPage({ params, searchParams }: { params: Promise<{ id: string; teamId: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id, teamId } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const team = await getTeam(id, teamId);
  if (!team) notFound();
  const [members, squad] = await Promise.all([listApprovedMembers(id), listSquad(teamId)]);
  const inSquad = new Set(squad.map((s) => s.user_id));
  return (
    <Frame communityId={id} title={`${team.name} squad`} back={isNew ? undefined : `/c/${id}/teams/${teamId}`}>
      <form action={setSquadAction} className="stack">
        <input type="hidden" name="communityId" value={id} />
        <input type="hidden" name="teamId" value={teamId} />
        {isNew && <div className="banner green">Team created. Now choose its regular players.</div>}
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>The permanent squad is the team&rsquo;s regular players. For each match you pick the actual lineup separately.</p>
        <section className="card list">
          {members.map((m) => {
            const role = labelOf(PLAYING_ROLES, m.playing_role);
            return (
              <label key={m.user_id} className="item" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="member" value={m.user_id} defaultChecked={inSquad.has(m.user_id)} style={{ width: 24, height: 24, accentColor: "var(--gold)" }} />
                <Shirt number={m.player_number} size="small" />
                <span className="t grow"><b>{m.name}</b>{role && <small>{role}</small>}</span>
              </label>
            );
          })}
        </section>
        <p className="muted small" style={{ margin: 0 }}>Taking the captain or vice-captain out of the squad also removes that role.</p>
        <button className="btn gold">Save squad</button>
      </form>
    </Frame>
  );
}
