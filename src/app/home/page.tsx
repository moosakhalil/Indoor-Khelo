import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listMyCommunities } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

// Sends you to the right place: your last community, the number step, the waiting screen, or create/join.
export default async function HomeRouter() {
  const user = await requireAcceptedUser();
  const mine = await listMyCommunities(user.id);
  const last = (await cookies()).get("ik_last")?.value;
  const ready = mine.filter((c) => c.status === "approved" && c.player_number !== null);
  const preferred = ready.find((c) => c.id === last) ?? ready[0];
  if (preferred) redirect(`/c/${preferred.id}`);
  const needsNumber = mine.find((c) => c.status === "approved");
  if (needsNumber) redirect(`/c/${needsNumber.id}/number`);
  const waiting = mine.find((c) => c.status === "pending");
  if (waiting) redirect(`/c/${waiting.id}/waiting`);
  redirect("/choose");
}
