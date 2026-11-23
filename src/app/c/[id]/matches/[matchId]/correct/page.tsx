import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CorrectForm from "@/components/CorrectForm";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { buildState } from "@/lib/engine/engine";
import { getMatch } from "@/lib/matches";
import { loadEvents } from "@/lib/scoring";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Correct a ball" };
export const dynamic = "force-dynamic";

// Any member can correct a finished match. The change is logged with their name and everything is worked out again.
export default async function CorrectPage({ params, searchParams }: { params: Promise<{ id: string; matchId: string }>; searchParams: Promise<{ ball?: string }> }) {
  const { id, matchId } = await params;
  const { ball } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const match = await getMatch(id, matchId, user.id);
  if (!match) notFound();
  if (match.status !== "completed") redirect(`/c/${id}/matches/${matchId}`);
  const events = await loadEvents(matchId);
  const built = buildState(events);
  if (!built.ok) notFound();
  const m = built.state;
  const found = m.innings.flatMap((i) => i.balls.map((b) => ({ inn: i, b }))).find((x) => x.b.eventId === ball);
  const base = `/c/${id}/matches/${matchId}`;

  if (!found) {
    return (
      <Frame communityId={id} title="Correct a ball" back={`${base}/report?tab=balls`}>
        <div className="banner mute">Choose a ball to correct from the ball-by-ball page.</div>
        <Link href={`${base}/report?tab=balls`} className="btn gold" style={{ marginTop: 12 }}>Open ball by ball</Link>
      </Frame>
    );
  }
  const { inn, b } = found;
  const batting = Object.values(m.players).filter((p) => p.side === inn.batting).map((p) => ({ id: p.id, name: p.name }));
  const fielding = Object.values(m.players).filter((p) => p.side === inn.bowling).map((p) => ({ id: p.id, name: p.name }));
  return (
    <Frame communityId={id} title="Correct a ball" back={`${base}/report?tab=balls`}>
      <div className="stack">
        <section className="card"><small className="muted">The ball as recorded</small><p style={{ margin: "4px 0 0" }}>{b.text}</p></section>
        <CorrectForm
          communityId={id} matchId={matchId} ballId={b.eventId} bat={batting} field={fielding}
          current={{ extra: b.extra ?? "", runs: b.runs, wicket: b.wicketType ?? "", out: b.out ?? "", fielder: b.fielder ?? "" }}
        />
      </div>
    </Frame>
  );
}
