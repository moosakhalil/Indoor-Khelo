import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Frame from "@/components/Frame";
import { MatchForm } from "@/components/Forms4";
import { requireMember } from "@/lib/community";
import { getMatch } from "@/lib/matches";
import { NOT_STARTED, toLocalInput } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Edit match" };

export default async function EditMatchPage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  if (!(NOT_STARTED as readonly string[]).includes(m.status)) redirect(`/c/${id}/matches/${matchId}?e=locked`);
  const tz = await getZone();
  return (
    <Frame communityId={id} title="Edit match" back={`/c/${id}/matches/${matchId}`}>
      <MatchForm
        mode="edit" communityId={id} matchId={matchId} teams={[]}
        defaults={{
          when: toLocalInput(m.scheduled_at, tz), venue: m.venue, overs: m.overs, playersPerSide: m.players_per_side, rules: m.rules,
          umpire: m.umpire, notes: m.notes, sideAName: m.side1_name, sideBName: m.side2_name,
        }}
      />
    </Frame>
  );
}
