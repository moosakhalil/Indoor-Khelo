import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import { setAvailabilityAction } from "@/app/actions4";
import { STATUS_LABEL, formatWhen, type MatchStatus } from "@/lib/matchRules";
import { noReplyCount, type MatchRow } from "@/lib/matches";

export const STATUS_TONE: Record<MatchStatus, string> = {
  draft: "", scheduled: "gold", live: "green", paused: "gold", completed: "green", postponed: "", cancelled: "red", abandoned: "red",
};

export function StatusChip({ status }: { status: MatchStatus }) {
  return <span className={`chip ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Counts({ m }: { m: MatchRow }) {
  return <>{m.in_count} in · {m.out_count} can&rsquo;t · {noReplyCount(m)} no reply</>;
}

/** The two reply buttons. Replies are guidance only and can be changed until the match starts. */
export function ReplyButtons({ communityId, m, next }: { communityId: string; m: MatchRow; next?: "home" | "list" }) {
  if (!["draft", "scheduled", "postponed"].includes(m.status)) return null;
  const mine = m.my_answer;
  return (
    <form action={setAvailabilityAction} className="two">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="matchId" value={m.id} />
      {next && <input type="hidden" name="next" value={next} />}
      <button name="answer" value="in" className={`btn ${mine === "in" ? "gold" : "green"}`} aria-pressed={mine === "in"}>{mine === "in" ? "✓ I’m in" : "I’m in"}</button>
      <button name="answer" value="out" className={`btn ${mine === "out" ? "gold" : "red"}`} aria-pressed={mine === "out"}>{mine === "out" ? "✓ Can’t make it" : "Can’t make it"}</button>
    </form>
  );
}

export function MatchCard({ communityId, m, tz }: { communityId: string; m: MatchRow; tz: string }) {
  return (
    <Link href={`/c/${communityId}/matches/${m.id}`} className="card" style={{ display: "block" }}>
      <div className="row space">
        <span className="row" style={{ gap: 6 }}>
          <CommunityLogo name={m.side1_name} /> <b aria-hidden="true">v</b> <CommunityLogo name={m.side2_name} />
        </span>
        <StatusChip status={m.status} />
      </div>
      <b style={{ display: "block", marginTop: 8 }}>{m.side1_name} v {m.side2_name}</b>
      <small className="muted" style={{ display: "block" }}>{formatWhen(m.scheduled_at, tz)}{m.venue ? ` · ${m.venue}` : ""} · {m.overs} overs</small>
      {["draft", "scheduled", "postponed"].includes(m.status) && (
        <small className="muted" style={{ display: "block", marginTop: 4 }}>
          <Counts m={m} />{m.my_answer ? ` · You: ${m.my_answer === "in" ? "I’m in" : "Can’t make it"}` : " · You: no reply"}
        </small>
      )}
    </Link>
  );
}
