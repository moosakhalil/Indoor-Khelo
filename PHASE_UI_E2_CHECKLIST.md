# Phase UI-E2 checklist: the scoring pad's sheets (wicket, byes, players, bowler, More sheets)

Owner: Builder E2 (prefix `ps-`). Files: `src/components/PadSheets.tsx` (restyled, every export and prop signature unchanged), new `PsParts.tsx`, `PsIcons.tsx`, `ps.css`, `PadRelease.tsx`; tests `PadE2Golden.test.tsx` (+ `__snapshots__/PadE2Golden.test.tsx.snap`), `PadE2.test.tsx`, `PadE2Pad.test.tsx`, fixture `PadE2.fixture.ts`.

## How the events were protected
1. BEFORE any change, `PadE2Golden.test.tsx` was written against the ORIGINAL `PadSheets.tsx` and run: 38 tests, 48 recorded event lists (JSON with key order kept: event types, payloads, `reason`, `then` chains) saved in the snapshot file (md5 `dc8257dce960e1b6f0fc82e559430ffa`).
2. The sheets were then restyled. Because the screens are tapped differently now, only the TAPS in the test were rewritten; the snapshot file was never touched (still the same md5, no "written", no "obsolete"). All 38 pass: for the same choices the new sheets hand the same bodies to `add`.
3. Copies of the original file and the original-tap test are kept in the scratchpad (`...\scratchpad\e2\PadSheets.ORIGINAL.tsx`, `PadE2Golden.OLD.test.tsx`, `golden.ORIGINAL.snap`). (The app folder is not a git repo, so "commit first" was done as: test written, run green on old code, files copied aside.)
4. The real pad runs the new sheets in `PadE2Pad.test.tsx` (real engine, no signal): byes, a caught wicket with next batter, an edit of an earlier ball, the bowler pick.
5. Existing `ScoringPad.test.tsx` (9), `QuickMatch.test.tsx`, `QuickC4.test.tsx` stay green WITHOUT any edit. `tsc --noEmit` clean.

## Scenarios (wicket sheets and byes, 14)
| # | Scenario | Status |
|---|---|---|
| 1 | Wicket tapped, nothing selected | DONE. Header "Bilal Ahmed to Hamza Khan · over 0.1", 3-step progress bar, 7 tiles with a one-line meaning, 3 columns (2 on 320px / big text), button names the missing step ("Choose how the batter is out"). Seen in screenshots (390, 320, 820 wide, 200% text). |
| 2 | Bowled, next batter picked | DONE. Players who cannot come in are named (At crease / Out struck through / Yet to bat), read-back "Out: Hamza Khan b Bilal Ahmed. Score becomes x/y. Wicket to ...", red "Confirm OUT". |
| 3 | Caught, confirm pressed without fielder / next batter | DONE. Pressing the button shows "Pick the fielder." next to the chips (red outline), the button reads "Pick the fielder to continue"; nothing recorded (tested). |
| 4 | Caught with fielder and next batter | DONE ("Out: Hamza Khan c Usman Tariq b Bilal Ahmed" read-back). |
| 5 | Stumped (label "Wicket-keeper") | DONE. |
| 6 | LBW, no fielder step | DONE. |
| 7 | Hit Wicket, no fielder step | DONE. |
| 8 | Run Out: who is out, runs, wide/no ball, fielder, next batter, end | DONE. Labelled groups with tiles; end tiles "Suggested end / Striker end / Non-striker end". "A run out is not the bowler's wicket." now only here (tested). |
| 9 | Run Out key: preselected, confirm with nothing else | DONE (same errors as 3). |
| 10 | Retired out | DONE ("counts as a wicket", "No wicket for the bowler"). |
| 11 | Free hit | DONE. One orange banner, other kinds dimmed (no repeated text), Run Out preselected (a default only; the scorer still confirms). |
| 12 | Kinds switched off, Retired out hidden | DONE. Tile says "Switched off for this match" + note that rules can be changed; grid keeps its shape (tested: 6 tiles). |
| 13 | Last batter out | DONE. "Last wicket" banner, no next-batter question (tested with a real one-batter-left state). |
| 14 | Byes and leg-byes | DONE. Two options, runs 1 to 5 (5 is NEW: overthrows; engine accepts it, tested), read-back "Records: 2 byes. The ball counts. Hamza Khan faces it; strike does not change (even runs)", button "Add 2 byes", subtitle "Not off the bat, not charged to the bowler". |

