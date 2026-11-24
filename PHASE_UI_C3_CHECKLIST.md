# Phase UI C3 checklist: Pick lineups and Correct a finished match

Builder C3 (prefix `lu-`). PDF pages 311-334 (Pick lineups, 8 scenarios) and 347-365 (Correct a ball, 10 scenarios).
Status words: DONE = built and checked as written; PARTIAL = something missing (said plainly); NOT DONE = not in my ownership.
"Checked" means a test in `src/components/C3.test.tsx`, `src/lib/lineupPick.test.ts` or `src/app/actionsC3.test.ts`, and a screenshot of the rendered component at 390, 820 and 1440 px. Pages that need a database and a signed-in user were not opened in a browser.

## Files
- `src/app/c/[id]/matches/[matchId]/lineup/page.tsx` (server page, now only loads data)
- `src/components/LineupPicker.tsx` (client: the whole picking screen), `src/lib/lineupPick.ts` (pure rules)
- `src/app/c/[id]/matches/[matchId]/correct/page.tsx`, `src/components/CorrectForm.tsx` (rewritten)
- `src/app/actionsC3.ts` (new actions), `src/components/lu.css`, `LuIcons.tsx`, `LuPanel.tsx` (side column helper)
- Tests: `src/components/C3.test.tsx` (36), `src/lib/lineupPick.test.ts` (13), `src/app/actionsC3.test.ts` (14)

## Pick lineups

| # | Scenario | Status |
|---|----------|--------|
| 1 | Mixed replies, 5 of 6 and 4 of 6 | DONE. Three-way control Out / team 1 / team 2 (real radio buttons, 44px, tick on the chosen one, `TeamBadge`, full team name for screen readers and shown beside the badge from 640px). Live counters and meters. Reply groups Said yes / No reply / Can't make it with counts, search, filter chips (All, In, No reply, Can't make it). Gold `Shirt` per player (normal). Side panel with both squads at 1360px and up. Quick tools fill the list on screen. |
| 2 | First pick, nobody replied | DONE. Both meters 0 / 6, "No players picked yet." in the picked lineups, quick tools stay available; "Added 0 players who replied “I’m in”." shown. |
| 3 | Filter In and "Everyone who is in" | DONE. Same rule as the server (player number order, until the side is full, skips people already placed); result is a draft with the "N changes not saved yet." note. A gold note says how many did not fit. |
| 4 | Side full, "can have at most 6 players" | DONE. A seventh player turns the meter red (7 / 6), Save is disabled, the real sentence shows with a link "Open Edit match". Picks stay on screen if the server refuses (the save action answers instead of redirecting). |
| 5 | Guests in this match, add-a-guest field | DONE. Guests are grey shirts with their name and the same three-way control, counted in the limit; "Guest, linked to a member by X" row for linked guests (shares state with that member, counted once). Field highlights while typing and both "Add to" buttons wake up. Linking itself stays on the match page (as the PDF says). |
| 6 | Add a guest sheet | DONE. Bottom sheet (centred box on wide screens): name, 0/60 counter, a button for each side, Escape closes, focus kept inside. Opened from "Add a guest" in the Guests header. |
| 7 | Every banner | DONE. Fill with some not fitting (gold), fill (snackbar), Guest added with Undo (snackbar; Undo removes the guest again), empty/over-60 name and duplicate name inline under the field, side limit, locked, bad state, not found, forbidden, "Choose a side." (red notes with icons; exact texts from `notices.ts`). A message in the address (old links) is still shown, with a close button. |
| 8 | Unsaved changes guard | DONE for closing the tab (browser asks) and for leaving through any link of the app (box "Leave without saving?" with Keep editing / Discard and leave). NOT covered: the browser Back button (see open points). Gold "N changes not saved yet." above Save. |

Every existing rule kept: only while the match has not started (redirect `?e=locked` unchanged), any approved member, players per side hard limit (checked again by `setLineup` on the server), guest name 1 to 60 characters and unique by name per match (checked on screen and again by `addGuest`), replies only order the list, permanent squads never changed. Only the changed people are sent on Save, so a concurrent change by someone else is not overwritten.

## Correct a finished match

| # | Scenario | Status |
|---|----------|--------|
| 1 | Opened without a ball | DONE (built, not opened in a browser: needs the database). Empty state with icon, the same sentence, button "Open ball by ball"; on 1024px and wider a ball picker (per innings, "Correct" link on each ball). |
| 2 | Normal ball, nothing changed | DONE. Ball card: over, bowler and batter as gold shirts with names, run chip, "Innings 1 · text", note that the original ball stays. Kind-of-ball chips, 0 to 12 pad plus a typed field, wicket chips (no Retired out), reason (200 characters), "What this changes" says "Nothing has changed yet.", gold warning that any member can correct, Save and Cancel. |
| 3 | Runs 1 to 4, preview | DONE. The preview is worked out by the real engine on the server without saving (`previewCorrectionC3`): innings score before and after, result before and after, Player of the Match and Stats "Recalculated". Shown again in the side column at 1360px and up. |
| 4 | Caught, no catcher | DONE. Fielder chips (with shirts) turn red, "Choose the fielder.", Save disabled until chosen; label "Who took the catch (required)". |
| 5 | Run out, two errors | DONE. "Who was run out" (batting side) and "Fielder (required)" (fielding side), both flagged; runs hint becomes "Runs completed before the run out. 0 to 12." |
| 6 | Stumped with keeper chosen | DONE. "Wicket-keeper (required)"; ready to save. Retired out not offered. |
| 7 | Runs outside 0 to 12 | DONE. The pad cannot produce them; typing 15 shows "Runs must be a whole number from 0 to 12." under a red field and blocks Save. The server check is unchanged (safety net). |
| 8 | Server failures | DONE. Not a member (lock icon), not found, not finished, invalid change, "would break the balls after it" (with a button "Show the balls after this one" that opens ball by ball), invalid id: exact texts from `actions6.ts`, shown with an icon; cleared when you edit again. A refused change is also shown in the preview before saving. |
| 9 | Saving… | DONE. Button shows a spinner and "Saving…", fields locked while the server recalculates. |
| 10 | After saving: banner and change history | NOT DONE here. The banner and the Changes tab belong to the report page (Phase D/E, not edited). After saving the form still goes to `report?tab=balls&corrected=1` as today. The history cannot show before/after values from what is stored today (the correction row keeps the patch and the reason only); the report page would have to rebuild them from the log. |

Rules kept: any approved member may correct (no creator/Admin limit), only a completed match, same action `correctBallAction` (actions6.ts, untouched), same fields (extra, runs, wicket, out, fielder, reason), same validation and messages, engine untouched.

## Open points
- Add a guest: the PDF shows the name field inside the quick-tools card (scenarios 1, 5, 7) and also as a sheet (scenario 6). Both are built and use the same code.
- Browser Back button with unsaved lineup changes is not guarded (only tab close and in-app links).
- `fillInAction`, `addGuestAction`, `setLineupAction` (actions4.ts) are still the forms' `action`, so the two quick-tool buttons and the guest buttons still work without JavaScript (the radio picking needs it); with JavaScript the screen uses the new actions that answer instead of redirecting.


## Decision applied 2026-11-24 (lead)
"Save the correction" stays disabled until something is changed, so no empty history row is written. C3.test.tsx updated (three saving tests now change the runs first).
