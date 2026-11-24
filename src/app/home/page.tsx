import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listMyCommunities } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

// Sends you to the right place. The rules, in order (written down for review in Phase G1; behaviour unchanged):
//   1. not signed in                 -> / (requireAcceptedUser, via requireUser)
//   2. signed in, terms not accepted -> /terms
//   3. a ready community (approved with a player number): the last one opened on this phone (cookie ik_last), else the first -> /c/{id}
//   4. approved but no player number -> /c/{id}/number
//   5. request still waiting         -> /c/{id}/waiting
//   6. in no community               -> /choose
// While this runs, loading.tsx shows the branded loading screen instead of a blank page.
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
