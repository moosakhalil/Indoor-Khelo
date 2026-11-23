"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireAcceptedUser, requireUser } from "@/lib/session";
import {
  audit,
  chooseNumber,
  createCommunity,
  decideRequest,
  getMembership,
  isUuid,
  regenerateInvite,
  requestToJoin,
} from "@/lib/community";
import {
  normalizeInviteCode,
  parsePlayerNumber,
  safeNextPath,
  validateCommunityInput,
  validatePersonName,
} from "@/lib/validation";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; message?: string };

/* ---------- terms (asked once, on first sign-in) ---------- */
export async function acceptTermsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (formData.get("accept") !== "on") return { error: "Please tick the box to accept the Terms and Privacy notice." };
  await query("update app_user set terms_accepted_at = coalesce(terms_accepted_at, now()), updated_at = now() where id = $1", [user.id]);
  redirect(safeNextPath(formData.get("next"), "/choose"));
}

/* ---------- create a community ---------- */
export async function createCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const parsed = validateCommunityInput({
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    approvalRequired: formData.get("approvalRequired") === "on",
  });
  if (!parsed.ok) return { fieldErrors: parsed.errors as Record<string, string>, error: "Please fix the highlighted fields." };
  const id = await createCommunity(user.id, parsed.value);
  redirect(`/c/${id}/number?new=1`);
}

/* ---------- join: type a link or code, then see the community first ---------- */
export async function findCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAcceptedUser();
  const code = normalizeInviteCode(formData.get("code"));
  if (!code) return { error: "That does not look like an invite link or code. A code looks like KH-7Q4M." };
  redirect(`/join/${code}`);
}

export async function requestJoinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const code = normalizeInviteCode(formData.get("code"));
  if (!code) return { error: "That invite link or code is not valid." };
  const res = await requestToJoin(user.id, code);
  switch (res.outcome) {
    case "not_found": return { error: "This invite link or code is not valid any more. Ask the Admin for a new one." };
    case "full": return { error: "This community already has 99 members, so no one else can join." };
    case "already_member": redirect(`/c/${res.communityId}`);
    case "pending": redirect(`/c/${res.communityId}/waiting`);
    case "approved": redirect(`/c/${res.communityId}/number`);
  }
  return { error: "Something went wrong. Please try again." };
}

/* ---------- admin: approve or reject a join request ---------- */
export async function decideRequestAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = String(formData.get("communityId") ?? "");
  const targetId = String(formData.get("userId") ?? "");
  const approve = formData.get("decision") === "approve";
  if (!isUuid(communityId) || !isUuid(targetId)) return;
  await decideRequest(user.id, communityId, targetId, approve);
  revalidatePath(`/c/${communityId}/requests`);
  revalidatePath(`/c/${communityId}`);
}

/* ---------- player number: required, first come first served ---------- */
export async function chooseNumberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = String(formData.get("communityId") ?? "");
  if (!isUuid(communityId)) return { error: "Community not found." };
  const parsed = parsePlayerNumber(formData.get("number"));
  if (!parsed.ok) return { error: parsed.error };
  const outcome = await chooseNumber(user.id, communityId, parsed.value);
  if (outcome === "taken") return { error: `Number ${parsed.value} was just taken. Please choose another number.` };
  if (outcome === "not_member") return { error: "You can choose a number once you are an approved member." };
  if (outcome === "locked") return { error: "You are in a match that is being played, so your number is locked until it ends." };
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(formData.get("isNew") === "1" ? `/c/${communityId}/invite?new=1` : `/c/${communityId}`);
}

/* ---------- admin: replace the invite link ---------- */
export async function replaceInviteAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = String(formData.get("communityId") ?? "");
  if (!isUuid(communityId)) return;
  await regenerateInvite(user.id, communityId);
  revalidatePath(`/c/${communityId}/invite`);
}

/* ---------- profile: change my name ---------- */
export async function updateNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const parsed = validatePersonName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };
  await query("update app_user set name = $2, updated_at = now() where id = $1", [user.id, parsed.value]);
  const communityId = String(formData.get("communityId") ?? "");
  if (isUuid(communityId) && (await getMembership(communityId, user.id))) {
    await audit(communityId, user.id, "name_changed", {});
    revalidatePath(`/c/${communityId}`, "layout");
  }
  return { message: "Name saved." };
}
