# Phase 6 checklist: match reports, statistics, leaderboards, corrections

Status: ✅ built and checked by tests · 🟡 built, needs a real tap-through · ⏳ not built yet (not skipped)

| Requirement | Status | Notes |
|---|---|---|
| Match report: summary, scorecard, ball by ball, over by over, match stats, changes | ✅ | /c/[id]/matches/[matchId]/report with six tabs. Finished matches open it from the match page and from Home. |
| Summary: result and margin, created by and scored by (every scorer), top performers | ✅ | |
| Player of the Match, automatic, with the "how the app chose" panel, breakdown and top three | ✅ | Points table from the plan. Ties broken by winning side, runs, wickets, economy; still level = shared. Abandoned or no-result matches have none. |
| Partnerships, fall of wickets, extras, did not bat, timeline of changes | ✅ | |
| Shareable report | 🟡 | A link members can open. Opening for non-members is not built (still an open decision). |
| Reports available offline once opened | 🟡 | Pages are kept by the phone like other pages. Needs a real airplane-mode check. |
| Player stats page: Overview, Batting, Bowling, Fielding, Matches tabs | ✅ | Every figure in section 6.5 of the plan, with the definitions panel. |
| Last-5 innings bars (ducks drawn differently, 30+ highlighted) and the empty state | ✅ | |
| Filters: this community or all time, team, date range | ✅ | Kept in the address so a page can be shared. Series filter arrives with series (Phase 8). |
| Team record, head to head, recent matches, player contributions, team table | ✅ | On each team page and the Teams tab. |
| Community leaderboard: any stat, all members listed, shared ranks, flip order, minimums for rate stats, your rank line, filters | ✅ | /c/[id]/leaderboard. Reached from the Teams tab. |
| Corrections to a finished match by any member, logged with their name, everything recalculated | ✅ | Tap Correct on a ball. A change that would break later balls is refused. |
| Stats only from finished matches; abandoned matches and super-over balls not counted; guest figures count only once linked | ✅ | Linking and unlinking move the figures at once. |
| A late member counts as played from the moment they are added | ✅ | The default in the plan. |
| Opening a player from a scorecard shows that match first | ⏳ | Not built. The player page shows the career; the Matches tab lists every match. |
| Series leaderboards and series filter | ⏳ | Phase 8. |

## Checks run
- 20 statistics and leaderboard tests, 5 screen tests, 7 database tests (finishing, abandoned, careers, corrections, refused corrections, team records, guest linking), plus the earlier suites.
- Production build passes.
