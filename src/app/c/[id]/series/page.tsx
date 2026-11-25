import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import SeriesList, { SeriesEmpty } from "@/components/SeriesList";
import { IconPlus } from "@/components/SrIcons";
import { requireMember } from "@/lib/community";
import { mayManage } from "@/lib/ownerRule";
import { listSeries } from "@/lib/seriesDb";
import { myTeamIds, toCardItem } from "@/lib/seriesMine";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/sr.css";

export const metadata: Metadata = { title: "Series" };
export const dynamic = "force-dynamic";

export default async function SeriesListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const { id } = await params;
  const { deleted } = await searchParams;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const admin = membership.role === "admin";
  const [list, mine] = await Promise.all([listSeries(id), myTeamIds(id, user.id)]);
  const items = list.map((s) => toCardItem(s, mine, mayManage({ id: user.id, admin }, s.created_by)));   // delete: who added it, or an Admin
  return (
    <Frame
      communityId={id}
      title="Series"
      subtitle={list.length ? <small className="muted">{list.length} series</small> : undefined}
      back={`/c/${id}/teams`}
      right={<Link href={`/c/${id}/series/new`} className="btn gold small sr-topnew"><IconPlus /> New series</Link>}
    >
      <div className="stack">
        {deleted && <div className="banner green sr-banner" role="status">Series deleted. Its matches were kept. Their stats are unchanged.</div>}
        {list.length === 0 ? <SeriesEmpty communityId={id} /> : <SeriesList communityId={id} items={items} />}
        <p className="muted small" style={{ margin: 0 }}>Being in a series never changes how stats are counted.</p>
      </div>
    </Frame>
  );
}
