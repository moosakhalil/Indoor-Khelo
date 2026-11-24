import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import PfProfileForm from "@/components/PfProfileForm";
import { requireMember } from "@/lib/community";
import { getProfile } from "@/lib/profile";
import { requireAcceptedUser } from "@/lib/session";
import { teamsOfPlayer } from "@/lib/teams";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const [profile, teams] = await Promise.all([getProfile(user.id), teamsOfPlayer(id, user.id)]); // always my own profile, never someone else's
  if (!profile) notFound();
  return (
    <Frame communityId={id} title="Edit profile" back={`/c/${id}/profile`}>
      <PfProfileForm
        communityId={id}
        profile={profile}
        number={membership.player_number}
        adminLabel={membership.role === "admin" ? "Admin · " : ""}
        teams={teams.map((t) => ({ ...t, mine: true }))}
      />
    </Frame>
  );
}
