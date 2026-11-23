import type { Metadata } from "next";
import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import { listMyCommunities } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create or join" };

export default async function ChoosePage() {
  const user = await requireAcceptedUser();
  const mine = await listMyCommunities(user.id);
  return (
    <main className="app">
      <header className="topbar"><h1>Welcome, {user.name.split(" ")[0]}</h1></header>
      <div className="stack">
        {mine.length > 0 && (
          <section>
            <h2 style={{ fontSize: "1rem", margin: "4px 0 8px" }}>Your communities</h2>
            <div className="card list">
              {mine.map((c) => (
                <Link key={c.id} href={c.status === "pending" ? `/c/${c.id}/waiting` : `/c/${c.id}`} className="item">
                  <CommunityLogo name={c.name} />
                  <span className="t grow"><b>{c.name}</b><small>{c.status === "pending" ? "Waiting for approval" : c.role === "admin" ? "Admin" : "Member"}</small></span>
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <p className="muted" style={{ margin: "4px 0 0" }}>What would you like to do?</p>
        <Link href="/create" className="card gold" style={{ minHeight: 116, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <b style={{ fontSize: "1.2rem" }}>Create a community</b>
          <span className="muted small">For your club, friends or office team. You become the Admin.</span>
        </Link>
        <Link href="/join" className="card" style={{ minHeight: 116, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <b style={{ fontSize: "1.2rem" }}>Join a community</b>
          <span className="muted small">Use an invite link or a code from your Admin.</span>
        </Link>
      </div>
    </main>
  );
}
