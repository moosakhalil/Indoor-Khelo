import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import ManageMember from "@/components/ManageMember";
import { countAdmins } from "@/lib/b3Data";
import { getMembership, isUuid, requireAdmin } from "@/lib/community";
import { one } from "@/lib/db";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/b3.css";

export const metadata: Metadata = { title: "Manage member" };

// Admin only (checked here on the server). The actions themselves are checked again in the server actions.
export default async function ManageMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; userId: string }>;
  searchParams: Promise<{ error?: string; done?: string; do?: string }>;
}) {
  const { id, userId } = await params;
  const { error, done, do: wants } = await searchParams;
  if (!isUuid(userId)) notFound();
  const me = await requireAcceptedUser();
  const { community } = await requireAdmin(id, me.id);
  const m = await getMembership(id, userId);
  if (!m || m.status !== "approved") notFound();
  const person = await one<{ name: string }>("select name from app_user where id = $1", [userId]);
  const adminCount = await countAdmins(id);

  return (
    <Frame communityId={id} title="Manage member" back={`/c/${id}/members`}>
      <ManageMember
        communityId={id}
        communityName={community.name}
        userId={userId}
        name={person?.name ?? "Member"}
        role={m.role}
        number={m.player_number}
        isSelf={userId === me.id}
        adminCount={adminCount}
        initialError={error}
        initialDone={done === "number"}
        autoOpen={wants === "role" || wants === "number" || wants === "remove" ? wants : undefined}
      />
    </Frame>
  );
}
