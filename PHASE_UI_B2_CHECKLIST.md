# Phase UI, Builder 2: Alerts, Community, Invite friends

Status: DONE = built and checked (tests in `src/components/B2.test.tsx`, plus phone 390 px and desktop 1440 px screenshots of the markup with dummy data). Not run against the real database or a real browser session.

Files: `src/app/c/[id]/alerts|community|invite/page.tsx`, `src/components/AlertsList.tsx`, `InviteBits.tsx`, `CopyButton.tsx`, `B2Icons.tsx`, `b2.css`, `src/lib/alertsUi.ts`, `alertsData.ts`, `communityUi.ts`, `src/app/actionsB2.ts`.

## Alerts (4 scenarios)
| # | Item | Status |
|---|------|--------|
| 1 | Icon tile + text badge per kind (New match, Reminder, Changed, Postponed, Cancelled, Payments, Cost changed, Payment reminder) | DONE |
| 1 | Unread = gold bar + "Unread" label + brighter bold text; day headers Today / Yesterday / Earlier in the viewer's zone | DONE |
| 1 | I'm in / Can't make it on New match and Reminder alerts (only while the match has not started); reply shown | DONE (uses `setAvailability` through new `answerFromAlertAction`, stays on the page) |
| 1 | Kebab per alert (Mark as read, Open match / Open payment), new action `markAlertReadAction` (own alert, this community) | DONE |
| 1 | Filter chips All / Unread / Matches / Payments, Mark all as read (N) | DONE |
| 1 | Cancelled match: no match time line; alert whose match is gone: plain dashed card, no link, "No longer available" | DONE |
| 1 | Desktop summary side card (Frame `panel`, counts per kind, wording) | DONE (shows at 1360 px and up) |
| 1 | Note: only the latest 50 are kept; truthful in-app / no phone push wording | DONE |
| 2 | Empty state with icon, same wording, Back to Home | DONE |
| 3 | After Mark all as read: snackbar "N alerts marked as read" with Undo (new `undoMarkAlertsReadAction`, sets `read_at` null for exactly those ids) | DONE |
| 3 | Read alerts dimmed but keep icon, badge and text | DONE |
| 4 | Unread filter, kebab menu open | DONE |

## Community (5 scenarios)
| # | Item | Status |
|---|------|--------|
| 1 | Hero: logo initials, name, location, description, Invite and Settings (Admin), 24/99, Admins, open requests, my number, progress bar | DONE |
| 1 | Admin tools card: "Admin only" pill, waiting-requests badge, no long title | DONE |
| 1 | Activity timeline with an icon per event kind and date (viewer's zone) | DONE |
| 1 | First 5 members with gold Shirt, Admin badge, Admin kebab (View profile, Make Admin / Take Admin away, Manage member, all links) | DONE |
| 1 | Desktop bento | PARTIAL: two columns inside the 760 px page, not three (Frame is not mine) |
| 1 | Leave community in its own red card with the explanation | DONE |
| 2 | Member view: no Admin card, no Settings, no kebabs, "Your role" stat | DONE |
| 3 | New community: 1 of 99, Invite first, no "See all" (only above 5 members), optional description/location | DONE |
| 4 | Your communities with `CommunityRow` (role, number), Create another / Join another | DONE |
| 5 | Copy: green check "Copied" 1.8 s, failure "Select and copy" kept | DONE |

## Invite friends (7 scenarios)
| # | Item | Status |
|---|------|--------|
| 1 | QR, link and code in field boxes with labelled Copy buttons; large spaced gold code | DONE |
| 1 | Share button (system share sheet, WhatsApp link fallback) | DONE |
| 1 | Joining banner: gold "Approval is on" / blue "Open joining", Change in settings for Admins | DONE |
| 1 | Desktop two columns | DONE |
| 2 | Member: Open joining, no Admin block, Share first | DONE |
| 3 | ?new=1: "Community created", no back arrow, Create / Set up / Invite strip, sticky Go to Home | DONE |
| 4 | Copy success: green check "Copied" | DONE |
| 5 | Copy refused: box gets gold focus ring and is selected, hint "Press and hold the link, choose Select all, then Copy" | DONE |
| 6 | Replace link and code behind a confirm dialog ("Replace link" button, says what stops working) | DONE |
| 7 | After replacing: success snackbar, no Undo | DONE (message shown by the client after the existing `replaceInviteAction` returns, no query param needed) |
