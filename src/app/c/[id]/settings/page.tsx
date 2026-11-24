import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { DangerZone, SettingsForm, SettingsHistory, SettingsPreview, SettingsProvider } from "@/components/SettingsB3";
import { approvedCount, requireAdmin } from "@/lib/community";
import { one } from "@/lib/db";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/b3.css";

export const metadata: Metadata = { title: "Community settings" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community } = await requireAdmin(id, user.id); // Admin only, checked on the server
  const names = await one<{ added: string | null; changed: string | null }>(
    "select (select name from app_user where id = $1) as added, (select name from app_user where id = $2) as changed",
    [community.created_by, (await one<{ changed_by: string }>("select changed_by from community where id = $1", [id]))?.changed_by ?? community.created_by],
  );
  const memberCount = await approvedCount(id);
  const added = names?.added ?? "—";
  const changed = names?.changed ?? "—";
  return (
    <SettingsProvider
      initial={{ name: community.name, location: community.location, description: community.description, approval: community.approval_required }}
      memberCount={memberCount}
    >
      <Frame
        communityId={id}
        title="Community settings"
        back={`/c/${id}/community`}
        panel={
          <div className="stack">
            <SettingsPreview />
            <SettingsHistory added={added} changed={changed} />
            <DangerZone communityId={id} />
          </div>
        }
      >
        <div className="stack">
          <SettingsForm communityId={id} />
          <div className="stack st-inline">
            <SettingsPreview />
            <SettingsHistory added={added} changed={changed} />
            <DangerZone communityId={id} />
          </div>
        </div>
      </Frame>
    </SettingsProvider>
  );
}
