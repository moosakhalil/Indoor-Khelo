import type { Metadata } from "next";
import Link from "next/link";
import ActionMenu from "@/components/ActionMenu";
import Icon from "@/components/B2Icons";
import CommunityLogo from "@/components/CommunityLogo";
import CommunityRow from "@/components/CommunityRow";
import CopyButton from "@/components/CopyButton";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { listApprovedMembers, listMyCommunities, listPending, requireMember } from "@/lib/community";
import { FIRST_MEMBERS, activityIcon, placesText, progressPercent, shortDate } from "@/lib/communityUi";
import { describeActivity, listActivity } from "@/lib/management";
import { getOrigin } from "@/lib/origin";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";
import { getZone } from "@/lib/zone";
import "@/components/b2.css";

export const metadata: Metadata = { title: "Community" };

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const isAdmin = membership.role === "admin";
  const [members, mine, activity, pending, tz] = await Promise.all([
    listApprovedMembers(id),
    listMyCommunities(user.id),
    listActivity(id, 6),
    isAdmin ? listPending(id) : Promise.resolve([]),
    getZone(),
  ]);
  const link = `${await getOrigin()}/join/${community.invite_code}`;
  const others = mine.filter((c) => c.status === "approved" && c.id !== id);
  const adminCount = members.filter((m) => m.role === "admin").length;

  return (
    <Frame communityId={id} title="Community" back={`/c/${id}`}>
      <div className="stack">
        {/* ---------- hub hero ---------- */}
        <section className="card cm-hero" aria-label="Community summary">
          <div className="cm-hero-top">
            <CommunityLogo name={community.name} big />
            <div className="grow">
              <h2>{community.name}</h2>
              {community.location && <p className="cm-loc muted small"><Icon name="pin" size={15} /> {community.location}</p>}
            </div>
          </div>
          {community.description && <p className="cm-desc muted">{community.description}</p>}
          <div className="cm-hero-btns">
            <Link href={`/c/${id}/invite`} className="btn gold small"><Icon name="userplus" size={18} /> Invite</Link>
            {isAdmin && <Link href={`/c/${id}/settings`} className="btn ghost small"><Icon name="cog" size={18} /> Settings</Link>}
          </div>
          <div className="cm-stats">
            <div className="statcell"><b>{members.length}<small className="muted">/{COMMUNITY_MEMBER_CAP}</small></b><small className="muted">Members</small></div>
            <div className="statcell"><b>{adminCount}</b><small className="muted">{adminCount === 1 ? "Admin" : "Admins"}</small></div>
            {isAdmin
              ? <div className="statcell"><b>{pending.length}</b><small className="muted">Open requests</small></div>
              : <div className="statcell"><b>Member</b><small className="muted">Your role</small></div>}
            <div className="statcell"><b>{membership.player_number === null ? "–" : `#${membership.player_number}`}</b><small className="muted">Your number</small></div>
          </div>
          <div className="cm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={COMMUNITY_MEMBER_CAP} aria-valuenow={members.length} aria-label={`${members.length} of ${COMMUNITY_MEMBER_CAP} members`}>
            <span style={{ width: `${progressPercent(members.length)}%` }} />
          </div>
          <p className="muted small" style={{ margin: "6px 0 0" }}>{placesText(members.length)}</p>
        </section>

        <div className="cm-cols">
          {/* ---------- first members ---------- */}
          <section className="card cm-block" aria-labelledby="cm-members-h">
            <div className="row space cm-head">
              <h2 id="cm-members-h">Members <small className="muted">{members.length} of {COMMUNITY_MEMBER_CAP}</small></h2>
              {members.length > FIRST_MEMBERS && <Link href={`/c/${id}/members`} className="cm-all">See all {members.length}</Link>}
            </div>
            <div className="list">
              {members.slice(0, FIRST_MEMBERS).map((m) => (
                <div key={m.user_id} className="item cm-member">
                  <Link href={`/c/${id}/players/${m.user_id}`} className="cm-member-link" aria-label={`Open ${m.name}`}>
                    <Shirt number={m.player_number} size="normal" />
                    <span className="t grow">
                      <b>{m.name}{m.user_id === user.id && <span className="pill gold cm-you">You</span>}</b>
                      <small>{m.playing_role || "Player"}</small>
                    </span>
                    {m.role === "admin" && <span className="pill green">Admin</span>}
                  </Link>
                  {isAdmin && m.user_id !== user.id && (
                    <ActionMenu
                      label={`Manage ${m.name}`}
                      items={[
                        { label: "View profile", href: `/c/${id}/players/${m.user_id}` },
                        { label: m.role === "admin" ? "Take Admin away" : "Make Admin", href: `/c/${id}/members/${m.user_id}` },
                        { label: "Manage member", href: `/c/${id}/members/${m.user_id}` },
                      ]}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ---------- invite ---------- */}
          <section className="card cm-block" aria-labelledby="cm-invite-h">
            <div className="row space cm-head">
              <h2 id="cm-invite-h">Invite friends</h2>
              <Link href={`/c/${id}/invite`} className="cm-all">QR code and more</Link>
            </div>
            <div id="cm-link" className="iv-box iv-link" tabIndex={0} role="textbox" aria-readonly="true" aria-label="Invite link">{link}</div>
            <div className="iv-btns"><CopyButton text={link} label="Copy link" targetId="cm-link" /></div>
            <div className="iv-coderow" style={{ marginTop: 10 }}>
              <div id="cm-code" className="iv-box iv-code" tabIndex={0} role="textbox" aria-readonly="true" aria-label="Invite code">{community.invite_code}</div>
              <CopyButton text={community.invite_code} label="Copy code" targetId="cm-code" />
            </div>
          </section>

          {/* ---------- recent activity ---------- */}
          <section className="card cm-block" aria-labelledby="cm-act-h">
            <h2 id="cm-act-h" className="cm-head">Recent activity</h2>
            {activity.length === 0 && <p className="muted">Nothing yet.</p>}
            <ol className="cm-tl">
              {activity.map((a, i) => (
                <li key={i}>
                  <span className="cm-tl-ico" aria-hidden="true"><Icon name={activityIcon(a.action)} size={16} /></span>
                  <span className="t grow"><b>{describeActivity(a)}</b><small className="muted">{shortDate(a.created_at, tz)}</small></span>
                </li>
              ))}
            </ol>
          </section>

          {/* ---------- Admin tools (Admin only) ---------- */}
          {isAdmin && (
            <section className="card cm-block" aria-labelledby="cm-admin-h">
              <div className="row space cm-head">
                <h2 id="cm-admin-h">Admin tools</h2>
                <span className="pill gold">Admin only</span>
              </div>
              <div className="list">
                <Link href={`/c/${id}/requests`} className="item cm-tool">
                  <span className="cm-tool-ico" aria-hidden="true"><Icon name="userplus" size={20} /></span>
                  <span className="t grow"><b>Join requests</b><small>{pending.length ? `${pending.length} waiting` : "None waiting"}</small></span>
                  {pending.length > 0 && <span className="cm-badge" aria-label={`${pending.length} waiting`}>{pending.length}</span>}
                  <Icon name="chevron" size={18} />
                </Link>
                <Link href={`/c/${id}/members`} className="item cm-tool">
                  <span className="cm-tool-ico" aria-hidden="true"><Icon name="users" size={20} /></span>
                  <span className="t grow"><b>Manage members</b><small>Make Admin, remove, new number</small></span>
                  <Icon name="chevron" size={18} />
                </Link>
                <Link href={`/c/${id}/settings`} className="item cm-tool">
                  <span className="cm-tool-ico" aria-hidden="true"><Icon name="cog" size={20} /></span>
                  <span className="t grow"><b>Community settings</b><small>Name, description, approval</small></span>
                  <Icon name="chevron" size={18} />
                </Link>
                <Link href={`/c/${id}/numbers`} className="item cm-tool">
                  <span className="cm-tool-ico" aria-hidden="true"><Icon name="grid" size={20} /></span>
                  <span className="t grow"><b>Player numbers</b><small>Every number in use</small></span>
                  <Icon name="chevron" size={18} />
                </Link>
              </div>
            </section>
          )}

          {/* ---------- my number ---------- */}
          <section className="card cm-block cm-number">
            <Shirt number={membership.player_number} size="normal" />
            <span className="t grow"><b>My player number here</b><small className="muted">Shown on scorecards and your profile</small></span>
            <Link href={`/c/${id}/number`} className="chip gold">Change</Link>
          </section>

          {/* ---------- your communities ---------- */}
          <section className="card cm-block" aria-labelledby="cm-mine-h">
            <h2 id="cm-mine-h" className="cm-head">Your communities</h2>
            <div className="stack" style={{ gap: 8 }}>
              <CommunityRow id={id} name={community.name} role={membership.role} number={membership.player_number} members={members.length} current />
              {others.map((c) => (
                <CommunityRow key={c.id} id={c.id} name={c.name} role={c.role} number={c.player_number} />
              ))}
            </div>
            <div className="two" style={{ marginTop: 10 }}>
              <Link href="/create" className="btn ghost small" style={{ width: "100%" }}><Icon name="plus" size={18} /> Create another</Link>
              <Link href="/join" className="btn ghost small" style={{ width: "100%" }}><Icon name="userplus" size={18} /> Join another</Link>
            </div>
          </section>
        </div>

        {/* ---------- leave (kept apart from the safe actions) ---------- */}
        <section className="cm-leave" aria-labelledby="cm-leave-h">
          <h2 id="cm-leave-h">Leave community</h2>
          <p className="muted small">Your career stats stay with you. Past scorecards keep your name and number. You can ask to join again later.</p>
          <Link href={`/c/${id}/leave`} className="btn red small"><Icon name="logout" size={18} /> Leave community</Link>
        </section>
      </div>
    </Frame>
  );
}
