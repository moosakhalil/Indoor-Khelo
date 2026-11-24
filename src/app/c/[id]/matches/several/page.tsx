import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { SvClose } from "@/components/C2Icons";
import SeveralPlan from "@/components/SeveralPlan";
import { requireMember } from "@/lib/community";
import { pickableTeams } from "@/lib/c2Data";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plan several matches" };

// Phase C (UI redesign): team cards, players-per-side stepper, compact match rows and a live recap. Same action, same fields.
export default async function SeveralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const teams = await pickableTeams(id, user.id);
  return (
    <Frame
      communityId={id}
      title="Plan several matches"
      back={`/c/${id}/matches`}
      right={<Link href={`/c/${id}/matches`} className="sv-xlink" aria-label="Close and go back to matches"><SvClose /></Link>}
      panel={<div id="sv-panel" />}
    >
      <SeveralPlan communityId={id} teams={teams} />
    </Frame>
  );
}
