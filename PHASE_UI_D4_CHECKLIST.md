# Phase D4 checklist: Match PDF and PDF actions (prefix pd-)

Files: `src/lib/reportPdf.ts` (redesigned), `src/components/PdfActions.tsx` (redesigned, props unchanged), `src/components/PdIcons.tsx`, `src/components/pd.css` (new), tests `src/lib/reportPdfD4.test.ts`, `src/components/PdfActionsD4.test.tsx` (new). `reportPdfResponse.ts` and both routes are unchanged (same headers: private no-store for members, public max-age=60 for the link).

## Match PDF (dump pages 504-509)

| # | Scenario / item | Status | How checked |
|---|---|---|---|
| 1 | Finished match, Short: brand header, both teams with badge, score, overs, WON mark, gold result banner | DONE | rendered to PNG with pymupdf and looked at; test checks teams, won flags, banner |
| 1a | Player of the Match callout (team badge, points, chips for the breakdown, top three, "nobody picks the winner") | DONE | PNG; test |
| 1b | Worm chart of both innings with wicket marks, and four key numbers (fours, sixes, dot balls, extras) | DONE | PNG; test (series end on the final scores) |
| 1c | Innings band with badge and score, shaded tables, right-aligned numbers, how out under the name, extras, fall of wickets, bowling table, partnerships | DONE | PNG |
| 1d | Over by over as columns with a red W (or the number of wickets) on the bar; best partnerships as bars | DONE | PNG |
| 1e | Page header (both badges) on pages 2+, footer with app name, "Short report" and "Page N of M" | DONE | PNG; test reads the page text |
| 1f | "Open the report online" QR box | DONE (L2) | Drawn with rectangles from QRCode.create modules (M, 3.5 pt modules = 1.23 mm, quiet zone 4 modules), black on white, after the changes list; only when the public link is on (member route reads the share token; public route always has one). Decoded back with OpenCV at 72 to 300 dpi. A last page that is already full gets one more page for it. Tests in reportPdfL2.test.ts |
| 1g | Community name in the header ("Indoor Khelo . Karachi Indoor Cricket Club") | DONE (L2, member PDF only) | Member route passes the community name; the public report shows no community name, so the public PDF does not either |
| 2 | Tied match: blue banner, no winner mark, both rows equal, guests tagged | DONE | PNG; test (tone "tie", nobody WON, GUEST tag) |
| 3 | Abandoned match: red banner, side that never batted shows "-" and "Did not bat", calm box for "no Player of the Match", only the innings that was bowled | DONE | PNG; test |
| 4 | Full version: Ball by ball with one row per over (over, bowler, runs, wickets) and the balls as bubbles (dot, 1-3, four, six, W, wide/no ball/bye/leg-bye with letters), legend, full sentence only under an over where a wicket fell | DONE | PNG; tests |
| 4a | Page count: Short 2 pages, Full 3 pages for a 6 over match | DONE | test (6 over sample: 2 and 3). A 20 over Full match is 4 pages (was 5+) |
| - | Dark text on white, A4, standard Helvetica, no font files, no images | DONE | test checks A4 on every page; the brand mark is a drawn square, not an image |
| - | Letters the fonts lack print as "?" (known limit kept) | DONE | test: Arabic and emoji names print "???" / "?", accents (Jose with acute, u with umlaut) stay |
| - | Long names and a very long venue: cut with "..." or wrapped, nothing overflows | DONE | PNG of a test with 60-letter and 70-character names |
| - | Table header repeats on every page | DONE | test: 120 rows, one "BATTER" header per page |
| - | Keeps the old content: toss, created by, scored by, did not bat, extras, fall of wickets, per-innings partnerships, top performers, changes list | DONE | old `reportPdf.test.ts` passes |

Decisions and differences from the picture:
- The proposal shows a dark header band; the brief says dark text on white for printing, so the header is white with a night-blue "IK" square and a gold rule (prints cheaply).
- Team badge colours are the app's `teamColor(name)`. If both teams get the same colour, the worm chart and over columns give the second team a different colour (and a dashed line) so the sides can still be told apart.
- Fewer words in Full: the non-wicket balls are shown as bubbles only (as the proposal says: "Nothing is dropped from the data"; every ball sentence is still in the blocks, just not printed). Batter names per ball are therefore not printed any more; the old Full list had them. Say if you want them back.
- "Match stats" heading is gone; fours, sixes, dot balls and extras are the key numbers on page 1, run rate is in each innings band, best partnerships and top performers have their own headings.
- Over-by-over: both innings side by side when each has 10 overs or fewer; otherwise one under the other.

## PDF actions (dump pages 510-520)

| # | Scenario | Status | How checked |
|---|---|---|---|
| 1 | Idle, Short selected: preview, segmented control, "About 2 pages", View / Download / Share the same size (48px, icons) | DONE | HTML rendered to PNG at 390px and looked at; tests |
| 2 | Full selected: hint "Everything, including every ball. About 3 to 4 pages." (picture says 4; real output is 3 to 4), preview shows a second page behind | DONE | PNG; test |
| 3 | Share tapped: gold button with spinner and "Preparing...", View and Download stay usable, "Still preparing" after 6 seconds | DONE | PNG; tests (fake timers) |
| 4 | Shared: green message with a tick, same word "Shared." | DONE | PNG; test |
| 5 | Browser cannot share a file: quiet information message with icon, then green "Share link on WhatsApp" button (same words as before) | DONE | PNG; test (link address unchanged) |
| 6 | 401: red message with icon and a "Sign in again" button (goes to `/`) | DONE | PNG; test |
| 7 | 500 or not a PDF: red message and a "Try again" button that asks again | DONE | PNG; test (fails twice, then works) |
| 8 | No connection: quiet message with Try again; View and Download shown disabled with the reason, enabled again when the signal returns (also when the card opens while offline) | DONE | PNG; tests (online event) |
| 9 | Sharing did not work: red message with a "Download PDF" button next to it | DONE | PNG; test |
| - | Closing the share sheet says nothing | DONE | test |
| - | Props unchanged (`pdfBase`, `shareUrl`, `title`, `fileName`), same addresses, same wording, old accessible names ("Short", "Full with ball by ball", "View PDF", "Download PDF", "Share") | DONE | old `PdfActions.test.tsx` passes unchanged |
| - | Keyboard and screen reader: segmented buttons have pressed state, icons hidden, messages are `role=status`, disabled offline buttons keep focus and point to the reason, 44px+ targets, reduced motion stops the spinner | DONE | tests; PNG |

Known limits (not built):
- View and Download are still plain links to the PDF address, so if the sign-in ran out they open the JSON error in the new tab (the proposal only changes the Share messages). Only Share checks first.
- The card has no "PDF report" title of its own (the page that holds the card already has one: D3 owns that wrapper).
- No page preview of the real PDF; the preview is a small drawing.

## Tests
- Old: `reportPdf.test.ts` 10 tests pass (one number changed on purpose: a 20 over Full match now needs at least 2 extra pages instead of 3, because the ball-by-ball list is much shorter), `PdfActions.test.tsx` 6 pass unchanged.
- New: `reportPdfD4.test.ts` 14 tests, `PdfActionsD4.test.tsx` 16 tests. `npx tsc --noEmit` clean for these files.
- Sample PDFs and PNGs for the look: `...\scratchpad\d4\` (s1_short, s2_tie, s3_abandoned, s4_full, s5_odd_full, s6_long_full, pd_states.png).
