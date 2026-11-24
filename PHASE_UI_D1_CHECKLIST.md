# Phase UI D1 checklist: Match details and Coin toss

Builder D1 (prefix `md-`). Page `src/app/c/[id]/matches/[matchId]/page.tsx` (rewritten), new components `MatchHero`, `MatchBug`, `MdAvailability`, `MdLineups`, `MatchToss`, `MdParts`, `MdSide`, `MdTopRight`, `MdIcons`, styles `md.css`, rules in `src/lib/md.ts`, tests `src/components/D1.test.tsx` (60 tests).
No new server actions (every button posts to the existing `actions4.ts` actions). `Forms4.tsx` and `CoinToss.tsx` are untouched (CoinToss is still used by the scoring pad at the start of scoring; the match page no longer uses `TossForm`).
"DONE (checked)" means a test or a rendered screenshot at 390 px showed it. The page itself needs the database, so it was checked part by part with dummy data, not as a whole signed-in page.

## Match details (15 scenarios)

| # | Scenario | Status |
|---|---|---|
| 1 | Scheduled, not replied, guest and linked guest, toss not recorded | DONE (checked). Hero with both team badges (own team gold ring + "Your team"), four fact tiles, big gold Start scoring under the hero, counts bar + two reply buttons + tabs with names + Remind, a lineup card per team with "x of 6 picked" and progress bar, guest with grey shirt and "Link to member", linked guest with "Undo link", toss card with Toss the coin and the manual form, rules open, match link with Copy, Manage match |
| 2 | Draft: no date, nobody picked, pattern warning | DONE (checked). "No date yet" + Set date (to Edit), "Not set" venue, gold warning with icon and "Edit the match", gold banner "Each side needs at least 2 players before scoring can start" with Pick lineups above Start scoring, 0 of 6 bars, Remind not offered for a draft |
| 3 | Just created, replied "I'm in", toss recorded, in a series, reminder sent | DONE (checked). Green banners with a tick (created + reminder stack), "I'm in" solid green with a tick and `aria-pressed`, toss summary with the batting team's badge and Change, gold series chip with trophy in the hero |
| 4 | Red notice: too many players | DONE (checked). `MatchNotice` (Phase C wording and alert icon) plus a one-tap "Edit match" link. The notice words are unchanged |
| 5 | Live (spectator) | DONE (checked). Score bug with Live badge (pulsing dot, still when reduced motion), both badges, scores in the score font, batting side marked, chase line; "Watch live or take over" and "Scoring now: name"; page still refreshes every 5 seconds (`AutoRefresh`); no replies card, toss read only, rules closed, no Edit/Postpone/Cancel/Delete (Rematch stays). Left out on purpose as in the PDF: the batters/bowler/ball strip of the old `LiveScore` card (it is on the live view one tap away) |
| 6 | Paused, I am the scorer | DONE (checked). Orange Paused badge on the bug and hero, "Match paused" line, button "Open the scoring pad" when I hold the lock |
| 7 | Finished | DONE (checked). Final bug with the winner marked, result text, gold "Match report" button, "Scored by ... (n balls)", no replies card, toss and lineups read only, Manage shrinks to Rematch / "Play another match in this series" only |
| 8 | Abandoned | DONE (checked). Red Abandoned badge, neutral "Match abandoned" line (no green), partial score kept, Match report button |
| 9 | Cancelled | DONE (checked). Red banner "This match was cancelled. It stays in the list. You can delete it or play a rematch.", no scoring button, no replies, lineups read only, Manage has Rematch and Delete |
| 10 | Postponed | DONE (checked). Orange banner with a Reschedule button (to Edit), no Start scoring, replies, lineups, toss and Edit still work, Postpone not offered |
| 11 | Overflow menu | DONE (checked). Kebab in the top bar (Edit, Rematch, Postpone, Cancel red, Delete red; only what the status allows) next to a Share button (system share, or copies the link with a snackbar). The risky three open the same dialogs as the Manage card, so there is one set of dialogs. The list is also on the page ("Manage match") |
| 12 | Postpone confirmation | DONE (checked) through Phase C `MatchManage`: names the outcome and the alert wording, "Postpone and tell everyone", no typing |
| 13 | Cancel confirmation | PARTIAL. `MatchManage` dialog: "Keep match" safe button, red "Cancel match", alert wording. The PDF line "9 players said they were coming" is NOT shown: `MatchManage` has no slot for it and I may not edit it. Suggested change (lead): an optional `note` prop on `MatchManage` shown in the cancel dialog; the page would pass the "in" count |
| 14 | Delete confirmation (typed) | DONE (checked) through `MatchManage`: button off until the match name ("Team A v Team B") is typed. The PDF says "the teams' names"; Phase C decided the match name |
| 15 | Link a guest to a member | DONE (checked). Search sheet (bottom sheet on phone, centred from 640 px), members not already in the match, gold shirt with number and role, radio, confirm button names the member ("Link to Arsalan Mir"), "count toward the member's career. You can undo the link", Cancel and Escape close, focus kept inside; posts to `linkGuestAction` |

