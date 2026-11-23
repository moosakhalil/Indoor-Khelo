# Phase 8 checklist: series, shareable profile, analytics

Status: ✅ built and checked by tests · 🟡 built, needs a real tap-through · ⏳ not built

| Part | Status | Notes |
|---|---|---|
| Series and tournaments | ✅ | Details in PHASE8_SERIES_CHECKLIST.md. A drawn series stays drawn. Series filter on player stats and the leaderboard. |
| Shareable player profile | ✅ | Off by default; only the player switches it on or off; new code each time; shows profile and career totals only (no community names, no match list, no numbers, no payments); stops when the account is deleted. /p/[token], db/011. |
| 11 chosen analytics | ✅ | Details in PHASE8_ANALYTICS_CHECKLIST.md. Phase of innings and under pressure left out by choice. |
| In-app alerts only (no push) | ✅ | Decided. |
| Real-phone tap-through of the new screens | 🟡 | Not done. |

## Checks run
- Series: 16 rule tests and 9 database tests. Analytics: 33 rule tests, 8 screen tests, 1 database query test. Profile: 3 database tests and 2 screen tests.
- Production build passes with every new route.
