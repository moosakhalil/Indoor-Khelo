import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { sharingAction } from "@/app/actions7";
import { getBooking, listSharing } from "@/lib/bookings";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { money, suggestedShare } from "@/lib/payments";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Who shares the cost" };
export const dynamic = "force-dynamic";

// Choose who the cost is suggested to be shared between. Paying is a convenience: this only decides the suggested share.
export default async function SharePage({ params, searchParams }: { params: Promise<{ id: string; bookingId: string }>; searchParams: Promise<{ e?: string }> }) {
  const { id, bookingId } = await params;
  const { e } = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const b = await getBooking(id, bookingId);
  if (!b) notFound();
  const [members, sharing] = await Promise.all([listApprovedMembers(id), listSharing(bookingId)]);
  const inList = new Set(sharing.filter((s) => s.user_id).map((s) => s.user_id));
  const guests = sharing.filter((s) => s.guest).map((s) => s.name).join("\n");
  return (
    <Frame communityId={id} title="Who shares the cost" back={`/c/${id}/payments/${bookingId}`}>
      <form action={sharingAction} className="stack">
        <input type="hidden" name="communityId" value={id} /><input type="hidden" name="bookingId" value={bookingId} />
        {e === "guest" && <div className="banner red" role="alert">A guest name must be 1 to 60 characters.</div>}
        {e === "bad_person" && <div className="banner red" role="alert">Someone in the list is not a member of this community any more.</div>}
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>Total {money(b.total_cost)} ÷ the people you choose = the <b style={{ color: "var(--white)" }}>suggested</b> share, rounded up to a whole rupee (for 10 people: {money(suggestedShare(b.total_cost, 10))} each). Nobody is forced to pay it: the group decides who pays what.</p>
        <section className="card list">
          {members.map((m) => (
            <label key={m.user_id} className="item" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="member" value={m.user_id} defaultChecked={inList.has(m.user_id)} style={{ width: 24, height: 24, accentColor: "var(--gold)" }} />
              <Shirt number={m.player_number} size="small" />
              <span className="t grow"><b>{m.name}</b></span>
            </label>
          ))}
        </section>
        <section className="card">
          <label className="lb" htmlFor="guests" style={{ marginTop: 0 }}>Guests (one name per line)</label>
          <textarea id="guests" name="guests" className="field" defaultValue={guests} placeholder={"Sami\nHamza"} />
          <p className="muted small" style={{ margin: "6px 0 0" }}>A guest has no account. They are counted in the split and their payments are tracked by name.</p>
        </section>
        <p className="muted small" style={{ margin: 0 }}>Everyone newly added is told their suggested share. If the number of people changes, the people already in the list are told the new amount.</p>
        <button className="btn gold">Save who shares</button>
      </form>
    </Frame>
  );
}
