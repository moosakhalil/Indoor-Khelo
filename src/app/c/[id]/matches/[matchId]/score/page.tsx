import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import Frame from "@/components/Frame";
import { LiveScore, Scorecard } from "@/components/Live";
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

  const scorers = await scorersOf(matchId);
  return (
    <Frame communityId={id} title={done ? "Scorecard" : "Live score"} back={`/c/${id}/matches/${matchId}`}>
      {!done && <AutoRefresh seconds={5} />}
      <div className="stack">
        <div className="card center">
          <b style={{ fontSize: "1.1rem" }}>{match.side1_name} v {match.side2_name}</b>
          <small className="muted" style={{ display: "block" }}>{match.overs} overs{scorers.length ? ` · Scored by ${scorers.map((s) => s.name).join(", ")}` : ""}</small>
        </div>
        {state && <LiveScore m={state} />}
        {!done && (
          <ScoreGate
            communityId={id} matchId={matchId} me={user.id} isAdmin={membership.role === "admin"} scorerId={lock?.scorer_id ?? null} scorerName={lock?.scorer_name ?? null}
            takeoverBy={lock?.takeover_by ?? null} takeoverName={lock?.takeover_name ?? null} canScore={!reason} reason={reason} started={started}
          />
        )}
        {reason && !done && sizes.some((n) => n < 2) && <Link href={`/c/${id}/matches/${matchId}/lineup`} className="btn gold">Pick lineups</Link>}
        {state && started && <Scorecard m={state} />}
        <Link href={`/c/${id}/matches/${matchId}`} className="btn ghost">Back to the match</Link>
      </div>
    </Frame>
  );
}
