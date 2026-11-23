import type { Metadata } from "next";
import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { approvedCount, listPending, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";

export const metadata: Metadata = { title: "Home" };

export default async function CommunityHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const [members, pending] = await Promise.all([approvedCount(id), membership.role === "admin" ? listPending(id) : Promise.resolve([])]);
  return (
    <Frame communityId={id} title={community.name}>
      <div className="stack">
        <Link href={`/c/${id}/community`} className="card" aria-label={`Open the community page for ${community.name}`}>
          <div className="row">
            <CommunityLogo name={community.name} />
            <span className="t grow">
              <b>{community.name}</b>
              <small className="muted">{members} of {COMMUNITY_MEMBER_CAP} members{community.location ? ` · ${community.location}` : ""}</small>
            </span>
            <Shirt number={membership.player_number} />
          </div>
          {community.description && <p className="muted" style={{ margin: "10px 0 0" }}>{community.description}</p>}
          <p className="muted small" style={{ margin: "8px 0 0" }}>Tap for the community page ›</p>
        </Link>

        {membership.role === "admin" && pending.length > 0 && (
          <Link href={`/c/${id}/requests`} className="card gold row space">
            <span><b>{pending.length} join request{pending.length === 1 ? "" : "s"}</b><br /><small className="muted">Tap to approve or reject</small></span>
            <span aria-hidden="true">›</span>
          </Link>
        )}

        <div className="two">
          <div className="card" aria-disabled="true" style={{ opacity: 0.6, minHeight: 96 }}>
            <b>Start scoring</b><br /><small className="muted">Arrives with matches (next phases)</small>
          </div>
          <div className="card" aria-disabled="true" style={{ opacity: 0.6, minHeight: 96 }}>
            <b>New match</b><br /><small className="muted">Arrives with matches (next phases)</small>
          </div>
        </div>

        <section className="card list">
          <Link href={`/c/${id}/invite`} className="item"><span className="t grow"><b>Invite friends</b><small>Link and code</small></span><span aria-hidden="true">›</span></Link>
          <Link href={`/c/${id}/members`} className="item"><span className="t grow"><b>Members</b><small>{members} players</small></span><span aria-hidden="true">›</span></Link>
          {membership.role === "admin" && (
            <Link href={`/c/${id}/requests`} className="item"><span className="t grow"><b>Join requests</b><small>{pending.length ? `${pending.length} waiting` : "None waiting"}</small></span><span aria-hidden="true">›</span></Link>
          )}
        </section>
      </div>
    </Frame>
  );
}
