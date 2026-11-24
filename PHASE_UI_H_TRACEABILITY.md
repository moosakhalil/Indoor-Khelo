# Phase UI-H traceability: UI Redesign Proposal PDF v. what is built

Written 2026-11-24 by Builder H2. No code was changed. Sources read: `Indoor_Khelo_UI_Redesign_Proposal.pdf` (text extracted with pymupdf), `Indoor_Khelo_UI_Implementation_Plan.md`, all 23 `PHASE_UI_*_CHECKLIST.md`, and `src/app`, `src/components`, `src/lib` (file existence and the specific greps named below).

## 0. Read this first

- **Statuses are copied from the builders' checklists, not re-proven.** DONE in a checklist means: covered by a jsdom test and/or a screenshot of the markup with dummy data. Almost no screen was run against the real database, real Google sign-in, a real browser session or a real phone (section 4). So DONE here means "built and checked in a simulated way", not "proven in use".
- **Scenario counts are verified against the PDF.** The PDF coverage checklist (printed pages 1003-1006) lists 78 screens that add up to 607. The nine group overview pages give the same 78 numbers (66+74+86+76+109+32+54+69+41 = 607). For every item the pages "scenario k of N" were counted in the PDF text and each item has all N. The PDF file has 1006 pages, not 1007.
- **How a scenario was counted.** DONE = the checklist status for that scenario says DONE (or ✅). PARTIAL = the status says PARTIAL, or one row of that scenario is marked PARTIAL. NOT DONE = the status says NOT DONE. `*` (inside the DONE column) = the checklist says DONE but its own text names a sub-feature that was not built (for example the desktop side panel); these are listed in section 3. `†` = G1 describes the scenario as built in prose and gives no status word. "Not stated" = the checklist gives no per-scenario status at all.
- **Plan page numbers are unreliable.** The plan's "PDF page" column is shifted by one item from Phase B onward (for example Matches list is printed p. 230 in the PDF contents; the plan says 229 and gives Create match 230). The page numbers below are the printed numbers from the PDF contents list.
- **Two overlaps in the PDF are built once.** Item 35 (No-signal score entry, 5) is the same screen as the last five scenarios of item 49; item 38 (Live view and gate, 14) covers the first nine scenarios of item 48. The builders built them once (C4, D2) and E1 says so. Both copies are counted because the PDF counts both.

## 1. Matrix of all 78 PDF items

Items are grouped by the plan's phases. PDF scen. = verified count. Code = the route's `page.tsx` (or the component for non-route items) exists in `src/`.

### Phase A: Foundations

| # | Item | Route | PDF p. | PDF scen. | DONE (`*`) | PARTIAL | NOT DONE | Not stated | Checklist | Code |
|---|---|---|---|---|---|---|---|---|---|---|
| 26 | Shared page frame and small components | `(components used on many pages)` | 220 | 7 | 0 | 0 | 0 | 7 | A (+B1, B2, C4 touch parts); no per-scenario list | Frame.tsx, CopyButton.tsx, QrCode.tsx, AutoRefresh.tsx, CacheRoster.tsx, CommunityLogo.tsx: yes |
| 25 | Bottom navigation and community switcher | `(every /c/[id]/... page)` | 211 | 7 | 0 | 0 | 0 | 7 | A + B1 (shell table); no per-scenario list | BottomNav.tsx, ShellParts.tsx, CommunitySwitcher.tsx, Frame.tsx: yes |
| 16 | App banners: offline, new version, install | `(root layout)` | 103 | 6 | 6 | 0 | 0 | 0 | G3 (summary line: all 6 DONE) | PwaShell.tsx mounted in app/layout.tsx: yes |
| 75 | Shirt (jersey) and player-number component | `src/components/Shirt.tsx` | 953 | 2 | 0 | 0 | 0 | 2 | A (rows on Shirt sizes, no-number, wide initials all marked done) | Shirt.tsx: yes |
| | **Total A** | | | **22** | **6** | **0** | **0** | **16** | 4 items | |

### Phase B: Home, lists, teams

