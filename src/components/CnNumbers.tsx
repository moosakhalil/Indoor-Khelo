"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetNumberB3 } from "@/app/actionsB3";
import ActionMenu from "@/components/ActionMenu";
import CnIc from "@/components/CnIcons";
import ConfirmDialog from "@/components/ConfirmDialog";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import { ALL_NUMBERS, matchesPerson, sortByNumber, type NumberMember } from "@/lib/cn";
import { firstName, manageNotice } from "@/lib/b3";
import "./cn.css";

/** The number map: 1 to 99, the ones in use are gold. Plain markup, used in the side panel (wide screens) and at the end of the page. */
export function NumberMap({ used, className }: { used: number[]; className?: string }) {
  const set = new Set(used);
  return (
    <section className={`cn-map ${className ?? ""}`} aria-label="Number map">
      <h2>Number map</h2>
      <div className="cn-mapgrid" role="list">
        {ALL_NUMBERS.map((n) => (
          <span key={n} role="listitem" className={`cn-cell${set.has(n) ? " used" : ""}`} aria-label={`${n}, ${set.has(n) ? "in use" : "free"}`}>{n}</span>
        ))}
      </div>
      <ul className="cn-legend" aria-label="Legend">
        <li><i className="sw sel" aria-hidden="true" />In use ({set.size})</li>
        <li><i className="sw free" aria-hidden="true" />Free ({ALL_NUMBERS.length - set.size})</li>
      </ul>
    </section>
  );
}

/**
 * Player numbers for the Admin: search by name or number, people without a number marked, and "Reset number" on every row
 * (a visible button on wide screens, the three dots menu everywhere). The reset asks first and names the number and the person.
 */
export default function CnNumbers({ communityId, communityName, members }: { communityId: string; communityName: string; members: NumberMember[] }) {
  const router = useRouter();
  const { show } = useSnackbar();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<NumberMember | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorName, setErrorName] = useState("This member");
  const rows = sortByNumber(members).filter((m) => matchesPerson(m.name, m.player_number, q));
  const withNumber = members.filter((m) => m.player_number !== null).length;
  const failure = errorCode ? manageNotice(errorCode, errorName) : null;

  async function reset() {
    const t = target;
    if (!t) return;
    const out = await resetNumberB3(communityId, t.user_id).catch(() => "error" as const);
    setTarget(null);
    if (out !== "ok") {
      setErrorName(t.name);
      setErrorCode(out);
      return;
    }
    setErrorCode(null);
    show({ message: `Number ${t.player_number} freed. ${t.name} must choose a new number.`, tone: "success" });
    router.refresh();
  }

  return (
    <div className="stack">
      <div className="cn-banner green" role="status">
        <CnIc name="check" />
        <div><b>No conflicts</b><span>Every number belongs to one person, because numbers are first come, first served.</span></div>
      </div>

      {failure && (
        <div className="cn-banner red" role="alert">
          <CnIc name="warn" />
          <div><b>{failure.headline}</b><span>{failure.body}</span></div>
        </div>
      )}

      <div className="cn-search">
        <CnIc name="search" />
        <label className="cn-sr" htmlFor="cn-nsearch">Search by name or number</label>
        <input id="cn-nsearch" type="search" className="field" placeholder="Search by name or number" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
        {q && <button type="button" className="cn-x" aria-label="Clear search" onClick={() => setQ("")}><CnIc name="close" /></button>}
      </div>

      <section className="card cn-rows" aria-label={`All members (${members.length} of 99)`}>
        <p className="cn-count muted small" role="status">
          {q.trim() ? `${rows.length} of ${members.length} members` : `${members.length} of 99 members, ${withNumber} with a number`}
        </p>
        {rows.length === 0 ? (
          <p className="cn-none">No one matches. Search a name, or an exact number.</p>
        ) : rows.map((m) => {
          const none = m.player_number === null;
          return (
            <div key={m.user_id} className={`cn-row${none ? " none" : ""}`}>
              <Link href={`/c/${communityId}/members/${m.user_id}`} className="cn-rowlink">
                <Shirt number={m.player_number} size="normal" />
                <span className="cn-rowt">
                  <b>{m.name}{none && <span className="cn-badge orange">NO NUMBER</span>}</b>
                  <small>{none ? "Has not picked a number yet" : `Number ${m.player_number}`}</small>
                </span>
              </Link>
              {!none && (
                <button type="button" className="cn-hoverbtn" onClick={() => setTarget(m)} aria-label={`Reset number ${m.player_number} for ${m.name}`}>Reset number</button>
              )}
              <ActionMenu
                label={`More actions for ${m.name}`}
                items={[
                  { label: "Manage member", href: `/c/${communityId}/members/${m.user_id}` },
                  { label: "Reset number", onSelect: () => setTarget(m), disabled: none, hint: none ? `${firstName(m.name)} has not picked one yet` : undefined },
                ]}
              />
            </div>
          );
        })}
      </section>

      <p className="muted small cn-foot">If two people ever argue about a number, tap a person and ask them to choose a new one. Past matches keep the number used at the time.</p>

      <NumberMap used={members.flatMap((m) => (m.player_number === null ? [] : [m.player_number]))} className="cn-map-inline" />

      <ConfirmDialog
        open={target !== null}
        danger
        title={`Free number ${target?.player_number}?`}
        body={target && <>{target.name} will have to pick a new number before using {communityName} again. Number {target.player_number} becomes free for everyone at once. Past matches keep the number used at the time.</>}
        confirmLabel={`Yes, free number ${target?.player_number}`}
        onConfirm={reset}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
