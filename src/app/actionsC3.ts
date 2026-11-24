"use server";

// Phase C3 (UI redesign): server actions for "Pick lineups" and "Correct a finished match".
// They call the same library functions as before (setLineup, addGuest in lib/matches.ts, parseEvent and buildState of the
// engine, read only) and keep every check: signed in and accepted, approved member of the community, match not started
// (lineups) or completed (corrections). The difference is that they ANSWER the page instead of redirecting after a
// failure, so what the person picked or typed stays on screen.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { getMembership, isUuid } from "@/lib/community";
import { addGuest, getMatch, listLineup, setLineup } from "@/lib/matches";
import { validateGuestName } from "@/lib/matchRules";
import { noticeFor } from "@/lib/notices";
import { buildState } from "@/lib/engine/engine";
import { parseEvent } from "@/lib/engine/parse";
import { loadEvents } from "@/lib/scoring";

const idOf = (v: unknown) => {
  const s = String(v ?? "");
  return isUuid(s) ? s : null;
};

export type LineupReply = { ok: true; guestId?: string } | { ok: false; code: string; text: string; field?: "guest" };

const fail = (code: string, extra: { side?: string; max?: string } = {}, field?: "guest"): LineupReply => ({
  ok: false, code, text: noticeFor(code, extra)?.text ?? "That could not be done.", field,
});

const sideValue = (v: FormDataEntryValue): 0 | 1 | 2 | null => (v === "0" ? 0 : v === "1" ? 1 : v === "2" ? 2 : null);

/** Save the sides the person changed. People who were not changed are left as they are (setLineup's own rule). */
export async function saveLineupC3(communityIdIn: string, matchIdIn: string, fields: Record<string, string>): Promise<LineupReply> {
  const user = await requireAcceptedUser();
  const communityId = idOf(communityIdIn);
  const matchId = idOf(matchIdIn);
  if (!communityId || !matchId) return fail("not_found");
  const members = new Map<string, 0 | 1 | 2>();
  const guests = new Map<string, 0 | 1 | 2>();
  for (const [key, value] of Object.entries(fields)) {
    const side = sideValue(value);
    if (side === null) continue;
    if (key.startsWith("m_")) members.set(key.slice(2), side);
    else if (key.startsWith("g_")) guests.set(key.slice(2), side);
  }
  const res = await setLineup(user.id, communityId, matchId, members, guests);
  revalidatePath(`/c/${communityId}`, "layout");
  if (res.outcome === "too_many") return fail("too_many", { side: res.tooMany!.side, max: String(res.tooMany!.max) });
  if (res.outcome !== "ok") return fail(res.outcome);
  redirect(`/c/${communityId}/matches/${matchId}?e=lineup_saved`);
}

/** Add a guest by name (same checks as addGuestAction). Answers with the new entry so it can be undone. */
export async function addGuestC3(communityIdIn: string, matchIdIn: string, side: number, nameIn: string): Promise<LineupReply> {
  const user = await requireAcceptedUser();
  const communityId = idOf(communityIdIn);
  const matchId = idOf(matchIdIn);
  if (!communityId || !matchId) return fail("not_found");
  const name = validateGuestName(nameIn);
  if (!name.ok) return fail("guest_name", {}, "guest");
  const res = await addGuest(user.id, communityId, matchId, Number(side), name.value);
  revalidatePath(`/c/${communityId}`, "layout");
  if (res.outcome === "too_many") return fail("too_many", { side: res.tooMany!.side, max: String(res.tooMany!.max) });
  if (res.outcome === "duplicate_guest") return fail("duplicate_guest", {}, "guest");
  if (res.outcome !== "ok") return fail(res.outcome);
  const entry = (await listLineup(communityId, matchId)).find((l) => l.kind === "guest" && (l.guest_name ?? "").trim().toLowerCase() === name.value.trim().toLowerCase());
  return { ok: true, guestId: entry?.id };
}

