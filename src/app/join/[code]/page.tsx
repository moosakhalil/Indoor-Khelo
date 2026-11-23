import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityLogo from "@/components/CommunityLogo";
import { RequestJoinForm } from "@/components/Forms";
import SignInButton from "@/components/SignInButton";
import { approvedCount, getCommunityByCode, getMembership } from "@/lib/community";
import { one } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP, normalizeInviteCode } from "@/lib/validation";

export const metadata: Metadata = { title: "Join this community" };

// Public: an invite link shows the community first. Signing in happens on this same screen.
export default async function JoinPreviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeInviteCode(decodeURIComponent(raw));
  const community = code ? await getCommunityByCode(code) : null;

  if (!community || !code) {
    return (
      <main className="app">
        <div className="stack center" style={{ paddingTop: 48 }}>
          <h1>This invite is not valid</h1>
          <p className="muted">The link or code may be wrong, or the Admin replaced it. Ask your Admin for a new one.</p>
          <Link className="btn gold" href="/join">Try another code</Link>
        </div>
      </main>
    );
  }

  const user = await getSessionUser();
  if (user && !user.termsAccepted) redirect(`/terms?next=${encodeURIComponent(`/join/${code}`)}`);

  const [members, admin] = await Promise.all([
    approvedCount(community.id),
    one<{ name: string }>("select name from app_user where id = $1", [community.created_by]),
  ]);

  if (user) {
    const m = await getMembership(community.id, user.id);
    if (m?.status === "approved") redirect(m.player_number === null ? `/c/${community.id}/number` : `/c/${community.id}`);
    if (m?.status === "pending") redirect(`/c/${community.id}/waiting`);
  }

  const full = members >= COMMUNITY_MEMBER_CAP;
  return (
    <main className="app">
      <div className="stack" style={{ paddingTop: 24 }}>
        <p className="muted center" style={{ margin: 0 }}>You were invited to join</p>
        <section className="card center">
          <div style={{ display: "flex", justifyContent: "center" }}><CommunityLogo name={community.name} big /></div>
          <h1 style={{ fontSize: "1.4rem", marginTop: 10 }}>{community.name}</h1>
          {community.location && <p className="muted small" style={{ margin: "2px 0 0" }}>{community.location}</p>}
          {community.description && <p className="muted" style={{ margin: "10px 0 0" }}>{community.description}</p>}
        </section>
        <section className="card list">
          <div className="item space"><span className="muted">Members</span><b>{members}</b></div>
          <div className="item space"><span className="muted">Admin</span><b>{admin?.name ?? "—"}</b></div>
          <div className="item space"><span className="muted">Joining</span><b>{community.approval_required ? "Admin approval needed" : "Open, join straight away"}</b></div>
        </section>
        {full ? (
          <div className="banner red">This community already has 99 members, so no one else can join.</div>
        ) : user ? (
          <RequestJoinForm code={code} approval={community.approval_required} />
        ) : (
          <>
            <SignInButton next={`/join/${code}`} />
            <p className="muted small center" style={{ margin: 0 }}>Sign in with Google to join. You will then pick your player number.</p>
          </>
        )}
      </div>
    </main>
  );
}
