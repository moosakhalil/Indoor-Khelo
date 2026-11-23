import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NumberPicker } from "@/components/Forms";
import { getCommunity, getMembership, takenNumbers } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your player number" };

// Required before anyone can enter a community. Also used later to change your number.
export default async function NumberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireAcceptedUser();
  const community = await getCommunity(id);
  if (!community) redirect("/choose");
  const m = await getMembership(id, user.id);
  if (!m || m.status === "left" || m.status === "removed" || m.status === "rejected") redirect("/choose");
  if (m.status === "pending") redirect(`/c/${id}/waiting`);
  const taken = await takenNumbers(id);
  const changing = m.player_number !== null;
  return (
    <main className="app">
      <header className="topbar">
        {changing && <Link href={`/c/${id}/profile`} className="back" aria-label="Back">‹</Link>}
        <h1>{changing ? "Change your number" : "Pick your player number"}</h1>
      </header>
      <p className="muted" style={{ margin: "0 0 12px" }}>
        {changing
          ? "Only free numbers can be picked. Your old number is free for others straight away, and past matches keep the number you used."
          : `Every member needs a number from 1 to 99, so this step cannot be skipped. First come, first served: crossed-out numbers are already taken in ${community.name}. You can change it later.`}
      </p>
      <NumberPicker communityId={id} taken={taken} mine={m.player_number} isNew={isNew === "1"} />
    </main>
  );
}
