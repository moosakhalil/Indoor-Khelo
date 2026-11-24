import type { Metadata } from "next";
import Link from "next/link";
import EnCommunityList from "@/components/EnCommunityList";
import EnIcon from "@/components/EnIcons";
import { EnHead, EnTopBar } from "@/components/EnParts";
import { listMyCommunities } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create or join" };

export default async function ChoosePage() {
  const user = await requireAcceptedUser();
  const mine = await listMyCommunities(user.id);
  const first = user.name.split(" ")[0];
  const none = mine.length === 0;
  return (
    <main className="app en-app en-wide">
      <EnTopBar user={{ name: user.name }} />
      <div className="en-col">
        <EnHead
          title={none ? `Welcome, ${first}` : `Welcome back, ${first}`}
          lead={none ? "You are not in a community yet. Create one for your group, or join one with an invite." : "Pick a community to open, or start a new one."}
        />
        <div className={`en-split${none ? " en-split-one" : ""}`}>
          {!none && <EnCommunityList mine={mine} />}
          <div className="en-doors">
            <Link href="/create" className={`en-door${none ? " primary" : ""}`}>
              <span className="en-door-ic"><EnIcon name="plus" size={22} /></span>
              <span className="en-door-t"><b>Create a community</b><small>For your club, friends or office team. You become the Admin.</small></span>
              <EnIcon name="right" size={18} />
            </Link>
            <Link href="/join" className="en-door">
              <span className="en-door-ic"><EnIcon name="userplus" size={22} /></span>
              <span className="en-door-t"><b>Join a community</b><small>Use an invite link or a code from your Admin.</small></span>
              <EnIcon name="right" size={18} />
            </Link>
            {none && (
              <div className="en-empty">
                <span className="en-empty-ic"><EnIcon name="people" size={28} /></span>
                <b>No communities yet</b>
                <small>Ask a friend for their invite link, or create your own and share the link.</small>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
