import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { SettingsForm } from "@/components/Forms2";
import { requireAdmin } from "@/lib/community";
import { one } from "@/lib/db";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Community settings" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community } = await requireAdmin(id, user.id); // Admin only, checked on the server
  const names = await one<{ added: string | null; changed: string | null }>(
    "select (select name from app_user where id = $1) as added, (select name from app_user where id = $2) as changed",
    [community.created_by, (await one<{ changed_by: string }>("select changed_by from community where id = $1", [id]))?.changed_by ?? community.created_by],
  );
  return (
    <Frame communityId={id} title="Community settings" back={`/c/${id}/community`}>
      <div className="stack">
        <SettingsForm
          communityId={id}
          name={community.name}
          description={community.description}
          location={community.location}
          approvalRequired={community.approval_required}
        />
        <p className="muted small" style={{ margin: 0 }}>Added by <b style={{ color: "var(--white)" }}>{names?.added ?? "—"}</b> · Last changed by <b style={{ color: "var(--white)" }}>{names?.changed ?? "—"}</b></p>
        <section className="card">
          <b>Danger zone</b>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>Deleting removes the community, its members and its history for everyone. It cannot be undone.</p>
          <Link href={`/c/${id}/delete`} className="btn red small">Delete community…</Link>
        </section>
      </div>
    </Frame>
  );
}
