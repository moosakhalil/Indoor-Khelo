# UI redesign, Builder 3: Members, Manage member, Join requests, Community settings

Status words: DONE = built and checked (unit tests in `src/components/B3.test.tsx` and `src/lib/b3.test.ts`, plus a screenshot at phone 390 px and desktop 1440 px). NOT DONE = reason given.
Nothing was run against the real database; the new server actions are thin wrappers of the existing rules (see the end).

## Members `/c/[id]/members` (7 scenarios)
| # | Scenario | Status |
|---|---|---|
| 1 | Admin: all members, one with a freed number (grey shirt) | DONE. Gold `Shirt` with the number, name, Admin badge, playing-role tag, role chips and sort, count line, kebab per row. The freed-number person is now listed (new query `listAllApprovedMembers`; the old query hid them) with a grey shirt and "Choosing a new number". Desktop side panel: NOT DONE (see below). |
| 2 | Member (not Admin): same list, no manage footnote | DONE. Chevron instead of the menu; filters and search for everyone. |
| 3 | Search "ha" | DONE. Name substring, result count and an x button. |
| 4 | Search "7": only number 7 | DONE. Number match is exact; empty text says "name or exact player number". |
| 5 | Search with no result | DONE. "No one matches" card with a Clear search button. |
| 6 | Admins filter | DONE. Solid gold active chip, `aria-pressed`. |
| 7 | Admin opens the row menu | DONE. `ActionMenu`: View profile, Make Admin / Take Admin away, Ask for a new number, Remove (red). They link to the Manage page with `?do=role|number|remove`. |
| new | Invite button in the top bar | DONE |
| new | Desktop list plus selected-member panel (1360 px) | NOT DONE. The panel prop belongs to the server page and the selection is client state; tapping a row still opens the player page. |

## Manage member `/c/[id]/members/[userId]` (12 scenarios)
| # | Scenario | Status |
|---|---|---|
| 1 | Another member: header and three cards | DONE. Big shirt with initials, role and number tags, View player profile, Admin role / Player number / Remove cards, each with one line. The `<details>` expander is gone. |
| 2 | Another Admin: Remove disabled with the reason | DONE ("Hamza is an Admin. Take Admin away first."). |
| 3 | Remove confirmation | DONE. `ConfirmDialog` names the person, the community and the number; button "Remove Bilal". |
| 4 | Ask for a new number confirmation | DONE. Names the consequence; button "Ask for a new number". |
| 5 | After freeing the number (`?done=number`) | DONE. Green banner with headline; number card says nothing to reset. Also shown right after the action without a reload. |
| 6 | After Make Admin | DONE. Message with Undo (Undo calls the opposite action). Take Admin away also has Undo. |
| 7 | Own page, only Admin (last_admin) | DONE. Take Admin away disabled with the reason; banner offers "Choose an Admin"; own page shows a Leaving card pointing to Community instead of Remove. Taking your own Admin away (when others exist) asks first and has no Undo, because you lose access. |
| 8 | Error is_admin | DONE. Banner with a "Take Admin away" button. |
| 9 | Error not_found | DONE. Headline "Member not found" then the reason. |
| 10 | Error forbidden | DONE. Same banner pattern. |
| 11 | Error no_change | DONE. Neutral (grey) banner, not red. |
| 12 | Member who has not chosen a number | DONE. Dashed grey shirt, "Choosing a new number", number card says nothing to reset. |
| - | is_self error | DONE (same banner pattern). |
| - | Permissions and redirects | Kept: `requireAdmin`, uuid check, `notFound` for non-approved. The actions repeat the Admin check. |

## Join requests `/c/[id]/requests` (6 scenarios)
| # | Scenario | Status |
|---|---|---|
| 1 | Several waiting | DONE. Oldest first, "Asked 2 h ago" from `requested_at` (no schema change), Approve (solid green, 48 px) and Reject (outline), places left. The grey shirt and the repeated "Number chosen after approval" are gone; it is said once in a note and in "What happens next". Initials circle, not a shirt, because these people are not players yet and have no number. |
| 2 | One request | DONE. No Select / Approve all bar. |
| 3 | Empty | DONE. "No one is waiting" and an Invite friends button. |
| 4 | Select mode | DONE. Tick people, "Approve 2" counts them; both bulk buttons open a confirm box first. |
| 5 | After Approve | DONE. Message "Zeeshan Anwar approved. They choose a player number next." |
| 6 | After Reject | DONE. Message with Undo. The existing code could not re-open a request, so a small new function `reopenRequest` (`src/lib/b3Data.ts`) sets a rejected request back to pending (keeps `requested_at`, writes an audit entry `request_reopened`, Admin only). |
| new | Places left / "What happens next" | DONE. Side panel at 1360 px, below the list on a phone. Approve is disabled when 99 members are reached; bulk is disabled when more people are picked than places left. |

## Community settings `/c/[id]/settings` (8 scenarios)
| # | Scenario | Status |
|---|---|---|
| 1 | Filled form, approval on, danger zone | DONE. Identity and Joining cards, counters 60/80/300, Save bar, red Danger zone card (still opens the type-the-name delete page), History, live Preview (side panel at 1360 px, below on a phone). |
| 2 | Approval off | DONE. Result line changes; gold "Open joining" banner. |
| 3 | Edited, not saved | DONE. Gold ring on changed fields, live preview, Save and Discard on. |
| 4 | Validation: name empty or 1 letter | DONE. Server text with icon and red ring; Save stays on; focus goes to the name; editing clears the error. |
| 5 | Fields at their limits | DONE. Orange counters from 80% (the browser `maxlength` stays as a safety net). |
| 6 | Saving... | DONE. Button reads "Saving…", values stay. |
| 7 | Saved | DONE. Green "Saved / Everyone now sees the new details"; Save goes back to disabled. |
| 8 | Error: only an Admin can change the settings | DONE. Titled red banner "Could not save". |

## Files
- Pages: `src/app/c/[id]/members/page.tsx`, `members/[userId]/page.tsx`, `requests/page.tsx`, `settings/page.tsx`
- Components: `MembersList.tsx` (rewritten), `ManageMember.tsx`, `RequestsList.tsx`, `SettingsB3.tsx`, `B3Icons.tsx`, `b3.css` (prefixes `mb-`, `rq-`, `st-`, `b3-`)
- Logic: `src/lib/b3.ts` (pure rules), `src/lib/b3Data.ts` (member list incl. no-number people, admin count, reopen request), `src/app/actionsB3.ts` (answers with the outcome instead of redirecting)
- Tests: `src/components/B3.test.tsx` (43), `src/lib/b3.test.ts` (7)
- `SettingsForm` in `Forms2.tsx` is no longer used by the settings page (left untouched, not mine).

## Not verified
- The new server actions and `reopenRequest` were not run against the database (only the UI side is tested with the actions mocked). They call the same `setRole`, `removeMember`, `resetNumber`, `decideRequest` as before.
- The three-dots menu open state, dialogs and snackbars were checked in tests (jsdom), not in a screenshot of a real browser.
