import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { ProfileForm } from "@/components/Forms3";
import { requireMember } from "@/lib/community";
import { getProfile } from "@/lib/profile";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const profile = await getProfile(user.id); // always my own profile, never someone else's
  if (!profile) notFound();
  return (
    <Frame communityId={id} title="Edit profile" back={`/c/${id}/profile`}>
      <ProfileForm communityId={id} profile={profile} />
    </Frame>
  );
}
