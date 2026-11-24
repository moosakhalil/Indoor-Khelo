"use server";

// Builder 3 (UI redesign): the same rules as the existing member and request actions, but they answer with the
// outcome instead of redirecting, so the new screens can show a snackbar, an Undo or an error banner.
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { decideRequest, isUuid, type DecideOutcome } from "@/lib/community";
import { removeMember, resetNumber, setRole, type RemoveOutcome, type ResetOutcome, type RoleOutcome } from "@/lib/management";
import { reopenRequest, type ReopenOutcome } from "@/lib/b3Data";

const refresh = (communityId: string) => revalidatePath(`/c/${communityId}`, "layout");

export async function setRoleB3(communityId: string, userId: string, role: "admin" | "member"): Promise<RoleOutcome> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(userId)) return "not_found";
  const outcome = await setRole(user.id, communityId, userId, role === "admin" ? "admin" : "member");
  refresh(communityId);
  return outcome;
}

export async function removeMemberB3(communityId: string, userId: string): Promise<RemoveOutcome> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(userId)) return "not_found";
  const outcome = await removeMember(user.id, communityId, userId);
  refresh(communityId);
  return outcome;
}

export async function resetNumberB3(communityId: string, userId: string): Promise<ResetOutcome> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(userId)) return "not_found";
  const outcome = await resetNumber(user.id, communityId, userId);
  refresh(communityId);
  return outcome;
}

export async function decideRequestB3(communityId: string, userId: string, decision: "approve" | "reject"): Promise<DecideOutcome> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(userId)) return "not_pending";
  const outcome = await decideRequest(user.id, communityId, userId, decision === "approve");
  revalidatePath(`/c/${communityId}/requests`);
  revalidatePath(`/c/${communityId}`);
  return outcome;
}

/** Approve several people in one go. Each one goes through decideRequest, so the Admin check and the 99 cap still apply. */
export async function approveManyB3(communityId: string, userIds: string[]): Promise<{ approved: string[]; failed: { userId: string; outcome: DecideOutcome }[] }> {
  const user = await requireAcceptedUser();
  const approved: string[] = [];
  const failed: { userId: string; outcome: DecideOutcome }[] = [];
  if (!isUuid(communityId)) return { approved, failed };
  for (const id of userIds.slice(0, 99)) {
    if (!isUuid(id)) continue;
    const outcome = await decideRequest(user.id, communityId, id, true);
    if (outcome === "ok") approved.push(id);
    else failed.push({ userId: id, outcome });
  }
  revalidatePath(`/c/${communityId}/requests`);
  revalidatePath(`/c/${communityId}`);
  return { approved, failed };
}

export async function reopenRequestB3(communityId: string, userId: string): Promise<ReopenOutcome> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(userId)) return "not_rejected";
  const outcome = await reopenRequest(user.id, communityId, userId);
  revalidatePath(`/c/${communityId}/requests`);
  revalidatePath(`/c/${communityId}`);
  return outcome;
}
