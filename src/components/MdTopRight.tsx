"use client";
// Phase D1: the right side of the top bar on the Match details page: Share (the match link) and the three-dots menu with
// Edit, Rematch, Postpone, Cancel (red) and Delete (red). Only what the status allows is listed (lib/crManage.ts, the same rules as
// the server). The three risky ones open the same confirm dialogs as the "Manage match" card, so there is one set of dialogs.
import { useCallback } from "react";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import { MdShare } from "@/components/MdIcons";
import { useSnackbar } from "@/components/Snackbar";
import { manageItems } from "@/lib/crManage";
import type { MatchStatus } from "@/lib/matchRules";
import "./md.css";

export const MANAGE_ID = "md-manage";
const ROW_LABEL = { postpone: "Postpone", cancel: "Cancel match", delete: "Delete match" } as const;

/** Presses the matching row of the "Manage match" card (it owns the confirm dialogs), after bringing the card into view. */
export function openManage(key: keyof typeof ROW_LABEL) {
  const root = document.getElementById(MANAGE_ID);
  if (!root) return false;
  const row = Array.from(root.querySelectorAll<HTMLButtonElement>("button.cr-mrow")).find((b) => (b.textContent ?? "").trim().startsWith(ROW_LABEL[key]));
  if (!row) return false;
  root.scrollIntoView?.({ block: "center" });
  row.click();
  return true;
}

export default function MdTopRight({ communityId, matchId, status, link, title, rematchLabel = "Rematch" }: { communityId: string; matchId: string; status: MatchStatus; link: string; title: string; rematchLabel?: string }) {
  const snack = useSnackbar();
  const base = `/c/${communityId}/matches/${matchId}`;
  const share = useCallback(async () => {
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title, url: link }); return; }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(link);
      snack.show({ message: "Match link copied.", tone: "success" });
    } catch {
      snack.show({ message: "Could not copy. The link is in the Match link card below.", tone: "warn" });
    }
  }, [link, title, snack]);

  const items: ActionItem[] = manageItems(status).filter((i) => i.ok).map((i) => {
    if (i.key === "edit") return { label: i.label, href: `${base}/edit` };
    if (i.key === "rematch") return { label: rematchLabel, href: `${base}/rematch` };
    const key = i.key as keyof typeof ROW_LABEL;
    return { label: i.label, danger: i.danger, onSelect: () => { openManage(key); } };
  });
  // Edit first, then Rematch, then the risky ones last (the proposal's order).
  const rank = (label: string) => (label === "Edit match" ? 0 : label === rematchLabel ? 1 : label === "Postpone" ? 2 : label === "Cancel match" ? 3 : 4);
  items.sort((a, b) => rank(a.label) - rank(b.label));

  return (
    <>
      <button type="button" className="md-iconbtn" onClick={() => void share()} aria-label="Share match link"><MdShare size={20} /></button>
      <ActionMenu items={items} label="Match actions" />
    </>
  );
}
