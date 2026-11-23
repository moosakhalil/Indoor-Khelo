"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { updateProfile } from "@/lib/profile";
import { createTeam, deleteTeam, setSquad, updateTeam } from "@/lib/teams";
import { validateProfileInput, validateTeamInput } from "@/lib/validation";
import type { FormState } from "@/app/actions";

const idOf = (fd: FormData, key: string) => {
  const v = String(fd.get(key) ?? "");
  return isUuid(v) ? v : null;
};

/* ---------- my player profile: only I can change it ---------- */
export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const parsed = validateProfileInput({
    name: formData.get("name"),
    battingHand: formData.get("battingHand"),
    battingPosition: formData.get("battingPosition"),
    bowlingStyle: formData.get("bowlingStyle"),
    playingRole: formData.get("playingRole"),
  });
  if (!parsed.ok) return { error: parsed.error };
  await updateProfile(user.id, parsed.value);
  const communityId = idOf(formData, "communityId");
  if (communityId) revalidatePath(`/c/${communityId}`, "layout");
  return { message: "Profile saved." };
}

/* ---------- teams: any approved member can create and change them ---------- */
function teamFields(fd: FormData) {
  return validateTeamInput({
    name: fd.get("name"),
    description: fd.get("description"),
    captainId: fd.get("captainId"),
    viceCaptainId: fd.get("viceCaptainId"),
  });
}

export async function createTeamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  if (!communityId) return { error: "Community not found." };
  const parsed = teamFields(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors as Record<string, string>, error: "Please fix the highlighted fields." };
  const res = await createTeam(user.id, communityId, parsed.value);
  if (res.outcome === "name_taken") return { fieldErrors: { name: "A team with this name already exists in this community." }, error: "Please fix the highlighted fields." };
  if (res.outcome === "forbidden") return { error: "Only members of this community can create teams." };
  if (res.outcome === "bad_person") return { error: "The captain and vice-captain must be members of this community." };
  revalidatePath(`/c/${communityId}/teams`);
  redirect(`/c/${communityId}/teams/${res.id}/squad?new=1`);
}

export async function updateTeamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  const teamId = idOf(formData, "teamId");
  if (!communityId || !teamId) return { error: "Team not found." };
  const parsed = teamFields(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors as Record<string, string>, error: "Please fix the highlighted fields." };
  const outcome = await updateTeam(user.id, communityId, teamId, parsed.value);
  if (outcome === "name_taken") return { fieldErrors: { name: "A team with this name already exists in this community." }, error: "Please fix the highlighted fields." };
  if (outcome === "forbidden") return { error: "Only members of this community can change teams." };
  if (outcome === "not_found") return { error: "That team no longer exists." };
  if (outcome === "bad_person") return { error: "The captain and vice-captain must be members of this community." };
  revalidatePath(`/c/${communityId}/teams`, "layout");
  return { message: "Saved." };
}

export async function setSquadAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  const teamId = idOf(formData, "teamId");
  if (!communityId || !teamId) return;
  const ids = formData.getAll("member").map(String);
  await setSquad(user.id, communityId, teamId, ids);
  revalidatePath(`/c/${communityId}/teams`, "layout");
  redirect(`/c/${communityId}/teams/${teamId}`);
}

export async function deleteTeamAction(formData: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(formData, "communityId");
  const teamId = idOf(formData, "teamId");
  if (!communityId || !teamId) return;
  const outcome = await deleteTeam(user.id, communityId, teamId);
  revalidatePath(`/c/${communityId}/teams`, "layout");
  // A team with matches is protected; send the person back to the team, where the reason is shown.
  redirect(outcome === "has_matches" ? `/c/${communityId}/teams/${teamId}/edit` : `/c/${communityId}/teams`);
}
