"use client";

import Link from "next/link";
import { useState } from "react";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import Icon from "@/components/B2Icons";
import { useSnackbar } from "@/components/Snackbar";
import { answerFromAlertAction, markAlertReadAction, markAllAlertsReadB2Action, undoMarkAlertsReadAction } from "@/app/actionsB2";
import {
  ALERTS_KEEP, ALERTS_TRUTH, DAY_LABEL, FILTERS, alertsMarkedText, filterCounts, kindMeta, matchesFilter,
  type AlertFilter, type DayBucket,
} from "@/lib/alertsUi";
import { noticeFor } from "@/lib/notices";
import "./b2.css";

/** One alert, with every date already written out in the viewer's time zone by the server. */
export type AlertView = {
  id: string;
  kind: string;
  message: string;
  matchId: string | null;
  bookingId: string | null;
  read: boolean;
  day: DayBucket;
  time: string;
  /** When the match is played; empty for a cancelled match. */
  matchWhen: string | null;
  /** New match and Reminder alerts of a match that has not started: show I'm in / Can't make it. */
  canAnswer: boolean;
  myAnswer: "in" | "out" | null;
};

export function AlertsEmpty({ communityId }: { communityId: string }) {
  return (
    <div className="card center al-empty">
      <span className="al-empty-ico" aria-hidden="true"><Icon name="inbox" size={30} /></span>
      <b>No alerts yet</b>
      <p className="muted small">You will see new matches, reminders and changes here. {ALERTS_TRUTH}</p>
      <Link href={`/c/${communityId}`} className="btn ghost small">Back to Home</Link>
    </div>
  );
}

