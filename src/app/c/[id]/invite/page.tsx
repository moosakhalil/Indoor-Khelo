import type { Metadata } from "next";
import CommunityLogo from "@/components/CommunityLogo";
import CopyButton from "@/components/CopyButton";
import QrCode from "@/components/QrCode";
import Frame from "@/components/Frame";
import { replaceInviteAction } from "@/app/actions";
import { requireMember } from "@/lib/community";
import { getOrigin } from "@/lib/origin";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Invite friends" };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const link = `${await getOrigin()}/join/${community.invite_code}`;
  const justCreated = isNew === "1";
  return (
    <Frame communityId={id} title={justCreated ? "Community created" : "Invite friends"} back={justCreated ? undefined : `/c/${id}`}>
      <div className="stack">
        {justCreated && (
          <section className="card center">
            <div style={{ display: "flex", justifyContent: "center" }}><CommunityLogo name={community.name} big /></div>
            <h2 style={{ marginTop: 10 }}>{community.name} is ready</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>You are the Admin. Invite your players.</p>
          </section>
        )}
        <section className="card center">
          <QrCode value={link} label={`QR code that opens the invite link for ${community.name}`} />
          <p className="muted small" style={{ margin: "8px 0 0" }}>Scan with a phone camera to join</p>
        </section>
        <section className="card">
          <small className="muted">Invite link</small>
          <div className="row space" style={{ margin: "4px 0 10px" }}>
            <span className="mono" style={{ fontSize: "0.8rem", overflowWrap: "anywhere" }}>{link}</span>
            <CopyButton text={link} />
          </div>
          <small className="muted">Code</small>
          <div className="row space" style={{ marginTop: 4 }}>
            <span className="mono" style={{ fontSize: "1.5rem", color: "var(--gold)" }}>{community.invite_code}</span>
            <CopyButton text={community.invite_code} />
          </div>
        </section>
        {community.approval_required
          ? <div className="banner mute">New people wait until an Admin approves them.</div>
          : <div className="banner mute">Anyone with this link joins straight away.</div>}
        {membership.role === "admin" && (
          <section className="card">
            <b>Admin only</b>
            <p className="muted small" style={{ margin: "4px 0 10px" }}>Make a new link if this one was shared by mistake. The old link and code stop working.</p>
            <form action={replaceInviteAction}>
              <input type="hidden" name="communityId" value={id} />
              <button className="btn red small">Replace link and code</button>
            </form>
          </section>
        )}
      </div>
    </Frame>
  );
}
