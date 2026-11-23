# Offline new match checklist

Status: ✅ built and checked by tests · 🟡 built, needs a real airplane-mode test · ⏳ not built

| Requirement | Status | Notes |
|---|---|---|
| Roster of players and teams kept on the phone (members, numbers, squads) | ✅ | Saved when Home or the matches screen opens online. The offline form says when it was last updated. |
| "New match with no signal" screen: two match-only team names, overs (preset or custom 1-50), players per side (2-11), players picked per side, guests by name, fill from a team squad | ✅ | Same rules as the normal form; checked on the phone and again on the server. Needs at least 2 players per side and not more than players per side. |
| Start scoring at once from the phone alone | ✅ | /c/[id]/matches/quick/score?m=...; reads everything from the phone; uses the normal scoring pad. |
| Link on the matches screen (always) and on Home (only while offline) | ✅ | |
| Match created on the server when the signal returns, with the same ids; sent twice = created once | ✅ | POST /api/matches/create; db tests. |
| Balls are sent only after the match exists, in order | ✅ | flushMatch creates a waiting match first. |
| A match the server refuses stays on the phone with the reason; its balls are kept, never lost | ✅ | Red banner on the scoring screen. |
| Server rules: members only, every player an approved member, one side per member, unique guests, caps, side names differ | ✅ | Plus database constraints. |
| The two "no signal" screens open with no signal | 🟡 | The service worker keeps them ahead of time (CACHE_PAGES, with their scripts). Production only; needs a real airplane-mode test after installing the app. |
| Payment and profile pages stay uncached | ✅ | Only the two quick-match paths can be prepared. |
| Offline match with a series, venue, date or notes | ⏳ | Not offered. Edit the match online after it is created. |

## Checks run
- 7 rule tests, 7 database tests (real Neon), 6 phone tests (jsdom). Older pad and payment phone tests still pass after the storage change (database version 3).
