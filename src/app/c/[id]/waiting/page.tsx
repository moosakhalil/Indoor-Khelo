import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CnTopBar from "@/components/CnTopBar";
import { RejectedCard, WaitingCard } from "@/components/CnWaiting";
import { getCommunity, getMembership } from "@/lib/community";
import { one } from "@/lib/db";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Waiting for approval" };

export default async function WaitingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const community = await getCommunity(id);
  if (!community) redirect("/choose");
  const m = await getMembership(id, user.id);
  if (!m || m.status === "left" || m.status === "removed") redirect("/choose");
  if (m.status === "approved") redirect(m.player_number === null ? `/c/${id}/number` : `/c/${id}`);

  if (m.status === "rejected") {
    return (
      <main className="app cn-page">
        <CnTopBar />
        <RejectedCard communityName={community.name} inviteCode={community.invite_code} />
      </main>
    );
  }

  const admin = await one<{ name: string }>("select name from app_user where id = $1", [community.created_by]);
  const adminMember = await getMembership(id, community.created_by);
  const adminNumber = adminMember && adminMember.status === "approved" ? adminMember.player_number : null;
  return (
    <main className="app cn-page">
      <CnTopBar />
      <WaitingCard communityId={id} communityName={community.name} adminName={admin?.name ?? null} adminNumber={adminNumber} />
    </main>
  );
}
