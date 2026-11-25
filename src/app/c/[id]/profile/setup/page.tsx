import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CnTopBar from "@/components/CnTopBar";
import ProfileSetupForm from "@/components/ProfileSetupForm";
import { getCommunity, getMembership } from "@/lib/community";
import { getProfile } from "@/lib/profile";
import { afterNumberHref, profileIsEmpty } from "@/lib/profileSetup";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "How you play" };

// Asked once, right after the first player number in a community. Optional: Skip goes straight on, and a person who has already
// filled in any choice never sees this page (they are sent on). It never blocks joining, lineups or scoring.
export default async function ProfileSetupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: n } = await searchParams;
  const isNew = n === "1";
  const user = await requireAcceptedUser();
  const community = await getCommunity(id);
  if (!community) redirect("/choose");
  const m = await getMembership(id, user.id);
  if (!m || m.status !== "approved") redirect("/choose");
  if (m.player_number === null) redirect(`/c/${id}/number${isNew ? "?new=1" : ""}`);   // the number comes first
  const next = afterNumberHref(id, isNew);
  const profile = await getProfile(user.id);
  if (!profileIsEmpty(profile)) redirect(next);
  return (
    <main className="app cn-page cn-wide">
      <CnTopBar />
      <h1 className="cn-h1">Tell us how you play</h1>
      <p className="muted cn-intro">
        Takes about 10 seconds. It shows next to your name when you are picked for a match in {community.name}. Everything here is optional.
      </p>
      <ProfileSetupForm communityId={id} isNew={isNew} skipHref={next} />
    </main>
  );
}
