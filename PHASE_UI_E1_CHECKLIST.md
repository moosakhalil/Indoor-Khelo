# Phase E1 checklist: the live scoring pad (core, start/finish, lock on the pad, offline/sync, More menu grid)

Status: DONE (built, and seen working in a simulated phone: jsdom tests plus headless Chrome screenshots at 390px, 150% text and 1100px)
 · PARTIAL (what is missing is written) · NOT DONE (why). Nothing here has been tried on a real phone (see the last section).

Files (all mine): `ScoringPad.tsx` (render part only), `PadStart.tsx`, new `PadBoard.tsx`, `PadKeypad.tsx`, `PadStatus.tsx`, `PadMore.tsx`,
`padInfo.ts` (pure words and numbers), `PpIcons.tsx`, `pp.css`. Tests (new files): `PadE1Golden.test.tsx` (+ `__snapshots__/PadE1Golden.test.tsx.snap`),
`PadE1.test.tsx`, `padE1.harness.tsx` (helpers). Not touched: engine, outbox, `actions5.ts`, sync route, service worker, `PadSheets.tsx`, `Live.tsx`, `CoinToss.tsx`, `QuickScore.tsx`.

## How the events were protected
1. Before anything was restyled, `PadE1Golden.test.tsx` (31 tests) was written and run against the OLD code: it drives the pad tap by tap
   (start, 0-6 with the over change, wide, no ball, armed cancel, wicket bowled/caught, run out, undo several times, pause/resume/swap,
   byes, level scores, super over, finish, offline then online, refused balls, lock lost, take-over request/accept/decline, move to this phone,
   stop scoring, sign-in expired) and records the events the server received (type, order number, payload, reason) and the lock calls. The snapshot file is what the old code made.
2. The handlers in `ScoringPad.tsx` (addInternal, add, flush, commit, the effects, run, toggleArm, the lock actions, discard/try again) were NOT edited.
   The only logic-area edits: `WORDS` moved to `padInfo.ts` unchanged; the toast message got an optional `sub` line (read-only read-back, e.g. "Hamza Khan 28 (15)");
   the "server could not save" toast got `sub: "Retrying every few seconds."`.
3. After the redesign the same golden tests pass with the SAME snapshot. Where a control was renamed by the design, only the selector in the golden test changed
   (never an expected event): "Yes, super over" -> "Yes, play a super over", "No, it is a tie" -> "No, call it a tie", "Finish the match" -> "Finish match: <result>",
   "Choose the bowler for the next over" -> "Choose the bowler for over 2", "Hand over" -> "Hand over to Hamza", "Yes, stop scoring" -> "Stop scoring and hand over",
   "N balls were not accepted... Tap to fix" -> button "Fix N balls", "Discard these balls (and any after them)" -> "Discard N balls", "Bravo bat. Target 7 from 1 over." -> "Bravo need 7 to win".
   And the two checks that said the Hand over buttons DISAPPEAR while balls wait now say they are dimmed with the reason (the design asks for this).
4. Existing tests still green, unedited: `ScoringPad.test.tsx` (9), `QuickMatch.test.tsx` (6), `QuickC4.test.tsx` (23), `D2.test.tsx` (38). Final run of these plus mine: 133 passed. `npx tsc --noEmit` clean.

## Scenario table

