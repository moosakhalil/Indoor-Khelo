# Match report PDF checklist

Status: ✅ built and checked by tests · 🟡 built, needs a real phone check · ⏳ not built

| Requirement | Status | Notes |
|---|---|---|
| View the PDF from a finished match report | ✅ | "View PDF" opens it in a new tab. |
| Download the PDF | ✅ | "Download PDF" saves a file named like Alpha-v-Bravo-2026-11-23.pdf. |
| Share the PDF file to WhatsApp or another app | 🟡 | "Share" uses the phone's share sheet when the browser can share files. Needs a real phone check (Android Chrome and iPhone Safari). |
| If the browser cannot share a file | ✅ | Says so in words and offers "Share link on WhatsApp" with the report link. |
| Short or Full (with ball by ball) | ✅ | A switch above the buttons. |
| Works for members (member report) and for anyone with the public link (public report) | ✅ | Member route needs sign-in and membership; public route works only while sharing is on. |
| Content: header, toss, result, Player of the Match with points, scorecards, did not bat, extras, fall of wickets, partnerships, over by over, match stats, top performers, changes, created by and scored by | ✅ | Full version adds every ball. |
| Names in any script, emoji, very long names never break the file | ✅ | Letters the PDF fonts lack become "?" (A4, standard Helvetica, no font files). Urdu names therefore show as "?" in the PDF. |
| Printer friendly: dark text on white, page numbers, footer, table headers repeat | ✅ | |
| Member PDF never kept by shared caches | ✅ | /api route, Cache-Control private, no-store. The public PDF may be kept for up to a minute. |

## Checks run
- 10 PDF tests (content, full v short, odd characters, file name, valid PDF, page counts, repeated headers) and 6 phone-screen tests for the buttons.
- `npx tsc --noEmit` clean. `next build` not run by this worker.

## Known limit
Names written in Urdu or other non-Latin scripts show as question marks in the PDF, because the built-in PDF fonts only cover Latin letters. Fixing it would need a bundled font file (adds weight to the app).
