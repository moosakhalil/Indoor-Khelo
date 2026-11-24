import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Frame from "@/components/Frame";
import LineupPicker from "@/components/LineupPicker";
import { PanelSlot } from "@/components/LuPanel";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { getMatch, listLineup, listReplies } from "@/lib/matches";
import { NOT_STARTED } from "@/lib/matchRules";
import { noticeFor } from "@/lib/notices";
import { requireAcceptedUser } from "@/lib/session";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";
import type { PickGuest, PickMember } from "@/lib/lineupPick";

export const metadata: Metadata = { title: "Pick lineups" };

type Q = { e?: string; n?: string; skip?: string; side?: string; max?: string };

// Lineups for both sides on one screen. Replies decide only the order of the list, never who can play.
// The picking itself happens in the browser (LineupPicker) and is saved with one button.
export default async function LineupPage({ params, searchParams }: { params: Promise<{ id: string; matchId: string }>; searchParams: Promise<Q> }) {
  const { id, matchId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  if (!(NOT_STARTED as readonly string[]).includes(m.status)) redirect(`/c/${id}/matches/${matchId}?e=locked`);
  const [lineup, replies, members] = await Promise.all([listLineup(id, matchId), listReplies(id, matchId), listApprovedMembers(id)]);

  const sideOf = new Map<string, 1 | 2>();
  for (const l of lineup) if (l.user_id) sideOf.set(l.user_id, l.position);
  const roleOf = new Map(members.map((p) => [p.user_id, p.playing_role]));

  const people: PickMember[] = replies.map((p) => ({
    id: p.user_id,
    name: p.name,
    number: p.player_number,
    answer: p.answer === "in" ? "in" : p.answer === "out" ? "out" : null,
    role: labelOf(PLAYING_ROLES, roleOf.get(p.user_id) ?? null) || null,
    saved: sideOf.get(p.user_id) ?? 0,
  }));
  const guests: PickGuest[] = lineup
    .filter((l) => l.kind !== "member")
    .map((g) => ({ id: g.id, name: g.name, kind: g.kind === "linked" ? "linked" : "guest", userId: g.user_id, linkedBy: g.linked_by_name ?? null, saved: g.position }));
  // Anyone saved on a side who is not in the member list any more still counts toward the limit.
  const listed = new Set(replies.map((r) => r.user_id));
  const fixed: [number, number] = [0, 0];
  for (const l of lineup) if (l.kind === "member" && l.user_id && !listed.has(l.user_id)) fixed[l.position - 1] += 1;

  const sides: [string, string] = [m.side1_name, m.side2_name];
  const notice = noticeFor(q.e, { n: q.n, skip: q.skip, side: q.side, max: q.max });

  return (
    <Frame communityId={id} title="Pick lineups" subtitle={<small className="muted">{sides[0]} v {sides[1]}</small>} back={`/c/${id}/matches/${matchId}`} panel={<PanelSlot />}>
      <LineupPicker
        communityId={id} matchId={matchId} sides={sides} max={m.players_per_side}
        members={people} guests={guests} fixed={fixed} notice={notice}
        editHref={`/c/${id}/matches/${matchId}/edit`}
      />
    </Frame>
  );
}
