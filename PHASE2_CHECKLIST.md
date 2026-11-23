# Phase 2 checklist: community tools

Status: ✅ built and checked · 🟡 built, needs a real tap-through · ⏳ waiting for your OK or a later phase · ❌ not done

| # | Requirement (feature list number) | Status | Notes |
|---|---|---|---|
| 2.8 | Community page: info, invite link and code, my number with Change, members (first 5 and "See all"), recent activity, Admin section, your communities, Leave | ✅ | Opens from the community card on Home and from Profile. |
| 2.8b | Switch community; Create another; Join another | ✅ | `/switch` page and a Switch button on the Community page. Your last community is remembered. |
| 2.9 | Leave community with one confirmation. Stats stay with you, number freed at once, can ask to join again | ✅ | Tested. |
| 2.10 | The only Admin cannot leave until they hand over (or delete the community) | ✅ | The Leave page lists members with a Make Admin button. Tested. |
| 2.11 | Admin: join requests (approve, reject) | ✅ | From Phase 1. |
| 2.11b | Admin: remove a member (number freed; Admins and yourself protected) | ✅ | One extra "Yes, remove" tap. Tested. |
| 2.11c | Admin: make someone Admin, take Admin away; at least one Admin always | ✅ | Tested, including two Admins trying at once (locked). |
| 2.11d | Admin: community settings (name, description, location, approval on or off) | ✅ | Shows Added by and Last changed by. Change is logged. Tested. |
| 2.11e | Admin: player numbers screen, ask someone to choose a new number | ✅ | Tested. |
| 2.11f | Admin: delete the community (type the name) | ✅ | Tested. |
| 2.3b | QR code on the invite screen | ✅ | Drawn on white so cameras read it. |
| 2.2b | Community logo | ✅ | Decided: no logo or picture upload anywhere. Communities and teams show a gold initials block. No file storage was created. |
| 2.12 | Recent activity (joined, left, removed, Admin changes, settings) | ✅ | Shown on the Community page. |
| 1.8 | Delete account | 🟡 | Removes your name and data, you leave every community, only-Admin blocked, sole-member communities deleted. Then asks Neon to remove the sign-in record. If Neon refuses, the screen says so honestly. Needs a real try. |
| 1.7b | Log out of all devices | 🟡 | Also on the Account page. |
| 3.8b | No number change during a live match | ⏳ | Needs matches (Phase 4). |
| Waiting | Cancel my join request | ✅ | Button on the waiting screen. Tested. |

## Checks run
- 32 tests pass (14 rules, 18 database). The database is empty again afterwards.
- Production build passes. Every new page sends a signed-out visitor back to the welcome screen.
