# Phase UI-C, Builder C2: Plan several matches and Rematch

DONE = built and checked by tests (jsdom) and a screenshot (phone 390 px, desktop 1440 px). Same server actions as before (`createSeveralAction`, `rematchAction` in `src/app/actions4.ts`), same field names, same validation, same redirects. No new server action was needed (no `actionsC2.ts`).

Files: `src/app/c/[id]/matches/several/page.tsx`, `src/app/c/[id]/matches/[matchId]/rematch/page.tsx` (both edited), new `src/components/{SeveralPlan,RematchCopied,RematchPlan,SvBits,C2Icons}.tsx`, `src/components/sv.css`, `src/lib/{c2,c2Data}.ts`, tests `src/lib/c2.test.ts`, `src/components/C2.test.tsx`. `Forms4.tsx` is untouched (SeveralForm and RematchForm are now unused).

## Plan several matches `/c/[id]/matches/several`
| # | Scenario | Status |
|---|---|---|
| 1 | Fresh form, 3 empty matches | DONE. Team radio cards with initials badge (own team gold ring), Swap teams, Team 2 waits for Team 1, players stepper, match rows (card on phone, table row from 1024 px), Duplicate and Remove on any row, Add another, NEW "Repeat last, +7 days", counter "3 of 10", recap with badges, "3 separate matches, 6 players a side" |
| 2 | Three matches filled in | DONE. "Create 3 matches" (singular "Create 1 match") in a sticky bar on phone and in the recap on tablet/desktop; recap says one "Are you coming?" alert per match |
| 3 | Errors (date missing/past, bad custom overs, venue too long, team and players-per-side) | DONE. Each message sits under its own field in its own row with an icon, same server words; message goes away when that field is edited; recap counts what is left ("N things need attention."); players per side error shown once |
| 4 | At the limit, 10 matches | DONE. Add another, Repeat last and Duplicate disabled, counter turns orange "10 of 10", hint with info icon |
| 5 | Down to one match | DONE. Remove disabled, "Create 1 match", "1 separate match" |
| 6 | Creating… | DONE. Button "Creating…", whole form locked (disabled fieldset), second submit ignored |
| 7 | Server failures (wrong count, not a member, team removed) | DONE. Banners with icon and the unchanged server text; team error under the team card |
| NEW | Label says a date is required (REQUIRED tag) | DONE |
| NEW | Close (X) in the top bar next to Back | DONE |

## Rematch `/c/[id]/matches/[matchId]/rematch`
| # | Scenario | Status |
|---|---|---|
| 1 | Plain rematch of a finished match, 12 players | DONE. Both badges (own team gold ring), "Rematch of Sun 22 Nov, 8:00 pm" (viewer's time zone), checklist (teams, venue, overs and rules + players a side, players copied), "separate match" note, two columns from 1024 px, NEW next-week and tomorrow chips, Cancel |
| 2 | Open series, "Play another match in this series" | DONE. Gold banner with trophy, series name and what happens, "Rematch of Match N of {series} (day)", no Make-a-series option |
| 3 | No series yet, "Make this a series" ticked | DONE. Option card, button becomes "Create rematch and series", sends `makeSeries=on` as before |
| 4 | Series finished or closed | DONE. Blue note, no option |
| 5 | No lineup and no venue | DONE. Venue line dropped, empty-lineup sentence from the PDF |
| 6 | One player copied (singular) | DONE |
| 7 | Every date error | DONE. The four server sentences under the field with an icon; a chip clears the error |
| 8 | Creating… | DONE. "Creating…" and form locked |
| 9 | Server failures | DONE. Same texts; "Plan a new match instead" (to `/matches/new`) for original match gone; "Try again" (resends the same form) with "Try again in a moment." for could not be created; time zone message split in two lines |
| 10 | After creating: new match page banner with Review lineups and Edit | NOT DONE here. It is on the Match details page (`/matches/[matchId]`), Phase D. The redirect and the `?rematch=1&series=` / `?seriesnote=1` codes are unchanged, and the series redirect `/series/{id}?created=1` is unchanged |
| NEW | "See who is copied" (shirts of the copied players by side, guests grey) | DONE (extra, answers the "does not show WHICH players" point) |

## Notes
- Chips are made in the browser after load (they use the phone's clock, the same zone the form sends). If the first match had no date there is no "Next week" chip and "Tomorrow" is 6:00 pm (my choice, not in the PDF). If the first match is long past, "Next week" is the first same-weekday slot that is still in the future.
- The venue field allows more than 80 characters on purpose (the old form blocked typing at 80), so the PDF's "venue too long" message can be reached; the server still enforces 80.
- Desktop 1360 px+: the recap moves into the shell's side panel (a portal into `<aside class="panel">`); below that it is under the list. Not seen in a real browser (the panel needs the full shell); the inline layout was.
- Players-per-side error: the server reports it per match row (`playersPerSide_0`...); the new screen shows it once under the stepper.
- Date field is the native `datetime-local` (no custom picker).
