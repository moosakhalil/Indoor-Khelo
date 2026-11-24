import type { Metadata } from "next";
import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import Icon from "@/components/B2Icons";
import { InviteFields, ReplaceInvite } from "@/components/InviteBits";
import QrCode from "@/components/QrCode";
import Frame from "@/components/Frame";
import { requireMember } from "@/lib/community";
import { getOrigin } from "@/lib/origin";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/b2.css";

export const metadata: Metadata = { title: "Invite friends" };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const link = `${await getOrigin()}/join/${community.invite_code}`;
  const justCreated = isNew === "1";
  const isAdmin = membership.role === "admin";
  return (
    <Frame communityId={id} title={justCreated ? "Community created" : "Invite friends"} back={justCreated ? undefined : `/c/${id}`}>
      <div className="stack">
        {justCreated && (
          <section className="card center iv-hero">
            <div style={{ display: "flex", justifyContent: "center" }}><CommunityLogo name={community.name} big /></div>
            <h2 style={{ marginTop: 10 }}>{community.name} is ready</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>You are the Admin. Invite your players with the QR code, the link or the code.</p>
            <ol className="iv-steps" aria-label="Progress: Create, Set up, Invite">
              <li className="done"><span className="iv-bar" aria-hidden="true" /><span>Create <span className="cm-sr">(done)</span></span></li>
              <li className="done"><span className="iv-bar" aria-hidden="true" /><span>Set up <span className="cm-sr">(done)</span></span></li>
              <li className="now" aria-current="step"><span className="iv-bar" aria-hidden="true" /><span>Invite <span className="cm-sr">(you are here)</span></span></li>
            </ol>
          </section>
        )}

        <div className="iv-cols">
          <section className="card center iv-qrcard">
            <div className="iv-qr"><QrCode value={link} label={`QR code that opens the invite link for ${community.name}`} /></div>
            <p className="iv-qrtitle">Scan with a phone camera to join</p>
            <p className="muted small" style={{ margin: "2px 0 0" }}>Show this to players next to you, or take a screenshot to post in a group.</p>
          </section>

          <div className="stack">
            <InviteFields name={community.name} link={link} code={community.invite_code} />

            {community.approval_required ? (
              <div className="iv-rule gold" role="note">
                <Icon name="lock" size={20} />
                <div>
                  <b>Approval is on</b>
                  <p>New people wait until an Admin approves them.{isAdmin && <> <Link href={`/c/${id}/settings`} className="iv-link-a">Change in settings</Link></>}</p>
                </div>
              </div>
            ) : (
              <div className="iv-rule blue" role="note">
                <Icon name="globe" size={20} />
                <div>
                  <b>Open joining</b>
                  <p>Anyone with this link joins straight away.{isAdmin && <> <Link href={`/c/${id}/settings`} className="iv-link-a">Change in settings</Link></>}</p>
                </div>
              </div>
            )}

            {isAdmin && (
              <section className="iv-admin">
                <b>Replace link and code</b>
                <p className="muted small">Make a new link if this one was shared by mistake. The old link and code stop working.</p>
                <ReplaceInvite communityId={id} />
              </section>
            )}
          </div>
        </div>

        {justCreated && (
          <div className="iv-sticky">
            <Link href={`/c/${id}`} className="btn gold">Go to Home</Link>
          </div>
        )}
      </div>
    </Frame>
  );
}
