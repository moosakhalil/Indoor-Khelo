# Phase D3 checklist: Match report (member) and Shared report (public)

Files: `src/app/c/[id]/matches/[matchId]/report/page.tsx`, `src/app/r/[token]/page.tsx`, `src/app/r/[token]/not-found.tsx`,
`src/components/ReportParts.tsx` (server pieces), `ReportClient.tsx` (tab bar, ball list, sheet, public link switch),
`ReportCharts.tsx`, `RpIcons.tsx`, `RpBrand.tsx`, `rp.css`, `src/lib/corrections.ts`.
Tests: `src/components/D3Report.test.tsx` (22), `src/lib/corrections.test.ts` (7).
Status key: DONE = built, covered by a test and/or seen in a Chrome screenshot (phone 390 and desktop 1280 on dummy data). The real pages were not run against the database.

## Member report (18)
| # | Scenario | Status |
|---|---|---|
| 1 | Summary, finished, POM, top performers | DONE (score header on every tab, sticky tab bar, POM hero with shirt, points, chips; strips with shirt and team badge; tiles; created/scored by). Own-team gold ring: DONE when the viewer is in the lineup |
| 2 | "How the app chose" | DONE (bottom sheet, rule rows, top three, tie-break and recompute text) |
| 3 | Scorecard | DONE (innings cards with badge, score, run rate; two columns when the page is 720px+; how-out under the name; 30+ gold; not-out star; did not bat; extras; fall of wickets chips; bowling; partnership bars, biggest gold; Guest badge; timeline card dropped from this tab, it lives in Changes) |
| 4 | Ball by ball | DONE (grouped by over, one open at first, filters All/Wickets/Fours and sixes/Extras, bubbles with letters and shapes, six gold and four blue, pencil to the same Correct screen, commentary word for word) |
| 5 | Over by over | DONE (Manhattan chart for both teams with W markers, per-over rows with bowler and bar) |
| 6 | Match stats | DONE (four tiles, run-rate bars with badges, extras stacked bar + legend, best partnerships bars, top batters and bowlers strips) |
| 7 | Worm | DONE (own chart: wickets as red dots labelled W, legend with team badges, same sentence in an info banner) |
| 8 | Win chance | DONE (headline "x% to y%" with badge, filled curve, 50% line, gold caution banner) |
| 9 | Changes | DONE (icons, "by name", pencil on corrections) plus the correction detail below |
| 10 | Right after a correction | DONE (banner with tick, bold title, same message, "See changes" link). The existing action redirects to `?tab=balls&corrected=1`; the page shows the Summary in that case (as the PDF says) and respects any other named tab |
| 11 | Tied match | DONE (blue Tied badge, blue result line, both rows same weight) |
| 12 | Tie settled by a super over | DONE (separate "Super over" cards below the main innings, header shows the 81-81, result text from the engine, partnerships include the super over). Seen only through unit tests, not a screenshot |
| 13 | Win chance for a tie | DONE (chart already ends at 50% from the engine data; headline reads "x% to 50%") |
| 14 | Abandoned summary | DONE (red badge, one team row, calm POM card) |
| 15 | Abandoned win chance | DONE (empty state with icon, same message) |
| 16 | No result | DONE (grey badge, neutral line, POM card with the same wording) |
| 17 | PDF and Share, link OFF | DONE (PDF card wrapping `PdfActions` unchanged; Share card with switch, Members only badge, link + Copy). Short/Full preview and page-count hint belong to `PdfActions` (D4) |
| 18 | PDF and Share, link ON | DONE (green Public badge, switch asks "Stop sharing?" in a dialog before turning off, note about the old link) |

Top bar: PDF and Share icon links jump to the cards on phone and tablet; at 1360px+ the cards sit in the right panel (rendered twice, one copy is hidden by CSS). Rematch button kept.

## Shared report (7)
| # | Scenario | Status |
|---|---|---|
| 1 | Summary, signed out | DONE (brand bar with "Shared report, read only" badge, same score header and tabs; PDF card and "Open Indoor Khelo" in a right-hand column from 1024px, after the report on phones) |
| 2 | Scorecard | DONE (same cards; Guest badge in place of "(guest)") |
| 3 | Ball by ball | DONE (grouped by over; no pencil, no Correct sentence, no links) |
| 4 | Match stats | DONE |
| 5 | Win chance | DONE |
| 6 | Abandoned | DONE |
| 7 | Link off or never existed | DONE (`not-found.tsx`: reason, button to the app, shows nothing about any community or match) |

## Changes history and `?corrected=1` (Phase C leftovers)
What a stored correction row holds (`match_event`, type `edit`): who (`actor_name`), when (`client_at`, set by the server at save), the optional reason, the ball (`payload.target`) and the patch (`payload.patch`: runs, extra, wicket). `src/lib/corrections.ts` replays the log up to just before and just after each correction with the same engine and shows: ball and over, what it was and what it is now, the reason, who and when, innings totals that moved, result before and after, Player of the Match before and after. No schema change, no new queries.
- Member Changes tab: the full detail. Public Changes tab: the plain log exactly as before (no reasons, no times, nothing new).
- Cannot be reconstructed: the old `match_stat` rows (deleted and rewritten on every correction), so "before" figures are replayed with today's rules; if scoring or Player-of-the-Match rules are ever changed, an old correction would show what today's rules say, not what people saw then. Times of ordinary events are the scorer's phone clock (may be off or offline); the correction time is the server's. The audit log only holds "match_corrected" with the match id, so it adds nothing.

## Decisions and flags
- Shirts on the public page show the player number, which the public page did not show before (locked shirt rule vs "no new personal data"). One constant, `PUBLIC_SHIRT_NUMBERS` in `ReportParts.tsx`, set to false removes shirts from the public page. Needs the user's decision.
- `SummaryTab` got an optional `showResult` (default true so the old test is untouched); the pages pass false because the result line is now in the header.
- Existing engine/stat quirk found, not changed: when two players tie on points and neither bowled, `computeMatchStats` returns `pom.winners = []` (Infinity minus Infinity). The report now shows "no Player of the Match" for that case instead of an empty card.