| # | Item | Route | PDF p. | PDF scen. | DONE (`*`) | PARTIAL | NOT DONE | Not stated | Checklist | Code |
|---|---|---|---|---|---|---|---|---|---|---|
| 17 | Home | `/c/[id]` | 112 | 11 | 11 | 0 | 0 | 0 | B1 | page.tsx: yes |
| 18 | Alerts | `/c/[id]/alerts` | 135 | 4 | 4 | 0 | 0 | 0 | B2 | page.tsx: yes |
| 19 | Community | `/c/[id]/community` | 142 | 5 | 4 | 1 | 0 | 0 | B2 | page.tsx: yes |
| 20 | Invite friends | `/c/[id]/invite` | 153 | 7 | 7 | 0 | 0 | 0 | B2 | page.tsx: yes |
| 21 | Members | `/c/[id]/members` | 163 | 7 | 7 (1*) | 0 | 0 | 0 | B3 | page.tsx: yes |
| 22 | Manage member | `/c/[id]/members/[userId]` | 175 | 12 | 12 | 0 | 0 | 0 | B3 | page.tsx: yes |
| 23 | Join requests | `/c/[id]/requests` | 189 | 6 | 6 | 0 | 0 | 0 | B3 | page.tsx: yes |
| 24 | Community settings | `/c/[id]/settings` | 197 | 8 | 8 | 0 | 0 | 0 | B3 | page.tsx: yes |
| 27 | Matches list | `/c/[id]/matches` | 230 | 8 | 8 (1*) | 0 | 0 | 0 | B4 | page.tsx: yes |
| 50 | Teams list | `/c/[id]/teams` | 664 | 5 | 5 (1*) | 0 | 0 | 0 | B4 | page.tsx: yes |
| 51 | New team | `/c/[id]/teams/new` | 671 | 5 | 5 | 0 | 0 | 0 | B4 | page.tsx: yes |
| 52 | Team page | `/c/[id]/teams/[teamId]` | 677 | 8 | 8 (1*) | 0 | 0 | 0 | B4 | page.tsx: yes |
| 53 | Edit team | `/c/[id]/teams/[teamId]/edit` | 691 | 8 | 8 (1*) | 0 | 0 | 0 | B4 | page.tsx: yes |
| 54 | Edit squad | `/c/[id]/teams/[teamId]/squad` | 703 | 6 | 6 | 0 | 0 | 0 | B4 | page.tsx: yes |
| | **Total B** | | | **100** | **99** (5*) | **1** | **0** | **0** | 14 items | |

### Phase C: Create and plan

| # | Item | Route | PDF p. | PDF scen. | DONE (`*`) | PARTIAL | NOT DONE | Not stated | Checklist | Code |
|---|---|---|---|---|---|---|---|---|---|---|
| 28 | Create match (4-step wizard) | `/c/[id]/matches/new` | 242 | 15 | 15 | 0 | 0 | 0 | C1 | page.tsx: yes |
| 29 | Plan several matches | `/c/[id]/matches/several` | 266 | 7 | 7 | 0 | 0 | 0 | C2 | page.tsx: yes |
| 30 | Edit, postpone, cancel, delete match | `/c/[id]/matches/[matchId]/edit` | 284 | 13 | 11 (1*) | 2 | 0 | 0 | C1 | page.tsx: yes |
| 31 | Pick lineups | `/c/[id]/matches/[matchId]/lineup` | 312 | 8 | 8 (1*) | 0 | 0 | 0 | C3 | page.tsx: yes |
| 32 | Rematch | `/c/[id]/matches/[matchId]/rematch` | 336 | 10 | 9 | 0 | 1 | 0 | C2 | page.tsx: yes |
| 33 | Correct a finished match (one ball) | `/c/[id]/matches/[matchId]/correct` | 348 | 10 | 9 | 0 | 1 | 0 | C3 | page.tsx: yes |
| 34 | New match with no signal | `/c/[id]/matches/quick` | 367 | 10 | 10 | 0 | 0 | 0 | C4 | page.tsx: yes |
| 35 | No-signal match: score entry | `/c/[id]/matches/quick/score` | 394 | 5 | 5 | 0 | 0 | 0 | C4 | page.tsx: yes |
| | **Total C** | | | **78** | **74** (2*) | **2** | **2** | **0** | 8 items | |

### Phase D: Live view, report, PDF

| # | Item | Route | PDF p. | PDF scen. | DONE (`*`) | PARTIAL | NOT DONE | Not stated | Checklist | Code |
|---|---|---|---|---|---|---|---|---|---|---|
| 36 | Match details | `/c/[id]/matches/[matchId]` | 401 | 15 | 14 | 1 | 0 | 0 | D1 | page.tsx: yes |
| 37 | Coin toss and batting order | `/c/[id]/matches/[matchId]#toss` | 434 | 9 | 9 | 0 | 0 | 0 | D1 | MatchToss.tsx inside match page: yes |
| 38 | Live view and take-over gate | `/c/[id]/matches/[matchId]/score (non-scorer)` | 445 | 14 | 14 | 0 | 0 | 0 | D2 | score/page.tsx + LiveView.tsx, ScoreGate.tsx: yes |
| 39 | Match report (member) | `/c/[id]/matches/[matchId]/report` | 465 | 18 | 18 | 0 | 0 | 0 | D3 | page.tsx: yes |
| 40 | Match PDF | `/api/matches/[matchId]/pdf, /r/[token]/pdf` | 505 | 4 | 3 | 1 | 0 | 0 | D4 | both route.ts + lib/reportPdf.ts: yes |
| 41 | PDF actions: View, Download, Share | `components/PdfActions.tsx` | 511 | 9 | 9 | 0 | 0 | 0 | D4 | PdfActions.tsx: yes |
| 42 | Shared match report (public link) | `/r/[token]` | 522 | 7 | 7 | 0 | 0 | 0 | D3 | page.tsx + not-found.tsx: yes |
| | **Total D** | | | **76** | **74** | **2** | **0** | **0** | 7 items | |

