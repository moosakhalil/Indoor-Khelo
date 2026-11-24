# Phase UI-B, Builder 1: Home screen and shell (prefix `hm-`)

Status: DONE = built, covered by tests in `src/components/B1Home.test.tsx` and looked at in screenshots (phone 390, tablet 820, desktop 1440). Nothing was run against the real database or `next build` (the lead does that).

## Files
- `src/app/c/[id]/page.tsx` (loads data, builds the page), `src/components/HomeView.tsx`, `HomeParts.tsx`, `ReplyBox.tsx`, `OfflineBanner.tsx`, `HmIcons.tsx`, `home.css`
- `src/lib/scoreLine.ts` (read-only score summary from the engine), `src/lib/shellData.ts` (cached shell queries)
- `src/components/Frame.tsx`, `BottomNav.tsx`, `ShellParts.tsx`, `CommunitySwitcher.tsx`, `shell.css`
- Test: `src/components/B1Home.test.tsx` (44 tests). One existing test line changed: `UiFoundations.test.tsx` (sidebar list now also has Insights and Members).

## Home scenarios
| # | Scenario | Status |
|---|---|---|
| 1 | Admin: live match, next match not answered, 3 requests, 2 alerts, 3 results | DONE. Banners with Review / Open buttons, broadcast score bug (badges, score, overs, chase line, Watch and Score), next-match card with "Reply needed" and two reply buttons, quick actions, results with both scores and a kebab, community card, link list, floating New match on phones. |
| 2 | Member: answered "You are in", 5 alerts, no live, no Admin cards | DONE. Green row with check and Change; no join-request banner or row; "5 new alerts" with Open; Quick actions "Start scoring" for the next match; "Your number" without Admin wording. |
| 3 | "You are out" | DONE. Neutral row with a close icon, Change button; results carry both scores. |
| 4 | No reply yet | DONE. "Reply needed" badge, "I'm in" (green) and "Can't make it", both team badges, venue and time. |
| 5 | Match day, lineups filled | DONE. Readable lists, medium shirt per player, count badge, gold ring on own team's badge (own side found from the lineup), gold Start scoring, secondary Pick lineups and Toss the coin with icons. |
| 6 | Match day, no lineups | DONE. "No lineup yet" with a "Pick lineup" button per side, count 0. |
| 7 | Live match, no next match | DONE. Score bug leads; no "No match planned" box; New match lives in Quick actions. |
| 8 | Brand-new community | DONE. "No match planned yet" with gold New match; Start scoring disabled with "Create a match first" underneath; "No results yet" panel. |
| 9 | 1 request, 1 alert, no results | DONE. Singular wording kept ("1 join request", "1 new alert", "1 player"). |
| 10 | Offline | DONE. Calm blue banner, gold "New match with no signal" (QuickMatchLink, unchanged), sentence that players are saved on the phone. `CacheRoster` still mounted. |
| 11 | Community switcher from the top bar | DONE. Tap the community name: phone bottom sheet, popover on 640 px and up. Rows via `CommunityRow` (role, number, members, Current), "In this community" grid, Create another, Join another. |

Kept behaviours: today = viewer's time zone, `liveMatch`, `nextMatch`, `recentResults(3)`, `rosterFor`, member cap (99), alert and request counts, all links of the old page.

## Shell
| Item | Status |
|---|---|
| Alerts bell with unread count in the sticky top bar of every Frame page (async server child, `getSessionUser()` without redirect, Suspense, text label, nothing when signed out) | DONE |
| Community switcher in the Home top bar (phone sheet, popover on wider screens, Escape/close/backdrop, focus trap, returns focus) | DONE |
| Sidebar (1024 px+): community name with the same switcher entry | DONE |
| Sidebar foot: your name, role and number (small shirt) | DONE (extra) |
| Sub-pages (Members, Alerts, Community, Invite, Requests, Settings) keep Home lit | DONE |
| Live dot on the Matches tab (word stays) | DONE |
| Red count beside Alerts in the sidebar "More" list; Insights and Members added to it | DONE |
| Frame: optional `subtitle` prop; existing props unchanged | DONE |
| Alerts entry with count on the tablet rail | NOT DONE: the rail only shows the five tabs; the bell in the top bar covers alerts on every width |
| Floating, taller glass tab bar (52 px) | NOT DONE: not in the assignment, `globals.css` owns `.nav` |
| Waiting (pending) communities in the switcher with a "Waiting" badge | NOT DONE: the brief says approved only; `/switch/[id]` already accepts pending |

## Open points
- Watch and Score both open `/matches/{id}/score` (that page already shows the pad to the scorer and the live view to everyone else).
- Results "share action" (scenario 3): the kebab has Open report and View PDF; sharing stays on the report page.
- "Updates every 5 s" from the proposed live card is not shown (Home does not auto refresh).
- Desktop uses the 760 px page column plus the 1360 px Community panel (card and links); a full three-column bento is not built.
