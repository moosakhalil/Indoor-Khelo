# Phase 7 checklist: venues, bookings and cost sharing

Status: ✅ built and checked by tests · 🟡 built, needs a real tap-through · ⏳ not built (not skipped)

| Requirement | Status | Notes |
|---|---|---|
| Saved venues (name, address, contact); any member can add, change, delete (not while it has bookings) | ✅ | Payments tab, then Venues. |
| Booking: venue, date, start time, duration, total cost, booking reference, notes | ✅ | Typed by hand. Live venue availability is out of scope (decided). |
| Statuses: pending, confirmed, cancelled, completed | ✅ | Any member can change them; every change is in the history. |
| Any member can create, edit or cancel; "Added by" and "Changed by" shown | ✅ | |
| Link a booking to one match or several | ✅ | |
| Choose who shares the cost: members and guests (by name) | ✅ | Guests keep their first spelling; no duplicates. |
| Suggested share = total ÷ people, rounded up to a whole rupee, surplus shown | ✅ | PKR 6,000 ÷ 7 = PKR 858 each, with PKR 6 extra. |
| **Paying is a convenience, never a rule** | ✅ | Any amount from anyone; one person can cover it all; 5 of 10 can pay. Nobody is blocked. Overpaying is shown as "over the cost by". |
| Statuses in words: Unpaid, Pending check, Partly paid, Paid | ✅ | Never colour alone. |
| Totals: contributed, still open, progress bar | ✅ | |
| Record amount, date, method, reference; verify ("Mark checked") | ✅ | Any member can check, edit or remove a record; edits and removals are logged with from and to. |
| Refunds recorded by hand, limited to what the person paid in; cancelled bookings keep their records | ✅ | |
| Cost or people change: shares recalculated, new amount shown, people told | ✅ | |
| Members told their share; "Remind everyone who has not paid" | ✅ | In-app alerts. Reminder at most once an hour; not for a cancelled booking. |
| Everyone in the community can see who has paid, only inside the booking screen | ✅ | Never on stats pages. |
| Full change history, visible to all members | ✅ | |
| Offline manual payment recording with sync | 🟡 | Saved on the phone, marked "not synced", sent later; the same record sent twice is saved once. The booking screen must be open when the signal drops (payment pages are deliberately not stored by the phone, to protect shared phones). Needs a real airplane-mode test. |
| Payments never change scores or statistics | ✅ | Separate tables, nothing links them to match figures. |
| Online payment gateway | ⏳ | Not in this phase by decision (manual first; needs a provider account). |
| Live venue availability | ✖ | Out of scope: the user decided it is too advanced. |

## Checks run
- 14 money-rule tests, 13 database tests (venues, bookings, history, status, sharing and rounding, contributions, duplicates, refunds, edits, reminders, linking, leaving, database refusals, community deletion), 4 phone tests for recording payments with and without signal.
- Production build passes.
