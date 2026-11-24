# Phase F3 checklist: Payments home, New booking, Venues, Venue edit/delete, Edit booking

Status: DONE = built and checked (test and/or screenshot) · PARTIAL = built, something differs or is unchecked (said plainly) · NOT DONE = not built.
Prefix `pv-`. Styles in `src/components/pv.css`. PDF pages 820-848 and 894-903.

## Files
- Pages (rewritten): `src/app/c/[id]/payments/page.tsx`, `new/page.tsx`, `venues/page.tsx`, `venues/[venueId]/page.tsx`, `[bookingId]/edit/page.tsx`
- Components: `PvHome.tsx`, `PvBookingForm.tsx` (new + edit), `PvVenueForm.tsx`, `PvVenues.tsx`, `PvVenueView.tsx`, `PvVenueEdit.tsx`, `PvSheet.tsx`, `PvParts.tsx`, `PvIcons.tsx`, `pv.css`
- Libraries (new): `src/lib/pv.ts` (pure helpers), `src/lib/pvData.ts` (one read for Payments home; uses `listBookings` and `moneyView`, no new rules)
- Tests: `src/lib/pv.test.ts` (21), `src/lib/pvData.test.ts` (7), `src/components/F3.test.tsx` (64)
- Old `VenueForm` and `BookingForm` in `Forms7.tsx` are untouched (dead code for these pages). No new server action: the same `createVenueAction`, `updateVenueAction`, `deleteVenueAction`, `createBookingAction`, `updateBookingAction`.

## Rules kept
- Contributions, not bills: the card and the preview call the share a "suggested share"; "Only a suggestion. Some pay more, some less, or one person covers it all."; one person covering the whole cost shows "all covered" (not "11 unpaid").
- Rounded UP: every share comes from `suggestedShare` / `surplus` in `payments.ts` (PKR 6,000 over 7 = PKR 858, PKR 6 extra). Example split under the cost rounds up and says it is only an example.
- Guests by name: grey shirt (`number={null}`) and "(guest)" after the name in the preview.
- Manual recording, PKR everywhere (`money()`), refunds by hand ("Refunds are done by hand, outside the app"), no live availability, payments never on stats pages (the privacy sentence stays on Payments home).
- Permissions: any approved member can do everything here, as today (no new restriction). Venue delete is still refused by the server when bookings exist; the page also locks the button.
- Validation messages are exactly the existing ones (from `validateVenue`, `validateBooking` and the actions); only presentation changed.

## Payments home (`/payments`, 4 scenarios)
| Item | Status | Notes |
|---|---|---|
| 1. Four upcoming and two past/cancelled, any member | DONE | Test + screenshot (phone 390, desktop 1440). Cards with ring, money, status badge, sharing and action line. |
| NEW progress ring with the percentage inside and "PKR 8,500 of PKR 12,000" in big numerals | DONE | Ring is `role="img"` with a label; numbers use `--font-num`. Currency is PKR, not "Rs" as in the PDF (locked rule). |
| NEW unpaid count on every card: "N unpaid", "all covered", "over by PKR X", "refunds by hand" | DONE | "N unpaid" counts people whose own recorded money is below their suggested share (unpaid or partly paid). Also "nobody chosen yet" and "nothing was paid" (cancelled, no money). |
| NEW desktop split view: list left, selected booking right (ring, contributed, checked / waiting / open bar, suggested share, "Still to cover", Open booking, Record payment) | DONE | From 1280 px up (the page widens to 1120 px). Below that a click opens the booking as before. Test for select-on-click and for phone click. "Record payment" links to `/payments/[id]#record` (anchor exists on the booking page today; Builder F4 owns that page). |
| NEW filter tabs All / Upcoming / Past and cancelled with counts, one gold "New booking", Venues as a quiet button in the header | DONE | Gold floating button on phone/tablet, gold button beside the tabs on desktop. Venues is a ghost button in the top bar. |
| NEW Cancelled and completed as text badges with an icon | DONE | Confirmed (check), Pending (clock), Completed (flag), Cancelled (cross), all with the word. |
| 2. First time: no bookings and no venues | DONE | 4-step start (Venue, Booking, People, Payments), first step highlighted, big gold "1 · Add your venue", "2 · Create a booking" shown waiting. The "paying is up to the group" sentence is kept. With a venue but no booking the step moves to "Create a booking". |
| 3. After deleting a booking (`?deleted=1`) | DONE | Green banner with check icon plus a snackbar ("Booking deleted."), no undo. Tested. |
| 4. Only past bookings | DONE | "Nothing upcoming right now" line; the desktop preview opens the latest past booking; a completed, fully paid booking shows a full ring and "all covered". |

