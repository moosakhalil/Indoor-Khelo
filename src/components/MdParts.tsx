// Phase D1: the small server-rendered pieces of the Match details page: banners (created, saved, rematch, status, warnings),
// the primary button, the rules card and the match link card. No state; links and wording are the page's own.
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { IconCalendar, IconCheck, IconCross, IconInfo, IconWarn } from "@/components/B4Icons";
import { MdBars, MdEye, MdScore } from "@/components/MdIcons";
import MatchManage from "@/components/MatchManage";
import MatchNotice from "@/components/MatchNotice";
import { IconChevron } from "@/components/B4Icons";
import { IconSwap } from "@/components/CrIcons";
import { manageItems } from "@/lib/crManage";
import { afterActionLink, createdBanners, type Primary } from "@/lib/md";
import { DISMISSALS, SUPER_OVER_MODES, type MatchStatus, type Rules } from "@/lib/matchRules";
import "./md.css";

/* ---------- banners ---------- */
export function MdNotice({ tone, icon, children, links = [] }: { tone: "green" | "mute" | "red" | "warn" | "orange"; icon: React.ReactNode; children: React.ReactNode; links?: { href: string; label: string }[] }) {
  return (
    <div className={`md-notice ${tone}`} role={tone === "red" ? "alert" : "status"}>
      <span className="md-nic" aria-hidden="true">{icon}</span>
      <span className="md-ntx">{children}</span>
      {links.map((l) => <Link key={l.href} href={l.href} className="md-nbtn">{l.label}</Link>)}
    </div>
  );
}

export type NoticeQuery = { created?: string; saved?: string; rematch?: string; e?: string; n?: string; skip?: string; side?: string; max?: string; series?: string; seriesnote?: string };

/** Everything that can sit above the hero: the green lines after create, edit and rematch, the notice for ?e=, and the pattern warning. */
export function MdTopNotices({ q, communityId, matchId, warning }: { q: NoticeQuery; communityId: string; matchId: string; warning: string | null }) {
  const base = `/c/${communityId}/matches/${matchId}`;
  const greens = createdBanners(q, base, true);
  const after = afterActionLink(q.e, communityId);
  return (
    <>
      {greens.map((b, i) => <MdNotice key={i} tone={b.tone} icon={b.tone === "green" ? <IconCheck size={18} /> : <IconInfo size={18} />} links={b.links.map((l) => ({ href: l.href, label: l.label }))}>{b.text}</MdNotice>)}
      {q.e && (
        <div className="md-noticewrap">
          <MatchNotice code={q.e} extra={{ n: q.n, skip: q.skip, side: q.side, max: q.max }} communityId={communityId} matchId={matchId} />
          {after && <Link href={after.href} className="md-view">{after.label} ›</Link>}
          {q.e === "too_many" && <Link href={`${base}/edit`} className="md-view">Edit match ›</Link>}
        </div>
      )}
      {warning && <MdNotice tone="warn" icon={<IconWarn size={18} />} links={[{ href: `${base}/edit`, label: "Edit the match" }]}>{warning}</MdNotice>}
    </>
  );
}

/** Cancelled and postponed explain themselves. Postponed has one tap to Reschedule (Edit). */
export function MdStatusNotice({ status, communityId, matchId }: { status: string; communityId: string; matchId: string }) {
  if (status === "cancelled") {
    return (
      <MdNotice tone="red" icon={<IconCross size={18} />}>
        <b>This match was cancelled.</b><small>It stays in the list. You can delete it or play a rematch.</small>
      </MdNotice>
    );
  }
  if (status === "postponed") {
    return (
      <MdNotice tone="orange" icon={<IconCalendar size={18} />} links={[{ href: `/c/${communityId}/matches/${matchId}/edit`, label: "Reschedule" }]}>
        <b>This match is postponed.</b><small>Edit it and choose a new date and time to schedule it again.</small>
      </MdNotice>
    );
  }
  return null;
}

/* ---------- the one big button ---------- */
export function MdPrimary({ primary, gap, communityId, matchId }: { primary: Primary; gap: string | null; communityId: string; matchId: string }) {
  if (!primary) return null;
  const icon = primary.kind === "report" ? <MdBars size={20} /> : primary.kind === "watch" ? <MdEye size={20} /> : <MdScore size={20} />;
  return (
    <div className="md-primarybox">
      {gap && primary.kind === "score" && <MdNotice tone="warn" icon={<IconWarn size={18} />} links={[{ href: `/c/${communityId}/matches/${matchId}/lineup`, label: "Pick lineups" }]}>{gap}</MdNotice>}
      <Link href={primary.href} className="md-go">{icon}{primary.label}</Link>
      {primary.hint && <p className="md-scoring">{primary.hint}</p>}
    </div>
  );
}

