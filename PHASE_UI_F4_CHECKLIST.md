# Phase F4 checklist: payments part 2 (booking and split, who shares, link matches, edit a payment record, my payments)

Status: DONE (built, checked by tests or a rendered screenshot) / PARTIAL / NOT DONE. Rules kept: contributions not bills, round up, guests by name, manual recording, refunds by hand, PKR, offline queue, every permission (any approved member can do everything), no schema or action changes.

Files: `BookingBits.tsx`, `BookingActions.tsx`, `Forms7.tsx` (PaymentForm, QueuedPayments, EditPaymentForm; VenueForm and BookingForm untouched), `ShareForm.tsx`, `LinkMatchesForm.tsx`, `MyPaymentsView.tsx`, `PbIcons.tsx`, `pb.css`, `src/lib/pbBooking.ts`, the five pages. Tests: `PbBooking.test.tsx` (74), `PaymentForm.test.tsx` (4, three string updates).

## Booking and split (27)
| # | Scenario | Status |
|---|---|---|
| 1 | Confirmed, 8,500 of 12,000 | DONE (screenshot 390 and 1440 px): ring, big numbers, 3-part bar (Checked / Waiting for check / Still open), hint box, people rows with shirt, status icon+word, "to suggested / over", "+" per person, jump chips, kebab rows, details, linked matches, status control, history, record panel at 1360+ |
| 2 | Just created (?created=1) | DONE (screenshot): banner with Choose people, empty ring with full cost, empty states with buttons, Delete available |
| 3 | People chosen, nothing paid | DONE: unpaid rows with alert icon and word, "Remind N" |
| 4 | 6,000 shared by 7 | DONE: "Rounded up, so PKR 6 extra is collected." in the hint box (tested) |
| 5 | Completed and fully paid | DONE: full green ring, Still open PKR 0, "All covered" disabled with reason, gold Completed badge |
| 6 | Overpaid | DONE: gold ring, "Over by PKR 500" in legend, row "PKR 500 over"; history lines unchanged (describeHistory) |
| 7 | Cancelled | DONE (screenshot): "Held after cancelling", legend without "Still open", "Refunds to give back" list with Record refund (form opens on Refund, amount filled), reminders gone, banner. Normal "Record" stays in the Payments header so nothing is lost |
| 8 | Member who owes | DONE: "Your share" card, "You" tag, Record my payment. Same permissions |
| 9 | ?reminded=5 | DONE: banner; button becomes "Again in N min" from `last_reminder_at` |
| 10 | ?e=too_soon&n=38 | DONE: gold info banner, disabled "Again in N min" |
| 11 | ?e=nobody | DONE: info banner; button already "All covered" |
| 12 | Success banners | DONE: banners as before plus a toast on long pages (FlashToast) |
| 13 | Refusals | DONE: red alert banners (bad_state, forbidden, not_found) |
| 14 | Record form empty | DONE (tested): sheet on phone, big amount, quick chips, method chips, exact messages with icons |
| 15 | Bank transfer | DONE: reference label becomes "Transaction ID (optional)"; person pre-fills remaining share |
| 16 | Refund to typed name / too large | DONE: Refund tab, "Refunded to", "Record refund", server refusal as red alert above the button |
| 17 | Recorded online | DONE: green "Recorded. PKR 600 from Ali Raza.", form cleared, refresh, snackbar with Undo (Undo removes the record with the existing delete; history shows both lines) |
| 18 | No signal, saved on phone | DONE (tested): orange "NOT SYNCED / N on this phone", "Do not close this booking page until it has sent." |
| 19 | Phone could not save | DONE (tested): red note |
| 20 | Queued record refused | DONE (tested): red reason, Discard, "Still waiting for a signal." |
| 21 | Kebab on a record | DONE (tested): Edit record / Mark checked or not checked / Remove record, 44px targets |
| 22 | Swipe actions | NOT DONE: swipe gestures are not built (locked rule 5); the kebab works for everyone |
| 23 | Remove unchecked: Undo | DONE (tested): row hides, real delete after 8 s unless Undo; leaving the page commits it (Snackbar provider) |
| 24 | Remove checked: confirm | DONE (tested): names who checked and the effect |
| 25 | Remind: preview first | DONE (tested): names, message text, one-hour rule, guests explained, "You are not alerted yourself", "Send N reminders" |
| 26 | Mark cancelled | DONE (tested): segmented control, confirm that explains reminders stop, records kept, refunds by hand |
| 27 | Delete booking | DONE (tested): dialog naming the booking; with payments a lock line "Cancel it instead" |

## Who shares the cost (4)
| 1 Ten members and two guests | DONE (screenshot, tested): live summary (sticky bar; right panel at 1360+ through a portal), search, Select all, Clear, Same as last booking (most recent other booking, read only), shirts, two columns from 640 px, guest chips |
| 2 Nobody chosen | DONE: "Choose at least one person to see a suggested share." |
| 3 ?e=guest | DONE: exact message at the guest field; the 1 to 60 rule is also checked while adding |
| 4 ?e=bad_person | DONE: message plus "Untick them, then save again."; forbidden and not_found now also show a message (they showed nothing before) |

## Link matches (3)
| 1 Six matches, two linked | DONE (screenshot, tested): team badges, status badges with icon, All / Scheduled / Completed with counts, sticky "N matches linked" + Save, reassurance line |
| 2 Nothing linked | DONE: "0 matches linked", says saving clears the links |
| 3 No matches | DONE: empty state with "Create a match" to `/matches/new` |

## Edit a payment record (7)
| 1 Unchecked cash | DONE (screenshot): record card first (shirt, signed amount, method, date, check state, recorded by; right panel at 1360+), tabs, big amount, method chips, Remove card |
| 2 Checked transfer | DONE (tested): banner before editing: "Saving will mark this as not checked again. {name} checked it earlier." |
| 3 Refund to a guest | DONE: Refund tab, "Refunded to", red signed amount; unknown payer kept as an extra option |
| 4 Validation | DONE (tested): same messages (client check with the same validatePayment, server check unchanged) |
| 5 Server refusals | DONE (tested): limit under the amount, person under the person, other refusals in a red banner |
| 6 Saving | DONE (tested): "Saving…" disabled |
| 7 Remove | DONE (tested): unchecked gets Undo (8 s), checked gets a specific confirm |

## My payments (3)
| 1 Eight bookings | DONE (screenshot, tested): two big numbers (gold when something is left), badges with icon and word incl. Paid for others, Completed, Cancelled, tabs All / To cover / Paid, "Record my payment" link per row (opens the sheet), "Needs you" panel at 1360+ |
| 2 Nothing yet | DONE: icon, same sentence, "See all bookings" |
| 3 Everything settled | DONE: "Nothing left to cover" under the zero and in the panel |

## Notes
- Existing test `PaymentForm.test.tsx` kept green. Changed: button names "Record the payment/refund" became "Record payment/refund" (the PDF wording), the "Not synced yet (n)" heading became "NOT SYNCED / n on this phone" (the PDF design), and `deletePaymentAction` added to the action mock.
- Not verified in a real browser: the phone sheet and the portal panel (jsdom only), a real airplane-mode test of the offline queue, and Undo after "Recorded" on a live server.
- Money in the PDF is written "Rs"; the app keeps "PKR".
