import type { Metadata } from "next";
import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import CopyButton from "@/components/CopyButton";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { listApprovedMembers, listMyCommunities, listPending, requireMember } from "@/lib/community";
import { describeActivity, listActivity } from "@/lib/management";
import { getOrigin } from "@/lib/origin";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";

export const metadata: Metadata = { title: "Community" };

function when(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const isAdmin = membership.role === "admin";
  const [members, mine, activity, pending] = await Promise.all([
    listApprovedMembers(id),
    listMyCommunities(user.id),
    listActivity(id, 6),
    isAdmin ? listPending(id) : Promise.resolve([]),
  ]);
  const link = `${await getOrigin()}/join/${community.invite_code}`;
  const others = mine.filter((c) => c.status === "approved" && c.id !== id);

  return (
    <Frame communityId={id} title="Community" back={`/c/${id}`}>
      <div className="stack">
        <section className="card center">
          <div style={{ display: "flex", justifyContent: "center" }}><CommunityLogo name={community.name} big /></div>
          <h2 style={{ marginTop: 10 }}>{community.name}</h2>
          {community.location && <p className="muted small" style={{ margin: "2px 0 0" }}>{community.location}</p>}
          {community.description && <p className="muted" style={{ margin: "10px 0 0" }}>{community.description}</p>}
        </section>

        <section className="card">
          <b>Invite friends</b>
          <div className="row space" style={{ margin: "8px 0" }}>
            <span className="mono" style={{ fontSize: "0.78rem", overflowWrap: "anywhere" }}>{link}</span>
            <CopyButton text={link} />
          </div>
          <div className="row space">
            <span>Code <span className="mono" style={{ color: "var(--gold)" }}>{community.invite_code}</span></span>
            <CopyButton text={community.invite_code} />
          </div>
          <Link href={`/c/${id}/invite`} className="chip" style={{ marginTop: 10 }}>QR code and more</Link>
        </section>

        <section className="card row space">
          <span className="row">
            <Shirt number={membership.player_number} />
            <span><small className="muted">My player number here</small><br /><b>{membership.player_number}</b></span>
          </span>
          <Link href={`/c/${id}/number`} className="chip gold">Change</Link>
        </section>

        <section>
          <div className="row space" style={{ margin: "4px 0 8px" }}>
            <h2 style={{ fontSize: "1rem" }}>Members <small className="muted">{members.length} of {COMMUNITY_MEMBER_CAP}</small></h2>
          </div>
          <div className="card list">
            {members.slice(0, 5).map((m) => (
              <div key={m.user_id} className="item">
                <Shirt number={m.player_number} size="small" />
                <span className="t grow"><b>{m.name}{m.user_id === user.id ? " (you)" : ""}</b>{m.role === "admin" && <small>Admin</small>}</span>
              </div>
            ))}
            {members.length > 5 && (
              <Link href={`/c/${id}/members`} className="item" style={{ justifyContent: "center" }}><span className="chip">See all {members.length} ›</span></Link>
            )}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: "1rem", margin: "4px 0 8px" }}>Recent activity</h2>
          <div className="card list">
            {activity.length === 0 && <div className="item muted">Nothing yet.</div>}
            {activity.map((a, i) => (
              <div key={i} className="item"><span className="t grow"><b style={{ fontWeight: 600 }}>{describeActivity(a)}</b><small>{when(a.created_at)}</small></span></div>
            ))}
          </div>
        </section>

        {isAdmin && (
          <section>
            <h2 style={{ fontSize: "1rem", margin: "4px 0 2px" }}>Admin only <small className="muted">(you see this because you are an Admin)</small></h2>
            <div className="card list" style={{ marginTop: 8 }}>
              <Link href={`/c/${id}/requests`} className="item"><span className="t grow"><b>Join requests</b><small>{pending.length ? `${pending.length} waiting` : "None waiting"}</small></span><span aria-hidden="true">›</span></Link>
              <Link href={`/c/${id}/members`} className="item"><span className="t grow"><b>Manage members</b><small>Make Admin, remove, new number</small></span><span aria-hidden="true">›</span></Link>
              <Link href={`/c/${id}/settings`} className="item"><span className="t grow"><b>Community settings</b><small>Name, description, approval</small></span><span aria-hidden="true">›</span></Link>
              <Link href={`/c/${id}/numbers`} className="item"><span className="t grow"><b>Player numbers</b><small>Every number in use</small></span><span aria-hidden="true">›</span></Link>
            </div>
          </section>
        )}

        <section>
          <h2 style={{ fontSize: "1rem", margin: "4px 0 8px" }}>Your communities</h2>
          <div className="card list">
            <div className="item"><CommunityLogo name={community.name} /><span className="t grow"><b>{community.name}</b><small>Current</small></span><span className="chip green">Current</span></div>
            {others.map((c) => (
              <div key={c.id} className="item">
                <CommunityLogo name={c.name} />
                <span className="t grow"><b>{c.name}</b><small>{c.role === "admin" ? "Admin" : "Member"} · number {c.player_number ?? "–"}</small></span>
                <a href={`/switch/${c.id}`} className="chip">Switch</a>
              </div>
            ))}
          </div>
          <div className="two" style={{ marginTop: 8 }}>
            <Link href="/create" className="btn ghost small" style={{ width: "100%" }}>Create another</Link>
            <Link href="/join" className="btn ghost small" style={{ width: "100%" }}>Join another</Link>
          </div>
        </section>

        <section style={{ marginTop: 8 }}>
          <Link href={`/c/${id}/leave`} className="btn red">Leave community</Link>
          <p className="muted small" style={{ margin: "8px 2px 0" }}>Your career stats stay with you. Past scorecards keep your name and number. You can ask to join again later.</p>
        </section>
      </div>
    </Frame>
  );
}
