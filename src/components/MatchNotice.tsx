// Phase C (UI redesign), Builder C1: the result of an action on a match, in the words of lib/notices.ts, as the proposal shows it:
// a failure is a banner that stays and says what to do next; a success is a short, calm line.
// Usable by any page (the Match details page can adopt it in Phase D); the Edit match page uses it for the ?e= codes.
import Link from "next/link";
import { IconBell, IconClock } from "@/components/CrIcons";
import { IconCheck, IconCross, IconLock, IconWarn } from "@/components/B4Icons";
import { noticeFor } from "@/lib/notices";
import "./cr.css";

const LOCKS = new Set(["locked", "forbidden", "not_a_member"]);

export default function MatchNotice({ code, extra, communityId, matchId }: {
  code: string | undefined; extra?: { n?: string; skip?: string; side?: string; max?: string }; communityId: string; matchId: string;
}) {
  const n = noticeFor(code, extra);
  if (!n) return null;
  const icon = n.tone === "red"
    ? (code && LOCKS.has(code) ? <IconLock size={18} /> : <IconWarn size={18} />)
    : code === "postponed" ? <IconClock size={18} /> : code === "cancelled" ? <IconCross size={18} /> : code === "reminded" ? <IconBell size={18} /> : <IconCheck size={18} />;
  const next = code === "locked" ? { href: `/c/${communityId}/matches/${matchId}`, label: "Open the match" }
    : code === "not_found" ? { href: `/c/${communityId}/matches`, label: "Back to matches" }
    : null;
  return (
    <div className={`cr-notice ${n.tone}`} role={n.tone === "red" ? "alert" : "status"}>
      {icon}
      <span>{n.text}</span>
      {next && <Link href={next.href} className="cr-notice-btn">{next.label}</Link>}
    </div>
  );
}
