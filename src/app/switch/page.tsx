import type { Metadata } from "next";
import { cookies } from "next/headers";
import EnSwitchList from "@/components/EnSwitchList";
import { EnHead, EnTopBar } from "@/components/EnParts";
import { listMyCommunities } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your communities" };

export default async function SwitchPage() {
  const user = await requireAcceptedUser();
  const mine = await listMyCommunities(user.id);
  // The same choice /home makes: the last community opened on this phone (cookie ik_last), otherwise the first ready one.
  const last = (await cookies()).get("ik_last")?.value;
  const ready = mine.filter((c) => c.status === "approved" && c.player_number !== null);
  const lastReady = ready.find((c) => c.id === last);
  const preferred = lastReady ?? ready[0];
  return (
    <main className="app en-app en-narrow">
      <EnTopBar back="/home" user={{ name: user.name }} />
      <div className="en-col">
        <EnHead title="Your communities" lead={mine.length > 0 ? "Tap one to open it." : undefined} />
        <EnSwitchList mine={mine} preferredId={preferred?.id} lastId={lastReady?.id} />
      </div>
    </main>
  );
}
