import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { requireMember } from "@/lib/community";
import { getPlayerInCommunity } from "@/lib/profile";
import { requireAcceptedUser } from "@/lib/session";
import { teamsOfPlayer } from "@/lib/teams";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Player" };

export default async function PlayerPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const me = await requireAcceptedUser();
  const { membership } = await requireMember(id, me.id);
  const p = await getPlayerInCommunity(id, userId);
  if (!p) notFound();
  const teams = await teamsOfPlayer(id, userId);
  const isMe = me.id === userId;

  const rows: [string, string | null][] = [
    ["Playing role", labelOf(PLAYING_ROLES, p.playing_role)],
    ["Batting hand", labelOf(BATTING_HANDS, p.batting_hand)],
    ["Batting position", labelOf(BATTING_POSITIONS, p.batting_position)],
    ["Bowling style", labelOf(BOWLING_STYLES, p.bowling_style)],
  ];

  return (
    <Frame communityId={id} title="Player" back={`/c/${id}/members`}>
      <div className="stack">
        <section className="card center">
          <div style={{ display: "flex", justifyContent: "center" }}><Shirt number={p.player_number} size="big" /></div>
          <h2 style={{ marginTop: 8 }}>{p.name}{isMe ? " (you)" : ""}</h2>
          <p className="muted small" style={{ margin: "2px 0 0" }}>{p.community_role === "admin" ? "Admin · " : ""}Number {p.player_number}</p>
        </section>

        <section className="card list">
          {rows.map(([label, value]) => (
            <div key={label} className="item space"><span className="muted">{label}</span><b>{value ?? "Not set"}</b></div>
          ))}
          <div className="item" style={{ alignItems: "flex-start" }}>
            <span className="muted" style={{ width: "40%" }}>Teams</span>
            <span className="row wrap grow" style={{ justifyContent: "flex-end" }}>
              {teams.length === 0 ? <b>None yet</b> : teams.map((t) => <Link key={t.id} href={`/c/${id}/teams/${t.id}`} className="chip">{t.name}</Link>)}
            </span>
          </div>
        </section>
        <section className="card center">
          <b>Stats start here</b>
          <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>Records build only from matches scored in Indoor Khelo. Nothing is added by hand. Runs, wickets, catches and awards will appear here once matches are scored.</p>
        </section>

        {isMe && <Link href={`/c/${id}/profile/edit`} className="btn gold">Edit my profile</Link>}
        {membership.role === "admin" && !isMe && <Link href={`/c/${id}/members/${userId}`} className="btn ghost">Manage this member (Admin)</Link>}
      </div>
    </Frame>
  );
}
