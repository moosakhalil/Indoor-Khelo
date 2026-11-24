# Phase UI-C, Builder C1: Create match and Edit / postpone / cancel / delete

Status: DONE = built and checked by tests (`src/components/C1.test.tsx`, 51 tests) and a screenshot at 390 px (phone) and, for the wizard, 1440 px. PARTIAL / NOT DONE say what is missing. The real server pages need a database and a signed-in user, so they were not opened in a browser; their pieces were rendered with dummy data.

Files: `src/app/c/[id]/matches/new/page.tsx`, `src/app/c/[id]/matches/[matchId]/edit/page.tsx`, `src/components/{MatchWizard,MatchSetup,MatchEditor,MatchManage,MatchNotice,CrIcons}.tsx`, `src/components/cr.css`, `src/lib/{crSetup,crManage,crData}.ts`, test `src/components/C1.test.tsx`. No new server action file was needed: both forms post to the existing `createMatchAction` / `updateMatchAction`, and the dialogs call the existing `postponeAction`, `cancelAction`, `deleteMatchAction`. `Forms4.tsx` and the Match details page are untouched.

## Create match `/c/[id]/matches/new`
| # | Scenario | Status |
|---|---|---|
| 1 | Blank form: 4-step wizard on phone (Teams, Format, Rules, Review), progress bar, Back / Next, team rows with initials badge, captain and squad size, Match-only team row, Swap teams, bottom tab bar hidden on phone, one page with a live summary on the right from 1024 px | DONE. Next is dimmed (aria-disabled) while the step is invalid but still tappable, so tapping it shows why (the PDF says both "disabled" and "validates this step") |
| 2 | Step 1 filled: confirmed team row with Change, match-only name with live badge preview and 0/40 counter, gold ring on the player's own team | DONE |
| 3 | Every team error text (missing, too short, too long, same team, same names, not a community team) under the right team with an alert icon and a red border | DONE. Duplicate team: the chosen row turns red |
| 4 | Step 2 format: date, quick date chips (Tonight / Tomorrow / next usual weekday), recent venue chips, ten overs chips + Custom, players stepper 2 to 11, umpire, notes | DONE. "Next fixture" is read as the weekday and time of the community's latest match (Saturday 8:00 pm when there is none) |
| 5 | Date empty: draft rule explained under the date, "Draft" badge and "Save as draft" button | DONE |
| 6 | Every date, venue, overs, players, umpire, notes error | DONE. Players per side error is now on the Format step. Counters 20/80, 12/40, 37/300 (the old hard `maxLength` on venue, umpire, notes is removed so the over-limit state and message can show, as the PDF draws 97/80) |
| 7 | Step 3: all rules at traditional defaults, grouped, "Traditional rules" badge, N changes, Reset | DONE. All nine switches, two hints, seven ways of getting out as on/off chips with words, innings, balls/wide/no-ball steppers, bowler limit, super over |
| 8 | Number and list rule errors under the control | DONE. The stepper buttons stay inside the range; the number can still be typed so the real message shows. A server rule error jumps to the Rules step and focuses the faulty control |
| 9 | Bowler limit Maximum overs: every error, minimum shown before the error, lock note | DONE |
| 10 | Bowler limit Pattern: every error, accepted separators hint, bowler chips with the total | DONE |
| 11 | Valid pattern that does not add up: warning while typing and again in the Review, never blocks | DONE |
| 12 | Step 4 Review (scheduled): match as the community sees it, alert wording, changed rules count, bowler limit, umpire, notes; Create match + Save as draft instead | DONE |
| 13 | Step 4 Review, no date: honest draft text, Save as draft | DONE |
| 14 | Saving state: button reads Saving…, whole form and Back locked | DONE |
| 15 | Server failures: "Please fix the highlighted fields." as a list with a Fix button per problem that opens its step; not a member (lock banner); team removed ("Go to the Teams step"); every typed value kept | DONE |
| + | `?team=<teamId>` pre-selects Team 1 (ignored when not a team of the community) | DONE in the wizard. The Team page's "New match" link does not add `?team=` yet (file owned by Phase B / lead, see report) |
| + | Offline / quick-match link "where today's page shows it" | Nothing to keep: today's Create match page shows no such link (it is on the Matches list and Home via `CacheRoster`) |

## Edit, postpone, cancel and delete `/c/[id]/matches/[matchId]/edit`
| # | Scenario | Status |
|---|---|---|
| 1 | Scheduled match, nothing changed: teams locked card with the same sentence, prefilled form (viewer's time zone via `getZone`), "What will change" panel ("Nothing changed yet"), Manage actions on the page, two columns from 1024 px, Save bar | DONE |
| 2 | Date moved: old to new row and the exact alert shown before sending (`has a new date or time.`) | DONE |
| 3 | Date cleared: gold warning, status badge and "Scheduled to Draft" row change at once | DONE |
| 4 | Postponed match: hint on the edit page, panel says what a date does (moves to Scheduled; alert only if the date changed; stays postponed with no date) | DONE. The date stays prefilled as today (the PDF mock shows it empty) |
| 5 | Validation errors on edit: same validators and texts as Create, inline, Save disabled while any exist | DONE |
| 6 | Players per side below the lineup: server error under the stepper and in the panel with both lineup sizes, "Pick lineups" link, stepper cannot go below the biggest lineup | DONE |
| 7 | Failures: already started, match gone, not a member, saving | DONE with "Open the match" / "Back to matches" buttons. "Opening /edit on a started match" still redirects to the match page `?e=locked` as today; the banner there is the Match details page (Phase D) |
| 8 | Which actions exist per status, with the reason when not | DONE as `MatchManage variant="card"` (all five actions, lock and reason, red Cancel / Delete) and `manageItems()` rules for all eight statuses. On the edit page the panel shows Postpone, Cancel, Delete (Postpone dimmed with its reason when postponed). The full card is NOT placed on the Match details page (Phase D) |
| 9 | Postpone confirmation: outcome, alert wording, "Keep it" / "Postpone and tell everyone" | DONE (existing `postponeAction`) |
| 10 | Cancel confirmation: alert wording, stays in the Past list, "Keep match" / "Cancel match" | DONE (existing `cancelAction`) |
| 11 | Delete: typed match name, button off until typed | DONE (existing `deleteMatchAction`, "Match deleted." snackbar comes from the Matches list) |
| 12 | Name typed: red button turns on | PARTIAL. The button turns on (case and spaces ignored) but the green tick inside the field is not drawn: `ConfirmDialog` is a shared Phase A part |
| 13 | Result banners and error codes | PARTIAL. `MatchNotice` (real words from `notices.ts`, icons, "Open the match" / "Back to matches") is built and used on the edit page for `?e=` codes. After postpone / cancel the existing actions still redirect to the Match details page, which shows its own green banner; turning those into snackbars with "View" belongs to that page (Phase D) |


## Decision applied 2026-11-24 (lead)
"Save as draft instead" on the Review step now asks first ("The date you typed (...) will be removed from this match") with Cancel / Save as draft. Test updated in C1.test.tsx.
