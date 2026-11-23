import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { SeriesForm } from "@/components/FormsSeries";
import { groupMatchesAction } from "@/app/actionsSeries";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { listMatches, teamNames } from "@/lib/matches";
import { listSeries } from "@/lib/seriesDb";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "New series" };
export const dynamic = "force-dynamic";

const E: Record<string, string> = {
  name: "Type a name of 2 to 60 characters, or leave it empty for an automatic name.", name_taken: "A series with that name already exists.",
  in_other_series: "A match can be in only one series. One of the matches you chose is already in another series.", bad_match: "Choose at least one match.",
  too_few: "A series needs at least two teams.", sides: "Those matches have too many different teams for one series.", forbidden: "Only members of this community can create a series.",
};

export default async function NewSeriesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; why?: string }> }) {
  const { id } = await params;
  const { e, why } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [teams, matches, series, tz] = await Promise.all([teamNames(id), listMatches(id, user.id), listSeries(id), getZone()]);
  const taken = new Set(series.flatMap((s) => s.matches.map((m) => m.id)));
  const free = matches.filter((m) => !taken.has(m.id) && m.status !== "cancelled" && m.status !== "abandoned");
  return (
    <Frame communityId={id} title="New series" back={`/c/${id}/series`}>
      <div className="stack">
        {e && <div className="banner red" role="alert">{why || E[e] || "That could not be done."}</div>}
        <section className="card">
          <h2 style={{ fontSize: "1rem", marginBottom: 6 }}>Start a series</h2>
          <SeriesForm mode="create" communityId={id} teams={Array.from(teams.entries()).map(([tid, name]) => ({ id: tid, name }))} />
        </section>
        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>Or group matches you already have</h2>
          <p className="muted small" style={{ margin: "4px 0 8px", lineHeight: 1.5 }}>Choose matches, including ones already played. The teams are taken from them. A match can be in one series only.</p>
          {free.length === 0 ? <p className="muted small">No matches are free to group.</p> : (
            <form action={groupMatchesAction}>
              <input type="hidden" name="communityId" value={id} />
              <label className="lb" htmlFor="g-name" style={{ marginTop: 0 }}>Series name (optional)</label>
              <input id="g-name" name="name" className="field" maxLength={60} placeholder="Automatic: Alpha v Bravo" />
              <div className="list" style={{ marginTop: 8 }}>
                {free.map((m) => (
                  <label key={m.id} className="item" style={{ cursor: "pointer" }}>
                    <input type="checkbox" name="match" value={m.id} style={{ width: 24, height: 24, accentColor: "var(--gold)" }} />
                    <span className="t grow"><b>{m.side1_name} v {m.side2_name}</b><small>{formatWhen(m.scheduled_at, tz)} · {m.status}</small></span>
                  </label>
                ))}
              </div>
              <button className="btn gold" style={{ marginTop: 12 }}>Group into a series</button>
            </form>
          )}
        </section>
      </div>
    </Frame>
  );
}
