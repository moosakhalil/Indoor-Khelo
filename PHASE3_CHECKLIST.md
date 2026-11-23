# Phase 3 checklist: player profiles and teams

Status: ✅ built and checked · 🟡 built, needs a real tap-through · ⏳ belongs to a later phase (not skipped)

## Player profile
| # | Requirement (feature list number) | Status | Notes |
|---|---|---|---|
| 3.1 | Profile: name, batting hand, batting position, bowling style | ✅ | Edit profile screen. All optional, "Not set" until chosen. |
| 3.1b | Playing role: Batter, Bowler, All-rounder, Wicket-keeper | ✅ | Shows on the member list, player page, squads. |
| 3.1c | Choices only from the lists; anything else refused | ✅ | Refused by the form, the server and the database. Tested. |
| 3.1d | Only the player can change their own profile (not an Admin) | ✅ | The edit page always loads your own profile. |
| 3.1e | No privacy setting: everyone in the community sees every profile and stats | ✅ | Decided. The setting was removed from the form, the code and the database. |
| 3.1f | Player page (tap any member): shirt, name, role, hand, position, bowling style, teams, "Stats start here" | ✅ | Members list now opens it. Admins get a "Manage this member" button there. |
| 4.x | Player stats on that page | ⏳ | Phase 6 (needs scored matches). The empty state is already there. |
| 3.2 | Profile fields cleared when an account is deleted | ✅ | Tested. |

## Teams
| # | Requirement | Status | Notes |
|---|---|---|---|
| 5.1 | Any approved member can create and manage teams; outsiders cannot | ✅ | Tested. |
| 5.2 | Name (2 to 40), description (up to 200), captain, vice-captain; shown by initials | ✅ | |
| 5.3 | Permanent squad from approved members; a player can be in many squads | ✅ | Squad screen with plain checkboxes. The database also refuses non-members. |
| 5.3b | Team name unique in a community (capitals and spaces ignored); same name allowed elsewhere | ✅ | Tested. |
| 5.3c | Captain and vice-captain: two different members, added to the squad automatically; removed from squad = captaincy removed | ✅ | Tested. |
| 5.3d | Leaving, being removed, or deleting the account removes a person from every squad and captain role there | ✅ | Tested. |
| 5.3e | Delete a team (one confirmation) | ✅ | Tested. Once matches exist, teams with matches will be protected (Phase 4). |
| 19.x | "Added by" and "Changed by" on every team | ✅ | Shown on the team page. |
| 5.4 | Squad and each match lineup are separate | ⏳ | The squad is its own table. Per-match lineups arrive with matches in Phase 4. |
| 5.5 | Temporary or match-only teams | ⏳ | Phase 4 (match setup). |
| 5.6 | Team record, head to head, recent matches, team leaderboards | ⏳ | Phase 6. |

## Checks run
- 52 tests pass (12 profile and team rule tests, 8 database tests for Phase 3, plus all earlier ones).
- Production build passes. Every new page sends a signed-out visitor back to the welcome screen.
- Player pages can be kept on the phone for offline reading, since nothing in them is private.
