import type { Metadata } from "next";
import Frame from "@/components/Frame";
import NewSeries from "@/components/NewSeries";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { listMatches, teamNames } from "@/lib/matches";
import { listSeries } from "@/lib/seriesDb";
import { GROUP_ERRORS, GROUP_FALLBACK, type FreeMatch } from "@/lib/seriesView";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";
import "@/components/sr.css";

export const metadata: Metadata = { title: "New series" };
export const dynamic = "force-dynamic";

export default async function NewSeriesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; why?: string; tab?: string }> }) {
  const { id } = await params;
  const { e, why, tab } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [teams, matches, series, tz] = await Promise.all([teamNames(id), listMatches(id, user.id), listSeries(id), getZone()]);
  const taken = new Set(series.flatMap((s) => s.matches.map((m) => m.id)));
  // a match is free unless it is already in a series, cancelled or abandoned
  const free: FreeMatch[] = matches
    .filter((m) => !taken.has(m.id) && m.status !== "cancelled" && m.status !== "abandoned")
    .map((m) => ({ id: m.id, side1: m.side1_name, team1: m.side1_team, side2: m.side2_name, team2: m.side2_team, when: formatWhen(m.scheduled_at, tz), status: m.status, at: m.scheduled_at ? m.scheduled_at.getTime() : null }));
  // an old-style address with ?e= (from before this design) still shows its message, above the list
  const groupError = e ? why || GROUP_ERRORS[e] || GROUP_FALLBACK : undefined;
  return (
    <Frame communityId={id} title="New series" back={`/c/${id}/series`}>
      <NewSeries
        communityId={id}
        teams={Array.from(teams.entries()).map(([tid, name]) => ({ id: tid, name }))}
        matches={free}
        initialTab={tab === "group" || e ? "group" : "start"}
        groupError={groupError}
      />
    </Frame>
  );
}
