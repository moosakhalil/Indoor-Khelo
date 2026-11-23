// Turns a finished match into an HTTP response carrying the PDF. Shared by the member route and the public route.
import { buildState } from "@/lib/engine/engine";
import { formatWhen } from "@/lib/matchRules";
import { buildReportBlocks, pdfFileName, renderReportPdf } from "@/lib/reportPdf";
import { loadEvents, scorersOf } from "@/lib/scoring";

type Meta = { matchId: string; side1: string; side2: string; overs: number; when: Date | null; venue: string; createdBy: string | null };

export async function pdfResponse(meta: Meta, opts: { full: boolean; download: boolean; tz: string; cache: "private" | "public" }): Promise<Response> {
  const [events, scorers] = await Promise.all([loadEvents(meta.matchId), scorersOf(meta.matchId)]);
  const built = buildState(events);
  if (!built.ok || !built.state.started) return Response.json({ error: "not_found" }, { status: 404 });
  const blocks = buildReportBlocks(built.state, { dateText: meta.when ? formatWhen(meta.when, opts.tz) : "", venue: meta.venue, overs: meta.overs, createdBy: meta.createdBy, scorers }, { full: opts.full });
  const bytes = await renderReportPdf(blocks, { title: `${meta.side1} v ${meta.side2}` });
  const name = pdfFileName(meta.side1, meta.side2, meta.when);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${opts.download ? "attachment" : "inline"}; filename="${name}"`,
      // a member's copy is never kept by shared caches; a public copy is short-lived because a correction changes the figures
      "cache-control": opts.cache === "private" ? "private, no-store" : "public, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}
