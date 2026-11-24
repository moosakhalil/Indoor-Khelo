import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CnNumberPicker from "@/components/CnNumberPicker";
import CnTopBar from "@/components/CnTopBar";
import { getCommunity, getMembership, takenNumbers } from "@/lib/community";
import { liveMatchFor } from "@/lib/cnData";
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
  const live = await liveMatchFor(id, user.id);
  return (
    <main className="app cn-page cn-wide">
      <CnTopBar back={changing ? `/c/${id}/profile` : undefined} />
      {isNew === "1" && (
        <ol className="cn-progress" aria-label="Setting up your community">
          <li className="done"><i aria-hidden="true" /><span>1 Community</span></li>
          <li className="now" aria-current="step"><i aria-hidden="true" /><span>2 Player number</span></li>
          <li className="later"><i aria-hidden="true" /><span>3 Invite friends</span></li>
        </ol>
      )}
      <h1 className="cn-h1">{changing ? "Change your number" : "Pick your player number"}</h1>
      <p className="muted cn-intro">
        {changing
          ? "Only free numbers can be picked. Your old number is free for others straight away, and past matches keep the number you used."
          : `Every member needs a number from 1 to 99, so this step cannot be skipped. First come, first served: crossed-out numbers are already taken in ${community.name}. You can change it later.`}
      </p>
      <CnNumberPicker
        communityId={id}
        taken={taken}
        mine={m.player_number}
        isNew={isNew === "1"}
        liveMatch={live ? { title: live.title } : null}
        keepHref={changing ? `/c/${id}/profile` : undefined}
      />
    </main>
  );
}
