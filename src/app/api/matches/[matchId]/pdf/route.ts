import { NextResponse } from "next/server";
import { isUuid, getMembership } from "@/lib/community";
import { getMatch } from "@/lib/matches";
import { pdfResponse } from "@/lib/reportPdfResponse";
import { getSessionUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

// The match report as a PDF, for signed-in members of the community. Never cached.
export async function GET(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;
  const url = new URL(req.url);
  const communityId = url.searchParams.get("communityId") ?? "";
  if (!isUuid(communityId) || !isUuid(matchId)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  let user;
  try { user = await getSessionUser(); } catch { return NextResponse.json({ error: "session" }, { status: 401 }); }
  if (!user || !user.termsAccepted) return NextResponse.json({ error: "session" }, { status: 401 });
  const member = await getMembership(communityId, user.id);
  if (!member || member.status !== "approved") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const match = await getMatch(communityId, matchId, user.id);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (match.status !== "completed" && match.status !== "abandoned") return NextResponse.json({ error: "not_finished" }, { status: 409 });
  try {
    return await pdfResponse(
      { matchId, side1: match.side1_name, side2: match.side2_name, overs: match.overs, when: match.scheduled_at, venue: match.venue, createdBy: match.created_by_name },
      { full: url.searchParams.get("full") === "1", download: url.searchParams.get("download") === "1", tz: await getZone(), cache: "private" },
    );
  } catch (err) {
    console.error("pdf failed", err);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
