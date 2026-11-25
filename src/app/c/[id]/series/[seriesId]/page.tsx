import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { SeriesMenu } from "@/components/SeriesActions";
import SeriesToast from "@/components/SeriesToast";
import SeriesView, { SeriesSide, type SeriesViewData } from "@/components/SeriesView";
import { IconPencil } from "@/components/SrIcons";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { mayManage } from "@/lib/ownerRule";
import { playerOfSeries } from "@/lib/seriesAward";
import { seriesAwardLines } from "@/lib/seriesAwardDb";
import { getSeries } from "@/lib/seriesDb";
import { myTeamIds } from "@/lib/seriesMine";
import { PAGE_ERRORS, seriesState, teamsText } from "@/lib/seriesView";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";
import "@/components/sr.css";

export const metadata: Metadata = { title: "Series" };
export const dynamic = "force-dynamic";

type Q = { created?: string; saved?: string; added?: string; removed?: string; status?: string; e?: string };
const UPCOMING = ["draft", "scheduled", "postponed", "live", "paused"];

export default async function SeriesPage({ params, searchParams }: { params: Promise<{ id: string; seriesId: string }>; searchParams: Promise<Q> }) {
  const { id, seriesId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const s = await getSeries(id, seriesId);
  if (!s) notFound();
  const canDelete = mayManage({ id: user.id, admin: membership.role === "admin" }, s.created_by);   // delete: who added the series, or an Admin
  const [tz, mine, awardLines] = await Promise.all([getZone(), myTeamIds(id, user.id), seriesAwardLines(id, seriesId)]);
  const open = s.status === "open";
  const upcoming = s.matches.filter((m) => UPCOMING.includes(m.status));
  const results = s.matches.filter((m) => !UPCOMING.includes(m.status)).slice().reverse();
  // "Play another" copies the latest match that was not cancelled or abandoned
  const latest = [...s.matches].filter((m) => m.status !== "cancelled" && m.status !== "abandoned").sort((a, b) => (b.scheduled_at?.getTime() ?? b.created_at.getTime()) - (a.scheduled_at?.getTime() ?? a.created_at.getTime()))[0];
  // Player of the Series: leading while the series is open, final once it is closed
  const won = playerOfSeries(awardLines);
  const award = won ? { ...won, final: !open } : null;
  const base = `/c/${id}/series/${seriesId}`;
  const dates = s.starts_on || s.ends_on ? `${s.starts_on ?? "…"} to ${s.ends_on ?? "…"}` : null;
  const ref = { id: s.id, name: s.name, open, matchCount: s.match_count, canDelete, addedBy: s.created_by_name };

  const isMine = (teamId: string | null) => !!(teamId && mine.has(teamId));
  const sides = s.tally.rows.map((r) => { const side = s.sides.find((x) => x.name === r.name); return { name: r.name, teamId: side?.teamId ?? null, mine: isMine(side?.teamId ?? null) }; });
  const toRow = (m: (typeof s.matches)[number]) => ({
    id: m.id, href: `/c/${id}/matches/${m.id}`, n1: m.n1, n2: m.n2, mine1: isMine(m.t1), mine2: isMine(m.t2), when: formatWhen(m.scheduled_at, tz), overs: m.overs, venue: m.venue, status: m.status,
    resultText: m.status === "completed" && m.result?.text ? m.result.text : null, reportHref: m.status === "completed" ? `/c/${id}/matches/${m.id}/report` : null,
  });
  const d: SeriesViewData = {
    id: s.id, name: s.name, open, matchCount: s.match_count,
    hero: {
      open, sides, wins: s.tally.rows.length === 2 ? [s.tally.rows[0]!.won, s.tally.rows[1]!.won] : null, counted: s.tally.counted, format: s.format, bestOf: s.best_of,
      status: s.status_view, state: seriesState(open, s.status_view, s.tally.counted), matchCount: s.match_count, abandoned: s.tally.abandoned, dates,
    },
    latestId: latest?.id ?? null,
    clinchedWinner: s.status_view.clinched ? s.status_view.winner : null,
    drawn: s.status_view.drawn,
    showTable: s.tally.rows.length > 2 || s.tally.counted > 0,
    table: s.table.map((r) => ({ name: r.name, mine: sides.find((x) => x.name === r.name)?.mine ?? false, played: r.played, won: r.won, lost: r.lost, tied: r.tied, points: r.points })),
    fixtures: upcoming.map(toRow), results: results.map(toRow),
    notes: s.notes, createdBy: s.created_by_name ?? "—", changedBy: s.changed_by_name ?? "—", changedAt: formatWhen(s.updated_at, tz),
    created: !!q.created, error: q.e ? (PAGE_ERRORS[q.e] ?? "That could not be done.") : null,
    award, canDelete,
  };

  return (
    <Frame
      communityId={id}
      title={s.name}
      subtitle={<small className="muted">{teamsText(s.sides.length)} · {open ? "Open" : "Closed"}</small>}
      back={`/c/${id}/series`}
      right={<span className="sr-topright"><Link href={`${base}/edit`} className="btn ghost small sr-topedit"><IconPencil />Edit</Link><SeriesMenu communityId={id} series={ref} /></span>}
      panel={<div className="sr-panel"><SeriesSide communityId={id} d={d} /></div>}
    >
      <SeriesToast saved={q.saved} added={q.added} removed={q.removed} status={q.status} open={open} clean />
      <SeriesView communityId={id} d={d} />
    </Frame>
  );
}
