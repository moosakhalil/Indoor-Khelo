# Phase 4 checklist: flexible match setup

Status: ✅ built and checked · 🟡 built, needs a real tap-through · ⏳ belongs to a later phase (not skipped)

## Creating and planning matches
| # | Requirement (feature list number) | Status | Notes |
|---|---|---|---|
| 6.1 | Any member can create a match; "Created by" and "Changed by" shown | ✅ | Tested, including a person outside the community. |
| 6.2 | Matches are independent (no series needed) | ✅ | |
| 6.3 | Teams: existing, or match-only by name; date and time, venue, overs (preset or custom), players per side, rules, notes | ✅ | Two sides must differ. A permanent team must belong to this community. |
| 6.4 | Optional umpire (a label only) | ✅ | |
| 6.5 | Toss winner and decision, who bats first | ✅ | Opening batters and bowler are chosen when scoring starts (Phase 5). Series link: Phase 8. |
| 6.6 | Same teams again, players can change, different overs or rules each time, no limit | ✅ | |
| 6.7 | Every match has its own link (copy button) | ✅ | Members only; others are asked to sign in and join. |
| 6.8 | Match states: draft, scheduled, live, paused, completed, postponed, cancelled, abandoned | 🟡 | All eight exist in the database. Phase 4 moves matches between draft, scheduled, postponed and cancelled. Live, paused, completed and abandoned arrive with scoring (Phase 5). |
| 6.9 | Each match keeps its own teams, lineup, rules snapshot | ✅ | Deliveries, scorecard and result arrive in Phases 5 and 6. |
| 6.10 | Quick match creation offline from cached players | ⏳ | Offline sync is built with scoring (Phase 5). |
| 6.11 | Schedule several at once, each with its own date, time, venue, overs; more any time | ✅ | "Plan several": 1 to 10 at a time, repeat as often as you like. Lineups are picked per match afterwards. |
| 6.12 | Rematch: same teams, venue, overs, rules; lineups copied and editable; fresh date | ✅ | Umpire, notes and toss are not copied. A guest linked to a member comes across as that member. People who left are skipped. |
| 6.13 | A rematch is separate; the first match and squads never change | ✅ | Tested. |
| 6.14 | No fixed number of matches | ✅ | |
| 6.15 | Replies "I'm in" / "Can't make it", changeable until the match starts | ✅ | |
| 6.16 | Counts and names on the match, the list and Home; reply buttons on Home | ✅ | |
| 6.17 | Replies are guidance only; a match can have no lineup | ✅ | |
| 6.18 | Lineup screen: "In" first, "Add everyone who is in", others still listed | ✅ | Fills a side up to its limit. |
| 6.19 | Reminders: alert when scheduled; "Remind those who have not replied" | ✅ | Alerts show inside the app. At most one reminder an hour per match. |
| 6.20 | Reply deadline and a "Maybe" answer | ⏳ | Still an open decision. |
| 6.21 to 6.24 | Draft rules, date limits, locked teams, team protection, Alerts screen | ✅ | New decisions, saved in the plan (section 9.2). |

## Guests and late players
| # | Requirement | Status | Notes |
|---|---|---|---|
| 7.3 | Any member adds a guest by typing a name | ✅ | Up to 60 characters; no number; shown as "Guest". |
| 7.4 | A guest can bat, bowl and field | ⏳ | Phase 5 (scoring uses the lineup). |
| 7.5 | Guest figures on that match only; no career page or leaderboard | ⏳ | Phase 6 (stats). The guest has no account, so nothing else can exist. |
| 7.6 and 7.7 | Link a guest to a member (any member), "Linked by", undo | ✅ | Works on any match, also after it is played. A guest cannot be linked to someone already in that match. Career figures follow in Phase 6. |
| 7.2 | Late member added mid-match | ⏳ | Phase 5 (during scoring). |

## Rules and settings (feature list 10.x)
| # | Requirement | Status | Notes |
|---|---|---|---|
| 10.1 to 10.3 | Traditional defaults; per-match settings; rules snapshot per match | ✅ | Saved with the match, shown on the match. They take effect when scoring (Phase 5). |
| 10.2 | Bonus or zone runs, fielding restrictions | ⏳ | No screen yet. The rules record has room for them. |
| 10.4 | Bowler limit: none, maximum, pattern like 2-1-1; warning when it does not add up | ✅ | Tested. |
| 10.5 | Limit is locked; a bowler who used their overs cannot be picked | ⏳ | Enforced on the scoring screen (Phase 5). |
| 10.7 to 10.12 | Players per side, dismissals, last batter alone, tie, super over, abandoned | ✅ | Chosen per match; applied by the scoring engine in Phase 5. |

## Housekeeping rules
| Rule | Status | Notes |
|---|---|---|
| A team that has matches cannot be deleted (reason shown) | ✅ | Deleting a whole community still works (found and fixed by the tests). |
| Leaving, removal, or deleting an account removes the person from matches not yet started; played matches keep their record | ✅ | Tested. |
| Only a match that never started can be deleted (one confirmation) | ✅ | |
| Everything is checked on the server, and by database rules | ✅ | |
| Times are shown in the viewer's own time zone | 🟡 | The phone's zone is sent as a small cookie. Please check one match shows the right time on your phone. |

## Checks run
- Rules tests (no database): 20. Database tests against the real Neon database: 22 (create, permissions, other-community access, sides, team protection, alerts, several at once, replies, reminders, lineups, limits, quick-fill, guests, linking, toss, status changes, rematch, leaving, database refusals, community deletion).
- Production build passes with every new page.
- Not yet checked: tapping through the screens with a real login (new match, plan several, lineup, rematch, alerts, Home).
