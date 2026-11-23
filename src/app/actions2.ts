"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import {
  deleteAccountData,
  deleteCommunity,
  leaveCommunity,
  removeMember,
  resetNumber,
  setRole,
  updateCommunity,
} from "@/lib/management";
import { safeNextPath, validateCommunityInput } from "@/lib/validation";
import type { FormState } from "@/app/actions";

const idOf = (fd: FormData, key: string) => {
  const v = String(fd.get(key) ?? "");
  return isUuid(v) ? v : null;
};

/* ---------- leave a community (also cancels a waiting request) ---------- */
export async function leaveAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  if (!communityId) redirect("/choose");
  const outcome = await leaveCommunity(user.id, communityId);
  if (outcome === "only_admin") redirect(`/c/${communityId}/leave?blocked=1`);
  redirect("/home");
}

/* ---------- Admin: members ---------- */
export async function removeMemberAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  const targetId = idOf(formData, "userId");
  if (!communityId || !targetId) return;
  const outcome = await removeMember(user.id, communityId, targetId);
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(outcome === "ok" ? `/c/${communityId}/members` : `/c/${communityId}/members/${targetId}?error=${outcome}`);
}

export async function setRoleAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  const targetId = idOf(formData, "userId");
  const role = formData.get("role") === "admin" ? "admin" : "member";
  if (!communityId || !targetId) return;
  const outcome = await setRole(user.id, communityId, targetId, role);
  revalidatePath(`/c/${communityId}`, "layout");
  const back = safeNextPath(formData.get("next"), "");
  if (back && outcome === "ok") redirect(back);
  redirect(`/c/${communityId}/members/${targetId}${outcome === "ok" ? "" : `?error=${outcome}`}`);
}

export async function resetNumberAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  const targetId = idOf(formData, "userId");
  if (!communityId || !targetId) return;
  const outcome = await resetNumber(user.id, communityId, targetId);
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(`/c/${communityId}/members/${targetId}${outcome === "ok" ? "?done=number" : `?error=${outcome}`}`);
}

/* ---------- Admin: settings ---------- */
export async function updateCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  if (!communityId) return { error: "Community not found." };
  const parsed = validateCommunityInput({
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    approvalRequired: formData.get("approvalRequired") === "on",
  });
  if (!parsed.ok) return { fieldErrors: parsed.errors as Record<string, string>, error: "Please fix the highlighted fields." };
  const outcome = await updateCommunity(user.id, communityId, parsed.value);
  if (outcome === "forbidden") return { error: "Only an Admin can change the settings." };
  revalidatePath(`/c/${communityId}`, "layout");
  return { message: "Saved." };
}

/* ---------- Admin: delete the community ---------- */
export async function deleteCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  if (!communityId) return { error: "Community not found." };
  const outcome = await deleteCommunity(user.id, communityId, String(formData.get("typedName") ?? ""));
  if (outcome === "forbidden") return { error: "Only an Admin can delete the community." };
  if (outcome === "name_mismatch") return { error: "The name you typed does not match. Type the community name exactly." };
  redirect("/home");
}

/* ---------- delete my account: app data first; the sign-in record is removed by the button that follows ---------- */
export async function deleteAccountDataAction(): Promise<FormState> {
  const user = await requireAcceptedUser();
  const outcome = await deleteAccountData(user.id);
  if (outcome === "blocked") return { error: "You are the only Admin of a community that still has members. Make someone else Admin first, or delete that community." };
  return { message: "done" };
}
