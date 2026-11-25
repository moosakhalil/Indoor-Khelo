"use client";
// The three-dots menu of a match in the list. It does only what the match page can already do, in the same states:
// open, pick lineups, edit, rematch, postpone, cancel and delete. Postpone and cancel ask first; delete asks for the match name.
// Cancel and delete are only listed for the person who added the match or an Admin (the server checks it again); the rest is open to every member.
import { useState } from "react";
import { cancelAction, deleteMatchAction, postponeAction } from "@/app/actions4";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import { menuFor, titleOf } from "@/lib/matchList";
import type { MatchStatus } from "@/lib/matchRules";

type Ask = "postpone" | "cancel" | "delete" | null;

export default function MatchRowMenu({ communityId, matchId, status, side1, side2, canManage = true }: { communityId: string; matchId: string; status: MatchStatus; side1: string; side2: string; canManage?: boolean }) {
  const [ask, setAsk] = useState<Ask>(null);
  const title = titleOf({ side1, side2 });
  const base = `/c/${communityId}/matches/${matchId}`;
  const hrefOf = { open: base, lineup: `${base}/lineup`, edit: `${base}/edit`, rematch: `${base}/rematch` } as const;
  const items: ActionItem[] = menuFor(status, canManage).map((a) => {
    if (a.key === "postpone" || a.key === "cancel" || a.key === "delete") return { label: a.label, danger: a.danger, onSelect: () => setAsk(a.key as Ask) };
    return { label: a.label, href: hrefOf[a.key] };
  });
  const send = async (action: (fd: FormData) => Promise<void>) => {
    const fd = new FormData();
    fd.set("communityId", communityId);
    fd.set("matchId", matchId);
    await action(fd);
  };
  return (
    <>
      <ActionMenu items={items} label={`Actions for ${title}`} />
      <ConfirmDialog
        open={ask === "delete"}
        title="Delete this match?"
        body={`Removes ${title}, its lineups and replies for good. Only matches that never started can be deleted.`}
        confirmLabel="Delete match"
        danger
        typeToConfirm={title}
        onConfirm={() => send(deleteMatchAction)}
        onClose={() => setAsk(null)}
      />
      <ConfirmDialog
        open={ask === "cancel"}
        title="Cancel this match?"
        body={`Everyone is told. A cancelled match stays in the list. ${title}`}
        confirmLabel="Cancel match"
        cancelLabel="Keep it"
        danger
        onConfirm={() => send(cancelAction)}
        onClose={() => setAsk(null)}
      />
      <ConfirmDialog
        open={ask === "postpone"}
        title="Postpone this match?"
        body={`Everyone is told. You can schedule it again later by editing it. ${title}`}
        confirmLabel="Postpone match"
        cancelLabel="Keep it"
        onConfirm={() => send(postponeAction)}
        onClose={() => setAsk(null)}
      />
    </>
  );
}
