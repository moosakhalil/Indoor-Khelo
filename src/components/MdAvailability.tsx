"use client";
// Phase D1: "Are you coming?" on the Match details page. A counts bar (in, can't, no reply), two big reply buttons, tabs with
// everyone who answered each way (a gold shirt and the name), and "Remind" for matches that are scheduled.
// It shows what the page showed before: the same counts and the same names, to every member. Replies are guidance only.
// The buttons post to the existing setAvailabilityAction, the reminder to remindAction (same checks, same redirects).
import { useId, useState } from "react";
import { remindAction, setAvailabilityAction } from "@/app/actions4";
import { IconCheck, IconCross } from "@/components/B4Icons";
import { IconBell } from "@/components/CrIcons";
import Shirt from "@/components/Shirt";
import { replyBar } from "@/lib/md";
import "./md.css";

export type ReplyPerson = { id: string; name: string; number: number | null; answer: "in" | "out" | null };
type Tab = "in" | "out" | "none";

export default function MdAvailability({ communityId, matchId, mine, replies, remindCount }: {
  communityId: string; matchId: string; mine: "in" | "out" | null; replies: ReplyPerson[];
  /** How many have not replied, when a reminder can be sent (scheduled match, at least one); otherwise 0. */
  remindCount: number;
}) {
  const [tab, setTab] = useState<Tab>("in");
  const uid = useId();
  const lists: Record<Tab, ReplyPerson[]> = {
    in: replies.filter((p) => p.answer === "in"),
    out: replies.filter((p) => p.answer === "out"),
    none: replies.filter((p) => p.answer === null),
  };
  const bar = replyBar(lists.in.length, lists.out.length, lists.none.length);
  const tabs: [Tab, string][] = [["in", `In ${lists.in.length}`], ["out", `Can’t ${lists.out.length}`], ["none", `No reply ${lists.none.length}`]];
  // Arrow keys move between the tabs (a tab list is one stop for the keyboard).
  const order: Tab[] = ["in", "out", "none"];
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = order[(order.indexOf(tab) + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length]!;
    setTab(next);
    document.getElementById(`${uid}-${next}`)?.focus();
  };
  return (
    <section className="md-card md-avail" aria-label="Are you coming?">
      <h2 className="md-h">Are you coming?</h2>
      <div className="md-bar" role="img" aria-label={`${lists.in.length} in, ${lists.out.length} can’t, ${lists.none.length} no reply`}>
        <span className="in" style={{ width: `${bar.inPct}%` }} /><span className="out" style={{ width: `${bar.outPct}%` }} /><span className="none" style={{ width: `${bar.nonePct}%` }} />
      </div>
      <ul className="md-legend">
        <li><i className="in" aria-hidden="true" />{lists.in.length} in</li>
        <li><i className="out" aria-hidden="true" />{lists.out.length} can’t</li>
        <li><i className="none" aria-hidden="true" />{lists.none.length} no reply</li>
      </ul>
      <form action={setAvailabilityAction} className="md-reply">
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="matchId" value={matchId} />
        <button name="answer" value="in" className={`md-rbtn${mine === "in" ? " on-in" : ""}`} aria-pressed={mine === "in"}>
          <IconCheck size={18} />I’m in
        </button>
        <button name="answer" value="out" className={`md-rbtn${mine === "out" ? " on-out" : ""}`} aria-pressed={mine === "out"}>
          <IconCross size={18} />Can’t make it
        </button>
      </form>
      <p className="md-help">Replies are only guidance: the lineup can include anyone, even on match day. You can change your reply until the match starts.</p>
      <div className="md-tabs" role="tablist" aria-label="Who replied" onKeyDown={onTabKey}>
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`${uid}-${k}`} aria-selected={tab === k} aria-controls={`${uid}-panel`} tabIndex={tab === k ? 0 : -1} className={tab === k ? "on" : undefined} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-${tab}`} className="md-chips">
        {lists[tab].length === 0 && <span className="muted small">nobody</span>}
        {lists[tab].map((p) => <span key={p.id} className="md-chip"><Shirt number={p.number} size="small" /><span>{p.name}</span></span>)}
      </div>
      {remindCount > 0 && (
        <form action={remindAction}>
          <input type="hidden" name="communityId" value={communityId} />
          <input type="hidden" name="matchId" value={matchId} />
          <button className="md-remind"><IconBell size={18} />Remind the {remindCount} who have not replied</button>
        </form>
      )}
    </section>
  );
}
