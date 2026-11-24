import type { Metadata } from "next";
import AlertsList, { type AlertView } from "@/components/AlertsList";
import Frame from "@/components/Frame";
import Icon from "@/components/B2Icons";
import { myAnswersFor } from "@/lib/alertsData";
import { ALERTS_KEEP, ALERTS_TRUTH, alertTimeLabel, canAnswerKind, countsByKind, dayBucket, kindMeta } from "@/lib/alertsUi";
import { requireMember } from "@/lib/community";
import { listAlerts } from "@/lib/matches";
import { NOT_STARTED, formatWhen, type MatchStatus } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";
import "@/components/b2.css";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const [alerts, tz] = await Promise.all([listAlerts(user.id, id), getZone()]);
  const now = new Date();
  const answerable = alerts.filter((a) => canAnswerKind(a.kind) && a.match_id).map((a) => a.match_id!);
  const mine = await myAnswersFor(user.id, answerable);

  const views: AlertView[] = alerts.map((a) => {
    const created = new Date(a.created_at);
    const day = dayBucket(created, now, tz);
    return {
      id: a.id,
      kind: a.kind,
      message: a.message,
      matchId: a.match_id,
      bookingId: a.booking_id,
      read: !!a.read_at,
      day,
      time: alertTimeLabel(created, day, tz),
      matchWhen: a.scheduled_at && a.status !== "cancelled" ? formatWhen(new Date(a.scheduled_at), tz) : null,
      canAnswer: canAnswerKind(a.kind) && !!a.match_id && !!a.status && (NOT_STARTED as readonly string[]).includes(a.status as MatchStatus),
      myAnswer: a.match_id ? mine[a.match_id] ?? null : null,
    };
  });

  const unread = views.filter((a) => !a.read).length;
  const kinds = countsByKind(views);

  const panel = (
    <section className="card al-summary" aria-label="Alerts summary">
      <h2>Your alerts</h2>
      <p className="muted small">{views.length} kept, {unread} unread</p>
      {kinds.length > 0 && (
        <ul className="al-sumlist">
          {kinds.map((k) => (
            <li key={k.kind}>
              <span className={`al-ico sm ${kindMeta(k.kind).tone}`} aria-hidden="true"><Icon name={kindMeta(k.kind).icon} size={16} /></span>
              <span className="grow">{k.label}</span>
              <b>{k.n}</b>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{ALERTS_TRUTH}</p>
      <p className="muted small">{ALERTS_KEEP}</p>
    </section>
  );

  return (
    <Frame communityId={id} title="Alerts" back={`/c/${id}`} panel={panel}>
      <AlertsList communityId={id} alerts={views} />
    </Frame>
  );
}
