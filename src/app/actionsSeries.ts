"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { teamNames } from "@/lib/matches";
import { addMatches, closeSeries, createSeries, createSeriesFromMatches, deleteSeries, removeMatch, reopenSeries, updateSeries } from "@/lib/seriesDb";
import { validateSeries, type SideRaw } from "@/lib/series";
import type { FormState } from "@/app/actions";

const idOf = (fd: FormData, key: string) => { const v = String(fd.get(key) ?? ""); return isUuid(v) ? v : null; };
const fixFields = "Please fix the highlighted fields.";
const S = (communityId: string, tail = "") => `/c/${communityId}/series${tail}`;
const SERIES_SLOTS = 6;

async function fields(fd: FormData, communityId: string) {
  const sides: SideRaw[] = Array.from({ length: SERIES_SLOTS }, (_, i) => ({ teamId: fd.get(`side${i}Team`), name: fd.get(`side${i}Name`) }));
  return validateSeries({ name: fd.get("name"), format: fd.get("format"), bestOf: fd.get("bestOf"), startsOn: fd.get("startsOn"), endsOn: fd.get("endsOn"), notes: fd.get("notes") }, sides, await teamNames(communityId));
}

export async function createSeriesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return { error: "Community not found." };
  const v = await fields(fd, communityId);
  if (!v.ok) return { fieldErrors: v.errors, error: fixFields };
  const r = await createSeries(user.id, communityId, v.value);
  if (r.outcome === "name_taken") return { fieldErrors: { name: "A series with this name already exists in this community." }, error: fixFields };
  if (r.outcome === "bad_team") return { fieldErrors: { sides: "Choose teams from this community." }, error: fixFields };
  if (r.outcome !== "ok") return { error: "Only members of this community can create a series." };
  revalidatePath(S(communityId), "layout");
  redirect(S(communityId, `/${r.id}?created=1`));
}

export async function updateSeriesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId");
  if (!communityId || !seriesId) return { error: "Series not found." };
  const v = await fields(fd, communityId);
  if (!v.ok) return { fieldErrors: v.errors, error: fixFields };
  const r = await updateSeries(user.id, communityId, seriesId, v.value);
  if (r.outcome === "name_taken") return { fieldErrors: { name: "A series with this name already exists in this community." }, error: fixFields };
  if (r.outcome === "bad_team") return { fieldErrors: { sides: "Choose teams from this community." }, error: fixFields };
  if (r.outcome === "side_in_use") return { fieldErrors: { sides: r.reason ?? "A team with matches in this series cannot be taken out." }, error: fixFields };
  if (r.outcome === "not_found") return { error: "That series no longer exists." };
  if (r.outcome !== "ok") return { error: "Only members of this community can change a series." };
  revalidatePath(S(communityId), "layout");
  redirect(S(communityId, `/${seriesId}?saved=1`));
}

/** Group matches that already exist (for example three already played) into a new series. */
export async function groupMatchesAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return;
  const name = String(fd.get("name") ?? "").trim();
  if (name.length > 60 || (name.length > 0 && name.length < 2)) redirect(S(communityId, "/new?e=name"));
  const r = await createSeriesFromMatches(user.id, communityId, name || null, fd.getAll("match").map(String));
  revalidatePath(S(communityId), "layout");
  if (r.outcome === "ok") redirect(S(communityId, `/${r.id}?created=1`));
  redirect(S(communityId, `/new?e=${r.outcome}&why=${encodeURIComponent((r.reason ?? "").slice(0, 160))}`));
}

export async function addMatchesAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId");
  if (!communityId || !seriesId) return;
  const r = await addMatches(user.id, communityId, seriesId, fd.getAll("match").map(String));
  revalidatePath(S(communityId), "layout");
  if (r.outcome === "ok") redirect(S(communityId, `/${seriesId}?added=${r.ids?.length ?? 0}`));
  redirect(S(communityId, `/${seriesId}/add?e=${r.outcome}&why=${encodeURIComponent((r.reason ?? "").slice(0, 160))}`));
}

export async function removeMatchAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId"), matchId = idOf(fd, "matchId");
  if (!communityId || !seriesId || !matchId) return;
  const r = await removeMatch(user.id, communityId, seriesId, matchId);
  revalidatePath(S(communityId), "layout");
  redirect(S(communityId, `/${seriesId}?${r === "ok" ? "removed=1" : `e=${r}`}`));
}

export async function seriesStatusAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId");
  if (!communityId || !seriesId) return;
  const r = String(fd.get("to")) === "closed" ? await closeSeries(user.id, communityId, seriesId) : await reopenSeries(user.id, communityId, seriesId);
  revalidatePath(S(communityId), "layout");
  redirect(S(communityId, `/${seriesId}?${r === "ok" ? "status=1" : `e=${r}`}`));
}

export async function deleteSeriesAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId");
  if (!communityId || !seriesId) return;
  const r = await deleteSeries(user.id, communityId, seriesId);
  revalidatePath(S(communityId), "layout");
  redirect(r === "ok" ? S(communityId, "?deleted=1") : S(communityId, `/${seriesId}?e=${r}`));
}
