"use client";

import Link from "next/link";
import { useState } from "react";
import { leaveAction, setRoleAction } from "@/app/actions2";
import CnIc, { type CnIconName } from "@/components/CnIcons";
import CnSubmit from "@/components/CnSubmit";
import CommunityLogo from "@/components/CommunityLogo";
import Shirt from "@/components/Shirt";
import { matchesSuccessor } from "@/lib/cn";
import "./cn.css";

export type Successor = { user_id: string; name: string; player_number: number | null };

/** Member (or an Admin with another Admin): what happens, as an icon list, then the red leave button and the gold Stay. */
export function LeaveCard({
  communityId, communityName, role, number, justUnblocked,
}: {
  communityId: string;
  communityName: string;
  role: "admin" | "member";
  number: number | null;
  /** Arrived after making someone else Admin (`?blocked=1`). */
  justUnblocked?: boolean;
}) {
  const facts: { icon: CnIconName; tone: "green" | "orange"; text: string; sub?: string }[] = [
    { icon: "stats", tone: "green", text: "Your career stats stay with you" },
    { icon: "list", tone: "green", text: "Past scorecards keep your name and number" },
    { icon: "swap", tone: "orange", text: `Your number ${number} becomes free at once`, sub: "Others can pick it straight away." },
    { icon: "rejoin", tone: "green", text: "You can ask to join again later" },
  ];
  return (
    <div className="stack">
      {justUnblocked && (
        <div className="cn-banner green" role="status">
          <CnIc name="check" />
          <div><b>You can leave now</b><span>You are no longer the only Admin.</span></div>
        </div>
      )}
      <section className="cn-card cn-leave" aria-labelledby="cn-leave-h">
        <div className="cn-id">
          <CommunityLogo name={communityName} big />
          <div className="cn-idt">
            <h2 id="cn-leave-h">Leave {communityName}?</h2>
            <small className="muted">{role === "admin" ? "Admin" : "Member"} · number {number}</small>
          </div>
        </div>
        <ul className="cn-facts">
          {facts.map((f) => (
            <li key={f.text}>
              <i className={f.tone} aria-hidden="true"><CnIc name={f.icon} /></i>
              <span><b>{f.text}</b>{f.sub && <small>{f.sub}</small>}</span>
            </li>
          ))}
        </ul>
        <form action={leaveAction} className="stack">
          <input type="hidden" name="communityId" value={communityId} />
          <CnSubmit className="btn cn-leavebtn" pendingLabel="Leaving…">Yes, leave the community</CnSubmit>
        </form>
        <Link href={`/c/${communityId}/community`} className="btn gold">Stay</Link>
      </section>
    </div>
  );
}

/** The only Admin: must hand over the role first (or delete the community). Search and a count on the list; Stay is the main button. */
export function OnlyAdminCard({ communityId, communityName, candidates }: { communityId: string; communityName: string; candidates: Successor[] }) {
  const [q, setQ] = useState("");
  const shown = candidates.filter((c) => matchesSuccessor(c.name, c.player_number, q));
  return (
    <div className="stack">
      <div className="cn-banner gold" role="status">
        <CnIc name="shield" />
        <div><b>You are the only Admin of {communityName}</b><span>Make someone else Admin first, or delete the community.</span></div>
      </div>

      {candidates.length > 0 ? (
        <section className="cn-card cn-succ" aria-labelledby="cn-succ-h">
          <div className="cn-succ-head">
            <b id="cn-succ-h">Make someone Admin</b>
            <span className="cn-count-badge" aria-label={`${candidates.length} members`}>{candidates.length}</span>
          </div>
          <div className="cn-search">
            <CnIc name="search" />
            <label className="cn-sr" htmlFor="cn-ssearch">Search members</label>
            <input id="cn-ssearch" type="search" className="field" placeholder="Search members" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
            {q && <button type="button" className="cn-x" aria-label="Clear search" onClick={() => setQ("")}><CnIc name="close" /></button>}
          </div>
          <div className="cn-succ-list">
            {shown.length === 0 ? (
              <p className="cn-none" role="status">No one matches that search.</p>
            ) : shown.map((m) => (
              <form key={m.user_id} action={setRoleAction} className="cn-succ-row">
                <input type="hidden" name="communityId" value={communityId} />
                <input type="hidden" name="userId" value={m.user_id} />
                <input type="hidden" name="role" value="admin" />
                <input type="hidden" name="next" value={`/c/${communityId}/leave`} />
                <Shirt number={m.player_number} size="normal" />
                <span className="cn-rowt"><b>{m.name}</b><small>{m.player_number === null ? "No number yet" : `Number ${m.player_number}`}</small></span>
                <CnSubmit className="cn-makeadmin" pendingLabel="Saving…">Make Admin<span className="cn-sr"> {m.name}</span></CnSubmit>
              </form>
            ))}
          </div>
        </section>
      ) : (
        <section className="cn-empty" aria-labelledby="cn-empty-h">
          <span className="cn-eic" aria-hidden="true"><CnIc name="users" /></span>
          <h2 id="cn-empty-h">No other members yet</h2>
          <p className="muted small">Invite someone and make them Admin, or delete the community.</p>
        </section>
      )}

      <div className="cn-pair cn-stay-delete">
        <Link href={`/c/${communityId}/community`} className="btn gold">Stay</Link>
        <Link href={`/c/${communityId}/delete`} className="btn cn-quiet-red"><CnIc name="trash" />Delete the community</Link>
      </div>
    </div>
  );
}
