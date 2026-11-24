"use client";
// Phase C (UI redesign), Builder C1: "Manage this match": Postpone, Cancel and Delete (and, on the card variant, Rematch and Edit),
// each with its outcome in one line, or dimmed with a lock and the reason when the status does not allow it.
// The three actions are the EXISTING server actions (postponeAction, cancelAction, deleteMatchAction): same permission checks, same
// redirects. The dialogs state what will happen before it does. Delete asks for the match name.
import Link from "next/link";
import { useState } from "react";
import { cancelAction, deleteMatchAction, postponeAction } from "@/app/actions4";
import { IconClock, IconSwap } from "@/components/CrIcons";
import { IconChevron, IconCross, IconLock, IconPencil, IconTrash, IconUsers } from "@/components/B4Icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cancelledAlert, comingText, manageItems, postponedAlert, type ManageKey } from "@/lib/crManage";
import type { MatchStatus } from "@/lib/matchRules";
import { IconBell } from "@/components/CrIcons";
import "./cr.css";

type Ask = "postpone" | "cancel" | "delete" | null;

const ICON: Record<ManageKey, React.ReactNode> = {
  rematch: <IconSwap size={18} />, edit: <IconPencil size={18} />, postpone: <IconClock size={18} />, cancel: <IconCross size={18} />, delete: <IconTrash size={18} />,
};

export default function MatchManage({ communityId, matchId, status, title, whenLabel, variant = "panel", keys, comingCount = 0 }: {
  communityId: string; matchId: string; status: MatchStatus; title: string; whenLabel: string;
  /** panel: compact buttons (edit page). card: every action with its outcome line (also usable on the match page). */
  variant?: "panel" | "card"; keys?: ManageKey[];
  /** How many members answered "I'm in" for this match; shown in the cancel box when above 0. */
  comingCount?: number;
}) {
  const [ask, setAsk] = useState<Ask>(null);
  const base = `/c/${communityId}/matches/${matchId}`;
  const items = manageItems(status).filter((i) => !keys || keys.includes(i.key));
  const send = async (action: (fd: FormData) => Promise<void>) => {
    const fd = new FormData();
    fd.set("communityId", communityId);
    fd.set("matchId", matchId);
    await action(fd);
  };
  const subtitle = whenLabel ? `${title}, ${whenLabel}` : title;
  return (
    <>
      <div className={`cr-manage ${variant}`}>
        {items.map((i) => {
          const danger = i.danger ? " danger" : "";
          const open = (k: Ask) => () => setAsk(k);
          if (!i.ok) {
            return (
              <div key={i.key} className="cr-mrow off" aria-disabled="true">
                <span className="cr-mic">{ICON[i.key]}</span>
                <span className="cr-mtx"><b>{i.label}</b><small>{i.why}</small></span>
                <span className="cr-mlock"><IconLock size={16} /><span className="cr-sr">Not available</span></span>
              </div>
            );
          }
          const inner = (
            <>
              <span className="cr-mic">{ICON[i.key]}</span>
              <span className="cr-mtx"><b>{variant === "panel" && (i.key === "postpone" || i.key === "cancel" || i.key === "delete") ? `${i.label}…` : i.label}</b>{variant === "card" && <small>{i.outcome}</small>}</span>
              {variant === "card" && <span className="cr-mgo"><IconChevron size={18} /></span>}
            </>
          );
          if (i.key === "rematch") return <Link key={i.key} href={`${base}/rematch`} className="cr-mrow">{inner}</Link>;
          if (i.key === "edit") return <Link key={i.key} href={`${base}/edit`} className="cr-mrow">{inner}</Link>;
          return <button key={i.key} type="button" className={`cr-mrow${danger}`} onClick={open(i.key as Ask)}>{inner}</button>;
        })}
      </div>

      <ConfirmDialog
        open={ask === "postpone"}
        title="Postpone this match?"
        body={(
          <>
            <span className="cr-dlg-sub">{subtitle}</span>
            <span className="cr-alert info"><IconBell size={18} /><span>Everyone gets an alert: “{postponedAlert(title)}”</span></span>
            <span className="cr-dlg-note">The match stays in Upcoming. Edit it later and choose a new date to schedule it again.</span>
          </>
        )}
        confirmLabel="Postpone and tell everyone"
        cancelLabel="Keep it"
        onConfirm={() => send(postponeAction)}
        onClose={() => setAsk(null)}
      />
      <ConfirmDialog
        open={ask === "cancel"}
        title="Cancel this match?"
        body={(
          <>
            <span className="cr-dlg-sub">{subtitle}</span>
            {comingCount > 0 && <span className="cr-dlg-coming"><IconUsers size={18} /><b>{comingText(comingCount)}</b></span>}
            <span className="cr-alert red"><IconBell size={18} /><span>Everyone gets an alert: “{cancelledAlert(title)}”</span></span>
            <span className="cr-dlg-note">A cancelled match stays in the Past list. Its replies and lineup are kept. It cannot be played; to play it, create a rematch.</span>
          </>
        )}
        confirmLabel="Cancel match"
        cancelLabel="Keep match"
        danger
        onConfirm={() => send(cancelAction)}
        onClose={() => setAsk(null)}
      />
      <ConfirmDialog
        open={ask === "delete"}
        title="Delete this match for good?"
        body="Removes the match, its lineups and replies. Only matches that never started can be deleted. This cannot be undone."
        confirmLabel="Delete forever"
        cancelLabel="Keep match"
        danger
        typeToConfirm={title}
        onConfirm={() => send(deleteMatchAction)}
        onClose={() => setAsk(null)}
      />
    </>
  );
}
