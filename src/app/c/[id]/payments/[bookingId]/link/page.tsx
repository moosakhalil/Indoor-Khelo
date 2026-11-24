import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import LinkMatchesForm from "@/components/LinkMatchesForm";
import { getBooking, linkedMatches, matchesToLink } from "@/lib/bookings";
import { requireMember } from "@/lib/community";
import { formatWhen, STATUS_LABEL, type MatchStatus } from "@/lib/matchRules";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Link matches" };
export const dynamic = "force-dynamic";

export default async function LinkPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const b = await getBooking(id, bookingId);
  if (!b) notFound();
  const [matches, linked, tz] = await Promise.all([matchesToLink(id), linkedMatches(bookingId), getZone()]);
  return (
    <Frame communityId={id} title="Link matches" subtitle={<small className="muted pb-sub1">{b.venue_name} · {formatWhen(b.starts_at, tz)}</small>} back={`/c/${id}/payments/${bookingId}`}>
      <LinkMatchesForm
        communityId={id} bookingId={bookingId} createHref={`/c/${id}/matches/new`} linked={linked.map((m) => m.id)}
        matches={matches.map((m) => ({ id: m.id, name: m.name, status: m.status, statusLabel: STATUS_LABEL[m.status as MatchStatus] ?? m.status, when: formatWhen(m.scheduled_at, tz) }))} />
    </Frame>
  );
}
