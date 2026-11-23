"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import { setProfileShare } from "@/lib/profileShare";

/** The player switches their own public profile link on or off. Nobody else can. */
export async function shareProfileAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = String(fd.get("communityId") ?? "");
  if (!isUuid(communityId)) return;
  await setProfileShare(user.id, String(fd.get("on") ?? "") === "1");
  revalidatePath(`/c/${communityId}/profile`);
  redirect(`/c/${communityId}/profile#share`);
}