/** Undo "Guest added": take that guest out again (a guest is only ever a row of this match). */
export async function removeGuestC3(communityIdIn: string, matchIdIn: string, entryIdIn: string): Promise<LineupReply> {
  const user = await requireAcceptedUser();
  const communityId = idOf(communityIdIn);
  const matchId = idOf(matchIdIn);
  const entryId = idOf(entryIdIn);
  if (!communityId || !matchId || !entryId) return fail("not_found");
  const res = await setLineup(user.id, communityId, matchId, new Map(), new Map([[entryId, 0 as const]]));
  revalidatePath(`/c/${communityId}`, "layout");
  if (res.outcome !== "ok") return fail(res.outcome);
  return { ok: true };
}

/* ---------- correct a finished match: what would change (nothing is saved) ---------- */

export type CorrectionPreview =
  | { ok: true; changed: boolean; innings: { label: string; before: string; after: string } | null; result: { before: string; after: string } | null }
  | { ok: false; kind: "refused" | "invalid" | "forbidden" | "not_found" | "not_finished"; error: string };

/**
 * Works out the correction exactly as correctBall does (same event, same engine) but writes nothing, so the person
 * sees the score and the result before saving. Any approved member may ask, as for the real correction.
 */
export async function previewCorrectionC3(input: {
  communityId: string; matchId: string; ballId: string;
  extra: string; runs: number; wicket: string; out: string; fielder: string;
}): Promise<CorrectionPreview> {
  const user = await requireAcceptedUser();
  const communityId = idOf(input.communityId);
  const matchId = idOf(input.matchId);
  const ballId = idOf(input.ballId);
  if (!communityId || !matchId || !ballId) return { ok: false, kind: "not_found", error: "That ball could not be found." };
  const mem = await getMembership(communityId, user.id);
  if (!mem || mem.status !== "approved") return { ok: false, kind: "forbidden", error: "Only members of this community can correct a match." };
  const match = await getMatch(communityId, matchId, user.id);
  if (!match) return { ok: false, kind: "not_found", error: "That match or ball could not be found." };
  if (match.status !== "completed") return { ok: false, kind: "not_finished", error: "Only a finished match can be corrected here. While it is being scored, use the scoring pad." };

  const events = await loadEvents(matchId);
  const before = buildState(events);
  if (!before.ok) return { ok: false, kind: "not_found", error: "That match or ball could not be found." };
  const seq = events.length ? events[events.length - 1]!.seq + 1 : 1;
  const wk = input.wicket;
  const patch = {
    runs: Number(input.runs),
    extra: input.extra || null,
    wicket: wk ? { type: wk, out: wk === "run_out" ? input.out || null : null, fielder: input.fielder || null } : null,
  };
  const parsed = parseEvent({ id: crypto.randomUUID(), seq, type: "edit", payload: { target: ballId, patch }, at: new Date().toISOString() });
  if (!parsed.ok) return { ok: false, kind: "invalid", error: parsed.error };
  const after = buildState([...events, parsed.value]);
  if (!after.ok) return { ok: false, kind: "refused", error: after.error };

  const where = before.state.innings.find((i) => i.balls.some((b) => b.eventId === ballId));
  const same = where ? after.state.innings.find((i) => i.index === where.index) : undefined;
  const score = (i: { runs: number; wickets: number }) => `${i.runs}/${i.wickets}`;
  const innings = where && same
    ? { label: `${before.state.sides[where.batting - 1]} ${where.superOver ? "super over" : `innings ${where.index + 1}`}`, before: score(where), after: score(same) }
    : null;
  const rb = before.state.result?.text ?? "";
  const ra = after.state.result?.text ?? "";
  const changed = (innings ? innings.before !== innings.after : false) || rb !== ra || JSON.stringify(before.state.innings.map((i) => i.balls.map((b) => b.text))) !== JSON.stringify(after.state.innings.map((i) => i.balls.map((b) => b.text)));
  return { ok: true, changed, innings, result: rb || ra ? { before: rb, after: ra } : null };
}
