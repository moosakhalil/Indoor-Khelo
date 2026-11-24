import MatchItemCard from "@/components/MatchItemCard";
import { setAvailabilityAction } from "@/app/actions4";
import { toMatchItem } from "@/lib/matchList";
import { STATUS_LABEL, type MatchStatus } from "@/lib/matchRules";
import type { CardSummary } from "@/lib/matchSummary";
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

/** One match as a card (server side). The list page uses the same card through `MatchList`, which filters plain data on the phone. */
export function MatchCard({ communityId, m, tz, summary, myTeams }: { communityId: string; m: MatchRow; tz: string; summary?: CardSummary; myTeams?: ReadonlySet<string> }) {
  return <MatchItemCard communityId={communityId} m={toMatchItem(m, tz, { summary, myTeams })} />;
}
