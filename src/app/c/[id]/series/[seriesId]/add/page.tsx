import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AddMatches from "@/components/AddMatches";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { getSeries, matchesAvailable } from "@/lib/seriesDb";
import { myTeamIds } from "@/lib/seriesMine";
import { GROUP_FALLBACK, type AvailItem } from "@/lib/seriesView";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";
import "@/components/sr.css";

export const metadata: Metadata = { title: "Add matches" };
export const dynamic = "force-dynamic";

export default async function AddMatchesPage({ params, searchParams }: { params: Promise<{ id: string; seriesId: string }>; searchParams: Promise<{ e?: string; why?: string }> }) {
  const { id, seriesId } = await params;
  const { e, why } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const s = await getSeries(id, seriesId);
  if (!s) notFound();
  const [avail, tz, mine] = await Promise.all([matchesAvailable(id, seriesId), getZone(), myTeamIds(id, user.id)]);
  const items: AvailItem[] = avail.map((m) => ({ id: m.id, side1: m.n1, team1: m.t1, side2: m.n2, team2: m.t2, when: formatWhen(m.scheduled_at, tz), status: m.status, fits: m.fits, reason: m.reason }));
  return (
    <Frame communityId={id} title="Add matches" subtitle={<small className="muted">{s.name}</small>} back={`/c/${id}/series/${seriesId}`}>
      <AddMatches
        communityId={id}
        series={{ id: s.id, name: s.name, open: s.status === "open", matchCount: s.match_count, sides: s.sides.map((x) => ({ name: x.name, mine: !!(x.teamId && mine.has(x.teamId)) })) }}
        items={items}
        initialError={e ? why || GROUP_FALLBACK : undefined}
      />
    </Frame>
  );
}