## New booking (`/payments/new`, 6 scenarios)
| Item | Status | Notes |
|---|---|---|
| 1. No venues yet | DONE | Step header (Step 1 of 3 · Details), empty state "Add a venue first" with the reason and a gold "+ Add a venue". Screenshot only (it is server markup in `page.tsx`). |
| 2. Empty form, venues exist | DONE | Venue as a radio pick list (name + address or "No address"), "+ Add another venue", Date and Start time as two fields, duration chips 30/45/60/90/120/180 + Other (default 60), big PKR cost, reference, notes, sticky bar. Test + screenshot. |
| NEW venue as pick list, duration as one control, cost as a large figure, 3-step header, sticky action bar | DONE | Sticky bar sits above the bottom bar on phones. "Add another venue" keeps what was typed for that one round trip (kept in session storage, used once, then deleted). |
| 3. Filled in | DONE | NEW live example "If 10 people share: PKR 1,200 each" (rounds up, shows extra), notes counter "40 / 300". Date and time are two native pickers styled as fields (shown in the browser's own date format, not "28 Nov 2026"). |
| 4. Every validation message | DONE | Same wording; each failing field gets a red ring and an alert icon; "Please fix the highlighted fields." as a summary banner on top (focused so it is not missed). Other `when` messages come from the same server text. |
| 5. Saving in progress | DONE | Button disabled and "Saving…"; a second submit is ignored (tested). |
| 6. Server refusals | DONE | Red banner at the top with the exact message; the time zone refusal adds a "Reload page" button. "Choose a venue from this community." marks the venue list. |

## Venues (`/payments/venues`, 5 scenarios)
| Item | Status | Notes |
|---|---|---|
| 1. No venues yet | DONE | Icon + the same sentence; on wide screens the Add card sits beside it; on phones a gold "Add a venue" button opens the sheet. |
| 2. Four venues, one with no address, one with no bookings | DONE | Gold initials mark, name, address and contact (or "No address"), "6 bookings" badge (the busiest gets a gold outline), edit and delete on every row (icon buttons from 1024 px, three-dots menu below). Delete is locked with a reason when bookings exist. |
| NEW search | DONE | Filters by name, address or contact; says when nothing matches. |
| 3. Just added (`?added=1`) | DONE | Green banner and a snackbar. A successful add redirects (Next remounts the form), so the form comes back empty and the sheet closed. |
| 4. Add form errors | DONE | Hint "2 to 60 characters. Each name can be used once." replaced by the exact error; pin and person icons in address and contact; ring + icon + summary banner; "Only members of this community can add venues." shown as the banner. |
| 5. Phone: Add opens as a bottom sheet | DONE | Used below 1280 px (phones and tablets). Escape, Close and a tap outside close it; focus stays inside. |

## Venue page (`/payments/venues/[venueId]`, 5 scenarios)
| Item | Status | Notes |
|---|---|---|
| 1. No bookings: edit form and delete available | DONE | Header card (mark, name, "0 bookings · added by X"), "Edit venue" form, "Added by / Changed by" line, delete card, top-bar three-dots menu (Edit venue, Delete venue). Bookings panel says "No bookings yet. This venue can be deleted." |
| NEW bookings panel on desktop | DONE | Right panel from 1360 px (Frame `panel`); below that the same list sits under the delete card so the bookings are always one tap away. |
| 2. 6 bookings: delete locked with the reason | DONE | Lock icon, "It has 6 bookings, so it stays. Delete or cancel those bookings first.", disabled "Delete venue (not available)", disabled menu item with the same reason, bookings listed with links and status words. |
| 3. Delete confirm | PARTIAL | Built as a dialog naming the venue and the outcome, "Keep venue" / "Delete venue", cannot be undone. DIFFERENCE FROM THE PDF: it asks to type the venue name. The PDF says "Not typed-name because a venue holds no money or results", but the locked rule (B_BRIEF rule 3) lists venue among the typed-name deletes. To follow the PDF, remove `typeToConfirm` in `PvVenueEdit.tsx` and `PvVenues.tsx` (one line each). |
| 4. Race `?e=in_use` | DONE | Red alert banner: "This venue has bookings, so it cannot be deleted." + "Another member just booked it. Cancel or delete those bookings first." |
| 5. Edit errors | DONE | Same messages, ring and icon on failing fields, summary banner; "That venue no longer exists." and "Only members of this community can change venues." shown as the banner. |

## Edit booking (`/payments/[bookingId]/edit`, 5 scenarios)
| Item | Status | Notes |
|---|---|---|
| 1. Prefilled | DONE | Same fields as New booking, prefilled; header subtitle "Venue · Fri 28 Nov"; Cancel link; sticky bar. |
| NEW "What this changes" panel | DONE | People sharing, suggested share now, after (rounded up), rounding extra; updates as the cost is typed; keeps the sentence about people being told. Card under the form on phones, side column from 1280 px. The PDF also shows the "Example split" in edit; here it only shows when nobody shares yet (with people chosen the real numbers are in the panel, a made-up "10 people" example would contradict them). |
| 2. 100-minute booking | DONE | "Other" chip is selected and the number is shown. |
| 3. Cost raised: confirm | DONE | Dialog "Change the cost to PKR 14,000?" with old and new share, rounding extra, "The members sharing will be told", "Payments already recorded stay as they are"; buttons "Keep PKR 12,000" (puts the old cost back) and "Change the cost". Only when people share and the new cost is a valid, different amount. Guests have no account so only members are told (as the server does today). |
| 4. Every validation message | DONE | As New booking. "That booking no longer exists." and "Only members of this community can change bookings." as the banner. |
| 5. Saving in progress | DONE | Disabled "Saving…", no double save. |

## Checks run
- `npx tsc --noEmit`: clean.
- `npx vitest run src/lib/pv.test.ts src/lib/pvData.test.ts src/components/F3.test.tsx`: 92 tests pass.
- Visual check: static HTML of every state rendered with the real `globals.css`, `shell.css` and `pv.css`, screenshots with headless Chrome at 390 px (iframe) and 1440 px; fixed overflow found at 390 px (form width) and a gap bug. Not run in a real browser against the database: the pages themselves (server components) were not rendered, only their components with dummy data.

## Not verified / open
- The sticky action bar is placed 66 px above the bottom of the screen on phones (height of the bottom bar); not checked on a real phone with a keyboard.
- Date and time use the browser's native pickers; the look differs by browser.
- "Record payment" depends on the `#record` anchor staying on the booking page.
- The PDF shows "Rs"; the app uses "PKR" (locked rule).