## Scenarios (batter, bowler, player sheets, 17)
| # | Scenario | Status |
|---|---|---|
| 1 | Next batter, nobody picked | DONE. Subtitle "Saad Hussain is out · 5/1 after 0.4 overs" (only when the last wicket really is the cause, else just the score), reasons per player, empty end marked "Empty end" and preselected (same `inn.vacant` logic), disabled "Pick who comes in". |
| 2 | Next batter picked, end chosen | DONE. "Confirm: Talha Mehmood to bat at the striker's end". Chosen tile keeps the dark tile with a gold outline, tint and a tick so the gold shirt stays visible. |
| 3 | Over finished, "Pick bowler for over N" under a limit | DONE. Text badges (BOWLING NOW / BOWLED LAST OVER / USED 2 OF 2 / 2 OVERS LEFT), the reason sentence on every blocked row, blocked rows dimmed (not hidden), rule line in a banner. Title text unchanged ("Pick bowler for over N"). |
| 4 | Bowler picked, ready to confirm | PARTIAL, see NOT DONE 1: a tap on an allowed bowler still records it at once (as today). |
| 5 | Change bowler mid-over | DONE. Warning in a banner, current bowler marked and not selectable. |
| 6 | Tapped a blocked bowler (red message) | DONE. Reason is visible on the row; the tap message "... Pick another bowler." stays as the fallback (tested). |
| 7 | Limit blocks everybody | DONE. Alert banner + a "Change the bowler limit" button that opens the limit sheet inside the same panel (no cross-file change needed). |
| 8 | Late player, member chosen | DONE. Searchable member list (shirts, number), team-badge side buttons, "Add Yasir Farooq to Royal Panthers". |
| 9 | Late player, nobody left | DONE. Illustrated empty state with "Add a guest instead" and "Raise players per side" (opens the players sheet in place). |
| 10 | Guest, only spaces | DONE. Button reads "Type the guest name" even for an untouched empty field; hint "no player number and no profile"; grey shirt. |
| 11 | Guest, name typed | DONE. "Add Ahmed to Thunder Strikers". A repeated guest name is refused early with the engine's words (the engine would refuse it anyway). Full side shows a warning (does not block; the engine decides). |
| 12 | Retire, retired hurt | DONE. Four tiles with their effect, consequence sentence ("... 0 (0) is kept, and can be chosen again later"), "Confirm: Saad Hussain retired hurt". |
| 13 | Retire, replaced | DONE. Replacement picker appears in place. |
| 14 | Substitute fielder | DONE. Team badges, "Note: Danish fielding for Royal Panthers". |
| 15 | Correct the batters | DONE. Tiles instead of two dropdowns, warning banner, "Save: Hamza Khan on strike, Saad Hussain at the other end", "Nobody (batting alone)" when allowed. |
| 16 | Batting order | DONE. Three numbered slots with player tiles; "Save order: Arsalan, Owais". |
| 17 | Batting order, same person twice | DONE. Both slots outlined, message, "Fix the duplicate to save". |

