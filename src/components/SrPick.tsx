"use client";
// Phase F1: the match rows you tick (Group matches I have, Add matches to a series). Both badges, the date and a state chip on every row;
// a match that does not fit shows a lock, the real reason in orange, and a way to fix it.
import "./sr.css";
import Link from "next/link";
import { IconBall, IconLock, IconPlus, IconWarn } from "@/components/SrIcons";
import { MatchStatusChip, SideBadge } from "@/components/SrParts";

export type PickMatch = { id: string; side1: string; side2: string; when: string; status: string };

export function PickRow({ m, checked, onChange, locked, reason, fixHref }: { m: PickMatch; checked?: boolean; onChange?: (on: boolean) => void; locked?: boolean; reason?: string | null; fixHref?: string }) {
  const title = `${m.side1} v ${m.side2}`;
  const body = (
    <>
      <span className="sr-pick-badges"><SideBadge name={m.side1} size="sm" /><SideBadge name={m.side2} size="sm" /></span>
      <span className="sr-pick-t"><b>{title}</b><span className="sr-pick-meta"><small>{m.when}</small><MatchStatusChip status={m.status} /></span></span>
    </>
  );
  if (locked) {
    return (
      <div className="sr-pick locked">
        <span className="sr-lockicon" aria-hidden="true"><IconLock size={16} /></span>
        <div className="sr-pick-main">
          <div className="sr-pick-line">{body}</div>
          {reason && <p className="sr-reason"><IconWarn size={14} /><span>{reason}</span></p>}
          {fixHref && <Link href={fixHref} className="sr-link">Add the team to the series</Link>}
        </div>
      </div>
    );
  }
  return (
    <label className={`sr-pick${checked ? " on" : ""}`}>
      <input type="checkbox" value={m.id} checked={!!checked} onChange={(e) => onChange?.(e.target.checked)} aria-label={`Select ${title}`} />
      <span className="sr-pick-line">{body}</span>
    </label>
  );
}

export function PickEmpty({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="sr-empty inner" role="status">
      <span className="sr-empty-icon"><IconBall size={26} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="sr-empty-btns">{children}</div>
    </div>
  );
}

export const NewMatchLink = ({ communityId }: { communityId: string }) => <Link href={`/c/${communityId}/matches/new`} className="btn gold small"><IconPlus />New match</Link>;
