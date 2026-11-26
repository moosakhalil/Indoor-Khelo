import { NextResponse } from "next/server";
import { AuthUnreachableError } from "@/lib/authError";
import { getSessionUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { applyEvents } from "@/lib/scoring";

// The scorer's phone sends its waiting events here, in order. Every event is checked again by the engine on the server.
// This route is never cached by the service worker (see public/sw.js).
export async function POST(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;
  let user;
  try { user = await getSessionUser(); } catch (e) {
    // 503 = the sign-in service did not answer: the phone keeps its data and tries again, without saying "Signed out".
    return NextResponse.json({ error: "session" }, { status: e instanceof AuthUnreachableError ? 503 : 401 });
  }
  if (!user || !user.termsAccepted) return NextResponse.json({ error: "session" }, { status: 401 });
  let body: { communityId?: unknown; deviceId?: unknown; events?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (typeof body.communityId !== "string" || !isUuid(body.communityId) || !isUuid(matchId) || typeof body.deviceId !== "string" || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const res = await applyEvents(user.id, body.communityId, matchId, body.deviceId, body.events);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.error === "too_big" ? 413 : res.error === "not_found" ? 404 : 403 });
    return NextResponse.json(res);
  } catch (err) {
    console.error("sync failed", err);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
