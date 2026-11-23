import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { SeriesForm } from "@/components/FormsSeries";
import { requireMember } from "@/lib/community";
import { teamNames } from "@/lib/matches";
import { getSeries } from "@/lib/seriesDb";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit series" };
export const dynamic = "force-dynamic";

export default async function EditSeriesPage({ params }: { params: Promise<{ id: string; seriesId: string }> }) {
  const { id, seriesId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [s, teams] = await Promise.all([getSeries(id, seriesId), teamNames(id)]);
  if (!s) notFound();
  return (
    <Frame communityId={id} title="Edit series" back={`/c/${id}/series/${seriesId}`}>
      <div className="stack">
        <SeriesForm mode="edit" communityId={id} seriesId={seriesId} teams={Array.from(teams.entries()).map(([tid, name]) => ({ id: tid, name }))}
          defaults={{ name: s.name, format: s.format, bestOf: s.best_of, startsOn: s.starts_on ?? "", endsOn: s.ends_on ?? "", notes: s.notes, sides: s.sides.map((x) => ({ teamId: x.teamId, name: x.name })) }} />
        <p className="muted small" style={{ margin: 0 }}>A team that already has matches in this series cannot be taken out. Changing the format never changes the record.</p>
      </div>
    </Frame>
  );
}
