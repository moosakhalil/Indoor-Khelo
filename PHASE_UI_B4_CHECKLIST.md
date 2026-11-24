# Phase UI-B, Builder 4: Matches list and Teams (6 screens)

Status: DONE = built and checked by tests and a screenshot at phone width (390 px) and, for Teams and Team page, at 1440 px. PARTIAL / NOT DONE say what is missing.

Files: `src/app/c/[id]/matches/page.tsx`, `src/components/{MatchBits,MatchList,MatchItemCard,MatchRowMenu,TeamsList,TeamDeleteDialog,TeamEditor,MemberPicker,TeamDangerZone,TeamPageBits,SquadEditor,B4Icons}.tsx`, `src/components/b4.css`, `src/lib/{matchList,matchSummary,teamList,listB4}.ts`, `src/app/actionsB4.ts`, pages under `src/app/c/[id]/teams/`, tests `src/components/B4.test.tsx`.

## Matches list `/c/[id]/matches`
| # | Scenario | Status |
|---|---|---|
| 1 | All eight statuses (grouping Live / Upcoming / Past, badges, score, result, quiet reply, filters, kebab) | DONE. Desktop list+detail split NOT DONE (see notes) |
| 2 | No matches yet (icon card, New match, Plan several, offline line) | DONE |
| 3 | "3 matches planned" banner with headline, icon, new matches first under Upcoming | DONE |
| 4 | "1 match planned" singular and "Match deleted." as a snackbar without Undo | DONE |
| 5 | Filter "Needs my reply" with one-tap I'm in / Can't make it | DONE |
| 6 | Search with no result and one-tap clear | DONE |
| 7 | Reply states (not replied, I'm in, Can't make it, started = no reply line; counts never shown) | DONE |
| 8 | Row kebab: Open, Pick lineups, Edit, Rematch, Postpone, Cancel, Delete (typed match name) | DONE |

## Teams list `/c/[id]/teams`
| 1 | Five teams, table beside cards, rank, badges, YOUR TEAM, form guide, search, A to Z / By record, New team (FAB on phone) | DONE |
| 2 | No teams yet (badge preview, Create a team, Explore links) | DONE |
| 3 | One team, no finished matches (table placeholder, "Needs 2+ players" chip) | DONE |
| 4 | Card menu (Edit team, Edit squad, Delete with reason) | DONE. Desktop hover toolbar: an always-visible pencil link next to the kebab (not hover-only) |
| 5 | Delete on a team that has matches (calm dialog, next step "Edit squad instead") | DONE |

## New team `/teams/new`
| 1 | Blank (live badge preview, Step 1 of 2, member pickers with shirts, counters 0/40 0/200) | DONE |
| 2 | Filled (GG preview with C and VC) | DONE. Sticky button on phones |
| 3 | Empty and same person captain and vice (real messages, icon + red field) | DONE |
| 4 | Name already used (server message on the name field, unique-name hint) | DONE |
| 5 | Saving (button dimmed, "Saving…") | DONE |

## Team page `/teams/[teamId]`
| 1 | 7-player squad, full record (hero badge, chips, form guide with key, table position, charts, head to head, recent, contributions, squad card) | DONE |
| 2 | Full squad of 12 (count in header, Edit squad always in the card header, C/VC tags) | DONE |
| 3 | Two players, no matches (empty record with action, no fake charts) | DONE. The action opens New match; the team is NOT pre-selected (Create match is Phase C) |
| 4 | One player, no captain (orange "Needs 1 more player to play", "No captain yet" chip) | DONE |
| 5 | Empty squad ("No players yet." + Add players) | DONE |
| 6 | Top-bar kebab (Edit team, Edit squad, Delete with "has N matches") and labelled Edit | DONE |
| 7 | Squad row menu (Open player, Make captain, Make vice-captain, Remove) | DONE (new server actions in `actionsB4.ts`, same rules) |
| 8 | Remove from squad: Undo snackbar naming the lost role | DONE (undoable, removal made after the wait) |

## Edit team `/teams/[teamId]/edit`
| 1 | No matches, delete allowed (danger card, live preview) | DONE |
| 2 | 14 matches, delete locked (Locked badge, real sentence, See its matches / Edit squad, dimmed delete) | DONE |
| 3 | Exactly 1 match (singular wording) | DONE |
| 4 | Delete dialog (typed name, outcome button "Delete team") | DONE |
| 5 | Name typed correctly (button enabled; exact match, case ignored) | DONE. The tick-in-field is not drawn; the button enabling is the signal |
| 6 | Renamed to an existing name (error on the field, preview shows the badge) | DONE |
| 7 | Captain = vice (error under the vice picker, live) | DONE |
| 8 | Saved (snackbar instead of banner) | DONE |

## Edit squad `/teams/[teamId]/squad`
| 1 | After creating (Step 2 of 2, captain/vice ticked, Ready tile, search, filters, select all/clear) | DONE |
| 2 | Editing an existing squad (gold tint + tick, In squad count) | DONE |
| 3 | Captain unticked (orange warning naming the person, "1 removed" summary) | DONE |
| 4 | Search "han" (count and Select all apply to the matches) | DONE |
| 5 | Nobody selected ("Not yet", Save squad (0)) | DONE |
| 6 | Leave squad on my row with Undo snackbar and role loss stated | DONE as a pending change (unticks you, Undo re-ticks, Save squad still applies it) |

## Notes
- Shirt rule: all players are gold shirts (squad rows, pickers, leader chips, contributions). Teams use `TeamBadge`.
- Not built: desktop list + detail split on the Matches list; the "tick in the field" of the typed-name dialog (shared `ConfirmDialog`).
- Existing test `QuietCard.test.tsx` still passes unchanged.