/* ---------- rules ---------- */
export function MdRules({ r, limitText, open }: { r: Rules; limitText: string; open: boolean }) {
  const rows: [string, string][] = [
    ["Innings", r.innings === 2 ? "Each team bats once" : "One innings"],
    ["Balls per over", String(r.ballsPerOver)],
    ["Wide", `${r.wideRuns} run${r.wideRuns === 1 ? "" : "s"}${r.widesReBowled ? ", bowled again" : ", counts as a ball"}`],
    ["No ball", `${r.noBallRuns} run${r.noBallRuns === 1 ? "" : "s"}${r.noBallsReBowled ? ", bowled again" : ", counts as a ball"}`],
    ["Byes and leg-byes", `${r.byesCountAsBalls ? "Byes count" : "Byes do not count"}, ${r.legByesCountAsBalls ? "leg-byes count" : "leg-byes do not count"} as balls`],
    ["Free hit", r.freeHit ? "On after a no ball" : "Off"],
    ["Overthrows", r.overthrows ? "Allowed" : "Not allowed"],
    ["Retired batter", r.retiredCanReturn ? "Can come back" : "Cannot come back"],
    ["Same bowler twice in a row", r.sameBowlerTwoInARow ? "Allowed" : "Not allowed"],
    ["Last batter", r.lastBatterAlone ? "Can bat alone" : "Innings ends when one batter is left"],
    ["Ways of getting out", r.dismissals.map((d) => DISMISSALS.find((x) => x.value === d)?.label ?? d).join(", ")],
    ["If level", SUPER_OVER_MODES.find((x) => x.value === r.superOver)?.label ?? ""],
    ["Bowler limit", limitText],
  ];
  return (
    <details className="md-card md-rules" open={open}>
      <summary><span><b>Rules for this match</b><small>Saved with the match, never changed by later settings.</small></span><span className="md-chev" aria-hidden="true">›</span></summary>
      <dl>
        {rows.map(([k, v]) => <div key={k} className="md-rrow"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </details>
  );
}

/* ---------- link ---------- */
export function MdLinkCard({ link }: { link: string }) {
  return (
    <section className="md-card md-linkcard">
      <h2 className="md-h">Match link</h2>
      <div className="md-linkrow">
        <span className="md-url">{link}</span>
        <CopyButton text={link} />
      </div>
      <p className="md-help">Members of this community can open it. Anyone else is asked to sign in and join first.</p>
    </section>
  );
}

/* ---------- manage ---------- */
/** "Manage match": only what the status allows (no dimmed buttons). Rematch keeps its series wording; the rest is Phase C's MatchManage. */
export function MdManageCard({ communityId, matchId, status, title, whenLabel, rematchLabel, comingCount = 0, canManage = true }: {
  communityId: string; matchId: string; status: MatchStatus; title: string; whenLabel: string; rematchLabel: string; comingCount?: number;
  /** Cancel and delete are only offered to the person who added the match, or an Admin (lib/ownerRule.ts). */
  canManage?: boolean;
}) {
  const keys = manageItems(status, canManage).filter((i) => i.ok && i.key !== "rematch").map((i) => i.key);
  return (
    <section className="md-card md-managecard" id="md-manage" aria-labelledby="md-manage-h">
      <h2 className="md-h" id="md-manage-h">Manage match</h2>
      <div className="cr-manage card">
        <Link href={`/c/${communityId}/matches/${matchId}/rematch`} className="cr-mrow">
          <span className="cr-mic"><IconSwap size={18} /></span>
          <span className="cr-mtx"><b>{rematchLabel}</b><small>Same teams, venue, overs, rules and lineups. Pick a new date.</small></span>
          <span className="cr-mgo"><IconChevron size={18} /></span>
        </Link>
      </div>
      {keys.length > 0 && <MatchManage communityId={communityId} matchId={matchId} status={status} title={title} whenLabel={whenLabel} variant="card" keys={keys} comingCount={comingCount} canManage={canManage} />}
    </section>
  );
}
