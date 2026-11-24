import { NextResponse } from "next/server";
import { getOrigin } from "@/lib/origin";
import { matchByShareToken } from "@/lib/reports";
import { pdfResponse } from "@/lib/reportPdfResponse";
import { getZone } from "@/lib/zone";

// The match report as a PDF for anyone who has the public link. Only works while sharing is switched on.
// It shows what the public report shows: no community name. The QR box points back to this same public link.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const match = await matchByShareToken(token);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const url = new URL(req.url);
  try {
    return await pdfResponse(
      { matchId: match.id, side1: match.side1, side2: match.side2, overs: match.overs, when: match.when, venue: match.venue, createdBy: match.created_by, reportUrl: `${await getOrigin()}/r/${token}` },
      { full: url.searchParams.get("full") === "1", download: url.searchParams.get("download") === "1", tz: await getZone(), cache: "public" },
    );
  } catch (err) {
    console.error("public pdf failed", err);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