Phase C leftovers on this page:
- Green banners after create (`?created=1`, with Pick lineups), edit (`?saved=1`), rematch (`?rematch=1`, `&series=`, `&seriesnote=1`, with Review lineups and Edit; the series note says it could not be added), postpone and cancel (`?e=postponed|cancelled`, with "View in Matches"): DONE (checked). `?seriesnote=1` was not shown at all before; now it is.
- Redirect to `/series/{id}?created=1`: unchanged (that page already shows "Series created. Add matches, or play the first one.").
- Snackbars with a "View" action: not built, because the match page is the place these actions land; a banner with "View in Matches" is shown instead.

## Coin toss and batting order (9 scenarios)

| # | Scenario | Status |
|---|---|---|
| 1 | Not recorded, coin closed | DONE (checked). "Not recorded" tag, gold Toss the coin with a coin icon, "Or enter a toss that was done in real life below.", the manual form in its own card "Enter or correct the toss" |
| 2 | Coin open, caller chosen, no call | DONE (checked). Four steps (Who calls, Call, Toss, Choose), 56 px team tiles with badges and a radio, Heads and Tails coin tiles, Toss button dimmed with "Choose heads or tails first.", Close the coin |
| 3 | Heads called | DONE (checked). Gold border on the chosen tile, button active, step moves to Toss |
| 4 | Coin in the air (2.2 s) | DONE (checked). Existing 3D flip, shadow, "Coin in the air" chip, "X called heads. The coin is in the air…", disabled "Tossing…"; vibration as before; with reduced motion the result shows at once |
| 5 | Result HEADS | DONE (checked). Big H coin, green "It's HEADS" banner (same words), Bat first / Bowl first as large tiles with icons |
| 6 | Result TAILS, form filled | DONE (checked). Choosing bat or bowl fills both fields below and says "X chose to bowl. Y bats first. Filled into the form below: press Save toss to keep it." Saving is still a deliberate press (as before) |
| 7 | Validation | DONE (checked). Checked in the browser before sending and again by the server: the message sits under the wrong field (winner or decision) with an alert icon and a red field, the button stays available, the message goes when the field is changed. The same two messages as the server |
| 8 | After saving | DONE (checked). Redirect brings the green "Toss saved." (`MatchNotice`), card shows "Recorded", coin icon, "X won the toss and chose to bowl.", "Y bats first" with the badge, Toss the coin and Change (scrolls to and focuses the form). "Not decided yet" in both clears the toss (sent as empty values), hint kept |
| 9 | Already started | DONE (checked). The server message is shown with a lock icon and the card turns read only (no coin, no form) after the error. The card is also read only whenever the match is not draft/scheduled/postponed |

## What is kept from today
Everything the old page did: replies only before the match starts; Remind only for scheduled matches with someone not replied; "Scored by" and "Scoring now" lines; bowler pattern warning; series link; rematch link ("Rematch of an earlier match"); created/changed by; lineup guests and links; toss lock; rules (all 13 rows, open before the match); match link; Rematch / "Play another match in this series"; Edit, Postpone, Cancel, Delete by status; any approved member may do all of it (the server checks again).

## Quiet card rule
"Are you coming?" shows what the page showed before to every member: the counts and the names under In, Can't and No reply. Nothing new is shown (no new numbers, no per-person detail beyond the names). The list pages keep their own quieter line (`QuietCard.test.tsx` passes unchanged).

## Not done / limits
- Two columns: at 1360 px and up Toss, Rules, Match link and Manage go into the shell's side column (drawn there from the page; below that width everything stays in one column under the lineups). On tablet and desktop below 1360 px it is one column because the shell page is 720 px wide at most; the PDF's two columns at 820 and 1440 would need a wider page in `Frame` (lead). Not seen in a real browser at 1360+ (the shell cannot be rendered without a database); the portal was tested in jsdom.
- The page as a whole was not run (needs the database and sign-in); `next build` was not run.
- The cancel dialog count (scenario 13).
- Shirt rule: players use the gold shirt in lineups and reply chips; guests and linked guests have no player number so they get the grey shirt with their name beside it.
