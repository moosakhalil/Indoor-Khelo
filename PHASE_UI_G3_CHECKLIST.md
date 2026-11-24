# Phase UI G3: Account, You are offline, App banners, Public profile

Prefix `ac-`. Files: `src/app/account/page.tsx`, `src/components/AcAccount.tsx` (AcSessions, AcDangerZone), `src/app/offline/page.tsx` (+ `AcOfflineRetry.tsx`, styles inline in the page), `src/components/PwaShell.tsx` (+ `ac-pwa.css`), `src/components/PublicProfileView.tsx`, `src/app/p/[token]/page.tsx`, new `src/app/p/[token]/not-found.tsx`, `AcIcons.tsx`, `ac.css`, `ac-public.css`, test `G3.test.tsx` (30 tests). No new server actions. Old `SignOutButton.tsx` and `DeleteAccountPanel` (Forms2.tsx) stay as dead code.

Status key: DONE = built and checked by test and/or screenshot (phone, tablet, desktop). Not verified: real Google sign-in, a real service worker, iOS Safari steps on a real iPhone.

- Account (9): all DONE (test per scenario; phone and desktop screenshots; desktop has the red Danger zone as a side column).
- You are offline (1): DONE (test: no img/link/import/url, inline svg and style; screenshots).
- App banners (6): DONE (test per scenario, screenshots of all states).
- Public profile (4): DONE (tests, screenshots phone/tablet/desktop; number never shown; real 404 status kept).
