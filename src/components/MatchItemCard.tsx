// One match in the list. Both team badges, the status, when and where, the score or the result, and the viewer's own reply.
// The list card is deliberately quiet: it shows only YOUR reply, never how many people said yes, no or nothing.
import "./b4.css";
import Link from "next/link";
import { setAvailabilityAction } from "@/app/actions4";
import { IconCheck, IconCross } from "@/components/B4Icons";
import MatchRowMenu from "@/components/MatchRowMenu";
import TeamBadge from "@/components/TeamBadge";
import { STATUS_LABEL } from "@/lib/matchRules";
import { isNotStarted, titleOf, type MatchItem } from "@/lib/matchList";

const TONE: Record<string, string> = { draft: "", scheduled: "gold", live: "green", paused: "gold", completed: "green", postponed: "", cancelled: "red", abandoned: "red" };

export function ReplyLine({ communityId, m }: { communityId: string; m: MatchItem }) {
  if (!isNotStarted(m.status)) return null;
  const buttons = (
    <form action={setAvailabilityAction} className="ml-reply-btns">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="matchId" value={m.id} />
      <input type="hidden" name="next" value="list" />
      <button name="answer" value="in" className="ml-btn in" aria-label={`I’m in for ${titleOf(m)}`}>I’m in</button>
      <button name="answer" value="out" className="ml-btn out" aria-label={`Can’t make it to ${titleOf(m)}`}>Can’t make it</button>
    </form>
  );
  if (!m.myAnswer) {
    return (
      <div className="ml-reply">
        <span className="ml-pill none">{"You have not replied"}</span>
        {buttons}
      </div>
    );
  }
  const text = `You: ${m.myAnswer === "in" ? "I’m in" : "Can’t make it"}`;
  return (
    <details className="ml-reply">
      <summary>
        <span className={`ml-pill ${m.myAnswer}`}>{m.myAnswer === "in" ? <IconCheck size={14} /> : <IconCross size={14} />}<span>{text}</span></span>
        <span className="ml-change">Change</span>
      </summary>
      {buttons}
    </details>
  );
}

export default function MatchItemCard({ communityId, m }: { communityId: string; m: MatchItem }) {
  const title = titleOf(m);
  const live = m.status === "live" || m.status === "paused";
  const past = m.status === "completed" || m.status === "abandoned";
  return (
    <article className={`ml-card${m.mine1 || m.mine2 ? " mine" : ""}`} data-status={m.status}>
      <div className="ml-badges">
        <span className={m.mine1 ? "ml-mine" : undefined}><TeamBadge name={m.side1} size="sm" label={m.mine1 ? `Team ${m.side1}, your team` : undefined} /></span>
        <span className={m.mine2 ? "ml-mine" : undefined}><TeamBadge name={m.side2} size="sm" label={m.mine2 ? `Team ${m.side2}, your team` : undefined} /></span>
      </div>
      <div className="ml-body">
        <div className="ml-head">
          <Link href={`/c/${communityId}/matches/${m.id}`} className="ml-title">{title}</Link>
          <MatchRowMenu communityId={communityId} matchId={m.id} status={m.status} side1={m.side1} side2={m.side2} canManage={m.canManage} />
        </div>
        <div className="ml-meta">
          <span className={`chip ${TONE[m.status] ?? ""} ml-status`}>{m.status === "live" && <span className="ml-dot" aria-hidden="true" />}{STATUS_LABEL[m.status]}</span>
          {m.isNew && <span className="chip gold ml-status">New</span>}
        </div>
        <small className="ml-when">{m.when}{m.venue ? ` · ${m.venue}` : ""} · {m.overs} overs</small>
        {live && m.score && (
          <div className="ml-score"><b>{m.score}</b>{m.scoreSub && <small>{m.scoreSub}</small>}{m.chase && <span className="ml-chase">{m.chase}</span>}</div>
        )}
        {live && m.status === "paused" && <small className="ml-when">Paused</small>}
        {past && (m.score || m.result) && (
          <div className="ml-score">{m.score && <b>{m.score}</b>}{m.result && <span className="ml-result">{m.result}</span>}</div>
        )}
        {m.status === "cancelled" && <small className="ml-when">Cancelled</small>}
        {m.status === "draft" && <small className="ml-when">Nobody is told until you set a date.</small>}
        <ReplyLine communityId={communityId} m={m} />
      </div>
    </article>
  );
}
