# Phase UI G1: entry pages (Welcome, Terms, Choose, Create, Join, Invite preview, routing, Switch)

Prefix `en-` / `En`. Styles: `src/components/en.css`. Tests: `src/components/G1.test.tsx` (50 tests). Proposal pages 19 to 58 of the PDF.

## Files
- Pages: `src/app/page.tsx`, `terms/page.tsx`, `choose/page.tsx`, `create/page.tsx`, `join/page.tsx`, `join/[code]/page.tsx`, `switch/page.tsx`, `home/page.tsx` (comment only), new `home/loading.tsx`, `profile/loading.tsx`. `profile/page.tsx` and `switch/[id]/route.ts` are unchanged.
- Components (new): `EnParts` (brand, top bar, heading, alert, field error, splash), `EnIcons`, `EnAccountMenu`, `EnInstallHint`, `EnTermsForm`, `EnCreateForm`, `EnJoinForm`, `EnRequestJoin`, `EnInvite` (card, steps, full, invalid), `EnCommunityList`, `EnSwitchList`, `EnOpenLink`.
- Changed: `SignInButton.tsx` (look only: spinner, banner with icon; the sign-in call, `next` and the error handling are the same).
- Old `TermsForm`, `CreateCommunityForm`, `FindCommunityForm`, `RequestJoinForm` stay in `Forms.tsx` (not used by these pages any more).
- No new server action. Same actions: `acceptTermsAction`, `createCommunityAction`, `findCommunityAction`, `requestJoinAction`.

## Rules kept
- Google sign-in only, English only, no uploads, same notices and redirects (`/terms?next=`, number step, waiting, `ik_last` cookie).
- Shirt rule: the /switch cards show the gold shirt with the player number (small), grey shirt with a dash while waiting. The top-bar account button is a person icon, not an initials avatar (players are only shown as shirts).
- Service worker, outbox, auth files untouched. No new fetch or network-only asset: icons are inline SVG; pictures are the app icons already precached.
- `/terms` stays a private page for the service worker (NetworkOnly); nothing changed there.

## Scenarios
Welcome `/`: 1 default (brand, 3 promises, Get started, Google button, privacy line, split hero from 640px); 2 busy (spinner, disabled, aria-busy); 3 error banner (icon, title, calm line, button stays active); 4 install hint (`beforeinstallprompt` only, 14-day dismiss key shared with PwaShell).
Terms: 1 icon facts, whole-row checkbox, account menu (Log out only); 2 red row with message and icon; 3 spinner "Saving…".
Choose: 1 two doors plus empty note; 2 list first with Admin / Pending badges, list left and actions right from 820px; 3 pending only.
Create: 1 empty with 3-step progress, counters, hints, switch text, live preview; 2 field error with ring and icon (typed text is kept: fields are controlled); 3 preview follows the form; 4 "Creating…" spinner.
Join: 1 Paste button and examples; 2 error on the field; 3 "Finding…" spinner.
Invite preview: 1 to 9 as in the index (signed out approval / open without details; signed in request / join; sending; fails banner; full state; sign-in error; invalid with way home).
Routing: 1 rules written as a comment in `home/page.tsx` (no behaviour change); 2 branded loading screen (`home/loading.tsx`, `profile/loading.tsx`, and a cover with the community name after tapping Open on /switch).
Switch: 1 big cards, role badge, shirt, Last opened, primary Open, Create/Join buttons; 2 empty state with the two doors.

## Not verified
Real Google sign-in, the real service worker, iPhone install steps, a real phone. Visual check done with static HTML + Chrome headless (phone iframe 390px, 820px, 1440px), not with `next dev`.
