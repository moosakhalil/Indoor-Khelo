"use client";
// The interactive parts of the team page: the top-bar actions (Edit, and a menu with Edit team, Edit squad, Delete team)
// and the permanent squad card with a menu on every row (open player, make captain, make vice-captain, remove from squad).
import "./b4.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeFromSquadAction, setTeamRoleAction } from "@/app/actionsB4";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import { IconPencil, IconPlus, IconUsers, IconWarn } from "@/components/B4Icons";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import TeamDeleteDialog from "@/components/TeamDeleteDialog";
import { matchesText, needsPlayersText, playersText } from "@/lib/teamList";

export function TeamTopActions({ communityId, teamId, name, matchCount, canDelete = true }: { communityId: string; teamId: string; name: string; matchCount: number; canDelete?: boolean }) {
  const [ask, setAsk] = useState(false);
  const base = `/c/${communityId}/teams/${teamId}`;
  const items: ActionItem[] = [
    { label: "Edit team", href: `${base}/edit` },
    { label: "Edit squad", href: `${base}/squad` },
    // Only the person who added the team, or an Admin, is offered Delete (lib/ownerRule.ts).
    ...(canDelete ? [{ label: matchCount > 0 ? `Delete team (has ${matchesText(matchCount)}, not allowed)` : "Delete team…", danger: true, onSelect: () => setAsk(true) }] : []),
  ];
  return (
    <span className="tm-top">
      <Link href={`${base}/edit`} className="chip gold tm-top-edit"><IconPencil size={15} /> Edit</Link>
      <ActionMenu items={items} label={`Actions for ${name}`} />
      <TeamDeleteDialog open={ask} onClose={() => setAsk(false)} communityId={communityId} teamId={teamId} name={name} matchCount={matchCount} />
    </span>
  );
}

export type SquadRow = { user_id: string; name: string; player_number: number | null; role: string | null };

export function SquadCard({ communityId, teamId, teamName, rows, captainId, viceId, me }: {
  communityId: string; teamId: string; teamName: string; rows: SquadRow[]; captainId: string | null; viceId: string | null; me: string;
}) {
  const snack = useSnackbar();
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const shown = rows.filter((r) => !gone.includes(r.user_id));
  const warn = needsPlayersText(shown.length);

  const role = async (r: SquadRow, which: "captain" | "vice") => {
    const res = await setTeamRoleAction(communityId, teamId, r.user_id, which);
    if (!res.ok) { snack.show({ message: res.error ?? "That did not work. Please try again.", tone: "error" }); return; }
    snack.show({ message: `${r.name} is now ${which === "captain" ? "captain" : "vice-captain"}.`, tone: "success" });
    router.refresh();
  };

  const remove = (r: SquadRow) => {
    const roleNote = r.user_id === captainId ? " The captain role went with the squad place." : r.user_id === viceId ? " The vice-captain role went with the squad place." : "";
    setGone((g) => [...g, r.user_id]);
    snack.undoable({
      message: `${r.name} removed from the squad.${roleNote}`,
      commit: async () => {
        const res = await removeFromSquadAction(communityId, teamId, r.user_id);
        if (!res.ok) {
          setGone((g) => g.filter((x) => x !== r.user_id));
          snack.show({ message: res.error ?? "That did not work. Please try again.", tone: "error" });
          return;
        }
        router.refresh();
      },
      onUndo: () => setGone((g) => g.filter((x) => x !== r.user_id)),
    });
  };

  return (
    <section className="card tm-squadcard" aria-labelledby="tm-squad-h">
      <div className="row space">
        <h2 id="tm-squad-h">Squad <small className="muted">{playersText(shown.length)}</small></h2>
        <Link href={`/c/${communityId}/teams/${teamId}/squad`} className="btn gold small"><IconPencil size={16} /> Edit squad</Link>
      </div>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>The regular players. For each match you pick the actual lineup separately, so changing a lineup never changes this squad.</p>
      {warn && (
        <div className="banner tm-orange" role="status"><IconWarn size={20} /><span>{warn}</span></div>
      )}
      {shown.length === 0 ? (
        <div className="tm-nosquad">
          <span className="ml-empty-icon"><IconUsers size={28} /></span>
          <b>No players yet.</b>
          <Link href={`/c/${communityId}/teams/${teamId}/squad`} className="btn gold ml-act"><IconPlus /> Add players</Link>
        </div>
      ) : (
        <div className="list">
          {shown.map((r) => {
            const isCap = r.user_id === captainId, isVice = r.user_id === viceId, isMe = r.user_id === me;
            const items: ActionItem[] = [
              { label: "Open player", href: `/c/${communityId}/players/${r.user_id}` },
              { label: "Make captain", disabled: isCap, hint: "Already captain", onSelect: () => void role(r, "captain") },
              { label: "Make vice-captain", disabled: isVice, hint: "Already vice-captain", onSelect: () => void role(r, "vice") },
              { label: "Remove from squad", danger: true, onSelect: () => remove(r) },
            ];
            return (
              <div key={r.user_id} className="item tm-srow">
                <Link href={`/c/${communityId}/players/${r.user_id}`} className="tm-srow-link">
                  <Shirt number={r.player_number} />
                  <span className="t grow">
                    <b>{r.name}{isCap && <span className="tm-role" title="Captain">C</span>}{isVice && <span className="tm-role" title="Vice-captain">VC</span>}{isMe && <span className="tm-you">You</span>}</b>
                    <small>{[isCap ? "Captain" : isVice ? "Vice-captain" : null, r.role].filter(Boolean).join(" · ")}</small>
                  </span>
                </Link>
                <ActionMenu items={items} label={`Actions for ${r.name} in ${teamName}`} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
