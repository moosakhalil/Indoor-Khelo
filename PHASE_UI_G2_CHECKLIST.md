# UI redesign, Builder G2: Waiting, Pick number, Player numbers, Leave, Delete community

Status words: DONE = built and checked (unit tests in `src/components/G2.test.tsx`, 34 tests, plus screenshots at phone 390 px, tablet 820 px and desktop 1440 px of the rendered markup). Nothing was run against the real database, real sign-in or a real phone.

## Waiting for approval `/c/[id]/waiting` (3)
| # | Scenario | Status |
|---|---|---|
| 1 | Request sent | DONE. Status timeline (done / now in gold / later), Pending badge, Admin with a shirt and a Waiting badge, Check again is the big primary button, Cancel is a quieter danger button, Back. |
| 2 | Confirm before cancelling | DONE. "Cancel your request?" with Keep request / Cancel request; the existing `leaveAction` runs only on Cancel request. |
| 3 | Not approved | DONE. Red X tile, same message, Ask again (to `/join/{code}`) as primary, Back. |

## Pick or change player number `/c/[id]/number` (7)
| # | Scenario | Status |
|---|---|---|
| 1 | First time (and creator step 2 of 3) | DONE. Board with legend, TAKEN/YOU labels, jump to a number, Free only filter, confirm panel (sticky bottom on phone, side panel from 900 px). With `?new=1` the 3-step progress strip shows. |
| 2 | Number 12 picked | DONE. Gold selected cell, shirt with 12, "Number 12 / This number is free", Confirm number 12. |
| 3 | Someone took it a moment ago | DONE. The server message is shown; 12 becomes TAKEN at once, the choice is cleared, the three closest free numbers are offered, and the page reloads the real list. |
| 4 | Changing (7 is yours) | DONE. 7 is green with YOU; "Keep number 7" button (back to the profile). |
| 5 | In a match being played | DONE. Said before the tap with the live match name; the button reads "Locked until your match ends" and is off. The server check stays (its message still shows). |
| 6 | Nearly full | DONE. At 10 free numbers or fewer a gold note lists them and Free only turns on by itself (the 10 is my choice; the PDF only shows 5). |
| 7 | Saving | DONE. Spinner on the button, second tap blocked. |

## Player numbers (Admin) `/c/[id]/numbers` (2)
| # | Scenario | Status |
|---|---|---|
| 1 | 24 members, one without a number | DONE. Search by name or exact number, NO NUMBER badge and text with a grey shirt, people without a number first, count line, number map (side panel from 1360 px, at the end of the page below that), Reset number on each row (button from 1024 px, and the three-dots menu always). The page now lists members without a number too (the old query hid them). |
| 2 | Reset a number | DONE. "Free number 10?" box naming the person and the community; the button repeats the outcome. Uses the existing `resetNumberB3` (same Admin checks); a failure shows the real reason. |

## Leave community `/c/[id]/leave` (4)
| # | Scenario | Status |
|---|---|---|
| 1 | Member / Admin with another Admin | DONE. Icon list of the four facts (the freed number in orange), red leave button, gold Stay. |
| 2 | Only Admin | DONE. Gold warning, counted and searchable successor list (own scroll box, gold shirts), Make Admin per person (existing `setRoleAction`), Stay primary, Delete quiet. |
| 3 | Only Admin, nobody else | DONE. Empty state explains the dead end. |
| 4 | After making someone Admin | DONE. Green "You can leave now" above the card. |

## Delete community `/c/[id]/delete` (4)
| # | Scenario | Status |
|---|---|---|
| 1 | Empty field | DONE. What will be lost with real counts (members, teams, series, matches, bookings); red button off; "Keep {short name}" and a link to leave instead. |
| 2 | Wrong name | DONE. Error with icon and red ring (after leaving the field, not while typing); the real server message also shows if the server disagrees. |
| 3 | Name typed correctly | DONE. Green tick, "The name matches.", red button on. Same matching rule as the server (case and spaces ignored). |
| 4 | Deleting | DONE. Spinner on the button, double tap blocked. |

## Not changed / notes
- No new server action. New read-only queries in `src/lib/cnData.ts` (live match for the number lock, counts for the delete card). Pure helpers in `src/lib/cn.ts`.
- Old `NumberPicker` (Forms.tsx) and `DeleteCommunityForm` (Forms2.tsx) stay as dead code.
- The PDF's small avatar with initials in the top bar of the entry pages is not built (no avatar there; the shirt rule has no number for a waiting person).
- After deleting, the redirect to `/home` has no message (the action is unchanged).
