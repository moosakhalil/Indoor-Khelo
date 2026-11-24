"use client";
// Deleting a team, in one place for the Teams list, the team page and the edit page.
//   no matches : type the team name, then the red "Delete team" button works
//   has matches: a calm box that says why it is not possible and offers the next best step (nothing is deleted)
import { useRouter } from "next/navigation";
import { deleteTeamAction } from "@/app/actions3";
import ConfirmDialog from "@/components/ConfirmDialog";
import { deleteBlockedText } from "@/lib/teamList";

export default function TeamDeleteDialog({ open, onClose, communityId, teamId, name, matchCount }: { open: boolean; onClose: () => void; communityId: string; teamId: string; name: string; matchCount: number }) {
  const router = useRouter();
  if (matchCount > 0) {
    return (
      <ConfirmDialog
        open={open}
        title={`${name} cannot be deleted`}
        body={deleteBlockedText(matchCount)}
        confirmLabel="Edit squad instead"
        cancelLabel="Close"
        onConfirm={() => { onClose(); router.push(`/c/${communityId}/teams/${teamId}/squad`); }}
        onClose={onClose}
      />
    );
  }
  return (
    <ConfirmDialog
      open={open}
      title="Delete this team?"
      body={`Removes ${name} and its squad for good. A team that has matches cannot be deleted.`}
      confirmLabel="Delete team"
      danger
      typeToConfirm={name}
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("communityId", communityId);
        fd.set("teamId", teamId);
        await deleteTeamAction(fd);
      }}
      onClose={onClose}
    />
  );
}
