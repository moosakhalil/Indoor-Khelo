# Phase 5 checklist: the scoring engine

Status: ✅ built and checked by tests · 🟡 built, needs a real tap-through on a phone · ⏳ not built yet (not skipped)

| Requirement | Status | Notes |
|---|---|---|
| One scoring engine used by the phone and the server (same rules both places) | ✅ | 68 engine tests. |
| Every ball and change saved as its own record, never edited or deleted | ✅ | `match_event` log; the database refuses edits and deletes. |
| Pad: 0 to 6, UNDO, WIDE, NO BALL, WICKET, RUN OUT, More | 🟡 | Rows checked in a simulated phone. Needs your real tap-through. |
| Wide 1 run not counted; no ball 1 run not counted + bat runs; byes and leg-byes; free hit on by default | ✅ | |
| Wicket flow, run-out flow (runs completed, who is out, on a wide or no ball, new batter's end) | ✅ | Fielder is required for caught, stumped and run out. |
| Over end, strike change, new bowler, maidens, extras, fall of wickets, partnership, run rate, required rate | ✅ | |
| Last batter can bat alone; all out; target; result; tie; super over | ✅ | |
| Bowler limits (max, pattern 2-1-1), locked, with the reason shown | ✅ | |
| Mid-match changes: overs (this innings or all), players per side, bowler limit, late player or guest, retire, absent, replaced, substitute fielder, penalty, revised target, swap strike, correct batters, batting order, change bowler mid-over, end innings, pause, abandon | ✅ | Each one is written on the match timeline. |
| Undo (several times, says what it undid) and edit an earlier ball | ✅ | |
| One scorer at a time; ask to take over; scorer accepts or declines; Admin can take over | ✅ | |
| Scoring offline: saved on the phone first, sent in order, repeats ignored, status line, refused balls shown (never dropped) | 🟡 | Tested in a simulated phone. Needs a real airplane-mode test. |
| Live scoreboard for spectators and the full scorecard | ✅ | Refreshes every 5 seconds (not Neon Realtime). |
| First-time how-to-score guide, "?" to replay | ✅ | |
| Number locked while the player is in a live match | ✅ | |
| Creating a brand-new match with no signal | ⏳ | Not built. Scoring a match that already exists works offline. |
| Player of the Match, stats, leaderboards, corrections to a finished match | ⏳ | Phase 6. |
