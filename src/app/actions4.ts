"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import {
  addGuest, cancelMatch, createMatch, createRematch, createSeveral, deleteMatch, fillWithIn, linkGuest, markAlertsRead,
  postponeMatch, remindNoReplies, setAvailability, setLineup, setToss, teamNames, unlinkGuest, updateMatch,
} from "@/lib/matches";
import {
  SEVERAL_MAX, checkWhen, validTimeZone, validateGuestName, validateMatchDetails, validateSides, validateToss, zonedToUtc,
} from "@/lib/matchRules";
import type { FormState } from "@/app/actions";

const idOf = (fd: FormData, key: string) => {
  const v = String(fd.get(key) ?? "");
  return isUuid(v) ? v : null;
};

async function zoneOf(fd: FormData): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get("ik_tz")?.value;
  return validTimeZone(fd.get("tz")) ?? validTimeZone(fromCookie ? decodeURIComponent(fromCookie) : null);
}

const NO_ZONE = "We could not read your phone's time zone. Please reload the page and try again.";

/** Everything the setup form sends, as one plain object (dismissals can arrive several times). */
function rawOf(fd: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(Array.from(fd.keys()))) raw[key] = key === "dismissals" ? fd.getAll(key).map(String) : fd.get(key);
  return raw;
}

const fixFields = "Please fix the highlighted fields.";

/* ---------- create one match ---------- */
export async function createMatchAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return { error: "Community not found." };
  const tz = await zoneOf(fd);
  if (!tz) return { error: NO_ZONE };
  const names = await teamNames(communityId);
  const sides = validateSides({ teamId: fd.get("sideATeam"), name: fd.get("sideAName") }, { teamId: fd.get("sideBTeam"), name: fd.get("sideBName") }, names);
  const details = validateMatchDetails(rawOf(fd), tz, new Date());
  const errors: Record<string, string> = { ...(sides.ok ? {} : sides.errors), ...(details.ok ? {} : details.errors) };
  if (Object.keys(errors).length || !sides.ok || !details.ok) return { fieldErrors: errors, error: fixFields };
  const res = await createMatch(user.id, communityId, { sides: sides.value, ...details.value });
  if (res.outcome === "forbidden") return { error: "Only members of this community can create matches." };
  if (res.outcome === "bad_team") return { fieldErrors: { sideA: "Choose teams from this community." }, error: fixFields };
  if (res.outcome === "same_names") return { fieldErrors: { sideB: "The two sides need different names." }, error: fixFields };
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(`/c/${communityId}/matches/${res.id}?created=1`);
}

/* ---------- schedule several at once ---------- */
export async function createSeveralAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return { error: "Community not found." };
  const tz = await zoneOf(fd);
  if (!tz) return { error: NO_ZONE };
  const count = Number(fd.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > SEVERAL_MAX) return { error: `Plan between 1 and ${SEVERAL_MAX} matches at a time.` };
  const names = await teamNames(communityId);
  const sides = validateSides({ teamId: fd.get("sideATeam"), name: fd.get("sideAName") }, { teamId: fd.get("sideBTeam"), name: fd.get("sideBName") }, names);
  const errors: Record<string, string> = sides.ok ? {} : { ...sides.errors };
  const items = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const when = String(fd.get(`when_${i}`) ?? "").trim();
    if (!when) { errors[`when_${i}`] = `Choose a date and time for match ${i + 1}.`; continue; }
    const d = validateMatchDetails(
      { when, venue: fd.get(`venue_${i}`), oversPreset: fd.get(`oversPreset_${i}`), oversCustom: fd.get(`oversCustom_${i}`), playersPerSide: fd.get("playersPerSide") },
      tz, now,
    );
    if (!d.ok) {
      for (const [k, v] of Object.entries(d.errors)) errors[`${k}_${i}`] = v;
      continue;
    }
    items.push(d.value);
  }
  if (Object.keys(errors).length || !sides.ok) return { fieldErrors: errors, error: fixFields };
  const res = await createSeveral(user.id, communityId, sides.value, items);
  if (res.outcome === "forbidden") return { error: "Only members of this community can create matches." };
  if (res.outcome === "bad_team") return { fieldErrors: { sideA: "Choose teams from this community." }, error: fixFields };
  if (res.outcome === "same_names") return { fieldErrors: { sideB: "The two sides need different names." }, error: fixFields };
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(`/c/${communityId}/matches?planned=${res.ids?.length ?? 0}`);
}

