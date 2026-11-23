import { NextResponse } from "next/server";
import { isUuid } from "@/lib/community";
import { createQuickMatch } from "@/lib/quickMatch";
import { validateQuickMatch } from "@/lib/quickMatchRules";
import { getSessionUser } from "@/lib/session";

// A match that was set up on a phone with no signal is created here once the signal is back. Sending it twice creates it once.
// Never cached by the service worker.
const MESSAGES: Record<string, string> = {
  forbidden: "Only members of this community can create matches.",
  not_a_member: "A player in this match is no longer a member of the community.",
  id_taken: "This match id is already used by another match.",
  same_names: "The two sides need different names.",
  bad_lineup: "The lineups are not valid.",
};

export async function POST(req: Request) {
  let user;
  try { user = await getSessionUser(); } catch { return NextResponse.json({ error: "session" }, { status: 401 }); }
  if (!user || !user.termsAccepted) return NextResponse.json({ error: "session" }, { status: 401 });
  let body: { communityId?: unknown; deviceId?: unknown; match?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 }); }
  if (typeof body.communityId !== "string" || !isUuid(body.communityId) || typeof body.deviceId !== "string") {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  const v = validateQuickMatch(body.match, isUuid);
  if (!v.ok) return NextResponse.json({ ok: false, message: Object.values(v.errors)[0] ?? "That match is not valid.", errors: v.errors }, { status: 422 });
  try {
    const res = await createQuickMatch(user.id, body.communityId, body.deviceId, v.value);
    if (res.outcome === "ok") return NextResponse.json({ ok: true, duplicate: !!res.duplicate });
    return NextResponse.json({ ok: false, message: MESSAGES[res.outcome] ?? "That match could not be created." }, { status: res.outcome === "forbidden" ? 403 : 422 });
  } catch (err) {
    console.error("quick match create failed", err);
    return NextResponse.json({ ok: false, message: "The server could not create it yet." }, { status: 500 });
  }
}
