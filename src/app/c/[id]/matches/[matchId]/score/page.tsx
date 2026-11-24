import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import Frame from "@/components/Frame";
import LiveView, { AutoChip, ScorecardView } from "@/components/LiveView";
import { IconBack } from "@/components/LvIcons";
import ScoreGate from "@/components/ScoreGate";
import ScoringPad from "@/components/ScoringPad";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { buildState } from "@/lib/engine/engine";
import { getMatch, listLineup } from "@/lib/matches";
import { getLock, loadEvents, scorersOf, startSnapshot } from "@/lib/scoring";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Score" };
export const dynamic = "force-dynamic";

// One page for every member: the scorer gets the pad, everyone else watches the live score (and can ask to take over).
export default async function ScorePage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const match = await getMatch(id, matchId, user.id);
  if (!match) notFound();
  const [lock, events, lineup, snap] = await Promise.all([getLock(id, matchId), loadEvents(matchId), listLineup(id, matchId), startSnapshot(id, matchId)]);
  const built = buildState(events);
  const state = built.ok ? built.state : null;
  const started = !!state?.started;
  const done = match.status === "completed" || match.status === "abandoned";
  if (done) redirect(`/c/${id}/matches/${matchId}/report`);
  const sizes = [1, 2].map((p) => lineup.filter((l) => l.position === p).length);
  const scorable = ["draft", "scheduled", "live", "paused"].includes(match.status);
  let reason: string | null = null;
  if (!scorable) reason = done ? "This match is finished." : `This match is ${match.status}, so it cannot be scored.`;
  else if (!started && (sizes[0]! < 2 || sizes[1]! < 2)) reason = "Each side needs at least 2 players before scoring can start. Pick the lineups first.";

  const holdsLock = lock?.scorer_id === user.id;
  if (holdsLock && !reason && snap) {
    const inMatch = new Set(lineup.map((l) => l.user_id).filter(Boolean));
    const members = (await listApprovedMembers(id)).filter((p) => !inMatch.has(p.user_id)).map((p) => ({ userId: p.user_id, name: p.name, number: p.player_number }));
    return (
      <ScoringPad
        communityId={id} matchId={matchId} matchHref={`/c/${id}/matches/${matchId}`}
        serverEvents={events} start={{ base: snap.base, toss: snap.toss, battingFirst: snap.battingFirst }}
        lateMembers={members} scorerDevice={lock?.scorer_device ?? null} scorerName={lock?.scorer_name ?? user.name}
      />
    );
  }

  const [scorers, everyone] = await Promise.all([scorersOf(matchId), listApprovedMembers(id)]);
  const scorerNumber = lock?.scorer_id ? everyone.find((p) => p.user_id === lock.scorer_id)?.player_number ?? null : null;
  const paused = match.status === "paused" || !!state?.paused;
  const live = !!state && started;
  const needLineups = !!reason && sizes.some((n) => n < 2);
  const back = `/c/${id}/matches/${matchId}`;
  return (
    <Frame communityId={id} title="Live score" subtitle={<small className="muted lv-sub">{match.side1_name} v {match.side2_name}</small>} back={back} right={<AutoChip paused={paused} />}>
      <AutoRefresh seconds={5} />
      <div className={`lv-root${live ? " two" : ""}`}>
        <div className="lv-col lv-main">
          <LiveView m={state} sides={[match.side1_name, match.side2_name]} venue={match.venue || undefined} paused={paused} scoredBy={scorers.map((s) => s.name)} />
          {!live && <p className="muted small center" style={{ margin: 0 }}>{match.overs} overs</p>}
        </div>
        <div className="lv-col lv-side">
          <ScoreGate
            communityId={id} matchId={matchId} me={user.id} isAdmin={membership.role === "admin"} scorerId={lock?.scorer_id ?? null} scorerName={lock?.scorer_name ?? null}
            takeoverBy={lock?.takeover_by ?? null} takeoverName={lock?.takeover_name ?? null} canScore={!reason} reason={reason} started={started}
            scorerNumber={scorerNumber} lineupsHref={needLineups ? `/c/${id}/matches/${matchId}/lineup` : null}
          />
          {state && started && (
            <>
              <h2 className="lv-h">Scorecard</h2>
              <ScorecardView m={state} />
            </>
          )}
          <Link href={back} className="btn ghost lv-btn"><IconBack size={18} />Back to the match</Link>
        </div>
      </div>
    </Frame>
  );
}
