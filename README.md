# Indoor Khelo (app)

Next.js app on Neon (database + Google sign-in). Requirements live one folder up in `Indoor_Khelo_Platform_Final_Complete_Requirements.md`.

## Run it on your computer

1. Open a terminal in this folder.
2. `pnpm dev`
3. Open http://localhost:3000 and tap **Continue with Google**.

Other commands: `pnpm test` (rules and database tests), `pnpm typecheck`, `pnpm build`, `pnpm start`.

## Settings

Secrets are in `.env.local` (never share it). `.env.example` shows the names. The service worker only runs in production (`pnpm build` then `pnpm start`), so test install and offline there.

## Where things are

- `src/lib/validation.ts`: pure rules (player number 1 to 99, names, invite codes, 99-member limit).
- `src/lib/community.ts`: communities, membership, join requests, number choice (first come, first served), Admin checks.
- `src/app/actions.ts`: what happens when a button is tapped. Every action checks who you are on the server.
- `db/001_phase1.sql`: the database tables and the rules the database enforces itself.
- `PHASE1_CHECKLIST.md`: every requirement for this phase and its status.
