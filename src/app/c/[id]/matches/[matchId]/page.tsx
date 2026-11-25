import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import Frame from "@/components/Frame";
import MatchBug from "@/components/MatchBug";
import MatchHero from "@/components/MatchHero";
import MatchToss from "@/components/MatchToss";
import MdAvailability from "@/components/MdAvailability";
import MdLineups, { type LineupRow, type LineupSide } from "@/components/MdLineups";
import { MdLinkCard, MdManageCard, MdPrimary, MdRules, MdStatusNotice, MdTopNotices, type NoticeQuery } from "@/components/MdParts";
import MdSide, { MdPanelSlot } from "@/components/MdSide";
import MdTopRight from "@/components/MdTopRight";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { buildState } from "@/lib/engine/engine";
import { getLock, loadEvents, scorersOf } from "@/lib/scoring";
import { getMatch, listLineup, listReplies, noReplyCount } from "@/lib/matches";
import { lineupGap, primaryAction } from "@/lib/md";
import { seriesOfMatch } from "@/lib/seriesDb";
import { NOT_STARTED, bowlerLimitWarning, formatWhen, patternText } from "@/lib/matchRules";
import { getOrigin } from "@/lib/origin";
import { mayManage } from "@/lib/ownerRule";
import { requireAcceptedUser } from "@/lib/session";
import { listTeams, teamsOfPlayer } from "@/lib/teams";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";
import { getZone } from "@/lib/zone";
import "@/components/md.css";

export const metadata: Metadata = { title: "Match" };