### Scoring pad: core states (18)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1-5 | First-time guide, steps 1 to 5 | PARTIAL | The guide sheet itself (`GuideSheet`) is in `PadSheets.tsx` = E2. Mine: a NEW "?" button in the header that reopens the guide at any time (`aria-label` "Open the guide: how to score"). Pictures, segmented progress, Back button: E2. |
| 6 | Normal ball state | DONE | Score bug with `TeamBadge`, LIVE badge, target, score in `--font-num`, overs, chase sentence (`Need 20 from 9 balls · RRR 13.33 · RR 10.00`); three rows (striker gold with star and "ON STRIKE", non-striker, bowler with figures and "N OVERS LEFT" pill) with gold `Shirt` small (number only; grey dash for guests); over strip with a word under every ball and empty slots; keypad in the lower half: 0-6 with captions DOT/RUN/RUNS/FOUR/SIX, 62px keys, WIDE, NO BALL, WICKET, RUN OUT, More; labelled UNDO bar above it. Two panes from 720px (board and earlier overs left, keypad right). |
| 7 | First ball of an innings | PARTIAL | Six dashed slots, run rate instead of a chase, no target: done. UNDO is NOT disabled: right after the innings start the engine's last action is "starting the innings", and today Undo takes the openers back (a real way to fix wrong openers). The bar says "Last: Starting the innings". Disabling it would remove a capability; the user should decide. |
| 8 | Free hit | DONE (one change) | Solid orange strip "FREE HIT / Only Run Out is allowed on this ball" in the board; WICKET dimmed with caption "RUN OUT ONLY" and described by the strip; RUN OUT turns solid red with "ALLOWED"; the Nb ball is labelled "no ball". WICKET is dimmed but NOT disabled: the wicket sheet still offers "Retired out" on a free hit and explains why the other ways are off. |
| 9 | Wide pressed | PARTIAL | The two-tap "armed" flow stays (tests and the old behaviour pin it): bar with "Just the wide" and "Cancel" (44px), and now one line saying a wide is N run(s) by itself. The PDF's guided sheet with a preview line and "Add Wide + 1 (2 runs)" is NOT built (it changes the tap flow; the events would be identical). |
| 10 | No ball pressed | PARTIAL | As 9: bar now says "The next ball will be a Free Hit." up front and why WICKET/RUN OUT are off, and how to record a run out on a no ball (cancel, use RUN OUT, which asks wide/no ball). Sheet with live summary not built. |
| 11 | Paused | DONE | "Paused" badge in the bug, a note saying the keys are locked until you resume, full-width gold "Match paused. Resume" (name unchanged), keys stay visible and dimmed. |
| 12 | Wicket fell, prompt dismissed | DONE | Board row "Next batter needed / STRIKE END IS EMPTY" (the blank-name bug is fixed; also "NON-STRIKER END IS EMPTY"); gold note "Bravo2 is out (c & b Alpha1). Pick who comes in to continue."; "Choose the next batter"; Undo button with a line "Takes back: Wicket: Caught · Bravo2 off Alpha1" (its name stays "Undo the last ball"); red W ball labelled "wicket". |
| 13 | Over finished, prompt dismissed | DONE | The finished over stays on the board with its words ("OVER 1 · Over complete"); note "Over 1 complete: 8 runs, no wicket. <who cannot bowl> cannot bowl the next over."; button "Choose the bowler for over 2". |
| 14 | Undo toast | PARTIAL | Toast stays 5 s; the Undo bar immediately shows the previous ball ("Last: ..."). NOT DONE: Redo, and the scorer's name in the toast text (Redo would have to create new events: it changes what the scorer records). |
| 15 | Engine refusal / free-hit toast | DONE | Red toast starts with "Not saved" and an alert icon; amber free-hit toast with a zap icon; green toasts with a check. Sits just above the keypad (moves to the top of the screen while a panel is open so it never hides the panel's buttons). |
| 16 | Scorecard sheet | PARTIAL | The Scorecard button is in my header (icon + label). The sheet (tabs, tables, striker tint) is `ScorecardSheet` in `PadSheets.tsx` = E2. |
| 17 | Ball saved toast | DONE | Toast text unchanged ("Four runs") with a read-back line under it ("Bravo2 8 (3)"); a clock badge on every ball not yet on the server; six flashes gold and a wicket flashes red as before (same classes, same vibration calls). |
| 18 | Text at 150% | DONE (simulated) | Heights are minimums; the board is the only scrolling area; Undo bar and keypad stay on screen at 150% (checked by screenshot at 390px with root font 24px); status strip has its own row; WICKET no longer breaks inside the word. |

### Start, innings break, super over, finish (13)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Match start, coin toss | PARTIAL | Done: three-segment progress bar (Toss, Openers, Start), both teams with `TeamBadge`, flat gold coin (CSS override of `.coin-face`, `CoinToss.tsx` untouched), the manual-entry link in gold, Start button fixed at the bottom edge of the screen, wide layout centres the panel beside the board. NOT done: three separate screens (one task per step). `ScoringPad.test.tsx` and `QuickC4.test.tsx` drive toss, openers and Start on one screen, so it stays one scrolling form with a sticky Start. |
| 2 | Call heads, "Toss the coin" enabled | DONE | Chips are 48px; the chosen one is filled gold (not colour alone: also a check mark in the player chips). Chips inside `CoinToss` are styled by CSS only. |
| 3 | Coin in the air | DONE | Unchanged markup and animation (D1's component); reduced motion is handled by the global rule. |
| 4 | Toss result, bat or bowl not chosen | PARTIAL | "Bat first / Bowl first" are the 48px chips of `CoinToss`; the "Continue: choose openers" button is not built (see 1). |
| 5 | Toss done, openers and bowler | PARTIAL | Three labelled groups of 48px chips with a gold shirt (number) and the name; toss result banner with a check and "Toss again". The Start button keeps its name "Start scoring" (tests pin it); the sentence "Alice and Bob to face Cara" and the missing-piece text ("Pick both openers and the bowler") are written right above it. |
| 6 | Striker and non-striker the same | DONE | Both chips turn red, the exact sentence under them with an alert icon, "Pick two different openers" above the disabled button. |
| 7 | All chosen | DONE | Three segments complete, the outcome sentence, button enabled. |
| 8 | Toss by hand | PARTIAL | 52px selects, same logic ("Batting first" only when needed), errors with an alert icon. The error is an inline red line, not a banner above the button. |
| 9 | Innings break | DONE | Gold card "Bravo need 7 to win from 1 over"; the bug shows "Innings 1 complete: Alpha finish on 6/0" (BREAK badge); same three pickers; only the bug is shown above the form. |
| 10 | Scores level | DONE | Gold card, "Yes, play a super over" / "No, call it a tie" (56px), board says "Scores level: 6 all", Undo says what it takes back. |
| 11 | Super over | DONE | The false "Target N from 1 over" for the first super-over innings is gone (`chaseFor` only gives a target for the second innings of the match and of a super over, like the engine); "One over each" and "There is no bowler limit in a super over." |
| 12 | Result reached | DONE | Button "Finish match: <result>"; note that Player of the Match is worked out automatically from points and shown on the report; Undo names the ball. |
| 13 | Finished and locked | PARTIAL | Green result card, "scorecard is locked, corrections are made from the match page", gold "Open the match report" (only once every ball is sent; otherwise a note says so), "Back to the match". NOT DONE: Player of the Match preview (the pad must not fetch or compute stats; the report is the source). |

### Scoring lock, take-over, read-only (pad side: 10-14; 1-9 are the gate page, Phase D2)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 10 | Request to take over, nothing waiting | DONE | A banner at the top of the scrolling area (the keypad does not move), "Hand over to Hamza" and "Not now" (44px). |
| 11 | Request while balls wait | DONE | "Hand over to ..." stays visible but dimmed, the reason is written ("N balls are still waiting to sync. Get a signal before handing over. They are saved only on this phone."), "Not now" works; unsent balls carry a clock. |
| 12 | Scoring on another phone | DONE | Titled "Scoring is open on another phone", "Move scoring to this phone" inside it, keys dimmed under it, Undo bar says "Scoring is not on this phone". |
| 13 | Someone took over | DONE | Title "You are no longer the scorer." (the full stop is kept: tests find it), 44px "See the live score", keys dimmed. |
| 14 | Lock lost with unsent balls | DONE | Red "Review unsent balls" beside "See the live score". |

### Offline queue, sync states (pad side: 1-10; 11-15 are `QuickScore.tsx`, built in Phase C4)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Offline with pending balls | PARTIAL | Calm blue strip with a "Saved on this phone" pill; a clock badge and dashed outline on every unsent ball; keypad unchanged. NOT adopted: "N changes pending" wording. `ScoringPad.test.tsx` pins "Offline · 5 balls waiting to sync". All status wording is in one function (`statusWording` in `padInfo.ts`) so the lead can change it in one place when that test is updated. |
| 2 | Browser has not promised to keep the data | DONE | Blue info note with a bold lead line. |
| 3 | Online but waiting | DONE | Orange strip with a clock icon, "Send now" is a 44px button. |
| 4 | Syncing | PARTIAL | Orange strip with a refresh icon; the text stays "Syncing…" (not "Sending 3 changes…", same wording reason as 1). |
| 5 | Sign-in expired | DONE | Red strip, red notice with a button "Sign in again" (the link goes to the sign-in page, which has the only sign-in, Google). |
| 6 | Server could not save yet | DONE | Toast keeps its text and adds "Retrying every few seconds." (the pad does retry every 8 s). |
| 7 | Balls refused | DONE | Red notice "N balls were not accepted by the server." with a "Fix N balls" button; the refused ball carries a red alert badge. |
| 8 | Tap to fix | PARTIAL | Each refused ball is a card with an alert icon, the sentence and the reason; says balls go in order; gold "Try sending them again"; red "Discard N balls" with a warning that it cannot be undone. No ball chip inside the card. |
| 9 | Phone could not store the last ball | PARTIAL | Red notice "Not kept on this phone." and the status strip turns red. The PDF's red badge on the affected balls is not possible: the pad only keeps one yes/no flag for this, not which ball. |
| 10 | Phone almost out of storage | DONE | Red notice with a bold lead line and an icon. |

### More menu grid (first part of the More screen)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Second innings, everything on | DONE | Four groups (During play, Players, Match rules, Fix and finish) plus How to score, an icon and a label on every tile; "End or abandon the match" (red, full width) and "Stop scoring (hand over)" are in separate sections with a divider and a sentence each. NOT adopted: shortened labels ("Late player or guest"): the existing test finds the long names. |
| 2 | Between innings | DONE | A line says "No innings in progress: some items are off."; every dimmed tile has its reason under it ("No innings in progress", "Only for the side batting second"...). Rules for which are off are the same as before. |
| 3 | Paused | DONE | "Resume the match" replaces Pause in the same place; line says byes are off because the match is paused. |
| 17, 18 | Stop scoring: all saved / balls waiting | DONE (here, not in E2) | The sheet's content lives in `ScoringPad.tsx`, so I built it: green "All changes are saved" or blue "Saved only on this phone" with the count, button "Stop scoring and hand over" (disabled while balls wait). |
| 4-16 | The sheets that open from More | E2 | `PadSheets.tsx`. |

## NOT DONE (changes scoring behaviour)
- Redo after Undo (would create new events).
- Disabling UNDO on the first ball (today it undoes the innings start: a capability).
- Disabling WICKET on a free hit (the sheet still offers "Retired out").
- Wide / No ball as a guided sheet instead of arming the keypad (changes the tap flow; kept as two taps).
- "N changes pending" wording (existing test pins "balls waiting to sync"): one-function change when the lead agrees.
- Three-step toss/openers/start screens (existing tests drive one screen).
- Player of the Match preview on the finished screen (needs stats; the pad must not fetch).

## Things the lead should know
- `ScoringPad.tsx` keeps the class `pad-page` on its root next to `pp-page`: `qm.css` (Phase C4) positions the pad inside the no-signal page with `.qm-score > .pad-page`.
- Keyboard order: the DOM order of the keypad is unchanged (0-6, UNDO, WIDE, NO BALL, WICKET, RUN OUT, More: `ScoringPad.test.tsx` pins it) while CSS grid places Undo on top and WICKET beside 6, so Tab follows the DOM order, not the picture.
- The two-pane layout uses a CSS container query (`@container`, Safari 16+, Chrome 105+). On an older browser the pad simply stays one column.
- `Live.tsx` (`LiveScore`) is no longer used by the pad (it draws its own board in `PadBoard.tsx`); it is untouched and still used by `LiveView` consumers and `D2.test.tsx`.
- Cross-file contract: nothing needed from E2. E2 owns the guide, scorecard and all sheets; I use `Sheet`, `BatterSheet`, `BowlerSheet` ... exactly as exported.
- "Match rules in force" side panel and "Previous overs" on desktop: previous overs built (read-only list from the engine's balls); the rules panel is NOT built (it is not in the scenario list).

## NOT verified on a real phone (said plainly)
- Haptics (vibration calls are unchanged, but nothing was felt).
- A real on-screen keyboard (the toss selects and the sheets' inputs).
- iOS safe areas (`env(safe-area-inset-*)`) and `100dvh` with the browser's own bars moving.
- Real airplane mode and the real `online` / `offline` events (simulated in jsdom with a pretend server).
- Real touch feel: tap sizes were checked in the CSS (>= 44px, keys 62px) and in screenshots, not with a thumb.
- 150% system font scale was simulated by setting the page's root font size to 24px in headless Chrome, not with a real Android/iOS setting.
- Colour contrast was judged by eye on screenshots, not measured.