## Scenarios (More sheets, 18; the More grid itself is Builder E1's)
| # | Scenario | Status |
|---|---|---|
| 1-3 | More menu (all enabled / between innings / paused) | NOT MINE: the grid is drawn in `ScoringPad.tsx` (E1). My sheets open from it unchanged. |
| 4 | Penalty runs | DONE. Quick values 1, 2, 5, 10, Other + a typed box, read-back "6/0 becomes 11/0. Penalty runs are not a ball.", "Add 5 penalty runs". |
| 5 | Penalty invalid | DONE. Red field, message, button "Fix the number to continue". |
| 6 | Overs 6 to 8 | DONE. Stepper (stops at the minimum), "Minimum 5 because 4.2 overs are bowled", target note in a banner, scope control. Button text stays "Change overs" (pinned by the existing pad test); the PDF's "Change to 8 overs for this innings" is the read-back line above it. |
| 7 | Overs below bowled | DONE. Engine message kept word for word; button "Fix the overs to continue". |
| 8 | Players per side 7 to 8 | DONE. Stepper + "An innings ends when N wickets have fallen." |
| 9 | Players invalid | DONE (stepper bounds 2 and 11, typed error kept). |
| 10 | Bowler limit maximum | DONE. Three option cards with an explanation each; lock note in a banner; "Set limit: 2 overs each". |
| 11 | Pattern invalid | DONE. Red field, engine's message, "Fix the pattern to continue". |
| 12 | Revised target invalid | DONE. Unit "runs" in the field, "Use the original target (59)" button, "Fix the target to continue". |
| 13 | Edit an earlier ball: pick | DONE. Rows with the ball chip, the sentence and a visible edit icon; innings control; over-strip taps still open the ball directly (tested through the pad). |
| 14 | Edit this ball | DONE. Tiles for kind, runs, wicket; "Was 4 · will be 6. The team score changes by +2."; "Save the edit: 4 becomes 6"; "Back to the ball list". Defaults are the same blank defaults as before (Normal, 0, no wicket): the sheet does NOT prefill from the ball, because that would change what a bare Save records. |
| 15 | End the innings | DONE. Team badge and score, "Royal Panthers then chase 48.", full-width "Keep batting". |
| 16 | End the match early | DONE. Outcome cards with their effect; ABANDON must be typed for an abandon; results need a second tap on an outcome button ("Finish: Thunder Strikers won"). |
| 17 | Stop scoring, all saved | BUILT, NOT WIRED: `PadRelease.tsx` (default export `ReleaseSheet`). `ScoringPad.tsx` still draws its own inline sheet; see "For the lead". |
| 18 | Stop scoring, balls waiting | BUILT, NOT WIRED (same). Calm orange banner "3 changes are still saved only on this device", real text kept, button disabled "Stop scoring (wait for sync)". |
| - | How to score (guide) | DONE, restyled only (content and texts unchanged, step dots). |
| - | Full scorecard | DONE (same content, new shell). |

## Cross-cutting
- Shell: bottom sheet on a phone, centred panel from 640px; header with title, subtitle and a labelled Close button; the old dark backdrop button "Close this panel" kept (the existing pad test uses it); Escape closes; Tab stays inside; focus goes to the sheet and returns to the pad.
- Shirt rule: players are gold `Shirt`s (small in tiles, normal in bowler and member rows, number only), guests grey with their name and "Guest". Teams use `TeamBadge`.
- Disabled things explain why (button label or tile note). Tap targets 44px or more (tiles 56px, run chips 48px). Text sizes in rem; grids switch from 3 columns to 2 to 1 as the text grows (seen at 200% and at 320px).
- No new fetches, no server components, no `Frame`. Colours are flat (no blur).

## NOT DONE (changes scoring behaviour or is pinned by an existing test)
1. Bowler select-then-confirm ("Confirm: Usman Tariq bowls over 6"). It adds a tap and `ScoringPad.test.tsx` pins the one-tap pick. Mis-taps are still fixed with Undo. Needs a decision; to build it, change one handler in `BowlerSheet` and update that one test.
2. Outcome text AS the confirm button for the wicket sheet ("Out: Hamza Khan c ... b ...") and for the overs sheet ("Change to 8 overs ..."): the existing test finds the buttons named exactly "Confirm OUT" and "Change overs". The same sentence is shown as a read-back right above the button. Other sheets use outcome-labelled buttons.
3. Prefilling "Edit this ball" with the ball's current values (see 14 above).
4. Typed confirmation for result outcomes (only ABANDON is typed; the PDF shows only that).

## What was NOT verified on a real phone
No real phone was used. Verified only in jsdom tests and headless Chrome screenshots (390px and 320px wide iframes, a 1000px window, and an emulated 200% text size). NOT verified: touch feel and tap accuracy, haptics, the on-screen keyboard (number pad for the number boxes, whether it covers the sticky buttons, `inputMode` behaviour), iOS Safari safe areas and `dvh` height with the address bar, Android system font scale (only emulated with larger rem and body text), screen readers (TalkBack/VoiceOver reading of tile names and descriptions), real airplane mode (tests use a stubbed failing fetch), the Tab key and focus return on a real browser, long names on narrow phones beyond the fixtures used.

## For the lead
- Wire the new stop-scoring sheet in `ScoringPad.tsx` (E1's file): replace the inline `sheet === "release"` block with `<ReleaseSheet waiting={waiting} close={close} onConfirm={async () => { await lockAction(communityId, matchId, "release", deviceId()); router.push(props.matchHref); router.refresh(); }} />` (import default from `@/components/PadRelease`). Same behaviour as today; only the look changes.
- `Sheet` (still exported) now draws the new shell, so E1's own sheets (More, "Balls the server did not accept") already get the new frame; their inner buttons keep the old classes.
- Decide items 1 and 2 of "NOT DONE".
