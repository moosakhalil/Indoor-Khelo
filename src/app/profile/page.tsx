import { redirect } from "next/navigation";
import { listMyCommunities } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export default async function ProfileRouter() {
  const user = await requireAcceptedUser();
  const ready = (await listMyCommunities(user.id)).find((c) => c.status === "approved" && c.player_number !== null);
  redirect(ready ? `/c/${ready.id}/profile` : "/choose");
}
