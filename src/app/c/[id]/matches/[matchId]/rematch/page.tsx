import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { SvClose } from "@/components/C2Icons";
import RematchCopied, { type CopiedPlayer } from "@/components/RematchCopied";
import RematchPlan from "@/components/RematchPlan";
import { fmtInstant } from "@/lib/c2";
import { pickableTeams } from "@/lib/c2Data";
import { requireMember } from "@/lib/community";
import { getMatch, listLineup } from "@/lib/matches";
import { getSeries, seriesOfMatch } from "@/lib/seriesDb";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Rematch" };

// One tap rematch: same teams, venue, overs, rules and lineups. Only the date and time are fresh.
// Phase C (UI redesign): a checklist of what is copied on the left, the one decision (when) on the right.
export default async function RematchPage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  const [lineup, series, teams, tz] = await Promise.all([listLineup(id, matchId), seriesOfMatch(id, matchId), pickableTeams(id, user.id), getZone()]);
  const mine = new Set(teams.filter((t) => t.mine).map((t) => t.id));
  const full = series ? await getSeries(id, series.id) : null;
  const number = full ? full.matches.findIndex((x) => x.id === matchId) + 1 : 0;
  const ofText = series && number > 0 && m.scheduled_at
    ? `Rematch of Match ${number} of ${series.name} (${fmtInstant(m.scheduled_at, tz, true)})`
    : series && number > 0 ? `Rematch of Match ${number} of ${series.name}`
    : m.scheduled_at ? `Rematch of ${fmtInstant(m.scheduled_at, tz)}`
    : "Rematch of a match that had no date yet";
  const copied: CopiedPlayer[] = lineup.map((p) => ({ name: p.name, number: p.player_number, side: p.position, guest: p.kind === "guest" }));
  return (
    <Frame
      communityId={id}
      title="Rematch"
      subtitle={<span className="muted small">{m.side1_name} v {m.side2_name}</span>}
      back={`/c/${id}/matches/${matchId}`}
      right={<Link href={`/c/${id}/matches/${matchId}`} className="sv-xlink" aria-label="Close and go back to the match"><SvClose /></Link>}
    >
      <div className="sv-rm">
        <RematchCopied
          side1={{ name: m.side1_name, mine: !!m.side1_team && mine.has(m.side1_team), permanent: !!m.side1_team }}
          side2={{ name: m.side2_name, mine: !!m.side2_team && mine.has(m.side2_team), permanent: !!m.side2_team }}
          ofText={ofText} venue={m.venue} overs={m.overs} rules={m.rules} playersPerSide={m.players_per_side} lineup={copied}
        />
        <RematchPlan
          communityId={id} matchId={matchId} sourceIso={m.scheduled_at ? m.scheduled_at.toISOString() : null}
          openSeriesName={series?.status === "open" ? series.name : null} seriesClosed={!!series && series.status !== "open"} canMakeSeries={!series}
        />
      </div>
    </Frame>
  );
}
