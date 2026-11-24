# Phase UI F1 checklist: Series (list, new, series page, add matches, edit)

Status: DONE = built and checked (jsdom behaviour tests, plus Chrome screenshots of the real markup with dummy data at 390 px, 820 px and 1440 px) · PARTIAL · NOT DONE.
Not checked: the five pages against the real database with a signed-in user (they need Neon and Google sign-in), and a real-phone tap-through. No number is counted differently: the tally, the status in words, the points table, the form checks and "which matches fit" all come from `src/lib/series.ts` and `seriesDb.ts`, unchanged.

## Files
- Pages: `src/app/c/[id]/series/page.tsx`, `new/page.tsx`, `[seriesId]/page.tsx`, `[seriesId]/add/page.tsx`, `[seriesId]/edit/page.tsx`
- Components: `FormsSeries.tsx` (the new `SeriesForm`, used by New and Edit), `NewSeries.tsx` (two tabs), `GroupMatches.tsx`, `AddMatches.tsx`, `SrPick.tsx` (tick rows), `SeriesList.tsx`, `SeriesView.tsx` (page body and side column), `SeriesMatches.tsx` (fixtures and results with Undo), `SeriesActions.tsx` (menu, close, delete, banners), `SeriesToast.tsx`, `SrParts.tsx` (badges, state chip, header, points table), `SrIcons.tsx`, `sr.css`
- Pure helpers: `src/lib/seriesView.ts` (states, progress, filters, locked teams, previews, messages), `src/lib/seriesMine.ts` (which teams are yours; card data)
- New actions: `src/app/actionsF1.ts` (create and update with 8 team rows, group and add that RETURN the message so the ticks stay, quiet close, reopen and remove). The old actions in `actionsSeries.ts` are untouched (`deleteSeriesAction` is still the one used for Delete).
- Tests: `src/components/F1Series.test.tsx` (76), `src/app/actionsF1.test.ts` (19)

## Rules kept
Every field (name, teams, format, best of, starts, ends, notes), every validation message (the real ones from `validateSeries`), every server message, "A drawn series stays drawn" (no tie-break, no manual winner), "A team that already has matches in this series cannot be taken out", "A match can be in one series only", all roles (any approved member; the server still checks), "Being in a series never changes how stats are counted", delete keeps every match, Added by / Changed by, series leaderboard link, notes, abandoned matches note, dates line. Old-style addresses (`?e=`, `?why=`, `?created`, `?saved`, `?added`, `?removed`, `?status`) still work.

## Series list (4)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Six series in every state | DONE | Card per series: small badge stack, name, "N matches · best of 3", both team badges with the series score big in the number font (winner's number gold) and a SERIES / LEVEL word, or the badge stack and the points line for a tournament. Chips: Open / Closed plus Not started / In progress / Drawn / Winner: name (words, never colour only). All / Open / Closed segment with counts and a search (series name or team). Grid of 2 columns from 640 px. Gold ring on your teams (words in the label). "Drawn" for a level closed series, no forced winner. Checked by tests and screenshots |
| 2 | No series yet | DONE | Dashed empty state with "Start a series" and "Group matches I already played" (opens the second tab) and the "optional: you never need one to play a match" sentence |
| 3 | After deleting a series | DONE | Green banner "Series deleted. Its matches were kept. Their stats are unchanged." No Undo (a typed name was needed). Not tested end to end (needs the database) |
| 4 | Card menu open | DONE | Kebab on every card: Edit series, Add matches, Close or Reopen the series (happens in place, with a message), Delete series… (typed name). From 1024 px a pencil and a bin also appear on hover or focus (the kebab is always there). Floating "New series" button on phones, button in the top bar from 640 px |

## New series (8)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Blank, open-ended | DONE | Two tabs (both stay mounted so nothing is lost when switching). Name with 0/60 counter, four dashed "Add" rows (grows to 6), segmented Open-ended / Best of a number, hints, date hints, notes 0/300, Cancel + Create series, Preview card (beside the form from 600 px of page width, below on a phone) |
| 2 | Best of 3 filled in correctly | DONE | Stepper − [3] + with "matches (1 to 21): first to 2 wins"; chosen teams become badge rows with a remove button; a typed name is tagged "Match-only team" |
| 3 | Every validation error at once | DONE | The same `validateSeries` runs in the browser before sending, so all messages show together, each beside its field with an icon (name, team row, duplicate, best of range, date order, notes, "Choose at least 2 teams.", more than 8, not part of this community). Nothing is sent until it is valid. NOTE: the team picker does not offer a team that is already chosen, so a duplicate can only come from a typed name equal to another team (the message and the red rows are there) |
| 4 | Name already used (server error) | DONE | Server message returned in the form state, shown at the name field (red) with the banner "Please fix the highlighted fields."; every typed value stays |
| 5 | Group matches I have: two ticked | DONE | Rows: checkbox, both badges, title, date, state chip; "N free matches" and a Status filter; sticky bar with Cancel and "Group into a series (2)" (off at zero); preview of the team badges found in the ticked matches and the automatic name rule ("Alpha v Bravo" for two teams, "Series of N matches" otherwise; the server adds "(2)" if the name is taken, the preview does not know that) |
| 6 | Group: server error "in another series" | DONE | New action `groupMatchesF1Action` returns the sentence; banner above the list, ticks kept (also the other real errors: choose at least one match, needs two teams, too many teams, name rule) |
| 7 | Group: no matches are free | DONE | "No matches are free to group" with the reason (already in a series, cancelled or abandoned) and a New match button |
| 8 | Saving (disabled button) | DONE | Button disabled and reads "Saving…" while the action runs (tested) |

