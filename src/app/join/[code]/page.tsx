import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EnRequestJoin from "@/components/EnRequestJoin";
import { EnFullCard, EnInvalid, EnInviteCard, EnNextSteps } from "@/components/EnInvite";
import { EnTopBar } from "@/components/EnParts";
import SignInButton from "@/components/SignInButton";
import { approvedCount, getCommunityByCode, getMembership } from "@/lib/community";
import { one } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP, normalizeInviteCode } from "@/lib/validation";

export const metadata: Metadata = { title: "Join this community" };

// Public: an invite link shows the community first. Signing in happens on this same screen.
export default async function JoinPreviewPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ rf?: string }> }) {
  const { code: raw } = await params;
  const { rf } = await searchParams;
  const code = normalizeInviteCode(decodeURIComponent(raw));
  const community = code ? await getCommunityByCode(code) : null;

  if (!community || !code) return <EnInvalid />;

  const user = await getSessionUser({ refreshTo: rf === "1" ? undefined : `/join/${code}` });
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
  const approval = community.approval_required;
  return (
    <main className="app en-app en-wide">
      <EnTopBar user={user ? { name: user.name } : undefined} />
      <div className="en-col">
        <div className="en-split en-invite-split">
          <EnInviteCard community={community} members={members} adminName={admin?.name ?? "—"} />
          {full ? (
            <EnFullCard cap={COMMUNITY_MEMBER_CAP} />
          ) : (
            <section className="en-card en-action" aria-labelledby="act-h">
              <h2 id="act-h" className="en-action-h">{user ? (approval ? "Ask to join" : "Join now") : "Sign in to join"}</h2>
              {user ? (
                <EnRequestJoin code={code} approval={approval} />
              ) : (
                <>
                  <SignInButton next={`/join/${code}`} />
                  <p className="en-hint center"><span>One tap with Google. Only your name is used.</span></p>
                </>
              )}
              <EnNextSteps approval={approval} signedIn={!!user} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
