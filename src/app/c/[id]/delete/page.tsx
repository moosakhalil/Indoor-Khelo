import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { DeleteCommunityForm } from "@/components/Forms2";
import { requireAdmin } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Delete community" };

export default async function DeletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community } = await requireAdmin(id, user.id);
  return (
    <Frame communityId={id} title="Delete community" back={`/c/${id}/settings`}>
      <div className="stack">
        <div className="banner red">This deletes <b>{community.name}</b>, all its members and its history for everyone. It cannot be undone.</div>
        <DeleteCommunityForm communityId={id} name={community.name} />
      </div>
    </Frame>
  );
}