export default function AlertsList({ communityId, alerts }: { communityId: string; alerts: AlertView[] }) {
  const snack = useSnackbar();
  const [filter, setFilter] = useState<AlertFilter>("all");
  // What the person changed on this screen; it wins over what the server sent until the page is loaded again.
  const [readOverride, setReadOverride] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, "in" | "out">>(() => {
    const first: Record<string, "in" | "out"> = {};
    for (const a of alerts) if (a.matchId && a.myAnswer) first[a.matchId] = a.myAnswer;
    return first;
  });
  const [busyAll, setBusyAll] = useState(false);
  const [busyAnswer, setBusyAnswer] = useState<string | null>(null);

  if (alerts.length === 0) return <AlertsEmpty communityId={communityId} />;

  const view = alerts.map((a) => ({ ...a, read: readOverride[a.id] ?? a.read }));
  const counts = filterCounts(view);
  const shown = view.filter((a) => matchesFilter(a, filter));

  const setRead = (ids: string[], value: boolean) =>
    setReadOverride((o) => {
      const next = { ...o };
      for (const id of ids) next[id] = value;
      return next;
    });

  async function markOne(id: string) {
    setRead([id], true);
    try {
      const r = await markAlertReadAction(communityId, id);
      if (!r.ok) throw new Error(r.error);
    } catch {
      setRead([id], false);
      snack.show({ message: "Could not mark that alert as read. Please try again.", tone: "error" });
    }
  }

  async function markAll() {
    if (busyAll) return;
    setBusyAll(true);
    try {
      const r = await markAllAlertsReadB2Action(communityId);
      if (!r.ok) throw new Error(r.error);
      const ids = r.ids;
      setRead(alerts.map((a) => a.id), true);
      snack.undoable({
        message: alertsMarkedText(ids.length),
        commit: () => {},
        onUndo: () => {
          setRead(alerts.map((a) => a.id), false);
          const failed = () => snack.show({ message: "Could not undo that. Please reload the page.", tone: "error" });
          void undoMarkAlertsReadAction(communityId, ids).then((u) => { if (!u.ok) failed(); }).catch(failed);
        },
      });
    } catch {
      snack.show({ message: "Could not mark the alerts as read. Please try again.", tone: "error" });
    } finally {
      setBusyAll(false);
    }
  }

  async function answer(matchId: string, value: "in" | "out") {
    if (busyAnswer) return;
    setBusyAnswer(matchId);
    try {
      const r = await answerFromAlertAction(communityId, matchId, value);
      if (r.ok) setAnswers((o) => ({ ...o, [matchId]: r.answer }));
      else snack.show({ message: noticeFor(r.error)?.text ?? "Could not save your reply. Please try again.", tone: "error" });
    } catch {
      snack.show({ message: "Could not save your reply. Please try again.", tone: "error" });
    } finally {
      setBusyAnswer(null);
    }
  }

  const groups = (["today", "yesterday", "earlier"] as DayBucket[])
    .map((d) => ({ day: d, items: shown.filter((a) => a.day === d) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="al-wrap">
      <div className="al-filters" role="group" aria-label="Filter alerts">
        {FILTERS.map((f) => {
          const n = f.key === "all" || f.key === "unread" ? counts[f.key] : null;
          return (
            <button key={f.key} type="button" className={`al-chip${filter === f.key ? " on" : ""}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}{n !== null ? ` ${n}` : ""}
            </button>
          );
        })}
      </div>

      {counts.unread > 0 && (
        <button type="button" className="btn ghost small al-markall" onClick={() => void markAll()} disabled={busyAll}>
          <Icon name="check" size={18} /> Mark all as read ({counts.unread})
        </button>
      )}

      {groups.length === 0 && (
        <div className="card center al-none">
          <b>{filter === "unread" ? "No unread alerts" : "No alerts of this kind"}</b>
          <p className="muted small">{filter === "unread" ? "You are all caught up." : "Nothing here yet."}</p>
          <button type="button" className="btn ghost small" onClick={() => setFilter("all")}>Show all alerts</button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day} className="al-group" aria-labelledby={`al-day-${g.day}`}>
          <h2 id={`al-day-${g.day}`} className="al-day">{DAY_LABEL[g.day]}</h2>
          <div className="stack">
            {g.items.map((a) => (
              <AlertCard
                key={a.id}
                communityId={communityId}
                a={a}
                answer={a.matchId ? answers[a.matchId] ?? null : null}
                answering={busyAnswer !== null && busyAnswer === a.matchId}
                onMarkRead={() => void markOne(a.id)}
                onAnswer={(v) => { if (a.matchId) void answer(a.matchId, v); }}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="muted small al-foot">{ALERTS_TRUTH} {ALERTS_KEEP}</p>
    </div>
  );
}

function AlertCard({
  communityId, a, answer, answering, onMarkRead, onAnswer,
}: { communityId: string; a: AlertView; answer: "in" | "out" | null; answering: boolean; onMarkRead: () => void; onAnswer: (v: "in" | "out") => void }) {
  const meta = kindMeta(a.kind);
  const href = a.bookingId ? `/c/${communityId}/payments/${a.bookingId}` : a.matchId ? `/c/${communityId}/matches/${a.matchId}` : null;
  const openLabel = a.bookingId ? "Open payment" : "Open match";
  const items: ActionItem[] = [];
  if (!a.read) items.push({ label: "Mark as read", onSelect: onMarkRead });
  if (href) items.push({ label: openLabel, href });

  const body = (
    <>
      <span className="al-msg">{a.message}</span>
      {a.matchWhen && (
        <span className="al-when"><Icon name="calendar" size={15} /> {a.matchWhen}</span>
      )}
    </>
  );

  return (
    <article className={`al-card ${a.read ? "read" : "unread"}${href ? " link" : " plain"}`} data-kind={a.kind} aria-label={`${meta.label}${a.read ? "" : ", unread"}`}>
      <span className={`al-ico ${meta.tone}`} aria-hidden="true"><Icon name={meta.icon} size={20} /></span>
      <div className="al-main">
        <div className="al-meta">
          <span className={`al-badge ${meta.tone}`}>{meta.label}</span>
          {!a.read && <span className="al-unread">Unread</span>}
          <span className="al-time">{a.time}</span>
        </div>
        {href ? (
          <Link href={href} className="al-body" onClick={() => { if (!a.read) onMarkRead(); }}>{body}<span className="al-open" aria-hidden="true"><Icon name="chevron" size={16} /></span></Link>
        ) : (
          <div className="al-body">
            {body}
            <span className="al-gone">No longer available</span>
          </div>
        )}
        {a.canAnswer && a.matchId && (
          <div className="al-reply" role="group" aria-label="Are you coming?">
            <button type="button" className={`btn small green${answer === "in" ? " on" : ""}`} aria-pressed={answer === "in"} disabled={answering} onClick={() => onAnswer("in")}>
              {answer === "in" && <Icon name="check" size={16} />} I’m in
            </button>
            <button type="button" className={`btn small ghost${answer === "out" ? " on" : ""}`} aria-pressed={answer === "out"} disabled={answering} onClick={() => onAnswer("out")}>
              {answer === "out" && <Icon name="check" size={16} />} Can’t make it
            </button>
            {answer && <span className="al-said muted small" role="status">You replied: {answer === "in" ? "I’m in" : "Can’t make it"}</span>}
          </div>
        )}
      </div>
      {items.length > 0 && <ActionMenu items={items} label={`Actions for this alert: ${a.message}`} />}
    </article>
  );
}
