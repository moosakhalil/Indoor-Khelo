import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CorrectForm from "@/components/CorrectForm";
import Frame from "@/components/Frame";
import LuIcon from "@/components/LuIcons";
import { PanelSlot } from "@/components/LuPanel";
import "@/components/lu.css";
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
  const ballsHref = `${base}/report?tab=balls`;
  const subtitle = <small className="muted">{m.sides[0]} v {m.sides[1]}</small>;

  if (!found) {
    return (
      <Frame communityId={id} title="Correct a ball" subtitle={subtitle} back={ballsHref}>
        <div className="stack">
          <div className="lu-empty-card">
            <span className="lu-empty-icon" aria-hidden="true"><LuIcon name="target" size={28} /></span>
            <h2>Choose a ball to correct</h2>
            <p>Choose a ball to correct from the ball-by-ball page. Open the ball-by-ball list of the match and tap “Correct” on the delivery you want to fix.</p>
            <Link href={ballsHref} className="btn gold"><LuIcon name="list" />Open ball by ball</Link>
          </div>
          <section className="card lu-desk" aria-label="Pick a ball">
            <h2 style={{ fontSize: "1rem" }}>Or pick a ball here</h2>
            {m.innings.map((inn) => (
              <details key={inn.index} className="lu-inn" open={m.innings.length === 1}>
                <summary>{m.sides[inn.batting - 1]} {inn.superOver ? "super over" : `innings ${inn.index + 1}`} · {inn.runs}/{inn.wickets}</summary>
                <ul className="lu-balls">
                  {inn.balls.map((b) => (
                    <li key={b.eventId}>
                      <Link href={`${base}/correct?ball=${b.eventId}`} aria-label={`Correct ball ${b.over}.${b.ball}: ${b.text}`}>
                        <b>{b.over}.{b.ball}</b><span>{b.text}</span><span className="go">Correct</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        </div>
      </Frame>
    );
  }
  const { inn, b } = found;
  const person = (pid: string | null) => {
    const p = pid ? m.players[pid] : undefined;
    return p ? { id: p.id, name: p.name, number: p.number } : null;
  };
  const batting = Object.values(m.players).filter((p) => p.side === inn.batting).map((p) => ({ id: p.id, name: p.name, number: p.number }));
  const fielding = Object.values(m.players).filter((p) => p.side === inn.bowling).map((p) => ({ id: p.id, name: p.name, number: p.number }));
  return (
    <Frame communityId={id} title="Correct a ball" subtitle={subtitle} back={ballsHref} panel={<PanelSlot />}>
      <CorrectForm
        communityId={id} matchId={matchId} ballId={b.eventId} bat={batting} field={fielding} cancelHref={ballsHref}
        current={{ extra: b.extra ?? "", runs: b.runs, wicket: b.wicketType ?? "", out: b.out ?? "", fielder: b.fielder ?? "" }}
        ball={{ over: `${b.over}.${b.ball}`, innings: inn.index + 1, text: b.text, runs: b.runs, bowler: person(b.bowler), batter: person(b.striker) }}
      />
    </Frame>
  );
}
