import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { listApprovedMembers, requireAdmin } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";

export const metadata: Metadata = { title: "Player numbers" };

export default async function NumbersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireAdmin(id, user.id);
  const members = (await listApprovedMembers(id)).sort((a, b) => (a.player_number ?? 0) - (b.player_number ?? 0));
  return (
    <Frame communityId={id} title="Player numbers" back={`/c/${id}/community`}>
      <div className="stack">
        <div className="banner green">No conflicts. Every number belongs to one person, because numbers are first come, first served.</div>
        <section className="card list">
          <b style={{ paddingBottom: 6 }}>All numbers in use ({members.length} of {COMMUNITY_MEMBER_CAP})</b>
          {members.map((m) => (
            <Link key={m.user_id} href={`/c/${id}/members/${m.user_id}`} className="item">
              <Shirt number={m.player_number} size="small" />
              <span className="t grow"><b>{m.name}</b></span>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </section>
        <p className="muted small" style={{ margin: "0 2px", lineHeight: 1.5 }}>If two people ever argue about a number, tap a person and ask them to choose a new one. Past matches keep the number used at the time.</p>
      </div>
    </Frame>
  );
}
