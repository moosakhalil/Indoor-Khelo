"use client";
// Compare players: two player cards instead of two dropdowns. Tapping a card opens a searchable list; choosing someone is a plain
// link to /compare?a=..&b=.. (so it works like the old form: the page itself does the comparing). The swap button is a link too.
import "./ld.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IconChevronDown, IconSearch, IconSwap } from "@/components/LdIcons";
import LdSheet from "@/components/LdSheet";
import Shirt from "@/components/Shirt";
import { compareHref, personLine } from "@/lib/ldView";

export type CmpMember = { user_id: string; name: string; player_number: number | null; playing_role: string | null };

type Side = "a" | "b";
const SIDE_LABEL: Record<Side, string> = { a: "First player", b: "Second player" };

export default function ComparePicker({ communityId, members, a, b }: { communityId: string; members: CmpMember[]; a: string | null; b: string | null }) {
  const [open, setOpen] = useState<Side | null>(null);
  const [q, setQ] = useState("");
  const by = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const chosen: Record<Side, CmpMember | null> = { a: a ? by.get(a) ?? null : null, b: b ? by.get(b) ?? null : null };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? members.filter((m) => m.name.toLowerCase().includes(s)) : members;
  }, [members, q]);
  const close = () => { setOpen(null); setQ(""); };
  const hrefFor = (side: Side, id: string | null) => (side === "a" ? compareHref(communityId, id, b) : compareHref(communityId, a, id));

  const card = (side: Side) => {
    const m = chosen[side];
    return (
      <div className={`ld-pcard${m ? "" : " empty"}`} role="group" aria-label={SIDE_LABEL[side]}>
        {m ? <Shirt number={m.player_number} size="big" name={m.name} /> : <span className="ld-qmark" aria-hidden="true">?</span>}
        <b className="ld-pname">{m ? m.name : SIDE_LABEL[side]}</b>
        <small className="muted ld-psub">{m ? personLine(m.player_number, m.playing_role) || "Member" : "Choose a member"}</small>
        <button type="button" className="ld-chipbtn" aria-haspopup="dialog" onClick={() => setOpen(side)}>
          {m ? "Change" : "Choose"}<span className="ld-sr"> {SIDE_LABEL[side].toLowerCase()}</span> <IconChevronDown size={14} />
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="ld-pair">
        {card("a")}
        {a || b ? (
          <Link href={compareHref(communityId, b, a)} className="ld-swap" aria-label="Swap the two players" title="Swap the two players"><IconSwap size={18} /></Link>
        ) : (
          <span className="ld-swap off" aria-hidden="true"><IconSwap size={18} /></span>
        )}
        {card("b")}
      </div>
      <LdSheet open={open !== null} onClose={close} title={open ? `Choose the ${SIDE_LABEL[open].toLowerCase()}` : "Choose"} hint="Search by name. The numbers come from finished matches only.">
        <label className="ld-search"><IconSearch size={18} /><input type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" aria-label="Search members" autoComplete="off" data-autofocus /></label>
        <ul className="ld-picklist">
          {open && chosen[open] && (
            <li><Link href={hrefFor(open, null)} className="ld-opt" onClick={close}>Not chosen</Link></li>
          )}
          {open && shown.map((m) => (
            <li key={m.user_id}>
              <Link href={hrefFor(open, m.user_id)} className={`ld-opt${chosen[open]?.user_id === m.user_id ? " on" : ""}`} onClick={close} aria-current={chosen[open]?.user_id === m.user_id ? "true" : undefined}>
                <Shirt number={m.player_number} size="small" />
                <span className="ld-opt-t"><b>{m.name}</b><small className="muted">{personLine(m.player_number, m.playing_role)}</small></span>
              </Link>
            </li>
          ))}
          {shown.length === 0 && <li className="muted small ld-opt-none">No member has that name.</li>}
        </ul>
      </LdSheet>
    </>
  );
}
