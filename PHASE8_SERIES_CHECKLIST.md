# Phase 8 checklist: series and tournaments

Status: ✅ built and checked by tests · 🟡 built, needs a real tap-through · ⏳ not built (not skipped) · ✖ out of scope

| Requirement (feature list 16.x) | Status | Notes |
|---|---|---|
| 16.1 Optional: never needed to make a match | ✅ | A match is created exactly as before. A match is in at most one series (database rule). |
| 16.2 Create a series with a name, teams and optional dates | ✅ | Teams: permanent teams or match-only names, 2 to 8, no duplicates (names compared without capitals). Dates optional; end cannot be before start. Name 2 to 60, unique per community. |
| 16.3 Add existing matches (also already played) or create matches in it | ✅ | "Add matches" shows free matches with a reason for any that do not fit. A match whose teams are not both in the series is refused. All or none. |
| 16.4 Open-ended, or best of N; the format can be changed later | ✅ | N is a whole number from 1 to 21. Changing best of 3 to best of 5 changes the words, never the record. |
| 16.4a Make a series at any time: tick "Make this a series" on a rematch, or group matches already played | ✅ | Rematch screen has the tick (only for a match not in a series). "New series" has a second form that groups matches you already have; the teams are taken from them and the name is automatic ("Alpha v Bravo", "(2)" if taken). |
| 16.4b Add a match to an existing series, or remove one (the match is kept) | ✅ | Removing never deletes the match or its stats. |
| 16.4c Series tally at the top, e.g. "Alpha 2 – Bravo 1 (1 tied)", every match listed | ✅ | Abandoned matches are not counted; matches not finished are not counted yet. For 3+ teams: a points table (win 2, tie 1, no result 1). |
| 16.4d "Play another match in this series" always available | ✅ | On the series page and on any match in a series. It is a rematch (same teams, venue, overs, rules, lineups) with a fresh date, and the new match joins the series. Available while the series is open. |
| 16.4e Close the series (can be reopened); a drawn series is shown as drawn, no forced winner | ✅ | A closed series keeps its record. Level = "Drawn 2–2". Decided: no tie-break, no manual winner. |
| 16.4f Being in a series does not change how stats are counted | ✅ | Tested: a player's lines are identical before and after their matches join a series. |
| 16.5 Fixtures and schedule; statuses (postponed, cancelled, live, completed) | ✅ | "Fixtures" lists draft, scheduled, postponed and live matches; "Results" lists the rest, each with its status. |
| 16.6 Points table, series summary and leaderboards | ✅ | Series leaderboard link, and a Series filter on the leaderboard and on player stats (also kept in the address as ?series=). |
| 16.7 Drawn series: tie-break or manual winner | ✖ | Decided: it stays drawn. |
| Any member can create, edit, close and reopen; Added by / Changed by shown | ✅ | Strangers are refused on the server. |
| A team that already has matches in the series cannot be taken out | ✅ | With the reason. A new team can be added at any time. |
| Deleting a series keeps every match | ✅ | |
| Deleting a whole community still works with series in it | ✅ | Tested, including a permanent team in a series. |
| Real-phone tap-through | 🟡 | Not done. |

## Checks run
- 16 rules tests (form checks, tally, best-of clinching, drawn, points table, which matches fit).
- 9 database tests against the real Neon database (create and change, format change, grouping played matches, one series per match, wrong community and wrong teams refused, remove keeps the match, close and reopen, delete keeps matches, play another, make a series from a rematch, stats unchanged, series filter, community deletion, database refusals).
