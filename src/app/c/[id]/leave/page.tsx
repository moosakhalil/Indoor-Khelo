import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { leaveAction } from "@/app/actions2";
import { setRoleAction } from "@/app/actions2";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Leave community" };

export default async function LeavePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string }> }) {
  const { id } = await params;
  const { blocked } = await searchParams;
  const user = await requireAcceptedUser();
  const { community, membership } = await requireMember(id, user.id);
  const members = await listApprovedMembers(id);
  const otherAdmins = members.filter((m) => m.role === "admin" && m.user_id !== user.id);
  const onlyAdmin = membership.role === "admin" && otherAdmins.length === 0;
  const candidates = members.filter((m) => m.user_id !== user.id);

  return (
    <Frame communityId={id} title="Leave community" back={`/c/${id}/community`}>
      <div className="stack">
        {onlyAdmin ? (
          <>
            <div className="banner gold">You are the only Admin of {community.name}. Make someone else Admin first, or delete the community.</div>
            {candidates.length > 0 && (
              <section className="card list">
                <b style={{ paddingBottom: 6 }}>Make someone Admin</b>
                {candidates.map((m) => (
                  <form key={m.user_id} action={setRoleAction} className="item">
                    <input type="hidden" name="communityId" value={id} />
                    <input type="hidden" name="userId" value={m.user_id} />
                    <input type="hidden" name="role" value="admin" />
                    <input type="hidden" name="next" value={`/c/${id}/leave`} />
                    <Shirt number={m.player_number} size="small" />
                    <span className="t grow"><b>{m.name}</b></span>
                    <button className="chip gold">Make Admin</button>
                  </form>
                ))}
              </section>
            )}
            <Link href={`/c/${id}/delete`} className="btn red">Delete the community instead</Link>
            <Link href={`/c/${id}/community`} className="btn ghost">Stay</Link>
          </>
        ) : (
          <>
            {blocked && <div className="banner gold">You are no longer the only Admin, so you can leave now.</div>}
            <section className="card">
              <b>Leave {community.name}?</b>
              <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: "1.2em", lineHeight: 1.7 }}>
                <li>Your career stats stay with you.</li>
                <li>Past scorecards keep your name and number.</li>
                <li>Your number {membership.player_number} becomes free for others at once.</li>
                <li>You can ask to join again later.</li>
              </ul>
            </section>
            <form action={leaveAction} className="stack">
              <input type="hidden" name="communityId" value={id} />
              <button className="btn red">Yes, leave the community</button>
            </form>
            <Link href={`/c/${id}/community`} className="btn ghost">Stay</Link>
          </>
        )}
      </div>
    </Frame>
  );
}
