"use server";
// Phase F1 (Series screens): actions that answer with a message instead of reloading the page, so nothing typed or ticked is lost.
// Every one keeps the checks of the existing series actions (signed in and accepted, member of the community, same validation, same database functions).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { teamNames } from "@/lib/matches";
import { addMatches, closeSeries, createSeries, createSeriesFromMatches, removeMatch, reopenSeries, updateSeries } from "@/lib/seriesDb";
import { validateSeries, type SideRaw } from "@/lib/series";
import { GROUP_ERRORS, GROUP_FALLBACK, PAGE_ERRORS } from "@/lib/seriesView";
import type { FormState } from "@/app/actions";

const idOf = (fd: FormData, key: string) => { const v = String(fd.get(key) ?? ""); return isUuid(v) ? v : null; };
const fixFields = "Please fix the highlighted fields.";
const S = (communityId: string, tail = "") => `/c/${communityId}/series${tail}`;
/** The form has room for 8 teams (the rule maximum), so a series made by grouping matches with 7 or 8 teams can still be edited. */
const SLOTS = 8;

async function fields(fd: FormData, communityId: string) {
  const sides: SideRaw[] = Array.from({ length: SLOTS }, (_, i) => ({ teamId: fd.get(`side${i}Team`), name: fd.get(`side${i}Name`) }));
  return validateSeries({ name: fd.get("name"), format: fd.get("format"), bestOf: fd.get("bestOf"), startsOn: fd.get("startsOn"), endsOn: fd.get("endsOn"), notes: fd.get("notes") }, sides, await teamNames(communityId));
}

/* ---------- create and change (same answers as createSeriesAction / updateSeriesAction, with 8 team rows) ---------- */
export async function createSeriesF1Action(_prev: FormState, fd: FormData): Promise<FormState> {
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

export async function updateSeriesF1Action(_prev: FormState, fd: FormData): Promise<FormState> {
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

/* ---------- group matches / add matches: the message comes back, the ticks stay ---------- */
export type SeriesPickState = { error?: string };

export async function groupMatchesF1Action(_prev: SeriesPickState, fd: FormData): Promise<SeriesPickState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return { error: "Community not found." };
  const name = String(fd.get("name") ?? "").trim();
  if (name.length > 60 || (name.length > 0 && name.length < 2)) return { error: GROUP_ERRORS.name };
  const r = await createSeriesFromMatches(user.id, communityId, name || null, fd.getAll("match").map(String));
  revalidatePath(S(communityId), "layout");
  if (r.outcome === "ok") redirect(S(communityId, `/${r.id}?created=1`));
  return { error: (r.reason ?? "").slice(0, 160) || GROUP_ERRORS[r.outcome] || GROUP_FALLBACK };
}

export async function addMatchesF1Action(_prev: SeriesPickState, fd: FormData): Promise<SeriesPickState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId");
  if (!communityId || !seriesId) return { error: "Series not found." };
  const r = await addMatches(user.id, communityId, seriesId, fd.getAll("match").map(String));
  revalidatePath(S(communityId), "layout");
  if (r.outcome === "ok") redirect(S(communityId, `/${seriesId}?added=${r.ids?.length ?? 0}`));
  return { error: (r.reason ?? "").slice(0, 160) || PAGE_ERRORS[r.outcome] || GROUP_FALLBACK };
}

/* ---------- quiet actions (no redirect): close, reopen and remove answer ok or a message, and the page refreshes by itself ---------- */
export type QuietResult = { ok: true } | { ok: false; error: string };

export async function seriesStatusQuietAction(fd: FormData): Promise<QuietResult> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId");
  if (!communityId || !seriesId) return { ok: false, error: PAGE_ERRORS.not_found! };
  const r = String(fd.get("to")) === "closed" ? await closeSeries(user.id, communityId, seriesId) : await reopenSeries(user.id, communityId, seriesId);
  revalidatePath(S(communityId), "layout");
  return r === "ok" ? { ok: true } : { ok: false, error: PAGE_ERRORS[r] ?? GROUP_FALLBACK };
}

export async function removeMatchQuietAction(fd: FormData): Promise<QuietResult> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), seriesId = idOf(fd, "seriesId"), matchId = idOf(fd, "matchId");
  if (!communityId || !seriesId || !matchId) return { ok: false, error: PAGE_ERRORS.not_found! };
  const r = await removeMatch(user.id, communityId, seriesId, matchId);
  revalidatePath(S(communityId), "layout");
  return r === "ok" ? { ok: true } : { ok: false, error: PAGE_ERRORS[r] ?? GROUP_FALLBACK };
}
