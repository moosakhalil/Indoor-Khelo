# Phase 1 checklist (feature numbers are from Indoor_Khelo_Complete_Feature_List.md)

Status: ✅ built and checked · 🟡 built, needs a real-phone or real-Google check · ⏳ planned for a later phase (not skipped, just not in Phase 1) · ❌ not done yet, belongs in Phase 1

## 1. Sign in and account
| # | Requirement | Status | Notes |
|---|---|---|---|
| 1.1 | Continue with Google, one button, creates or signs in | 🟡 | Built on Neon Auth. Uses Neon's shared Google key until your own client is connected. Needs a real tap-through. |
| 1.2 | No password, no reset, no email verification | ✅ | By design: nothing of that exists. |
| 1.3 | Only the name is used. No photos anywhere | ✅ | App reads the name only. Neon stores Google's photo field in its own sign-in table, but the app never reads or shows it. |
| 1.4 | Edit name | ✅ | Profile tab. |
| 1.5 | Accept terms once | ✅ | Asked on first sign-in, remembered. Terms text is a placeholder, not legal wording. |
| 1.6 | Stay signed in | 🟡 | Neon session cookies. Check on a real phone. |
| 1.7 | Log out | ✅ | Also clears cached pages on the phone. |
| 1.7b | Log out of all devices | 🟡 | Built on Neon's own sign-out-everywhere. Needs a real sign-in to try. |
| 1.8 | Delete account | ⏳ | Depends on handing over the Admin role (an only-Admin must hand over first), which is built with the Community page in Phase 2. Done there, not skipped. |
| 1.9 | Nothing visible until signed in; invite links lead to Google | ✅ | Checked: every protected page sends a signed-out visitor to the welcome screen. |
| 1.11 | Larger text and theme settings | ⏳ | Settings screen comes later. |

## 2. Communities
| # | Requirement | Status | Notes |
|---|---|---|---|
| 2.1 | Create or join choice | ✅ | |
| 2.2 | Create: name, description, location, approval switch; creator becomes Admin | ✅ | Checked against the real database. |
| 2.2b | Community logo | ✅ | Decided: no logo upload anywhere. A community is shown by a gold block with its initials. |
| 2.3 | Invite link and unique code | ✅ | Admin can replace them; the old one stops working (tested). |
| 2.3b | QR code for the invite | ⏳ | Not built yet. |
| 2.4 | Join by link or code, community shown first, request to join | ✅ | |
| 2.5 | Admin approval on or off; pending people are not members | ✅ | Tested. Changing the setting later is on the settings screen (later). |
| 2.6 | After approval, pick a number, then enter | ✅ | |
| 2.7 | Many communities per person | 🟡 | Data model supports it. The community switcher screen comes later. |
| 2.8 | Community page (leave, switch, activity, etc.) | ⏳ | Home, Members and Invite exist. Leave, switch and the rest come next. |
| 2.11 | Admin: join requests | ✅ | Approve or reject. Server refuses anyone who is not an Admin (tested). |
| 2.11b | Admin: remove member, settings, number conflicts | ⏳ | Later. |
| 2.12 | Statuses: pending, approved, rejected, removed (and left) | ✅ | |
| 2.13 | Community data isolation | ✅ | Every community page checks membership on the server. |

## 3. Player number
| # | Requirement | Status | Notes |
|---|---|---|---|
| 3.2 | Mandatory, 1 to 99, nobody enters without one | ✅ | Pages redirect to the number step until one is chosen. |
| 3.2b | Unique per community, same number allowed in another community | ✅ | Enforced by the database (tested). |
| 3.2c | 99 members per community | ✅ | Enforced by the database too (tested). |
| 3.4 | Change number, only free numbers offered | ✅ | Profile, then Change number. |
| 3.8 | First come, first served | ✅ | Tested, including two people at the same instant: exactly one wins. |
| 3.8a | Self-chosen, no Admin approval | ✅ | |
| 3.8b | No change during a live match | ⏳ | Needs matches (a later phase). |
| 3.8c | Old number free straight away | ✅ | Tested. |
| 3.6 | Gold shirt with the number, grey shirt for people without one | ✅ | Members, Home, Profile, Join requests. |
| 3.1 | Batting hand, position, bowling style | ⏳ | Phase 3 in the plan. |

## 18. Install, offline, updates
| # | Requirement | Status | Notes |
|---|---|---|---|
| 18.1 | Install: Android button, iPhone steps, no steps inside the app or in-app browsers, 14-day "not now" | 🟡 | Built. The Android prompt showed in a test browser. iPhone steps need a real iPhone. |
| 18.x | Manifest, icons (192, 512, maskable, Apple touch, favicons) | ✅ | |
| 18.13 | Service worker: API never cached, static files cached, personal pages never cached, 3-second network-first | 🟡 | Written to the PRD rules. Needs a real-phone test in production mode. |
| 18.14 | New version waits for Refresh | 🟡 | Built. Needs a real update to test. |
| 18.15 | Offline page | ✅ | |
| 18.2+ | Offline scoring and sync | ⏳ | Later phases. |

## 20. Navigation
| # | Requirement | Status | Notes |
|---|---|---|---|
| 20.1 | Five bottom tabs with labels | ✅ | Matches, Teams and Payments show a clear "arrives later" message for now. |

## Checks run
- 14 rule tests and 9 database tests: all pass. Test data was deleted afterwards (database confirmed empty).
- Production build: passes. Signed-out visitors cannot open any protected page.
