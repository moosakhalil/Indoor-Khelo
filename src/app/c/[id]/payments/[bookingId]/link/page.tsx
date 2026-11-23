import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { linkMatchesAction } from "@/app/actions7";
import { getBooking, linkedMatches, matchesToLink } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Link matches" };
export const dynamic = "force-dynamic";

export default async function LinkPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const b = await getBooking(id, bookingId);
  if (!b) notFound();
  const [matches, linked, tz] = await Promise.all([matchesToLink(id), linkedMatches(bookingId), getZone()]);
  const on = new Set(linked.map((m) => m.id));
  return (
    <Frame communityId={id} title="Link matches" back={`/c/${id}/payments/${bookingId}`}>
      <form action={linkMatchesAction} className="stack">
        <input type="hidden" name="communityId" value={id} /><input type="hidden" name="bookingId" value={bookingId} />
        <p className="muted" style={{ margin: 0 }}>Choose the matches played in this booking: one, or several (for example three on a Saturday).</p>
        {matches.length === 0 ? <div className="card center muted">No matches yet. Create matches first.</div> : (
          <section className="card list">
            {matches.map((m) => (
              <label key={m.id} className="item" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="match" value={m.id} defaultChecked={on.has(m.id)} style={{ width: 24, height: 24, accentColor: "var(--gold)" }} />
                <span className="t grow"><b>{m.name}</b><small>{formatWhen(m.scheduled_at, tz)} · {m.status}</small></span>
              </label>
            ))}
          </section>
        )}
        <button className="btn gold">Save linked matches</button>
      </form>
    </Frame>
  );
}
