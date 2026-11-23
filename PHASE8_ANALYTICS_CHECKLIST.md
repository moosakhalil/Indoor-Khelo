# Phase 8 analytics checklist (the 11 chosen)

Status: ✅ built and checked by tests · 🟡 built, needs a real tap-through with real matches · ✖ not wanted

| # | Analytic | Status | Where | Notes |
|---|---|---|---|---|
| 1 | Form over time (runs or wickets, last 10 matches) | ✅ 🟡 | Player page → Analytics → Form | Bar chart, average line, "improving / down / steady" after 6 matches. Ducks dashed, 30+ gold, * not out. |
| 2 | Compare two players | ✅ 🟡 | Teams tab → Compare two players (`/c/[id]/compare`) | 18 rows; the better number carries the word "better"; lower-is-better for economy, bowling average and strike rate, batting dot ball %; ties and missing numbers mark neither; small samples flagged. |
| 3 | Batter v bowler | ✅ 🟡 | Player → Analytics → Batter v bowler | Both directions. A wide is not a ball faced; a run-out is not the bowler's dismissal; members only. |
| 4 | Where the runs come from | ✅ 🟡 | Player → Analytics → Where the runs come from | Singles, running (2, 3, 5), fours, sixes, other, as shares; extras gained while on strike are kept apart. |
| 5 | Phase of the innings | ✖ | | User said no need. |
| 6 | Under pressure | ✖ | | User said no need. |
| 7 | Team form | ✅ 🟡 | Team page → Form | Last 5 results, oldest first (letter and word, not colour alone) and a team-scores chart over all finished matches. |
| 8 | Team head to head, deeper | ✅ 🟡 | Team page → Head to head | Record against each opponent plus highest and lowest score for each side in those matches. |
| 9 | Partnership pairs | ✅ 🟡 | Teams tab → Insights → Partnerships | Total runs, number of partnerships, balls, best partnership with a link to the match. Members only. |
| 10 | Community records | ✅ 🟡 | Insights → Records | Highest score, best bowling, fastest fifty (balls faced), most sixes in a match, longest unbeaten run (wins and ties in a row; a permanent team is followed by id). |
| 11 | Bowling by over | ✅ 🟡 | Insights → Bowling by over | First two overs and last two overs of an innings; needs 12 balls to be ranked, others listed after in grey. |
| 12 | Match worm | ✅ 🟡 | Match report → Worm (member and public report) | Cumulative runs ball by ball, wickets marked, solid and dashed lines named in a legend. |
| 13 | Win likelihood in a chase | ✅ 🟡 | Match report → Win chance (member and public report) | A rough estimate, said so on screen: blends first-innings and own scoring rate, cut for wickets lost, uncertainty grows with balls left. 100% when the target is reached, 0% when it ends short, 50% on a tie. |

## Checks run
- 33 unit tests for the pure functions (`src/lib/analytics.test.ts`), including monotonic behaviour of the win estimate.
- 8 render tests for every chart and table (`src/components/Analytics.test.tsx`), including with no community (public report).
- 1 database test that the loader's queries run (`src/lib/analyticsData.db.test.ts`).
- Type check clean. Not run: the production build, and the screens with real matches.

## Not done / notes
- Super-over balls are left out of every analytic (same rule as career stats).
- Guests are left out of 3, 9, 10 and 11 (they have no career).
- The analytics pages load every finished match of the community and replay it. Fine for a community's size; if it grows to thousands of matches this would need a stored summary.
