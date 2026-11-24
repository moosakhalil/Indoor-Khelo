import type { Metadata } from "next";
import CnDelete from "@/components/CnDelete";
import Frame from "@/components/Frame";
import { requireAdmin } from "@/lib/community";
import { deleteCounts } from "@/lib/cnData";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/cn.css";

export const metadata: Metadata = { title: "Delete community" };

export default async function DeletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community } = await requireAdmin(id, user.id);
  const counts = await deleteCounts(id);
  return (
    <Frame communityId={id} title="Delete community" back={`/c/${id}/settings`}>
      <CnDelete communityId={id} name={community.name} counts={counts} />
    </Frame>
  );
}
