# Phase UI-C, Builder C4: the two "no signal" screens

Files: `src/components/QuickMatchForm.tsx`, `QuickScore.tsx`, `QuickShell.tsx` (new), `qm.css` (new), `src/lib/quickMatchUi.ts` (new), pages `src/app/c/[id]/matches/quick/page.tsx` and `.../quick/score/page.tsx`, tests `src/components/QuickC4.test.tsx` (23 tests). One line changed in the old test `QuickMatch.test.tsx` (see notes).

NOT touched: `CacheRoster`, `outbox.ts`, `quickMatch.ts`, `quickMatchRules.ts`, `public/sw.js`, `PwaShell`, `ScoringPad`, the engine, `Frame`, `globals.css`. The saving code in `start()` (validate, save on phone, send in background, go to the score page) is the same as before.

## Setup `/c/[id]/matches/quick` (10 scenarios)
| # | Scenario | Status |
|---|---|---|
| 1 | Fresh form: blue "Works with no signal" note, "Offline-ready" chip in the top bar, badge + counter team names, overs round buttons, players stepper, 0 / 6 meters, squad chips, shirts + three-way control, summary panel on wide screens | DONE (test + phone and 1440 px screenshots) |
| 2 | Ready to start: both meters green with "Full", guests count toward the limit, note on what Start does | DONE (test, screenshot) |
| 3 | No players saved: red banner, empty list with the fix, guests allowed, Start disabled | DONE (test, screenshot) |
| 4 | Roster older than a week: gold "Players saved N days ago" note | DONE (test, screenshot) |
| 5 | Team name errors (same, empty, 1 letter, over 40), counter and live badge | DONE (test, screenshot) |
| 6 | Overs and players-per-side errors beside the controls | DONE (test) |
| 7 | Lineup errors: meter 7 / 6 red with "Over by 1", messages under the meters, cleared live when fixed | DONE (test, screenshot) |
| 8 | Guest field: empty, too long (counter 74/60), duplicate; list with grey shirt; Remove with Undo snackbar | DONE (test, screenshot) |
| 9 | Squads as one-tap chips (stops when side full, message of how many fitted) | DONE with a decision, see notes |
| 10 | "Saving…" and storage full ("This phone could not save the match. Free some space and try again. Nothing was started."), typed data kept | DONE (tests for both) |
| NEW | Stale roster warning, live meters, summary panel, Undo for guests | DONE |
| Extra | Player search and "Picked only" (the PDF lists "no search" as a problem but its mock-ups do not draw one) | DONE, small addition, only shown with more than 6 players |

## Score entry `/c/[id]/matches/quick/score?m=…` (5 scenarios)
| # | Scenario | Status |
|---|---|---|
| 1 | Loading: branded card, skeleton, "Reading from this phone" (also the page's Suspense fallback) | DONE (test, screenshot) |
| 2 | Not saved on this phone: reason sentence and both actions in one card | DONE (test, screenshot) |
| 3 | On the server, nothing waiting: green tick, sentence, "Open the match" | DONE (test, screenshot) |
| 4 | Ready, not on the server: "Saved on phone" chip + blue banner above the pad (no longer fixed over it), count of balls waiting (NEW), chip changes to "On the server" when the 3 s check sees it synced | DONE (test, screenshot) |
| 5 | Refused: red "Not accepted" chip, headline with the server's reason, "Your balls are safe on this phone", "What can I do?" help (NEW) | DONE (test, screenshot). The help is guidance only: no retry exists in the sync code and none was added |

## Offline: what was and was NOT tested
Tested (jsdom + fake IndexedDB, `navigator.onLine = false`, `fetch` replaced by a stub that throws and is asserted NEVER called): rendering of every state of both screens, picking players, guests, saving the match on the phone, opening the score screen from the phone's storage, the 3 s status check. The old test (`QuickMatch.test.tsx`) still proves the offline-then-online sync order (match created first, then balls) and the refused path.
NOT tested: the real service worker and airplane mode in a real browser (needs `next build`, which the brief forbids). Not tested: that `qm.css` ends up in the CSS file the service worker prefetches (it is imported from client and server components of these two pages like `b4.css` is for other pages, so it is in the page's own `<link>`; please confirm in the lead's production build by loading both pages once, going offline and reloading). Screenshots use system fonts (no Jakarta font in the harness).

## Notes and decisions
- Frame is NOT used on these pages. Phase B `Frame` adds a bell and sidebar data (name, role, unread count, community list) rendered by the server inside Suspense. That does not stop the page working, but it puts a signed-in person's data inside the HTML copy that the service worker keeps for these two pages (whose comment says they carry no private data) and adds server work to a page that must open fast on a weak signal. `QuickShell` gives the same top bar, bottom bar, rail and sidebar with no server slots (no bell, no switcher, no name in the sidebar foot). The score page has no frame at all (as before). If the lead prefers the full Frame, change one line in `quick/page.tsx`.
- Squad chips: a chip whose team name equals a side name fills that side at once; otherwise a small "Add X to: Team 1 / Team 2 / Cancel" row asks (two taps), so no capability of the old two buttons is lost.
- Roster age: the "Players last updated" time is drawn after the first paint (was a possible server/phone mismatch). Online with an older phone copy, the phone copy still wins (unchanged roster caching), so the stale note can show even when the server copy is fresh. Left as is on purpose.
- Existing test change: `QuickMatch.test.tsx` line 110 `/works with no signal/` became `/works with no signal/i` because the PDF headline is "Works with no signal" (capital W). Nothing else changed.
- Players per side is a number box with minus and plus buttons; the overs are round buttons plus Custom (custom box appears only then).
- Score screen: the pad's own header (back, title, status) stays below my status strip, so the title is not repeated in the strip.
- Not built: the PDF's desktop side panel for the score screen (the pad is another part's screen and stays a 480 px column).
