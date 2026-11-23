"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { correctBall, setShare } from "@/lib/reports";
import type { FormState } from "@/app/actions";

/** Correct one ball of a finished match. Any approved member can; the change carries their name and recalculates every figure. */
export async function correctBallAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = String(fd.get("communityId") ?? "");
  const matchId = String(fd.get("matchId") ?? "");
  const ballId = String(fd.get("ballId") ?? "");
  if (!isUuid(communityId) || !isUuid(matchId) || !isUuid(ballId)) return { error: "That ball could not be found." };

  const extra = String(fd.get("extra") ?? "");
  const runsText = String(fd.get("runs") ?? "").trim();
  if (!/^\d{1,2}$/.test(runsText)) return { fieldErrors: { runs: "Runs must be a whole number from 0 to 12." }, error: "Please fix the highlighted fields." };
  const wk = String(fd.get("wicket") ?? "");
  const out = String(fd.get("out") ?? "");
  const fielder = String(fd.get("fielder") ?? "");
  if ((wk === "caught" || wk === "stumped" || wk === "run_out") && !fielder) return { fieldErrors: { fielder: "Choose the fielder." }, error: "Please fix the highlighted fields." };
  if (wk === "run_out" && !out) return { fieldErrors: { out: "Choose who was run out." }, error: "Please fix the highlighted fields." };
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 200);
  const patch = {
    runs: Number(runsText),
    extra: extra || null,
    wicket: wk ? { type: wk, out: wk === "run_out" ? out : null, fielder: fielder || null } : null,
  };
  const res = await correctBall(user.id, communityId, matchId, ballId, patch, reason);
  if (res.outcome === "forbidden") return { error: "Only members of this community can correct a match." };
  if (res.outcome === "not_found") return { error: "That match or ball could not be found." };
  if (res.outcome === "not_finished") return { error: "Only a finished match can be corrected here. While it is being scored, use the scoring pad." };
  if (res.outcome === "bad_input") return { error: res.error ?? "That is not a valid correction." };
  if (res.outcome === "refused") return { error: `This change would break the balls after it, so it was not saved. ${res.error ?? ""}` };
  revalidatePath(`/c/${communityId}`, "layout");
  redirect(`/c/${communityId}/matches/${matchId}/report?tab=balls&corrected=1`);
}

/** Turn the public link for a finished match on or off. */
export async function shareReportAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = String(fd.get("communityId") ?? "");
  const matchId = String(fd.get("matchId") ?? "");
  if (!isUuid(communityId) || !isUuid(matchId)) return;
  await setShare(user.id, communityId, matchId, String(fd.get("on") ?? "") === "1");
  revalidatePath(`/c/${communityId}/matches/${matchId}/report`);
  redirect(`/c/${communityId}/matches/${matchId}/report?tab=summary#share`);
}
