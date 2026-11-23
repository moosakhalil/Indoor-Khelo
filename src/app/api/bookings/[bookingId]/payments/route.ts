import { NextResponse } from "next/server";
import { addPayment } from "@/lib/bookings";
import { isUuid } from "@/lib/community";
import { validatePayment } from "@/lib/payments";
import { getSessionUser } from "@/lib/session";

// A payment or refund recorded by a member. The id comes from the phone, so a record sent twice (after a lost signal) is saved once.
// Never cached by the service worker.
const MESSAGES: Record<string, string> = {
  forbidden: "Only members of this community can record payments.", not_found: "That booking could not be found.", bad_person: "The person who paid is not a member of this community.",
  too_much: "A refund cannot be more than that person has paid in.", duplicate: "That record id was already used.", bad_state: "That cannot be done now.",
};

export async function POST(req: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  let user;
  try { user = await getSessionUser(); } catch { return NextResponse.json({ error: "session" }, { status: 401 }); }
  if (!user || !user.termsAccepted) return NextResponse.json({ error: "session" }, { status: 401 });
  let body: { communityId?: unknown; payment?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 }); }
  const raw = body.payment;
  if (typeof body.communityId !== "string" || !isUuid(body.communityId) || !isUuid(bookingId) || !raw || typeof raw.id !== "string" || !isUuid(raw.id)) {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  const v = validatePayment(raw, new Date(), isUuid);
  if (!v.ok) return NextResponse.json({ ok: false, message: Object.values(v.errors)[0] ?? "That payment record is not valid.", errors: v.errors }, { status: 422 });
  try {
    const res = await addPayment(user.id, body.communityId, bookingId, raw.id, v.value);
    if (res.outcome === "ok") return NextResponse.json({ ok: true, duplicate: !!res.duplicate });
    return NextResponse.json({ ok: false, message: MESSAGES[res.outcome] ?? "That could not be saved." }, { status: res.outcome === "forbidden" ? 403 : res.outcome === "not_found" ? 404 : 422 });
  } catch (err) {
    console.error("payment save failed", err);
    return NextResponse.json({ ok: false, message: "The server could not save it yet." }, { status: 500 });
  }
}
