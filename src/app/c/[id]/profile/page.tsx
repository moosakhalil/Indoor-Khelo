import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import CommunityLogo from "@/components/CommunityLogo";
import PfIcon, { type PfIconName } from "@/components/PfIcons";
import { PfLogoutCard, PfLogoutIcon } from "@/components/PfAccount";
import { PfCareerStrip, PfDetails, PfPlayerCard, PfStatsStart } from "@/components/PfParts";
import PfShare from "@/components/PfShare";
import Shirt from "@/components/Shirt";
import { careerOf } from "@/lib/career";
import { listMyCommunities, requireMember } from "@/lib/community";
import { getOrigin } from "@/lib/origin";
import { profileShareToken } from "@/lib/profileShare";
import { getProfile } from "@/lib/profile";
import { playerLines } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";
import { teamsOfPlayer } from "@/lib/teams";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const [profile, all, token, origin, teams, lines] = await Promise.all([
    getProfile(user.id), listMyCommunities(user.id), profileShareToken(user.id), getOrigin(), teamsOfPlayer(id, user.id), playerLines(id, user.id, {}),
  ]);
  const mine = all.filter((c) => c.status === "approved");
  const career = careerOf(lines);
  const role = labelOf(PLAYING_ROLES, profile?.playing_role);
  const hand = labelOf(BATTING_HANDS, profile?.batting_hand);
  const position = labelOf(BATTING_POSITIONS, profile?.batting_position);
  const bowling = labelOf(BOWLING_STYLES, profile?.bowling_style);
  const rows: [string, string | null][] = [["Playing role", role], ["Batting hand", hand], ["Batting position", position], ["Bowling style", bowling]];
  const editHref = `/c/${id}/profile/edit`;
  const statsHref = `/c/${id}/players/${user.id}`;
  const isAdmin = membership.role === "admin";

  const quick = (
    <nav className="pf-qa" aria-label="Quick actions">
      <Link href={editHref}><PfIcon name="pencil" size={20} />Edit profile</Link>
      <Link href={statsHref}><PfIcon name="chart" size={20} />My stats</Link>
      <Link href={`/c/${id}/profile/payments`}><PfIcon name="wallet" size={20} />My payments</Link>
      <Link href={`/c/${id}/number`}><PfIcon name="swap" size={20} />Change number</Link>
    </nav>
  );
  const menu: [string, string, string, PfIconName][] = [
    [`/c/${id}/community`, "Community page", "Members, invite, switch, leave", "shield"],
    ["/switch", "Your communities", "Switch, create or join another", "swap"],
    ["/account", "Account", "Log out everywhere, delete account", "cog"],
  ];

  return (
    <Frame
      communityId={id}
      title="Profile"
      subtitle={<small className="muted">{community.name}</small>}
      right={<PfLogoutIcon />}
      panel={<div className="pf-panel-qa pf-box"><div className="pf-box-head"><h2>Quick actions</h2></div><div style={{ marginTop: 10 }}>{quick}</div></div>}
    >
      <div className="pf-page">
        <PfPlayerCard
          communityId={id} name={user.name} number={membership.player_number} isMe
          subtitle={`${isAdmin ? "Admin · " : ""}Number ${membership.player_number} · you`}
          role={role} hand={hand} position={position} bowling={bowling}
          teams={teams.map((t) => ({ ...t, mine: true }))} editHref={editHref}
        />
        <div className="pf-qa-inline">{quick}</div>

        <div className="pf-bento">
          <div className="pf-col">
            {career.matches === 0
              ? <section className="pf-box" aria-label="Career in this community"><div className="pf-box-head"><h2>Career in this community</h2></div><div style={{ marginTop: 10 }}><PfStatsStart text="Runs, wickets and awards appear here after your first finished match." /></div></section>
              : <PfCareerStrip career={career} title="Career in this community" fullHref={statsHref} />}
            <PfDetails rows={rows} editHref={editHref} />
          </div>
          <div className="pf-col">
            <PfShare communityId={id} token={token} origin={origin} />
            <section className="pf-box" aria-label="My communities and numbers">
              <div className="pf-box-head"><h2>My communities and numbers</h2></div>
              {mine.map((c) => {
                const here = c.id === id;
                const body = (
                  <>
                    <CommunityLogo name={c.name} />
                    <span className="t"><b>{c.name}</b><small>{c.role === "admin" ? "Admin" : "Member"}{here ? " · here" : c.player_number !== null ? ` · number ${c.player_number}` : ""}</small></span>
                    <Shirt number={c.player_number} size="small" />
                  </>
                );
                return here ? (
                  <div key={c.id} className="pf-comm">
                    {body}
                    <Link href={`/c/${id}/number`} className="btn ghost small" aria-label={`Change my number in ${c.name}`}><PfIcon name="swap" size={16} /> Change</Link>
                  </div>
                ) : (
                  <Link key={c.id} href={`/c/${c.id}/profile`} className="pf-comm">{body}<PfIcon name="chevron" size={18} /></Link>
                );
              })}
            </section>
          </div>
          <section className="pf-box pf-menu pf-span" aria-label="More">
            {menu.map(([href, title, sub, icon]) => (
              <Link key={href} href={href}><span className="ic"><PfIcon name={icon} size={20} /></span><span className="t"><b>{title}</b><small>{sub}</small></span><PfIcon name="chevron" size={18} /></Link>
            ))}
          </section>
        </div>
        <PfLogoutCard />
      </div>
    </Frame>
  );
}