// Phase D1 (UI redesign): Match details. The hero with both team badges and four fact tiles, the score bug, one primary action per status,
// "Are you coming?" as a bar and tabs, a lineup card per team, the toss, the rules, the match link and "Manage match".
// Everything the page did before is still here: the same data, the same server actions, the same permissions (any approved member).
export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string; matchId: string }>; searchParams: Promise<NoticeQuery> }) {
  const { id, matchId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  // Cancel and delete are for the person who added the match, or an Admin (lib/ownerRule.ts). Everything else is open to every member.
  const canManage = mayManage({ id: user.id, admin: membership.role === "admin" }, m.created_by);
  const series = await seriesOfMatch(id, matchId);
  const [lineup, replies, members, tz, origin, events, lock, scorers, squads, teams] = await Promise.all([
    listLineup(id, matchId), listReplies(id, matchId), listApprovedMembers(id), getZone(), getOrigin(), loadEvents(matchId), getLock(id, matchId), scorersOf(matchId),
    teamsOfPlayer(id, user.id), listTeams(id),
  ]);
  const built = buildState(events);
  const state = built.ok && built.state.started ? built.state : null;
  const isLive = m.status === "live" || m.status === "paused";
  const notStarted = (NOT_STARTED as readonly string[]).includes(m.status);
  const base = `/c/${id}/matches/${matchId}`;
  const link = `${origin}${base}`;
  const r = m.rules;
  const warning = bowlerLimitWarning(r.bowlerLimit, m.overs);
  const sideName = (pos: 1 | 2) => (pos === 1 ? m.side1_name : m.side2_name);
  const title = `${m.side1_name} v ${m.side2_name}`;
  // "My teams": a team I play for or captain. Its badge gets the gold ring.
  const myTeams = new Set<string>(squads.map((t) => t.id));
  for (const t of teams) if (t.captain_id === user.id || t.vice_captain_id === user.id) myTeams.add(t.id);
  const mine: [boolean, boolean] = [!!(m.side1_team && myTeams.has(m.side1_team)), !!(m.side2_team && myTeams.has(m.side2_team))];

  const inMatch = new Set(lineup.map((l) => l.user_id).filter(Boolean));
  const linkable = members.filter((p) => !inMatch.has(p.user_id)).map((p) => ({ userId: p.user_id, name: p.name, number: p.player_number, role: labelOf(PLAYING_ROLES, p.playing_role) ?? "Member" }));
  const rowOf = (p: (typeof lineup)[number]): LineupRow => ({
    id: p.id, name: p.name, userId: p.user_id, number: p.player_number, kind: p.kind,
    sub: p.kind === "guest" ? "Guest" : p.kind === "linked" ? `Guest · linked by ${p.linked_by_name ?? "a member"}` : labelOf(PLAYING_ROLES, p.playing_role) ?? "Member",
  });
  const sideOf = (pos: 1 | 2): LineupSide => ({ pos, name: sideName(pos), needed: m.players_per_side, mine: mine[pos - 1], rows: lineup.filter((l) => l.position === pos).map(rowOf) });
  const sides: [LineupSide, LineupSide] = [sideOf(1), sideOf(2)];

  const limitText = r.bowlerLimit.mode === "none" ? "No limit" : r.bowlerLimit.mode === "max" ? `${r.bowlerLimit.overs} over${r.bowlerLimit.overs === 1 ? "" : "s"} per bowler` : `Pattern ${patternText(r.bowlerLimit.pattern)}`;
  const played = ["live", "paused", "completed", "abandoned"].includes(m.status);
  const primary = primaryAction(base, m.status, { iHoldTheLock: lock?.scorer_id === user.id, scorerName: isLive ? lock?.scorer_name ?? null : null });
  const gap = lineupGap(m.status, [sides[0].rows.length, sides[1].rows.length]);
  const rematchLabel = series?.status === "open" ? "Play another match in this series" : "Rematch";
  const whenLabel = m.scheduled_at ? formatWhen(m.scheduled_at, tz) : "";
  const bugSub = `${m.overs} overs${m.venue ? ` · ${m.venue}` : ""}`;

  return (
    <Frame
      communityId={id}
      title="Match"
      subtitle={<small className="muted">{title}</small>}
      back={`/c/${id}/matches`}
      right={<MdTopRight communityId={id} matchId={matchId} status={m.status} link={link} title={title} rematchLabel={rematchLabel} canManage={canManage} />}
      panel={<MdPanelSlot />}
    >
      <div className="stack">
        {isLive && <AutoRefresh seconds={5} />}
        <MdTopNotices q={q} communityId={id} matchId={matchId} warning={warning} />
        <MdStatusNotice status={m.status} communityId={id} matchId={matchId} />

        <MatchHero communityId={id} matchId={matchId} m={m} tz={tz} series={series} mine={mine} />
        {state && <MatchBug state={state} status={m.status} sub={bugSub} />}
        <MdPrimary primary={primary} gap={gap} communityId={id} matchId={matchId} />
        {scorers.length > 0 && <p className="md-scoredby">Scored by <b>{scorers.map((s) => `${s.name} (${s.balls} ball${s.balls === 1 ? "" : "s"})`).join(", ")}</b></p>}

        {notStarted && (
          <MdAvailability
            communityId={id}
            matchId={matchId}
            mine={m.my_answer}
            replies={replies.map((p) => ({ id: p.user_id, name: p.name, number: p.player_number, answer: p.answer }))}
            remindCount={m.status === "scheduled" ? noReplyCount(m) : 0}
          />
        )}

        <MdLineups communityId={id} matchId={matchId} canPick={notStarted} sides={sides} linkable={linkable} />

        <MdSide>
          <MatchToss communityId={id} matchId={matchId} sides={[m.side1_name, m.side2_name]} winner={m.toss_winner_side} decision={m.toss_decision} battingFirst={m.batting_first_side} canEdit={notStarted} mine={mine} />
          <MdRules r={r} limitText={limitText} open={!played} />
          <MdLinkCard link={link} />
          <MdManageCard communityId={id} matchId={matchId} status={m.status} title={title} whenLabel={whenLabel} rematchLabel={rematchLabel} comingCount={replies.filter((p) => p.answer === "in").length} canManage={canManage} />
        </MdSide>
      </div>
    </Frame>
  );
}
