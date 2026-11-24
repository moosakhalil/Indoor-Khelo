# Phase D2 checklist: Live view and take-over gate (`/c/[id]/matches/[matchId]/score`)

Built from the proposal pages 444-463 (14 scenarios). Status key: DONE = built and seen working (jsdom test and/or headless Chrome screenshot at 390, 820 and 1440 px).

Files: `src/app/c/[id]/matches/[matchId]/score/page.tsx`, `src/components/ScoreGate.tsx` (restyled, same props plus two optional ones), new `src/components/LiveView.tsx`, `LvIcons.tsx`, `lv.css`, `src/lib/liveView.ts`, tests `src/components/D2.test.tsx` and `D2.fixtures.ts`. `Live.tsx` was NOT edited (the scoring pad, the match page and the report keep using `LiveScore` and `Scorecard` exactly as before).

| # | Scenario | Status | How checked |
|---|----------|--------|-------------|
| 1 | Member watching innings 1, Ask to take over | DONE | one team row with run rate, no chase row; striker (star), non-striker and bowler strips with gold shirts; OVERS LEFT pill; this over with letters and dashed empty slots, "Ball 5 of 6"; gate with Ask to take over scoring (gold). Test + screenshot |
| 2 | Admin watching the chase, Take over as Admin visible | DONE | two team rows with badges, chasing side marked, "need N from N balls . RRR . RR", chase progress bar "47 of 59 needed", Admin area separate and labelled. Desktop (1360 px and up): live on the left (sticky), gate and scorecard on the right. Test + screenshots |
| 3 | Free hit pending | DONE | centred orange banner "FREE HIT / Only Run Out is allowed on this ball", Nb as an orange bubble with letters |
| 4 | Super over | DONE | bug says "Super over . 1 over", rows are the two super over innings, need sentence for the chasing side; no limit pill because the engine returns no allowance in a super over (the PDF picture shows a pill, its text says none; I followed the engine and the text) |
| 5 | Match paused | DONE | orange PAUSED badge on the bug instead of LIVE, orange "Paused" chip in the top bar instead of "Auto-updating" |
| 6 | Innings break | DONE | "Thunder Strikers innings over . run rate 12.17" in the bug line, one row; the chase target appears when innings 2 starts |
| 7 | Not started, lineups ready, Start scoring | DONE | two large team badges with "v", "The match has not started yet", gate card with big Start scoring button and the one-scorer-at-a-time rule |
| 8 | Cannot start: each side needs 2 players | DONE | orange warning block with icon, and the "Pick lineups" gold button directly under it |
| 9 | In progress, nobody holds the lock | DONE | button text "Take over scoring" (started) vs "Start scoring" (not started); live score stays above |
| 10 | I asked, waiting for the scorer | DONE | blue block "Waiting for X to hand over..." with "You will be taken to the pad as soon as they accept"; Cancel my request is a full-width button |
| 11 | Someone else already asked | DONE | disabled button "X has already asked" plus hint "Only one request at a time. Try again in a moment." |
| 12 | Error after tapping | DONE | red banner with warning icon, role=alert; all 8 messages of the table kept word for word (tested one by one) |
| 13 | Match cancelled / postponed | DONE | orange reason block with the same sentence, then Back to the match (reason text unchanged from the page) |
| 14 | Take over as Admin: confirmation | DONE | button opens a dialog "Take over scoring now?" naming the scorer and the consequence (unsent balls not saved), warning "Use this only if they cannot hand over.", buttons "Keep watching" / red "Take over as Admin"; nothing is sent until confirmed; Escape and Keep watching do nothing |

## New items from the "what changed" lists
- Broadcast score bug with team badges, big score in `var(--font-num)`, overs, chase sentence: DONE.
- At the crease as strips with strike rate and OVERS LEFT pill: DONE (shirt rule: gold shirt with number for members, grey shirt with dash for guests).
- This over with W / Wd / Nb / 4 / 6 text; six gold filled, four blue outlined (fixes "six looks like four"), empty dashed slots, Ball N of 6: DONE.
- Chase progress bar: DONE. Auto-updating chip in the top bar and Auto chip in the bug: DONE.
- Scorecard as innings cards with team badge, batting table (R B 4s 6s SR), extras, did not bat, fall of wickets as pills, bowling table (wickets in gold), timeline: DONE (same facts as before; result banner kept).
- Gate states drawn as blocks, error banner, Admin separated and confirmed, scorer shown with their shirt number: DONE.
- Desktop two-column layout (1360 px and up) via own CSS (`.app.has-nav > .page:has(.lv-root.two)`), single column below that: DONE.

## Kept from today (nothing lost)
Same `lockAction` calls (take, request, cancel, admin), same permission rules (Admin area only when someone else scores and you are Admin), same texts, automatic refresh every 5 seconds (`AutoRefresh`, also while paused so a resume shows), "Scored by" names (now a row in the numbers card), "Pick lineups" only when a side has fewer than 2 players, Back to the match, redirect of finished matches to the report, the scoring pad for the lock holder.

## Not built / differences from the PDF (plain)
- No scorecard/commentary tabs: the PDF shows the scorecard stacked under a SCORECARD heading, so it is stacked (the timeline stays as its own card).
- The PDF avatar chips with initials for the scorer and the batters became shirts (shirt rule).
- The PDF shows "Paused" next to a green dot; built orange so the colour is not the only signal (the word is there too).
- The red filled confirm button is styled by `.lv-gate .dlg-actions .btn.red` in `lv.css` (the shared `.btn.red` is an outline).
- Not checked: a real browser on the real page with a database (page needs a signed-in user); the pieces were rendered with real engine states instead.
