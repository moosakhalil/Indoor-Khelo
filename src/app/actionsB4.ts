"use server";
// Phase B (UI redesign), Builder 4: the two squad shortcuts of the team page. They only call the same team rules as the
// edit pages (any approved member, captain and vice-captain are always in the squad, taking someone out of the squad
// also removes their role), so nothing a person could not do before becomes possible.

import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { getTeam, listSquad, setSquad, updateTeam } from "@/lib/teams";
import { validateTeamInput } from "@/lib/validation";

export type SquadResult = { ok: boolean; error?: string };

const NOT_FOUND: SquadResult = { ok: false, error: "That team no longer exists." };
const FORBIDDEN: SquadResult = { ok: false, error: "Only members of this community can change teams." };

/** Take one player out of the permanent squad. If they were captain or vice-captain the role goes too. */
export async function removeFromSquadAction(communityId: string, teamId: string, userId: string): Promise<SquadResult> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(teamId) || !isUuid(userId)) return NOT_FOUND;
  const team = await getTeam(communityId, teamId);
  if (!team) return NOT_FOUND;
  const squad = await listSquad(teamId);
  const outcome = await setSquad(user.id, communityId, teamId, squad.map((s) => s.user_id).filter((id) => id !== userId));
  if (outcome === "forbidden") return FORBIDDEN;
  if (outcome !== "ok") return NOT_FOUND;
  revalidatePath(`/c/${communityId}/teams`, "layout");
  return { ok: true };
}

/** Make a player captain or vice-captain. They are added to the squad if needed; the same person cannot hold both roles. */
export async function setTeamRoleAction(communityId: string, teamId: string, userId: string, role: "captain" | "vice"): Promise<SquadResult> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(teamId) || !isUuid(userId) || (role !== "captain" && role !== "vice")) return NOT_FOUND;
  const team = await getTeam(communityId, teamId);
  if (!team) return NOT_FOUND;
  let captainId = team.captain_id;
  let viceCaptainId = team.vice_captain_id;
  if (role === "captain") {
    captainId = userId;
    if (viceCaptainId === userId) viceCaptainId = null;
  } else {
    viceCaptainId = userId;
    if (captainId === userId) captainId = null;
  }
  const parsed = validateTeamInput({ name: team.name, description: team.description, captainId, viceCaptainId });
  if (!parsed.ok) return { ok: false, error: Object.values(parsed.errors)[0] ?? "Please check the team." };
  const outcome = await updateTeam(user.id, communityId, teamId, parsed.value);
  if (outcome === "forbidden") return FORBIDDEN;
  if (outcome === "bad_person") return { ok: false, error: "The captain and vice-captain must be members of this community." };
  if (outcome !== "ok") return NOT_FOUND;
  revalidatePath(`/c/${communityId}/teams`, "layout");
  return { ok: true };
}
