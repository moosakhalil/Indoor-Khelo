import type { Metadata } from "next";
import QuickMatchForm from "@/components/QuickMatchForm";
import QuickShell from "@/components/QuickShell";
import { requireMember } from "@/lib/community";
import { rosterFor } from "@/lib/quickMatch";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "New match with no signal" };
export const dynamic = "force-dynamic";

// Opens with no signal once it has been opened (or Home has been visited) online: the page is kept by the phone and the
// players are kept in its storage. The page itself shows nothing private beyond the community's player list.
// It uses QuickShell, not Frame: Frame loads the alerts bell and the sidebar from the server, and this page must not need (or keep a copy of) any of that.
export default async function QuickMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const roster = await rosterFor(id, user.id);
  return (
    <QuickShell communityId={id} title="Offline match" back={`/c/${id}/matches`} ready={roster.members.length > 0}>
      <QuickMatchForm communityId={id} fallback={roster} />
    </QuickShell>
  );
}
