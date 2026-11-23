import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { safeNextPath } from "@/lib/validation";

// A route is allowed to change cookies, so Neon can renew its short-lived session cookie here.
// Then we send the person straight back. "rf=1" tells the page it already went through here (no loops).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get("next"), "/");
  try {
    await auth.getSession();
  } catch {
    // If renewal fails the page simply shows the signed-out view.
  }
  const dest = new URL(next, url.origin);
  dest.searchParams.set("rf", "1");
  return NextResponse.redirect(dest);
}
