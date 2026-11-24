# Phase UI F2 checklist: Leaderboard, Compare players, Insights, Player analytics

Status: DONE = built and checked (jsdom/markup tests, plus a Chrome screenshot of the markup with dummy data at 390 px and 1440 px) · PARTIAL · NOT DONE.
Not checked: the four pages against a real database with real matches (they need sign-in and Neon). No statistic is computed differently: all numbers come from `career.ts`, `analytics.ts` and the existing loaders.

## Files
- Pages: `src/app/c/[id]/leaderboard/page.tsx`, `compare/page.tsx`, `insights/page.tsx`, `players/[userId]/analytics/page.tsx`
- Components: `LeaderboardParts.tsx`, `LeaderboardClient.tsx`, `ComparePicker.tsx`, `CompareParts.tsx`, `InsightsParts.tsx`, `AnalyticsTabs.tsx`, `PlayerAnalyticsParts.tsx`, `LdSheet.tsx`, `LdIcons.tsx`, `ld.css`
- Library (pure view helpers, no statistics): `src/lib/ldView.ts`
- `AnalyticsParts.tsx`: every export and prop unchanged; ONE new export `FormBars` (the form chart bars without card and sentence). `Analytics.test.tsx` and `B4.test.tsx` still pass.
- Tests: `src/components/Ld.test.tsx` (38), `src/lib/ldView.test.ts` (12)

## Leaderboard (12)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Runs, you are 3rd of N | DONE | "YOUR RANK · RUNS" card first (shirt, 3rd of N, your figure), podium (2nd, 1st, 3rd, text labels), group tabs (segmented) + scrolling stat chips (active filled), Filters chip and order chip together, top 10 + your own row + "Show the other N members" (all members stay listed), row = small shirt, name, "#number · role", YOU tag |
| 2 | Ties | DONE | "3=" kept, TIED tag on tied rows, rank card says "of N, tied" and the sentence "You are 3rd of N (tied)." for screen readers; next rank skips (buildBoard unchanged) |
| 3 | Rate stat below the minimum | DONE | blue note states the rule once; unranked rows dimmed (55 %), "–" instead of a rank and instead of a value, reason in the sub-line, listed last |
| 4 | Not ranked yet | DONE | card "Not ranked yet", the real sentence, plus your progress ("You have 2 innings and 14 balls so far.", bowling in overs, matches played) |
| 5 | Economy, lowest first | DONE | order chip says "Lowest first" |
| 6 | Order flipped | DONE | swap-icon chip, "Highest first" + "Reversed order" in words; the flip link keeps the filters |
| 7 | Fielding: Catches | DONE | same layout for every stat |
| 8 | Awards (most have 0) | DONE | everyone with 0 shares the last rank with TIED; zero-count members never get a podium place |
| 9 | Win percentage (3 matches) | DONE | same minimum note |
| 10 | No finished matches | DONE | rows show "–" instead of 24 people tied first; rank card and podium hidden; the real sentence kept in a note |
| 11 | Filtered by series and dates | DONE | removable chips at the top ("Series: ...", team, one chip for the date range), each removes only itself; from the series page `?series=` still works |
| 12 | Filters opened | DONE | bottom sheet on a phone, dialog from 640 px (Escape, backdrop, focus in and back, Tab trapped); Series (only when series exist), Team, From, To, Apply, Clear filters; same GET field names (`stat, series, team, from, to`, plus `flip`) |

## Compare players (5)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Nobody chosen | DONE | two player cards (shirt, name, role, Choose), swap button (disabled until one is chosen), empty card with QUICK PICKS: top two run scorers, you v the top scorer, next pair (built from the careers the page already loads; only players with matches) |
| 2 | Only one chosen | DONE | blue note "Choose the second player too." (says "first" if only the second is chosen) |
| 3 | Same player twice | DONE | red alert with icon "Choose two different players."; the second card keeps Change |
| 4 | Ali v Hamza, 18 rows | DONE | score "6 ROWS WON 10" with split bar and "N level" (rows where neither is marked), better value gold with the word BETTER, "lower is better" under economy, bowling average, bowling strike rate and batting dot %, SMALL SAMPLE tag, tabular numbers, five group cards, two-column bento from 1024 px; swap link flips the sides; choosing is a link to `?a=&b=` (no Compare button needed) |
| 5 | A player with no matches | DONE | blue note names the player; rates show "–" and are not marked, counts show 0 |

