import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { RematchForm } from "@/components/Forms4";
import { requireMember } from "@/lib/community";
import { getMatch, listLineup } from "@/lib/matches";
import { seriesOfMatch } from "@/lib/seriesDb";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Rematch" };

// One tap rematch: same teams, venue, overs, rules and lineups. Only the date and time are fresh.
export default async function RematchPage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  const [lineup, series] = await Promise.all([listLineup(id, matchId), seriesOfMatch(id, matchId)]);
  return (
    <Frame communityId={id} title="Rematch" back={`/c/${id}/matches/${matchId}`}>
      <div className="stack">
        <section className="card">
          <b>{m.side1_name} v {m.side2_name}</b>
          <ul className="muted small" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Same two teams, {m.venue ? `venue (${m.venue}), ` : ""}{m.overs} overs and the same rules.</li>
            <li>{lineup.length} player{lineup.length === 1 ? "" : "s"} copied into the lineups. You can change them before the match: swap players, add a guest, or use someone from another team.</li>
            <li>It is a separate match. The first match and the permanent squads stay exactly as they are.</li>
          </ul>
        </section>
        <section className="card"><RematchForm communityId={id} matchId={matchId} seriesName={series?.status === "open" ? series.name : null} canMakeSeries={!series} /></section>
      </div>
    </Frame>
  );
}
