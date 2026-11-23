import type { Metadata } from "next";
import { Suspense } from "react";
import QuickScore from "@/components/QuickScore";
import { requireMember } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Score" };
export const dynamic = "force-dynamic";

// The scoring screen for a match made with no signal. It carries no match data from the server: everything comes from the phone.
export default async function QuickScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  return (
    <Suspense fallback={<main className="app"><p className="muted center" style={{ marginTop: 40 }}>Opening the match…</p></main>}>
      <QuickScore communityId={id} />
    </Suspense>
  );
}