## Insights (6)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Records with unbeaten runs | DONE | record tiles (big gold figure, shirt of the holder or TeamBadge for the unbeaten run, detail, "See the match" link), unbeaten runs as ranked team badges with bars, "Compare players" button in the top bar and at the bottom (no longer a fourth tab) |
| 2 | Records, no finished matches | DONE | blue note + calm tiles: grey dash, "?" circle, "Nobody yet", the reason per record, no gold, no link |
| 3 | Partnerships | DONE | two overlapping shirts, both names as links, big run total, partnerships, balls, best, "Best match" link |
| 4 | Partnerships none | DONE | icon, "No partnerships between members yet." |
| 5 | Bowling by over | DONE | start and end side by side from 1280 px; rule stated once above; best economy gold; unranked rows dimmed with "needs 12 balls to be ranked" kept per row (it is the reason) |
| 6 | Bowling none | DONE | both cards keep their titles and "No bowling by members yet." |

## Player analytics (9)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Form, runs, Improving | DONE | one card: title "Form, last N matches", trend badge, Runs/Wickets segmented control (no reload), chart, legend in words, four tiles (Average, Best with *, Last 3 matches, Before that), the sentence kept. Dashboard from 1280 px: no tabs, form double width + run sources, then boundaries and dots, how out, best partnership, then both duel tables (page column widened to 960 px for this page only, by CSS `:has`). Phone and tablet: three tabs, no reload (tab and chart kept in the address with replaceState) |
| 2 | Wickets chart | DONE | green bars, legend names them, average line, same tiles |
| 3 | Down lately, ducks | DONE | red "Down lately" badge first; dashed red bar and "Out for a duck (dashed)" in the legend |
| 4 | Fewer than 6 matches | DONE | orange "Needs 6 matches" badge, the two trend tiles show "–", old sentence kept |
| 5 | No innings yet | DONE | dashed card, chart icon, title, "The chart fills in after finished matches." ("No bowling yet" for wickets) |
| 6 | Where the runs come from | DONE | big number "412 runs off 298 balls", stacked bar, four-column legend (colour, source, runs, share), extras kept apart in a note; NEW cards: Boundaries and dots (boundary runs %, balls per boundary, dot ball %, strike rate, fours/sixes/dots line), How out (every way out incl. zeros, bars), Best partnership (runs, balls, partner name); all from `careerOf(playerLines)` |
| 7 | No runs off the bat | DONE | dashed card, says runs appear after the first innings |
| 8 | Batter v bowler | DONE | shirt per opponent (number from the member list), name link, bigger tabular numerals, sticky first column inside a sideways-scrolling table, strike rate over 140 gold and named in the header |
| 9 | Nothing yet | DONE | each table has its own dashed empty state with the real sentence |

## Differences from the PDF and things to know
- Avatars: the PDF's initials circles are gold shirts (shirt rule). Leaderboard rows use the small shirt; the PDF's "avatar with number tag" is the shirt itself.
- Leaderboard unranked rows show "–" for the value as well (the PDF shows a dash; the old page showed the number dimmed).
- PDF scenario 5 (compare, no matches) says no row is marked. `compareCareers` (not changed) does mark counts (for example 412 runs v 0). The note says only what is true: rates are "–" and a row with a missing number is never marked.
- Compare quick picks and the "You v ..." chip are an interpretation (the PDF does not define them).
- Player analytics now loads the player's lines AND every finished match on every visit (before, the Form tab only loaded the lines), because all cards exist at once on a wide screen.
- Best partnership shows the partner by name only: `bestPartnership` in the career has no match or user id, so no shirt for the partner and no "see the match" link.
- NOT built: wagon wheel and phase (powerplay/death) split (the PDF itself says the pad does not record them).
- Topbar filter icon in the PDF header is not added; the Filters chip sits next to the order chip as the PDF's "what changed" says.
- Compare's old "Compare" submit button is gone on purpose (choosing a player navigates). Without JavaScript the player lists do not open (they are plain links once open).