/* ---------- edit ---------- */
export async function updateMatchAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return { error: "Match not found." };
  const tz = await zoneOf(fd);
  if (!tz) return { error: NO_ZONE };
  const details = validateMatchDetails(rawOf(fd), tz, new Date());
  if (!details.ok) return { fieldErrors: details.errors, error: fixFields };
  const res = await updateMatch(user.id, communityId, matchId, details.value);
  if (res.outcome === "forbidden") return { error: "Only members of this community can change matches." };
  if (res.outcome === "not_found") return { error: "That match no longer exists." };
  if (res.outcome === "locked") return { error: "This match has already started, so its setup can no longer be changed here." };
  if (res.outcome === "too_many") return { fieldErrors: { playersPerSide: `${res.tooMany!.side} already has more than ${res.tooMany!.max} players in the lineup. Take some out first.` }, error: fixFields };
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(`/c/${communityId}/matches/${matchId}?saved=1`);
}

/* ---------- small actions on the match page (plain buttons) ---------- */
function back(communityId: string, matchId: string, code?: string, extra = "") {
  return `/c/${communityId}/matches/${matchId}${code ? `?e=${code}${extra}` : ""}`;
}

export async function setAvailabilityAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const res = await setAvailability(user.id, communityId, matchId, String(fd.get("answer") ?? ""));
  revalidatePath(`/c/${communityId}`, "layout");
  const next = String(fd.get("next") ?? "");
  if (res !== "ok") redirect(back(communityId, matchId, res));
  if (next === "home") redirect(`/c/${communityId}`);
  if (next === "list") redirect(`/c/${communityId}/matches`);
  redirect(back(communityId, matchId));
}

export async function remindAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const res = await remindNoReplies(user.id, communityId, matchId);
  revalidatePath(`/c/${communityId}`, "layout");
  if (res.outcome === "ok") redirect(back(communityId, matchId, "reminded", `&n=${res.sent}`));
  if (res.outcome === "too_soon") redirect(back(communityId, matchId, "too_soon", `&n=${res.waitMinutes}`));
  redirect(back(communityId, matchId, res.outcome));
}

export async function postponeAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const res = await postponeMatch(user.id, communityId, matchId);
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(back(communityId, matchId, res === "ok" ? "postponed" : res));
}

export async function cancelAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const res = await cancelMatch(user.id, communityId, matchId);
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(back(communityId, matchId, res === "ok" ? "cancelled" : res));
}

export async function deleteMatchAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const res = await deleteMatch(user.id, communityId, matchId);
  revalidatePath(`/c/${communityId}`, "layout");
  if (res !== "ok") redirect(back(communityId, matchId, res));
  redirect(`/c/${communityId}/matches?deleted=1`);
}

/* ---------- toss ---------- */
export async function tossAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return { error: "Match not found." };
  const t = validateToss(fd.get("winner"), fd.get("decision"));
  if (!t.ok) return { error: t.error };
  const res = await setToss(user.id, communityId, matchId, t.value);
  if (res === "locked") return { error: "This match has already started, so the toss can no longer be changed here." };
  if (res !== "ok") return { error: "That match could not be found." };
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(back(communityId, matchId, "toss_saved"));
}

/* ---------- lineup ---------- */
const sideValue = (v: FormDataEntryValue | null): 0 | 1 | 2 | null => (v === "0" ? 0 : v === "1" ? 1 : v === "2" ? 2 : null);

