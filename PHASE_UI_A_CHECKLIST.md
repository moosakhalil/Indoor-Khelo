# UI redesign, Phase A (Foundations) checklist

Status: ✅ built and checked by tests or a rendered preview · 🟡 built, needs a real phone check · ⏳ not built
Source: `Indoor_Khelo_UI_Implementation_Plan.md` (phase A) and `Indoor_Khelo_UI_Redesign_Proposal.pdf` (Part 4 and Part 1).

| Requirement | Status | Notes |
|---|---|---|
| Stepped dark surfaces added as variables (`--s0` to `--s3`, `--glass`), old variables and class names kept | ✅ | `globals.css`. Brand colours unchanged. Every existing page keeps working. |
| Condensed score font Barlow Semi Condensed (decided 2026-11-24) | 🟡 | Loaded with next/font in `layout.tsx` as `--font-score`; used on the live score now (`.live-score`, `.score-num`). Needs one look in the real app because the preview used the Google font link. |
| Glass blur on the top bar and the navigation only, solid fallback (decided 2026-11-24) | 🟡 | `backdrop-filter` inside `@supports`; no blur behind buttons or text fields. Top bar is now sticky. Check on a real iPhone and Android. |
| Shirt kept on every player; big size = number on chest + two initials under it (decided 2026-11-24) | ✅ | `Shirt.tsx`: `size="big"` + `name` shows the initials. Big is 96 px, normal 48 px, small 36 px. Two digits use a smaller font on normal and small. Profile header, member page and player page already pass the name. |
| No number: grey shirt, dash, initials still shown on big | ✅ | Tested. |
| Wide initials (WM) and 99 fit on the shirt | ✅ | Preview checked; a real phone check is still wanted. |
| `TeamBadge`: initials on a colour from the team name, never a shirt | ✅ | `TeamBadge.tsx`. No database change, no upload. Eight colours, all with text contrast of 4.5 or more (a test caught one red that was 3.9 and it was changed). Not used on pages yet: Phase B and D switch teams over. |
| `ActionMenu` (three dots): links and buttons, danger item, disabled item with a reason, Escape, arrow keys, tap outside | ✅ | `ActionMenu.tsx`. Not used on pages yet (Phase B onward). |
| `ConfirmDialog`: plain and typed-name, focus kept inside, Cancel focused first on plain, Escape cancels, Enter cannot confirm a wrong name | ✅ | `ConfirmDialog.tsx`. Typed name ignores case and extra spaces. |
| `Snackbar` with Undo: the real delete waits 6 seconds in the browser, Undo cancels it, a new message or leaving the page finishes it, announced politely to screen readers | ✅ | `Snackbar.tsx`, provider is in the root layout. No database change. |
| Adaptive shell: bottom bar (phone), rail (640 px), sidebar (1024 px), optional side panel (1360 px) | ✅ | `Frame.tsx`, `BottomNav.tsx`, `globals.css`. Checked in a rendered preview at 390, 820 and 1440 px. The side panel is optional and empty until later phases use it. |
| Sidebar extras: app name, "More" list (Community, Series, Leaderboard, Alerts) and Switch community | ✅ | Static links, no extra database work on any page. The sidebar does not show the community name yet (needs data on every page; planned for Phase B). |
| Same five labelled tabs on every size, never an icon alone | ✅ | Tested. |
| Pages without the navigation (sign-in, create, join, scoring pad) are unchanged | ✅ | They do not use `Frame`; the `.app` rules for them were not changed. |
| 231 earlier tests still pass | 🟡 | See the run recorded below. |
| 32 new tests for Phase A | ✅ | `src/components/UiFoundations.test.tsx`. |
| `tsc --noEmit` clean | ✅ | |

## Decisions applied
Glass blur yes · Barlow Semi Condensed yes · any approved member may delete or correct a match (no change to who can) · create match in 4 steps (Phase C) · shirt rule locked.

## Not in Phase A (on purpose)
Switching individual screens to the new parts (Phase B onward), the community name in the sidebar, light theme, swipe actions.
