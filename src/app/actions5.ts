"use server";

import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { getLock, adminTakeover, cancelTakeoverRequest, claimDevice, releaseScoring, requestTakeover, respondTakeover, takeScoring, type LockOutcome } from "@/lib/scoring";

// The scoring lock. These return a short code the screen turns into words; nothing here redirects,
// so a scorer in the middle of a match never loses their place.
export type LockAction = "take" | "claim" | "release" | "request" | "cancel" | "accept" | "decline" | "admin";

/** What the scorer's phone asks every few seconds: do I still hold the lock, and is someone asking for it? */
export async function lockStatus(communityId: string, matchId: string): Promise<{ scorerId: string | null; scorerDevice: string | null; requester: string | null; me: string } | null> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(matchId)) return null;
  const l = await getLock(communityId, matchId);
  if (!l) return null;
  return { scorerId: l.scorer_id, scorerDevice: l.scorer_device, requester: l.takeover_name, me: user.id };
}

export async function lockAction(communityId: string, matchId: string, action: LockAction, deviceId: string): Promise<LockOutcome> {
  const user = await requireAcceptedUser();
  if (!isUuid(communityId) || !isUuid(matchId)) return "not_found";
  let out: LockOutcome;
  switch (action) {
    case "take": out = await takeScoring(user.id, communityId, matchId, deviceId); break;
    case "claim": out = await claimDevice(user.id, communityId, matchId, deviceId); break;
    case "release": out = await releaseScoring(user.id, communityId, matchId); break;
    case "request": out = await requestTakeover(user.id, communityId, matchId); break;
    case "cancel": out = await cancelTakeoverRequest(user.id, communityId, matchId); break;
    case "accept": out = await respondTakeover(user.id, communityId, matchId, true); break;
    case "decline": out = await respondTakeover(user.id, communityId, matchId, false); break;
    case "admin": out = await adminTakeover(user.id, communityId, matchId); break;
    default: out = "bad_state";
  }
  revalidatePath(`/c/${communityId}/matches/${matchId}`, "layout");
  return out;
}
