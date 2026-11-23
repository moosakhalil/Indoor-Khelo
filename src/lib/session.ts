import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { one } from "@/lib/db";

export type AppUser = { id: string; name: string; email: string; termsAccepted: boolean };

/** The signed-in user, or null. Creates the app profile row the first time (name only, from Google). */
export async function getSessionUser(): Promise<AppUser | null> {
  const { data: session } = await auth.getSession();
  const u = session?.user;
  if (!u) return null;
  const email = u.email ?? "";
  const fallback = ((u.name ?? "").trim() || email.split("@")[0] || "Player").slice(0, 60);
  const row = await one<{ name: string; terms_accepted_at: Date | null }>(
    `insert into app_user (id, name) values ($1, $2)
     on conflict (id) do update set id = excluded.id
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
