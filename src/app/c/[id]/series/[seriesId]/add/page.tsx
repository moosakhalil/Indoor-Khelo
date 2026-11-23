import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { addMatchesAction } from "@/app/actionsSeries";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { getSeries, matchesAvailable } from "@/lib/seriesDb";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Add matches" };
export const dynamic = "force-dynamic";

export default async function AddMatchesPage({ params, searchParams }: { params: Promise<{ id: string; seriesId: string }>; searchParams: Promise<{ e?: string; why?: string }> }) {
  const { id, seriesId } = await params;
  const { e, why } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const s = await getSeries(id, seriesId);
  if (!s) notFound();
  const [avail, tz] = await Promise.all([matchesAvailable(id, seriesId), getZone()]);
  return (
    <Frame communityId={id} title="Add matches" back={`/c/${id}/series/${seriesId}`}>
      <form action={addMatchesAction} className="stack">
        <input type="hidden" name="communityId" value={id} /><input type="hidden" name="seriesId" value={seriesId} />
        {e && <div className="banner red" role="alert">{why || "That could not be done."}</div>}
        {s.status === "closed" && <div className="banner mute">This series is closed. Reopen it to add matches.</div>}
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>Add matches that already exist, including ones already played. Both teams must be teams of this series ({s.sides.map((x) => x.name).join(", ")}). A match can be in one series only.</p>
        {avail.length === 0 ? <div className="card center muted">No free matches. Create a match first, or use “Play another match in this series”.</div> : (
          <section className="card list">
            {avail.map((m) => (
              <label key={m.id} className="item" style={{ cursor: m.fits ? "pointer" : "not-allowed", opacity: m.fits ? 1 : 0.55 }}>
                <input type="checkbox" name="match" value={m.id} disabled={!m.fits} style={{ width: 24, height: 24, accentColor: "var(--gold)" }} />
                <span className="t grow"><b>{m.n1} v {m.n2}</b><small>{formatWhen(m.scheduled_at, tz)} · {m.status}{m.reason ? ` · ${m.reason}` : ""}</small></span>
              </label>
            ))}
          </section>
        )}
        <button className="btn gold" disabled={s.status === "closed"}>Add to the series</button>
      </form>
    </Frame>
  );
}
