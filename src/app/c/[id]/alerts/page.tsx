import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import { markAlertsReadAction } from "@/app/actions4";
import { requireMember } from "@/lib/community";
import { listAlerts } from "@/lib/matches";
import { formatWhen } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [alerts, tz] = await Promise.all([listAlerts(user.id, id), getZone()]);
  const unread = alerts.filter((a) => !a.read_at).length;
  return (
    <Frame communityId={id} title="Alerts" back={`/c/${id}`}>
      <div className="stack">
        {alerts.length === 0 && (
          <div className="card center">
            <b>No alerts yet</b>
            <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>You will see new matches, reminders and changes here. Alerts show inside the app; phone push notifications are not switched on.</p>
          </div>
        )}
        {unread > 0 && (
          <form action={markAlertsReadAction}>
            <input type="hidden" name="communityId" value={id} />
            <button className="btn ghost small">Mark all as read ({unread})</button>
          </form>
        )}
        <section className="stack">
          {alerts.map((a) => {
            const body = (
              <>
                <b>{a.message}</b>
                {a.scheduled_at && a.status !== "cancelled" && <small className="muted" style={{ display: "block" }}>{formatWhen(a.scheduled_at, tz)}</small>}
                <small className="muted" style={{ display: "block" }}>{formatWhen(a.created_at, tz)}</small>
              </>
            );
            return a.booking_id ? (
              <Link key={a.id} href={`/c/${id}/payments/${a.booking_id}`} className={`card${a.read_at ? "" : " gold"}`} style={{ display: "block" }}>{body}</Link>
            ) : a.match_id ? (
              <Link key={a.id} href={`/c/${id}/matches/${a.match_id}`} className={`card${a.read_at ? "" : " gold"}`} style={{ display: "block" }}>{body}</Link>
            ) : (
              <div key={a.id} className={`card${a.read_at ? "" : " gold"}`}>{body}</div>
            );
          })}
        </section>
      </div>
    </Frame>
  );
}
