import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import ShareForm from "@/components/ShareForm";
import { getBooking, listBookings, listSharing } from "@/lib/bookings";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { formatWhen } from "@/lib/matchRules";
import { money } from "@/lib/payments";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

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
  const [members, sharing, all, tz] = await Promise.all([listApprovedMembers(id), listSharing(bookingId), listBookings(id), getZone()]);
  // "Same as last booking": the most recent other booking up to this one's date that has people in it (read only; nothing is changed by looking)
  const others = all.filter((x) => x.id !== bookingId && x.member_count > 0);
  const lastRow = others.find((x) => x.starts_at.getTime() <= b.starts_at.getTime()) ?? others[0] ?? null;
  const lastSharing = lastRow ? await listSharing(lastRow.id) : [];
  const last = lastRow ? {
    label: formatWhen(lastRow.starts_at, tz),
    members: lastSharing.filter((s) => s.user_id).map((s) => s.user_id!),
    guests: lastSharing.filter((s) => s.guest).map((s) => s.name),
  } : null;
  const known = new Set(["guest", "bad_person", "forbidden", "not_found"]);
  return (
    <Frame communityId={id} title="Who shares the cost" subtitle={<small className="muted pb-sub1">{b.venue_name} · {money(b.total_cost)}</small>} back={`/c/${id}/payments/${bookingId}`}
      panel={<div id="pb-share-panel" />}>
      <ShareForm
        communityId={id} bookingId={bookingId} total={b.total_cost}
        members={members.map((m) => ({ user_id: m.user_id, name: m.name, number: m.player_number }))}
        selected={sharing.filter((s) => s.user_id).map((s) => s.user_id!)} guests={sharing.filter((s) => s.guest).map((s) => s.name)}
        last={last && (last.members.length || last.guests.length) ? last : null} error={e && known.has(e) ? e : null} />
    </Frame>
  );
}
