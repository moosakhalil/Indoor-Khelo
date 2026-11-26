import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AuthUnreachableError } from "@/lib/authError";
import { getMembership, isUuid } from "@/lib/community";
import { getSessionUser } from "@/lib/session";

// Switching community: remember the choice, then open that community.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // If the sign-in check cannot answer, go to "/": that page says "Couldn't connect" and has a retry.
  const user = await getSessionUser().catch((err) => { if (err instanceof AuthUnreachableError) return null; throw err; });
  const origin = new URL(req.url).origin;
  if (!user || !user.termsAccepted || !isUuid(id)) return NextResponse.redirect(new URL("/", origin));
  const m = await getMembership(id, user.id);
  if (!m || (m.status !== "approved" && m.status !== "pending")) return NextResponse.redirect(new URL("/choose", origin));
  (await cookies()).set("ik_last", id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  return NextResponse.redirect(new URL(m.status === "pending" ? `/c/${id}/waiting` : `/c/${id}`, origin));
}
