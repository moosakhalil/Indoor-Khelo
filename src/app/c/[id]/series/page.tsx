import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { tallyLine } from "@/lib/series";
import { listSeries } from "@/lib/seriesDb";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Series" };
export const dynamic = "force-dynamic";

export default async function SeriesListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const { id } = await params;
  const { deleted } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const list = await listSeries(id);
  return (
    <Frame communityId={id} title="Series" back={`/c/${id}/teams`}>
      <div className="stack">
        {deleted && <div className="banner green" role="status">Series deleted. Its matches were kept.</div>}
        <Link href={`/c/${id}/series/new`} className="btn gold">New series</Link>
        {list.length === 0 ? (
          <div className="card center">
            <b>No series yet</b>
            <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>A series groups matches, for example best of 3 between two teams. It is optional: you never need one to play a match. You can make one now, or group matches you already played.</p>
          </div>
        ) : list.map((s) => (
          <Link key={s.id} href={`/c/${id}/series/${s.id}`} className="card" style={{ display: "block" }}>
            <div className="row space"><b>{s.name}</b><span className={`chip ${s.status === "open" ? "green" : ""}`}>{s.status === "open" ? "Open" : "Closed"}</span></div>
            <b style={{ display: "block", marginTop: 6 }}>{tallyLine(s.tally)}</b>
            <small className="muted" style={{ display: "block" }}>{s.status_view.text}</small>
            <small className="muted" style={{ display: "block" }}>{s.match_count} match{s.match_count === 1 ? "" : "es"}{s.format === "best_of" ? ` · best of ${s.best_of}` : " · open-ended"}</small>
          </Link>
        ))}
        <p className="muted small" style={{ margin: 0 }}>Being in a series never changes how stats are counted.</p>
      </div>
    </Frame>
  );
}
