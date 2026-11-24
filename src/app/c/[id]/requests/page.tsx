import type { Metadata } from "next";
import Frame from "@/components/Frame";
import RequestsList, { WhatHappensNext } from "@/components/RequestsList";
import { approvedCount, listPending, requireAdmin } from "@/lib/community";
import { askedAgo } from "@/lib/b3";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/b3.css";

export const metadata: Metadata = { title: "Join requests" };

export default async function RequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireAdmin(id, user.id); // only the Admin can open this, checked on the server
  const [pending, members] = await Promise.all([listPending(id), approvedCount(id)]);
  const now = new Date();
  return (
    <Frame
      communityId={id}
      title="Join requests"
      back={`/c/${id}`}
      right={pending.length ? <span className="chip gold">{pending.length} waiting</span> : null}
      panel={<WhatHappensNext members={members} />}
    >
      <RequestsList
        communityId={id}
        members={members}
        requests={pending.map((p) => ({ userId: p.user_id, name: p.name, asked: askedAgo(p.requested_at, now) }))}
      />
    </Frame>
  );
}