## Series page (10)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Best of 3, level 1–1, one match to play | DONE | Header: Open chip, state chip, BEST OF 3, both big badges (gold ring on yours), score 1 – 1 with LEVEL, "Best of 3: level at 1–1", progress marks and "2 of 3 matches played". Big gold "Play another match in this series"; Add matches and Edit series secondary. Top bar: series name, "2 teams · Open", Edit button, kebab. Fixtures and Results rows with both badges, state chip, result sentence, menu. At 1360 px and wider the points table, leaderboard link, notes, close, delete and Added by sit in the side panel (below that they follow the results) |
| 2 | Not started | DONE | "Not started" state, 0 – 0, empty marks, the real banner sentence, no points table (hidden until a match is counted or 3+ teams), empty fixtures with "Add or schedule a match", "No finished matches yet" |
| 3 | Best of 3 clinched 2–0, still open | DONE | Gold hero, WINNER chip, the real sentence, and a banner "X has clinched it" with a Close series button |
| 4 | Closed and level: drawn | DONE | Orange "Drawn 1–1 (1 tied)", LEVEL label, banner "A drawn series stays drawn: no tie-break and no manual winner" with a Reopen button |
| 5 | Best of 5 won 3–1 and closed | DONE | Gold hero, "Reopen the series" instead of Close, all four results, 4 of 5 marks |
| 6 | Four-team tournament, two level on points | DONE | Badge stack, "level" (no leader named), points table with rank, badge, bold points, your team ringed and tinted; teams level on points and wins share a rank number (order stays points, wins, name, as `pointsTable` gives it) |
| 7 | After actions | DONE | "created" is a banner with the next step; added, removed, saved and closed are snackbars said once (the address is cleaned so a refresh does not repeat them). Remove is undoable (scenario 9) |
| 8 | Error banner | DONE | Red banner with an icon, same four real wordings |
| 9 | Result row menu: remove from series | DONE | Menu: Open match report / Open match page / Remove from series. Remove hides the row at once, shows "Match removed from the series. The match itself is kept." with Undo; the database removal happens after 6 seconds, or at once if you leave the page; Undo removes nothing; a server refusal puts the row back with the message. While the 6 seconds run the header score and points table are not yet updated (they refresh after the removal) |
| 10 | Delete series: type the name | DONE | Typed-name dialog "Delete {name}?", "Deletes the series only. Every match in it (N) is kept, with all its stats.", red "Delete series" stays off until the whole name is typed (a part is not enough; tested) |

## Add matches to a series (5)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Open series, 3 free fit and 2 do not | DONE | Rows with both badges, date and state chip; rows that do not fit show a lock, the real reason in orange and a link "Add the team to the series" (to Edit series); All / Can be added / Cannot be added chips with counts; summary card with "In the series" and "Selected" |
| 2 | Two matches ticked | DONE | Sticky "Add to the series (2)", active only when something is ticked |
| 3 | No free matches | DONE | "No free matches" with the real sentence, New match and Back to series |
| 4 | Series is closed | DONE | Banner "This series is closed. Reopen it to add matches." with a Reopen button that works in place (ticks kept); the add button stays off |
| 5 | Server error after adding | DONE | New action `addMatchesF1Action` returns the sentence; banner above the list; ticks kept; a ticked match hidden by a filter is still sent |

## Edit series (4)
| # | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Editing Thunder v Panthers Rivalry | DONE | Same form as New, filled in. Teams that already have matches show a LOCKED tag and "has matches in this series" instead of a remove button; stepper with "first to 3 wins"; live preview; the rule sentence "A team that already has matches in this series cannot be taken out. Changing the format never changes the record." |
| 2 | Error: tried to take out a team with matches | DONE | The remove button does not exist for such a team, so this can only happen if the data changed meanwhile; then the server sentence is shown under the list and the locked team row turns red and stays on screen |
| 3 | Tournament, four teams all locked | DONE | Four locked rows, open-ended, adding a fifth team works (checked) |
| 4 | Saved | DONE | Redirect to the series page with `?saved=1`, said once as a snackbar "Saved." |

## Open points and things to know
- NOT DONE: the Delete icon button on the card needs hover or focus to appear on a wide screen (by design, the kebab is always visible).
- The edit and create forms now have room for 8 team rows (the rule maximum) through the new actions, so a series made by grouping matches with 7 or 8 teams can be edited without losing teams. The old forms had 6 rows. The text says "up to 6 here" for a normal series.
- The series page "Edit" button in the top bar is hidden under 400 px (Edit series is still in the page and in the menu).
- The old `groupMatchesAction`, `removeMatchAction`, `seriesStatusAction`, `createSeriesAction`, `updateSeriesAction` in `actionsSeries.ts` are no longer used by these pages (dead code, kept). `deleteSeriesAction` is used.
- A real tap-through on a phone, with the real database, is still to do.
