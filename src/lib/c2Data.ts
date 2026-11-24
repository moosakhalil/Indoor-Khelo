// Phase C (UI redesign), Builder C2: what the server hands to the several-matches and rematch screens.
import { listTeams, teamsOfPlayer } from "@/lib/teams";

export type PickTeam = { id: string; name: string; squad: number; captain: string | null; mine: boolean };

/** Every team of the community, with the ones the viewer plays for, captains or vice-captains marked as theirs. */
export async function pickableTeams(communityId: string, userId: string): Promise<PickTeam[]> {
  const [teams, squads] = await Promise.all([listTeams(communityId), teamsOfPlayer(communityId, userId)]);
  const mine = new Set(squads.map((s) => s.id));
  for (const t of teams) if (t.captain_id === userId || t.vice_captain_id === userId) mine.add(t.id);
  return teams.map((t) => ({ id: t.id, name: t.name, squad: t.squad_count, captain: t.captain_name, mine: mine.has(t.id) }));
}
