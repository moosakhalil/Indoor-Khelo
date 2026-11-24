import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Frame from "@/components/Frame";
import { IconCross } from "@/components/B4Icons";
import MatchEditor from "@/components/MatchEditor";
import MatchNotice from "@/components/MatchNotice";
import { requireMember } from "@/lib/community";
import { recentSetup } from "@/lib/crData";
import { valuesFromMatch } from "@/lib/crSetup";
import { getMatch, listLineup, listReplies } from "@/lib/matches";
import { NOT_STARTED, formatWhen, toLocalInput } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { teamsOfPlayer, listTeams } from "@/lib/teams";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Edit match" };

type Q = { e?: string; n?: string; skip?: string; side?: string; max?: string };

export default async function EditMatchPage({ params, searchParams }: { params: Promise<{ id: string; matchId: string }>; searchParams: Promise<Q> }) {
  const { id, matchId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  // Only a match that has not started can be edited (a cancelled one can only be deleted).
  if (!(NOT_STARTED as readonly string[]).includes(m.status)) redirect(`/c/${id}/matches/${matchId}?e=locked`);
  const tz = await getZone();
  const [lineup, mine, teams, recent, replies] = await Promise.all([listLineup(id, matchId), teamsOfPlayer(id, user.id), listTeams(id), recentSetup(id, tz), listReplies(id, matchId)]);
  const mineIds = new Set(mine.map((t) => t.id));
  for (const t of teams) if (t.captain_id === user.id || t.vice_captain_id === user.id) mineIds.add(t.id);
  const count = (sideId: string) => lineup.filter((p) => p.side_id === sideId).length;
  const title = `${m.side1_name} v ${m.side2_name}`;
  const base = `/c/${id}/matches/${matchId}`;
  return (
    <Frame communityId={id} title="Edit match" back={base} subtitle={<span className="cr-sub">{title}</span>}
      right={<Link href={base} className="cr-x" aria-label="Close and go back to the match"><IconCross size={20} /></Link>}>
      <MatchNotice code={q.e} extra={{ n: q.n, skip: q.skip, side: q.side, max: q.max }} communityId={id} matchId={matchId} />
      <MatchEditor
        communityId={id} matchId={matchId} status={m.status}
        sideA={{ name: m.side1_name, mine: !!(m.side1_team && mineIds.has(m.side1_team)) }}
        sideB={{ name: m.side2_name, mine: !!(m.side2_team && mineIds.has(m.side2_team)) }}
        lineup={{ a: count(m.side1_id), b: count(m.side2_id) }}
        initialValues={valuesFromMatch({
          when: toLocalInput(m.scheduled_at, tz), venue: m.venue, overs: m.overs, playersPerSide: m.players_per_side, rules: m.rules, umpire: m.umpire, notes: m.notes,
        })}
        comingCount={replies.filter((p) => p.answer === "in").length}
        recentVenues={recent.venues} lastWhen={recent.lastWhen} whenLabel={m.scheduled_at ? formatWhen(m.scheduled_at, tz) : ""}
      />
    </Frame>
  );
}
