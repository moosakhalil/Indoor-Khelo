import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { AuthUnreachableError } from "@/lib/authError";
import { one } from "@/lib/db";

export type AppUser = { id: string; name: string; email: string; termsAccepted: boolean };

const COOKIE_WRITE_ERROR = /Cookies can only be modified/i;

/**
 * The signed-in user, or null. Creates the app profile row the first time (name only, from Google).
 *
 * Neon keeps a short-lived copy of the session in a cookie and renews it when it runs out. Next.js only allows
 * cookie changes in a route or a button action, not while a page is being built. Pages behind sign-in are covered
 * by the proxy. PUBLIC pages (welcome, invite) pass `refreshTo`: if the renewal is needed, we hop through
 * /api/session/refresh (a route, where cookies may change) and come straight back.
 */
export async function getSessionUser(opts?: { refreshTo?: string }): Promise<AppUser | null> {
  let result: Awaited<ReturnType<typeof auth.getSession>>;
  try {
    result = await auth.getSession();
  } catch (err) {
    if (opts && COOKIE_WRITE_ERROR.test(String((err as Error)?.message ?? err))) {
      if (opts.refreshTo) redirect(`/api/session/refresh?next=${encodeURIComponent(opts.refreshTo)}`);
      return null; // already tried once: show the signed-out view rather than loop
    }
    throw err;
  }
  // "No answer" is not "signed out": the page shows "Couldn't connect" (app/error.tsx) instead of the sign-in screen.
  const status = result.error?.status;
  if (result.error && (!status || status >= 500 || status === 429)) throw new AuthUnreachableError();
  const u = result.data?.user;
  if (!u) return null;
  const email = u.email ?? "";
  const fallback = ((u.name ?? "").trim() || email.split("@")[0] || "Player").slice(0, 60);
  const row = await one<{ name: string; terms_accepted_at: Date | null }>(
    `insert into app_user (id, name) values ($1, $2)
     on conflict (id) do update set name = case when app_user.name = 'Deleted player' then excluded.name else app_user.name end
     returning name, terms_accepted_at`,
    [u.id, fallback],
  );
  return { id: u.id, name: row!.name, email, termsAccepted: !!row!.terms_accepted_at };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) redirect("/");
  return user;
}

/** Signed in AND has accepted the terms (asked once, on first sign-in). */
export async function requireAcceptedUser(): Promise<AppUser> {
  const user = await requireUser();
  if (!user.termsAccepted) redirect("/terms");
  return user;
}
