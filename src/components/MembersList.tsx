"use client";

import Link from "next/link";
import { useState } from "react";
import Shirt from "@/components/Shirt";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

type M = { user_id: string; name: string; role: "admin" | "member"; player_number: number | null; playing_role: string | null };

/** Search by name or number. Tap anyone to open their player page. */
export default function MembersList({ members, meId, isAdmin, communityId }: { members: M[]; meId: string; isAdmin: boolean; communityId: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "admin">("all");
  const needle = q.trim().toLowerCase();
  const shown = members.filter((m) => {
    if (filter === "admin" && m.role !== "admin") return false;
    if (!needle) return true;
    return m.name.toLowerCase().includes(needle) || String(m.player_number ?? "") === needle;
  });
  const admins = members.filter((m) => m.role === "admin").length;
  return (
    <div className="stack">
      <input className="field" type="search" placeholder="Search by name or number" aria-label="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row wrap">
        <button type="button" className={`chip${filter === "all" ? " gold" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All {members.length}</button>
        <button type="button" className={`chip${filter === "admin" ? " gold" : ""}`} aria-pressed={filter === "admin"} onClick={() => setFilter("admin")}>Admins {admins}</button>
      </div>
      <section className="card list">
        {shown.length === 0 && <div className="item muted">No one matches.</div>}
        {shown.map((m) => {
          const role = labelOf(PLAYING_ROLES, m.playing_role);
          return (
            <Link key={m.user_id} href={`/c/${communityId}/players/${m.user_id}`} className="item" aria-label={`Open ${m.name}`}>
              <Shirt number={m.player_number} />
              <span className="t grow">
                <b>{m.name}{m.user_id === meId ? " (you)" : ""}</b>
                {(m.role === "admin" || role) && <small>{[m.role === "admin" ? "Admin" : null, role].filter(Boolean).join(" · ")}</small>}
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          );
        })}
      </section>
      <p className="muted small" style={{ margin: "0 2px" }}>Tap a player to see their profile.{isAdmin ? " As an Admin you can manage them from there." : ""}</p>
    </div>
  );
}