export async function setLineupAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const members = new Map<string, 0 | 1 | 2>();
  const guests = new Map<string, 0 | 1 | 2>();
  for (const [key, value] of fd.entries()) {
    const side = sideValue(value);
    if (side === null) continue;
    if (key.startsWith("m_")) members.set(key.slice(2), side);
    else if (key.startsWith("g_")) guests.set(key.slice(2), side);
  }
  const res = await setLineup(user.id, communityId, matchId, members, guests);
  revalidatePath(`/c/${communityId}`, "layout");
  const base = `/c/${communityId}/matches/${matchId}/lineup`;
  if (res.outcome === "too_many") redirect(`${base}?e=too_many&side=${encodeURIComponent(res.tooMany!.side)}&max=${res.tooMany!.max}`);
  if (res.outcome !== "ok") redirect(`${base}?e=${res.outcome}`);
  redirect(back(communityId, matchId, "lineup_saved"));
}

export async function fillInAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const res = await fillWithIn(user.id, communityId, matchId, Number(fd.get("side")));
  revalidatePath(`/c/${communityId}`, "layout");
  const base = `/c/${communityId}/matches/${matchId}/lineup`;
  if (res.outcome !== "ok") redirect(`${base}?e=${res.outcome}`);
  redirect(`${base}?e=filled&n=${res.added}&skip=${res.skipped}`);
}

export async function addGuestAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return;
  const base = `/c/${communityId}/matches/${matchId}/lineup`;
  const name = validateGuestName(fd.get("guestName"));
  if (!name.ok) redirect(`${base}?e=guest_name`);
  const res = await addGuest(user.id, communityId, matchId, Number(fd.get("side")), name.value);
  revalidatePath(`/c/${communityId}`, "layout");
  if (res.outcome === "too_many") redirect(`${base}?e=too_many&side=${encodeURIComponent(res.tooMany!.side)}&max=${res.tooMany!.max}`);
  if (res.outcome !== "ok") redirect(`${base}?e=${res.outcome}`);
  redirect(`${base}?e=guest_added`);
}

export async function linkGuestAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  const entryId = idOf(fd, "entryId");
  const target = idOf(fd, "targetId");
  if (!communityId || !matchId) return;
  const res = entryId && target ? await linkGuest(user.id, communityId, matchId, entryId, target) : "not_found";
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(back(communityId, matchId, res === "ok" ? "linked" : res));
}

export async function unlinkGuestAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  const entryId = idOf(fd, "entryId");
  if (!communityId || !matchId) return;
  const res = entryId ? await unlinkGuest(user.id, communityId, matchId, entryId) : "not_found";
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(back(communityId, matchId, res === "ok" ? "unlinked" : res));
}

/* ---------- rematch ---------- */
export async function rematchAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  const matchId = idOf(fd, "matchId");
  if (!communityId || !matchId) return { error: "Match not found." };
  const tz = await zoneOf(fd);
  if (!tz) return { error: NO_ZONE };
  const when = String(fd.get("when") ?? "").trim();
  if (!when) return { fieldErrors: { when: "Choose the date and time of the rematch." }, error: fixFields };
  const d = zonedToUtc(when, tz);
  if (!d) return { fieldErrors: { when: "Choose a real date and time." }, error: fixFields };
  const bad = checkWhen(d, new Date());
  if (bad) return { fieldErrors: { when: bad }, error: fixFields };
  const res = await createRematch(user.id, communityId, matchId, d);
  if (res.outcome === "forbidden") return { error: "Only members of this community can create matches." };
  if (res.outcome === "not_found") return { error: "The original match no longer exists." };
  if (res.outcome !== "ok") return { error: "The rematch could not be created." };
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(`/c/${communityId}/matches/${res.id}?rematch=1`);
}

/* ---------- alerts ---------- */
export async function markAlertsReadAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return;
  await markAlertsRead(user.id, communityId);
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(`/c/${communityId}/alerts`);
}