### Phase E: Scoring pad

| # | Item | Route | PDF p. | PDF scen. | DONE (`*`) | PARTIAL | NOT DONE | Not stated | Checklist | Code |
|---|---|---|---|---|---|---|---|---|---|---|
| 43 | Pad: core states | `/c/[id]/matches/[matchId]/score` | 540 | 18 | 8 | 10 | 0 | 0 | E1 (guide sheet and scorecard sheet are E2's files) | score/page.tsx, ScoringPad.tsx, PadBoard.tsx, PadKeypad.tsx: yes |
| 44 | Pad: start, innings break, super over, finish | `same` | 560 | 13 | 8 | 5 | 0 | 0 | E1 | ScoringPad.tsx, PadStart.tsx: yes |
| 45 | Pad: wicket sheets and byes | `same` | 575 | 14 | 14 (1*) | 0 | 0 | 0 | E2 | PadSheets.tsx: yes |
| 46 | Pad: batter, bowler and player sheets | `same` | 591 | 17 | 16 | 1 | 0 | 0 | E2 | PadSheets.tsx: yes |
| 47 | Pad: More menu and its sheets | `same` | 610 | 18 | 18 (2*) | 0 | 0 | 0 | E1 (1-3, 17-18) + E2 (4-16) | PadMore.tsx, PadSheets.tsx: yes (PadRelease.tsx exists but is not used) |
| 48 | Scoring lock, take-over, read-only watchers | `same` | 630 | 14 | 14 | 0 | 0 | 0 | E1 (10-14) + D2 (1-9, by E1's own statement) | ScoreGate.tsx, LiveView.tsx, ScoringPad.tsx: yes |
| 49 | Pad: offline queue, sync states, offline matches | `same + /matches/quick/score` | 646 | 15 | 11 | 4 | 0 | 0 | E1 (1-10) + C4 (11-15) | ScoringPad.tsx, PadStatus.tsx, QuickScore.tsx: yes |
| | **Total E** | | | **109** | **89** (3*) | **20** | **0** | **0** | 7 items | |

### Phase F: Series, leaderboards, payments, players

| # | Item | Route | PDF p. | PDF scen. | DONE (`*`) | PARTIAL | NOT DONE | Not stated | Checklist | Code |
|---|---|---|---|---|---|---|---|---|---|---|
| 55 | Series list | `/c/[id]/series` | 718 | 4 | 4 | 0 | 0 | 0 | F1 | page.tsx: yes |
| 56 | New series | `/c/[id]/series/new` | 723 | 8 | 8 | 0 | 0 | 0 | F1 | page.tsx: yes |
| 57 | Series page | `/c/[id]/series/[seriesId]` | 740 | 10 | 10 | 0 | 0 | 0 | F1 | page.tsx: yes |
| 58 | Add matches to a series | `/c/[id]/series/[seriesId]/add` | 759 | 5 | 5 | 0 | 0 | 0 | F1 | page.tsx: yes |
| 59 | Edit series | `/c/[id]/series/[seriesId]/edit` | 769 | 4 | 4 | 0 | 0 | 0 | F1 | page.tsx: yes |
| 60 | Leaderboard | `/c/[id]/leaderboard` | 778 | 12 | 12 | 0 | 0 | 0 | F2 | page.tsx: yes |
| 61 | Compare players | `/c/[id]/compare` | 803 | 5 | 5 | 0 | 0 | 0 | F2 | page.tsx: yes |
| 62 | Insights | `/c/[id]/insights` | 811 | 6 | 6 | 0 | 0 | 0 | F2 | page.tsx: yes |
| 63 | Payments home | `/c/[id]/payments` | 821 | 4 | 4 | 0 | 0 | 0 | F3 | page.tsx: yes |
| 64 | New booking | `/c/[id]/payments/new` | 826 | 6 | 6 | 0 | 0 | 0 | F3 | page.tsx: yes |
| 65 | Venues | `/c/[id]/payments/venues` | 838 | 5 | 5 | 0 | 0 | 0 | F3 | page.tsx: yes |
| 66 | Venue (edit / delete) | `/c/[id]/payments/venues/[venueId]` | 844 | 5 | 4 | 1 | 0 | 0 | F3 | page.tsx: yes |
| 67 | Booking and split | `/c/[id]/payments/[bookingId]` | 850 | 27 | 26 | 0 | 1 | 0 | F4 | page.tsx: yes |
| 68 | Edit booking | `/c/[id]/payments/[bookingId]/edit` | 895 | 5 | 5 | 0 | 0 | 0 | F3 | page.tsx: yes |
| 69 | Who shares the cost | `/c/[id]/payments/[bookingId]/share` | 905 | 4 | 4 | 0 | 0 | 0 | F4 | page.tsx: yes |
| 70 | Link matches to a booking | `/c/[id]/payments/[bookingId]/link` | 914 | 3 | 3 | 0 | 0 | 0 | F4 | page.tsx: yes |
| 71 | Edit a payment record | `/c/[id]/payments/[bookingId]/pay/[paymentId]` | 918 | 7 | 7 | 0 | 0 | 0 | F4 | page.tsx: yes |
| 72 | My payments | `/c/[id]/profile/payments` | 927 | 3 | 3 | 0 | 0 | 0 | F4 | page.tsx: yes |
| 73 | My profile | `/c/[id]/profile` | 932 | 6 | 6 | 0 | 0 | 0 | F5 | page.tsx: yes |
| 74 | Edit my profile | `/c/[id]/profile/edit` | 944 | 7 | 7 | 0 | 0 | 0 | F5 | page.tsx: yes |
| 76 | Player page (stats) | `/c/[id]/players/[userId]` | 956 | 13 | 13 | 0 | 0 | 0 | F5 | page.tsx: yes |
| 77 | Player analytics | `/c/[id]/players/[userId]/analytics` | 983 | 9 | 9 | 0 | 0 | 0 | F2 | page.tsx: yes |
| | **Total F** | | | **158** | **156** | **1** | **1** | **0** | 22 items | |

### Phase G: Entry and public

| # | Item | Route | PDF p. | PDF scen. | DONE (`*`) | PARTIAL | NOT DONE | Not stated | Checklist | Code |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Welcome and sign in | `/` | 21 | 4 | 4 | 0 | 0 | 0 | G1 (prose, no status words) † | page.tsx: yes |
| 2 | Terms and privacy | `/terms` | 26 | 3 | 3 | 0 | 0 | 0 | G1 † | page.tsx: yes |
| 3 | Create or join | `/choose` | 30 | 3 | 3 | 0 | 0 | 0 | G1 † | page.tsx: yes |
| 4 | Create a community | `/create` | 34 | 4 | 4 | 0 | 0 | 0 | G1 † | page.tsx: yes |
| 5 | Join (link or code) | `/join` | 39 | 3 | 3 | 0 | 0 | 0 | G1 † | page.tsx: yes |
| 6 | Invite preview and join | `/join/[code]` | 43 | 9 | 9 | 0 | 0 | 0 | G1 † ("1 to 9 as in the index") | page.tsx: yes |
| 7 | Routing redirects | `/home, /profile, /switch/[id]` | 54 | 2 | 2 | 0 | 0 | 0 | G1 † (scenario 1 is a code comment only; 2 is a loading screen) | home/page.tsx, profile/page.tsx, switch/[id]/route.ts, loading.tsx x2: yes |
| 8 | Your communities (switcher) | `/switch` | 57 | 2 | 2 | 0 | 0 | 0 | G1 † | page.tsx: yes |
| 9 | Waiting for approval | `/c/[id]/waiting` | 60 | 3 | 3 | 0 | 0 | 0 | G2 | page.tsx: yes |
| 10 | Pick or change player number | `/c/[id]/number` | 64 | 7 | 7 | 0 | 0 | 0 | G2 | page.tsx: yes |
| 11 | Player numbers (Admin) | `/c/[id]/numbers` | 76 | 2 | 2 | 0 | 0 | 0 | G2 | page.tsx: yes |
| 12 | Leave community | `/c/[id]/leave` | 80 | 4 | 4 | 0 | 0 | 0 | G2 | page.tsx: yes |
| 13 | Delete community (type the name) | `/c/[id]/delete` | 85 | 4 | 4 | 0 | 0 | 0 | G2 | page.tsx: yes |
| 14 | Account: log out, delete account | `/account` | 90 | 9 | 9 | 0 | 0 | 0 | G3 (summary line: all 9 DONE) | page.tsx: yes |
| 15 | You are offline | `/offline` | 101 | 1 | 1 | 0 | 0 | 0 | G3 | page.tsx: yes |
| 78 | Public shareable profile | `/p/[token]` | 995 | 4 | 4 | 0 | 0 | 0 | G3 | page.tsx + not-found.tsx: yes |
| | **Total G** | | | **64** | **64** | **0** | **0** | **0** | 16 items | |

### Overall

| Phase | Items | PDF scenarios | DONE | of which `*` | PARTIAL | NOT DONE | Not stated |
|---|---|---|---|---|---|---|---|
| Phase A: Foundations | 4 | 22 | 6 | 0 | 0 | 0 | 16 |
| Phase B: Home, lists, teams | 14 | 100 | 99 | 5 | 1 | 0 | 0 |
| Phase C: Create and plan | 8 | 78 | 74 | 2 | 2 | 2 | 0 |
| Phase D: Live view, report, PDF | 7 | 76 | 74 | 0 | 2 | 0 | 0 |
| Phase E: Scoring pad | 7 | 109 | 89 | 3 | 20 | 0 | 0 |
| Phase F: Series, leaderboards, payments, players | 22 | 158 | 156 | 0 | 1 | 1 | 0 |
| Phase G: Entry and public | 16 | 64 | 64 | 0 | 0 | 0 | 0 |
| **All phases** | **78** | **607** | **562** | **10** | **26** | **3** | **16** |

Against 607: DONE 562 (92.6%), PARTIAL 26, NOT DONE 3, not stated per scenario 16. Of the DONE count, 30 are `†` (G1 prose only), so 532 carry an explicit DONE word.

**After checking the code (section 3):** the two NOT DONE scenarios in Phase C (Rematch 10, Correct 10) are closed by Phase D work (D1 banners on Match details, D3 correction banner and Changes tab), so the standing NOT DONE count is **1** (Booking and split 22, swipe actions). The Phase C Edit scenario 8 (`*`) and most of the PARTIAL Edit scenario 13 are also closed by D1. These are code-checked only; nothing was run.

**Not stated (16 scenarios):** items 25 and 26 (Bottom navigation and switcher 7, Shared frame 7) and item 75 (Shirt 2). Their checklists (A, B1) list requirements, not PDF scenarios. What they say is in section 2.

## 2. Items with no per-scenario checklist, or with count or mapping questions

| Item | What was found |
|---|---|
| 25 Bottom navigation and community switcher (7) | No checklist lists its 7 PDF scenarios. Phase A: adaptive shell (tab bar, rail 640 px, sidebar 1024 px, optional panel 1360 px) ✅ "checked in a rendered preview at 390, 820 and 1440 px"; same five labelled tabs ✅; glass blur 🟡 (needs a real phone). B1 shell table: switcher sheet and popover DONE, sidebar switcher DONE, live dot on Matches DONE; NOT DONE: alerts entry on the tablet rail, floating taller tab bar, waiting communities in the switcher. PDF scenarios 5 (3 communities, 1 waiting) and 6 (one community) are not confirmed one by one. Plan checkbox still `[ ]`. |
| 26 Shared page frame and small components (7) | No checklist lists the 7 scenarios (title bar variants, CopyButton states, QrCode, AutoRefresh visible and offline, QuickMatchLink + CacheRoster, Shirt + CommunityLogo). Evidence by part: Frame subtitle prop and sticky bar (A, B1); CopyButton green "Copied" and "Select and copy" failure (B2, DONE); QuickMatchLink and CacheRoster kept (B1 Home 10, C4); the visible AutoRefresh ("Updates every 5 s") is listed as not shown (B1). Plan checkbox still `[ ]`. |
| 75 Shirt component (2) | Phase A rows: sizes and initials ✅, no-number grey shirt ✅ (tested), wide initials and 99 ✅ (preview; real phone wanted). Not tied to the PDF's 2 scenarios. Plan ticks it `[x]`. |
| 16 App banners (6) | Plan lists it under Phase A; it was built in G3 (summary line only, "test per scenario"). The plan has the item now (it was once missing). |
| 1-8 Entry pages (30) | G1 has no status words and no tables, only prose. All 30 counted as built (`†`), none checked against a status word. Item 7 Routing (2) is a code comment plus a loading screen with no behaviour change, so "built" is thin. |
| 14 Account (9), 15 Offline (1), 16 Banners (6), 78 Public profile (4) | G3 gives one summary line per group ("all DONE", "test per scenario"), not a row per scenario. Counted DONE as stated. |
| 43-49 Scoring pad (109) | Split across E1 (pad core, start/finish, lock on pad, offline, More grid) and E2 (sheets). E1 uses the PDF's scenario numbers. Item 48 scenarios 1-9 and item 49 scenarios 11-15 have no row in E1 or E2; E1 says they are D2's gate page and C4's QuickScore. Counted DONE from D2 (14 of 14 DONE) and C4 (5 of 5 DONE). E1's "1-5" row for the guide is one range row, counted as 5. |
| 47 More menu scenarios 17-18 | E1 says DONE (inline sheet in `ScoringPad.tsx`, new look). E2 says its `PadRelease.tsx` is "BUILT, NOT WIRED". Checked: nothing imports `PadRelease`, so E2's file is dead code and E1's inline sheet is the live one. Counted DONE per E1. |
| Plan table and header | Plan item names and scenario counts for all 78 match the PDF; no item is missing from the plan now. Plan checkboxes for items 25 and 26 are still `[ ]` while the status line says Phase A is built. |
| Count disagreements | None. No checklist lists a different number of scenarios than the PDF for any item (B2 Alerts has 12 rows for 4 scenarios, counted by scenario number). |

## 3. Every PARTIAL and NOT DONE scenario, and every `*` gap, grouped by reason

Reasons: (a) would change behaviour or the engine, or a test that pins today's behaviour, and was deliberately not built; (b) decided not to build by the user or by a locked rule (or a deviation caused by one); (c) needs a real device or real service to build or verify; (d) simply missing or cut for time. "Closed" = a later phase built it (code checked, not run). Gaps inside scenarios marked plain DONE are included where a checklist or the plan names them.

### (a) Would change behaviour or the engine (deliberately not built)

| Item / scenario | What is missing | Checklist | State now |
|---|---|---|---|
| 43 Core 7: first ball of an innings | UNDO is not disabled on the first ball (today Undo takes back the openers). Disabling it would remove a capability. | E1 | Open, needs user decision |
| 43 Core 9: Wide pressed | Guided sheet with preview "Add Wide + 1 (2 runs)" not built; two-tap armed flow kept. | E1 | Open |
| 43 Core 10: No ball pressed | Guided sheet with live summary not built (same reason). | E1 | Open |
| 43 Core 14: Undo toast | Redo and the scorer's name in the toast not built (Redo creates new events). | E1 | Open |
| 44 Start 1: Match start, coin toss | Three separate screens (one task per step) not built; existing tests drive one screen; sticky Start instead. | E1 | Open |
| 44 Start 4: Toss result | "Continue: choose openers" button not built (follows from Start 1). | E1 | Open |
| 44 Start 5: Toss done, openers and bowler | Start button keeps its old name "Start scoring" (a test pins it); the PDF's sentence is shown above it. | E1 | Open |
| 44 Start 13: Finished and locked | Player of the Match preview on the pad not built (the pad must not fetch or compute stats). | E1 | Open |
| 46 Sheets 4: Bowler picked, ready to confirm | Select-then-confirm not built: a tap on an allowed bowler records at once (adds a tap; `ScoringPad.test.tsx` pins it). | E2 | Open, needs decision |
| 47 More 6 and 14 (`*`), 45 Wicket 2 (`*`) | Outcome text as the confirm button not adopted ("Confirm OUT", "Change overs" are pinned by tests; the read-back sentence sits above the button). "Edit this ball" does not prefill from the ball (a bare Save would record something different). | E2 | Open |
| 49 Offline 1 and 4 | Wording "N changes pending" and "Sending 3 changes…" not adopted: `ScoringPad.test.tsx` pins "N balls waiting to sync" and "Syncing…". One function (`statusWording` in `padInfo.ts`) to change. | E1 | Open, lead decision |
| 49 Offline 9: phone could not store the last ball | Red badge on the affected ball is not possible: the pad keeps one yes/no flag, not which ball (outbox untouched by rule). | E1 | Open |
| 60-62, 77 Analytics (inside DONE) | Wagon wheel and phase (powerplay/death) split not built; the PDF itself says the pad does not record them. | F2 | Not buildable without recording more data |

### (b) Decided not to build by the user or by a locked rule

| Item / scenario | What is missing | Checklist | State now |
|---|---|---|---|
| 67 Booking and split 22: swipe actions (NOT DONE) | Swipe gestures not built; the kebab works for everyone. F4 cites "locked rule 5". The plan lists decision 5 (swipe actions) as "Yes, kebab always present ... to confirm", so it is not clearly decided. Flag for the user. | F4 | Open |
| 66 Venue 3: delete confirm (PARTIAL) | Built with a typed venue name (the typed-name rule); the PDF says no typing for a venue. One line each in `PvVenueEdit.tsx` and `PvVenues.tsx` to follow the PDF. Plan decision 7 still "to confirm". | F3 | Open, needs decision |
| 42 Shared report, shirt numbers (inside DONE) | The public report shows shirt numbers (`PUBLIC_SHIRT_NUMBERS = true` in `ReportParts.tsx`); decision pending (locked shirt rule v. no new personal data on the public page). | D3 | Open, needs decision |
| Light theme, push alerts, uploads | Not among the 78; excluded by earlier locked rules (plan decision 13 and section 0 rule 2). | Plan | Not built on purpose |
| Money shown as PKR, not "Rs" (63-72, inside DONE) | Locked decision 11. | F3, F4 | By decision |

### (c) Needs a real device or real service to build or verify

| Item / scenario | What is missing | Checklist | State now |
|---|---|---|---|
| All 78 items | Nothing was run against the real Neon database, real Google sign-in or a real phone. See section 4. | All | Unproven |
| 34 and 35 No-signal pages | Service worker and airplane mode in a real browser not tested; check that `qm.css` is in the CSS the service worker prefetches (production build). | C4 | Unproven |
| 43 Core 18 (150% text, DONE) | Simulated by setting root font size to 24px, not a real system font scale. | E1 | Simulated only |
| 75 Shirt, 25 Bottom navigation | Wide initials and 99 on a real phone; glass blur and Barlow font on real iPhone and Android. | A | Unproven |

### (d) Simply missing or cut for time

| Item / scenario | What is missing | Checklist | State now |
|---|---|---|---|
| 19 Community 1 (PARTIAL) | Desktop bento is two columns inside the 760 px page, not three. | B2 | Open |
| 21 Members 1 (`*`) | Desktop list plus selected-member side panel not built. | B3 | Open (members page passes no panel) |
| 27 Matches list 1 (`*`) | Desktop list plus detail split not built. | B4 | Open |
| 50 Teams list 4 (`*`) | Hover toolbar replaced by an always-visible pencil next to the kebab. | B4 | Minor variation |
| 52 Team page 3 (`*`) | New match from an empty team did not pre-select the team. | B4 | Closed: Team page link is now `matches/new?team=...` (teams/[teamId]/page.tsx line 41) |
| 53 Edit team 5 (`*`) and 30 Edit 12 (PARTIAL) | Green tick inside the typed-name field not drawn (shared `ConfirmDialog`). B4 calls it DONE; C1 calls the same gap PARTIAL. The tick exists only in the Delete community form (G2). | B4, C1 | Open (no tick in ConfirmDialog.tsx) |
| 30 Edit 13 (PARTIAL) | After postpone or cancel the actions still redirect to Match details; a snackbar with a "View" action was not built. | C1, D1 | Mostly closed: D1 shows banners with "View in Matches" (lib/md.ts, MdParts.tsx) |
| 30 Edit 8 (`*`) | The full manage card was not on the Match details page. | C1 | Closed by D1 (MdManageCard in the match page) |
| 32 Rematch 10 (NOT DONE) | New-match banner with Review lineups and Edit. | C2 | Closed by D1: `createdBanners` has Review lineups and Edit (lib/md.ts, used by MdParts.tsx) |
| 33 Correct 10 (NOT DONE) | Banner after saving and change history. | C3 | Closed by D3: banner in report/page.tsx and the Changes tab (`correctionsOf`). Caveat: before-values are replayed with today's rules |
| 31 Lineups 8 (`*`) | Browser Back button not guarded (tab close and in-app links are). | C3 | Open (LineupPicker has beforeunload and a click guard, no popstate) |
| 36 Match details 13 (PARTIAL) | Cancel dialog lacks "N players said they were coming" (`MatchManage` has no slot for it). | D1 | Open (no such text anywhere in `src`) |
| 40 Match PDF 1 (PARTIAL) | 1f: "Open the report online" QR box not built (needs a QR library or link; no new packages). 1g: community name in the header not built (the PDF data has no community name; the public link must show nothing new). | D4 | Open (no QR or community name in reportPdf.ts) |
| 40 Match PDF (inside DONE) | Full version no longer prints the batter name per ball; "Match stats" heading merged into page 1. | D4 | Open by design; can be asked back |
| 39 Report (inside DONE) | Changes tab before-values are replayed with today's rules, not what people saw then. | D3 | Known limit |
| 36 Match details (inside DONE) | Two columns at 820 and 1440 px not built (page is 720 px wide; side column only at 1360 px). Not seen in a real browser at 1360+. | D1 | Open |
| 43 Core 1-5 (PARTIAL, 5 scenarios) | How-to-score guide: pictures and a Back button not built (code checked: `GuideSheet` has Next, Start scoring, Skip and dots only). A "?" button reopens it. | E1, E2 | Open |
| 43 Core 16 (PARTIAL) | Scorecard sheet in the pad: E1 says E2 owns it; E2 says "same content, new shell". Tabs and striker tint from the PDF are not claimed. | E1, E2 | Unclear, counted PARTIAL |
| 44 Start 8: toss by hand | Error is an inline red line, not a banner above the button. | E1 | Open |
| 49 Offline 8: tap to fix | No ball chip inside each refused-ball card. | E1 | Open |
| 17 Home (inside DONE) | "Updates every 5 s" label not shown on the live card; full three-column desktop Home not built. | B1 | Open |
| 55 Series list 4 (inside DONE) | Delete icon appears only on hover or focus on a wide screen (kebab always present). | F1 | By design |

### Gap notes in the plan file header, and whether later work closed them (code checked, nothing run)

| Plan note | State now | Evidence |
|---|---|---|
| B: Members desktop side panel | Open | members page and `MembersList.tsx` pass no panel |
| B: Matches list desktop list+detail | Open | matches page passes no panel |
| B: three-column desktop Home/Community | Open | Home uses the 760 px column plus a Community panel; Community is two columns (B1, B2) |
| B: floating glass tab bar | Partly: glass blur is applied to `.topbar` and `.nav`; the floating, taller (52 px) shape is not built | `globals.css` @supports block; B1 NOT DONE row |
| B: alerts entry on the tablet rail | Open | Alerts is in the sidebar list and the top-bar bell only (`BottomNav.tsx`) |
| B: waiting communities in the switcher | Open | no "Waiting" in `CommunitySwitcher.tsx`; B1 says the brief said approved only |
| B: "Updates every 5 s" on the live card | Open | text not found in Home components |
| B: hover toolbars | Partly: Series cards have a hover/focus pencil and bin (F1, `sr.css` line 64); Teams has an always-visible pencil; Members and Matches have none | `sr.css` |
| B: needs a real phone and database check | Open | section 4 |
| C: Rematch 10 and Edit 13 banners on Match details | Closed (Edit 13: a banner link instead of a snackbar with View) | D1, `lib/md.ts` `createdBanners` and `afterActionLink` |
| C: Correct 10 banner and change history | Closed | D3, `report/page.tsx`, `lib/corrections.ts` |
| C: green tick in the typed-name field | Open for the shared `ConfirmDialog`; present in the Delete community form | `ConfirmDialog.tsx`; G2 |
| C: browser Back guard on lineups | Open | `LineupPicker.tsx`: beforeunload and click only |
| C: offline quick pages with the service worker in a real browser | Open (needs a real browser) | C4 "NOT tested" |
| D: cancel dialog lacks "N players said they were coming" | Open | text not found in `src` |
| D: live match page no longer shows batters/bowler strip | Closed by design: strips are on `/score` (D2 LiveView) | D1, D2 |
| D: PDF has no QR box and no community name | Open | `reportPdf.ts` has neither |
| D: PDF Full no batter name per ball; Match stats merged | Open by design | D4 |
| D: Changes tab before-values replayed with today's rules | Open (known limit) | D3 |
| D: public report shows shirt numbers, decision pending | Open | `PUBLIC_SHIRT_NUMBERS = true` |
| D: Player-of-the-Match tie bug (Infinity-Infinity) fixed in stats.ts | Closed | `stats.ts` line 5 comment and tie handling near line 200; D3's own text still says "not changed" (written before the fix) |
| D: quick pages use a plain QuickShell (no bell, no switcher) on purpose | Still true, by design (no private data enters the offline cache) | C4 |

## 4. Things only a real phone or a real database can prove

None of these has been seen by a builder. Each is a gap in the evidence, not a known defect.

- Scoring pad with signal: a full over, wicket, undo, innings break, super over and finish on a real phone (tap feel, 62 px keys, haptics, the on-screen keyboard over sticky buttons, iOS safe areas, `100dvh`). The plan itself says the pad needs a real-phone trial match before use.
- Scoring pad without signal: airplane mode, balls saved in IndexedDB, the "online" event, sync every 8 s, refused balls (Fix, Try again, Discard), sign-in expired, storage full. Tests use a stubbed failing fetch.
- Offline quick match (`/matches/quick`, `/matches/quick/score`): start with no signal, score, reconnect, match created before balls. Needs the real service worker.
- Service worker caching of `/offline` and the two quick pages, and that `qm.css` is in the cached CSS (needs `next build`, one visit online, then an offline reload). Also that private pages are not cached.
- PDF download and share: View, Download, Share as a file through the system share sheet, the WhatsApp link fallback, 401 behaviour, page counts for a 20-over Full match, non-Latin names printing as "?", printing on paper.
- Google sign-in end to end (sign-in, first-sign-in terms, `next` redirect, log out of all devices, delete account) and every page against the real Neon database (server pages were only rendered as components with dummy data).
- Glass blur on the top bar and tab bar on a real iPhone and Android, with the solid fallback; Barlow Semi Condensed loaded by `next/font` (the preview used the Google link), on the live score.
- Shirt rendering of wide initials (MW, WM) and 99 at every size on a real phone.
- 1360 px and 1440 px layouts in a real browser: the side panel (a portal) on Plan several, Lineups, Correct, Booking, Payments; two-column Live view; the 960 px analytics dashboard (CSS `:has`). Only seen in jsdom or static HTML.
- iPhone install steps (Add to Home Screen, "open in Safari" banner), the Android and Chrome install prompt, the update banner (service worker SKIP_WAITING), the offline banner.
- Real 150% and 200% text scale on Android and iOS; screen readers (TalkBack, VoiceOver) on sheets, tiles and chips; keyboard Tab order in the pad (DOM order differs from the picture).
- Server paths never run: new actions (`actionsB2`, `B3`, `B4`, `C3`, `F1`), `reopenRequest`, undo after "Recorded" on a live server, the "someone took that number" race, the venue-in-use race.

## 5. Bottom line

- 562 of 607 scenarios are DONE as stated by the checklists (92.6%), 26 PARTIAL, 3 NOT DONE (1 after later phases closed two), 16 not stated per scenario. All 78 items have a route page or component in the code; no item is absent.
- Biggest gap by count: the scoring pad (20 PARTIAL of 109, nearly all deliberate or pinned by tests, plus a real-phone trial match still owed). Next: items 25 and 26 have no per-scenario evidence, and the desktop layouts at 1360 px are unverified.
- Nothing in this document replaces a run on a real phone and the real database.
