"use client";

import Link from "next/link";
import { useState } from "react";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import Ic from "@/components/B3Icons";
import Shirt from "@/components/Shirt";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";
import { FILTER_CHIPS, SORTS, countFor, firstName, playingRoleLabel, visibleMembers, type MemberFilter, type MemberItem, type MemberSort } from "@/lib/b3";
import "./b3.css";

/**
 * Search by name (any part) or by exact player number, filter by role, sort. Tap anyone to open their player page.
 * An Admin also gets a three-dots menu on every other row (profile, Make Admin, new number, Remove).
 */
export default function MembersList({ members, meId, isAdmin, communityId }: { members: MemberItem[]; meId: string; isAdmin: boolean; communityId: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [sort, setSort] = useState<MemberSort>("name");
  const shown = visibleMembers(members, q, filter, sort);
  const places = Math.max(0, COMMUNITY_MEMBER_CAP - members.length);
  const searching = q.trim() !== "";
  const clearAll = () => { setQ(""); setFilter("all"); };

  return (
    <div className="stack">
      <div className="mb-search">
        <span className="mb-lens" aria-hidden="true"><Ic name="search" /></span>
        <input className="field" type="search" placeholder="Search by name or number" aria-label="Search members by name or exact player number" value={q} onChange={(e) => setQ(e.target.value)} />
        {q !== "" && <button type="button" className="mb-clear" aria-label="Clear search" onClick={() => setQ("")}><Ic name="close" /></button>}
      </div>

      <div className="mb-chips" role="group" aria-label="Filter by role">
        {FILTER_CHIPS.map((c) => (
          <button key={c.value} type="button" className={`mb-chip${filter === c.value ? " on" : ""}`} aria-pressed={filter === c.value} onClick={() => setFilter(c.value)}>
            {c.label} <small>{countFor(members, c.value)}</small>
          </button>
        ))}
      </div>

      <div className="mb-meta">
        <span className="muted small" role="status" aria-live="polite">{shown.length} of {members.length} {members.length === 1 ? "member" : "members"} · {places} {places === 1 ? "place" : "places"} left</span>
        <label className="mb-sort">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as MemberSort)} aria-label="Sort members">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <section className="card mb-empty" aria-live="polite">
          <span className="mb-eic" aria-hidden="true"><Ic name="search" /></span>
          <h2>No one matches</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {searching ? <>Nothing found for “{q.trim()}”. Search works on the name or an exact player number.</> : "Nobody has this role yet. Try another filter."}
          </p>
          <button type="button" className="btn ghost" onClick={clearAll}>{searching ? "Clear search" : "Show everyone"}</button>
        </section>
      ) : (
        <section className="card mb-rows">
          {shown.map((m) => {
            const me = m.user_id === meId;
            const role = playingRoleLabel(m.playing_role);
            const manage = `/c/${communityId}/members/${m.user_id}`;
            const items: ActionItem[] = [
              { label: "View profile", href: `/c/${communityId}/players/${m.user_id}` },
              m.role === "admin"
                ? { label: "Take Admin away", href: `${manage}?do=role` }
                : { label: "Make Admin", href: `${manage}?do=role` },
              m.player_number === null
                ? { label: "Ask for a new number", disabled: true, hint: "No number to reset yet" }
                : { label: "Ask for a new number", href: `${manage}?do=number` },
              m.role === "admin"
                ? { label: "Remove from community", danger: true, disabled: true, hint: `Take Admin away first` }
                : { label: "Remove from community", danger: true, href: `${manage}?do=remove` },
            ];
            return (
              <div key={m.user_id} className="mb-row">
                <Link href={`/c/${communityId}/players/${m.user_id}`} aria-label={`Open ${m.name}${me ? " (you)" : ""}`}>
                  <Shirt number={m.player_number} />
                  <span className="t">
                    <b>{m.name}{me && <span className="mb-tag you">YOU</span>}</b>
                    <span className="mb-tags">
                      {m.role === "admin" && <span className="mb-tag admin">Admin</span>}
                      {role && <span className="mb-tag">{role}</span>}
                      {m.player_number === null && <span className="mb-tag dashed">Choosing a new number</span>}
                    </span>
                  </span>
                  {!(isAdmin && !me) && <span className="mb-chev" aria-hidden="true"><Ic name="chevron" /></span>}
                </Link>
                {isAdmin && !me && <ActionMenu label={`Actions for ${firstName(m.name)}`} items={items} />}
              </div>
            );
          })}
        </section>
      )}
      <p className="muted small" style={{ margin: "0 2px" }}>Tap a player to see their profile.{isAdmin ? " Use the three dots to manage someone from here." : ""}</p>
    </div>
  );
}
