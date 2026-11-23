import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import SignOutButton, { SignOutAllButton } from "@/components/SignOutButton";
import { listMyCommunities, requireMember } from "@/lib/community";
import { getProfile } from "@/lib/profile";
import { requireAcceptedUser } from "@/lib/session";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const [profile, all] = await Promise.all([getProfile(user.id), listMyCommunities(user.id)]);
  const mine = all.filter((c) => c.status === "approved");
  const rows: [string, string | null][] = [
    ["Playing role", labelOf(PLAYING_ROLES, profile?.playing_role)],
    ["Batting hand", labelOf(BATTING_HANDS, profile?.batting_hand)],
    ["Batting position", labelOf(BATTING_POSITIONS, profile?.batting_position)],
    ["Bowling style", labelOf(BOWLING_STYLES, profile?.bowling_style)],
  ];
  return (
    <Frame communityId={id} title="Profile">
      <div className="stack">
        <section className="card center">
          <div style={{ display: "flex", justifyContent: "center" }}><Shirt number={membership.player_number} size="big" /></div>
          <h2 style={{ marginTop: 8 }}>{user.name}</h2>
          <p className="muted small" style={{ margin: "2px 0 0" }}>Number {membership.player_number} in {community.name}</p>
        </section>

        <section className="card list">
          {rows.map(([label, value]) => (
            <div key={label} className="item space"><span className="muted">{label}</span><b>{value ?? "Not set"}</b></div>
          ))}
        </section>
        <Link href={`/c/${id}/profile/edit`} className="btn gold">Edit my profile</Link>
        <Link href={`/c/${id}/players/${user.id}`} className="btn ghost">See how others see me</Link>

        <section className="card list">
          <h2 style={{ fontSize: "1rem", paddingBottom: 6 }}>My communities and numbers</h2>
          {mine.map((c) => (
            <div key={c.id} className="item">
              <Shirt number={c.player_number} size="small" />
              <span className="t grow"><b>{c.name}</b><small>{c.role === "admin" ? "Admin" : "Member"}</small></span>
              {c.id === id && <Link href={`/c/${id}/number`} className="chip gold">Change number</Link>}
            </div>
          ))}
        </section>

        <section className="card list">
          <Link href={`/c/${id}/community`} className="item"><span className="t grow"><b>Community page</b><small>Members, invite, switch, leave</small></span><span aria-hidden="true">›</span></Link>
          <Link href="/switch" className="item"><span className="t grow"><b>Your communities</b><small>Switch, create or join another</small></span><span aria-hidden="true">›</span></Link>
          <Link href="/account" className="item"><span className="t grow"><b>Account</b><small>Log out everywhere, delete account</small></span><span aria-hidden="true">›</span></Link>
        </section>
        <p className="muted small" style={{ margin: "0 2px" }}>Career stats, awards and more settings arrive in later build phases.</p>
        <SignOutButton />
        <SignOutAllButton />
      </div>
    </Frame>
  );
}
