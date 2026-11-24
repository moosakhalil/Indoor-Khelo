"use server";

// Server actions for the Alerts screen (UI redesign, builder 2). Same rules as the older actions:
// the person must be signed in and accepted, and only their own alerts in this community are touched.
import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/community";
import { markAlertsUnread, markAllAlertsReadReturning, markOneAlertRead } from "@/lib/alertsData";
import { setAvailability, type ChangeOutcome } from "@/lib/matches";
import { requireAcceptedUser } from "@/lib/session";

export type AlertActionResult = { ok: true } | { ok: false; error: string };

/** Mark one alert as read (the "Mark as read" item of the alert's menu). */
export async function markAlertReadAction(communityId: string, alertId: string): Promise<AlertActionResult> {
  const user = await requireAcceptedUser();
  if (!isUuid(String(communityId)) || !isUuid(String(alertId))) return { ok: false, error: "not_found" };
  await markOneAlertRead(user.id, communityId, alertId);
  revalidatePath(`/c/${communityId}`, "layout");
  return { ok: true };
}

/** "Mark all as read": says which alerts it changed, so Undo can put back exactly those. */
export async function markAllAlertsReadB2Action(communityId: string): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const user = await requireAcceptedUser();
  if (!isUuid(String(communityId))) return { ok: false, error: "not_found" };
  const ids = await markAllAlertsReadReturning(user.id, communityId);
  revalidatePath(`/c/${communityId}`, "layout");
  return { ok: true, ids };
}

/** Undo for "Mark all as read": sets read_at back to empty for exactly these alert ids. */
export async function undoMarkAlertsReadAction(communityId: string, ids: string[]): Promise<AlertActionResult> {
  const user = await requireAcceptedUser();
  if (!isUuid(String(communityId)) || !Array.isArray(ids)) return { ok: false, error: "not_found" };
  await markAlertsUnread(user.id, communityId, ids.map(String));
  revalidatePath(`/c/${communityId}`, "layout");
  return { ok: true };
}

/**
 * "I'm in" / "Can't make it" from an alert. Same work and same checks as setAvailabilityAction
 * (it calls the same setAvailability), but it stays on the Alerts page instead of opening the match.
 */
export async function answerFromAlertAction(communityId: string, matchId: string, answer: string): Promise<{ ok: true; answer: "in" | "out" } | { ok: false; error: ChangeOutcome }> {
  const user = await requireAcceptedUser();
  if (!isUuid(String(communityId)) || !isUuid(String(matchId))) return { ok: false, error: "not_found" };
  const res = await setAvailability(user.id, communityId, matchId, String(answer));
  revalidatePath(`/c/${communityId}`, "layout");
  if (res !== "ok") return { ok: false, error: res };
  return { ok: true, answer: answer === "out" ? "out" : "in" };
}
