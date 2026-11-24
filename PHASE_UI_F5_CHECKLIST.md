# Phase UI F5: My profile, Edit my profile, Player page

Prefix `pf-`. Files: `src/app/c/[id]/profile/page.tsx`, `profile/edit/page.tsx`, `players/[userId]/page.tsx`, `src/components/PlayerStats.tsx`, new `PfParts.tsx`, `PfShare.tsx`, `PfAccount.tsx`, `PfProfileForm.tsx`, `PfFilters.tsx`, `PfIcons.tsx`, `pf.css`, tests `F5Players.test.tsx` (+ `F5.fixtures.ts`). Same server actions (`saveProfileAction`, `shareProfileAction`), same fields, validation and permissions. Old `ProfileForm` stays in Forms3.tsx (dead code).

Status key: DONE = built and checked by the test and/or a screenshot.

## My profile (6)
| # | Scenario | Status |
|---|---|---|
| 1 | Admin, details set, three communities, sharing off: broadcast card (gold shirt big + name, chips, team badges with gold ring, pencil), career strip (6 tiles, Full stats), Add buttons / edit pencil, share card with lists, adaptive layout (2x2 quick actions on phone, bento on tablet, Quick actions panel at 1360) | DONE (test + phone/desktop screenshots) |
| 2 | Sharing on: dashed link box, Copy button, Share link (only where the browser has native share), red Stop sharing, "On" badge | DONE |
| 3 | Stop sharing confirm (Keep sharing / Stop sharing, new link wording), nothing happens before confirm | DONE (test) |
| 4 | Link copied: green button with tick, snackbar, "Select and copy" if refused | DONE (test) |
| 5 | Brand-new member: Role not set, Add buttons, Not in a team yet, Stats start here | DONE |
| 6 | Log out of all devices failed: red banner with title and the real sentence, button re-enabled | DONE (test) |

## Edit my profile (7)
| # | Scenario | Status |
|---|---|---|
| 1 | Chips (real radio buttons) for the four choices with visible Not set, 44px, live preview card + number tile on wide screens, sticky Save/Cancel bar, counter and hint | DONE |
| 2 | Name empty: red field, alert icon, message under it | DONE (test) |
| 3 | Name over 60: same field error; box refuses extra letters, counter 60/60 | DONE (test) |
| 4 | Saving: disabled "Saving…" | DONE (test) |
| 5 | Saved: green banner "Profile saved." + "Your changes are live for every member.", user stays, typed values kept | DONE (test) |
| 6 | First time: Not set is the selected chip in all four groups | DONE (test) |
| 7 | Choice not on the list: red banner with the way out; name not marked | DONE (test) |

## Player page (13)
| # | Scenario | Status |
|---|---|---|
| 1 | Own page, Overview: card with pencil and "(you)", career strip above, filter chips, segmented tabs, bento cards, last 5 with legend, awards, recent matches with result words and opponent badges, analytics card, help accordion, Edit button | DONE |
| 2 | Admin viewing another member: no pencil, Manage this member button + kebab menu | DONE |
| 3 | Batting: run mix as one bar with counted legend, how out as bars, partnership callout | DONE |
| 4 | Bowling (plain member, no Edit/Manage): wickets by type bars, dot-ball gauge, rates | DONE |
| 5 | Fielding: tiles, blue note, help accordion (closed by default, same eight definitions) | DONE |
| 6 | Matches: team record stacked bar + legend, awards, one-line rows (wore #N kept), segmented All/Batting/Bowling, count | DONE |
| 7 | Matches filtered to Batting: hidden match, "N shown" | DONE |
| 8 | ?match=: gold "In this match" card above the career strip, four tiles, Open the match | DONE |
| 9 | Guest linked afterwards: no "wore #", "joined the community after this match", did not bat, dashes | DONE |
| 10 | Filters applied: gold chips, count on Filters chip, red Clear all, same address params (scope, team, series, from, to); full filter form in the right panel at 1360+ | DONE |
| 11 | Filters, no results: own Clear filters button, chips stay, tabs/stats/analytics hidden | DONE |
| 12 | Zero matches: dashed Stats start here, Role not set, Not in a team yet, no tabs/strip/analytics | DONE |
| 13 | Phone: filters in a bottom sheet (Apply, Cancel, Clear all, Series only if the community has one; Escape closes; focus kept) | DONE (test; sheet not screenshotted) |

## Notes / not done
- Phone sheet and the open-help state were checked by tests only, not by screenshot.
- The PDF shows an initials avatar: built as the gold Shirt (big + name) per the shirt rule.
- Top bar kebab/log-out icon have text labels. Nothing added to public pages, no privacy setting, no schema change.
- "Stop sharing" success/failure feedback: a snackbar appears after the page reloads (compares the link before/after); the server action itself is unchanged.
- Tests: `Report.test.tsx` (uses PlayerStats) still passes unchanged; PlayerStats keeps its props (new optional `analyticsHref`, `showSummary`).
