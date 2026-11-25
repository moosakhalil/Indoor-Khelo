"use client";
// The "Delete this team" card on the edit page.
//   no matches : red outlined card, the rule written once, a Delete button that asks for the team name
//   has matches: a Locked badge, the real explanation, two useful buttons (see its matches, edit squad) and a dimmed delete button
import "./b4.css";
import Link from "next/link";
import { useState } from "react";
import { IconLock, IconTrash } from "@/components/B4Icons";
import TeamDeleteDialog from "@/components/TeamDeleteDialog";
import { ownerReason } from "@/lib/ownerRule";
import { deleteBlockedText } from "@/lib/teamList";

export default function TeamDangerZone({ communityId, teamId, name, matchCount, canDelete = true, addedBy = null }: { communityId: string; teamId: string; name: string; matchCount: number; canDelete?: boolean; addedBy?: string | null }) {
  const [ask, setAsk] = useState(false);
  // Only the person who added the team, or an Admin, can delete it (lib/ownerRule.ts): the others see why, with no delete button.
  if (!canDelete) {
    return (
      <section className="card tm-danger locked" aria-labelledby="tm-dz-h">
        <div className="row space"><b id="tm-dz-h">Delete this team</b><span className="chip"><IconLock size={14} /> Locked</span></div>
        <p className="muted small" style={{ margin: "6px 0 0" }}>{ownerReason("delete", addedBy)}</p>
      </section>
    );
  }
  if (matchCount > 0) {
    return (
      <section className="card tm-danger locked" aria-labelledby="tm-dz-h">
        <div className="row space"><b id="tm-dz-h">Delete this team</b><span className="chip"><IconLock size={14} /> Locked</span></div>
        <p className="muted small" style={{ margin: "6px 0 10px" }}>{deleteBlockedText(matchCount)}</p>
        <div className="tm-dz-btns">
          <Link href={`/c/${communityId}/matches?q=${encodeURIComponent(name)}`} className="btn ghost small">See its {matchCount === 1 ? "1 match" : `${matchCount} matches`}</Link>
          <Link href={`/c/${communityId}/teams/${teamId}/squad`} className="btn ghost small">Edit squad</Link>
        </div>
        <button type="button" className="btn red small tm-dz-off" disabled>Delete {name} (not allowed)</button>
      </section>
    );
  }
  return (
    <section className="card tm-danger" aria-labelledby="tm-dz-h">
      <b id="tm-dz-h">Delete this team</b>
      <p className="muted small" style={{ margin: "6px 0 10px" }}>Removes the team and its squad. A team that has matches cannot be deleted.</p>
      <button type="button" className="btn red small" onClick={() => setAsk(true)}><IconTrash size={16} /> Delete {name}…</button>
      <TeamDeleteDialog open={ask} onClose={() => setAsk(false)} communityId={communityId} teamId={teamId} name={name} matchCount={0} />
    </section>
  );
}
