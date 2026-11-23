import type { Metadata } from "next";
import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import { listMyCommunities } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your communities" };

export default async function SwitchPage() {
  const user = await requireAcceptedUser();
  const mine = await listMyCommunities(user.id);
  return (
    <main className="app">
      <header className="topbar">
        <Link href="/home" className="back" aria-label="Back">‹</Link>
        <h1>Your communities</h1>
      </header>
      <div className="stack">
        <section className="card list">
          {mine.length === 0 && <div className="item muted">You are not in a community yet.</div>}
          {mine.map((c) => (
            <div key={c.id} className="item">
              <CommunityLogo name={c.name} />
              <span className="t grow"><b>{c.name}</b><small>{c.status === "pending" ? "Waiting for approval" : `${c.role === "admin" ? "Admin" : "Member"} · number ${c.player_number ?? "–"}`}</small></span>
              <a href={`/switch/${c.id}`} className="chip gold">Open</a>
            </div>
          ))}
        </section>
        <div className="two">
          <Link href="/create" className="btn ghost small" style={{ width: "100%" }}>Create community</Link>
          <Link href="/join" className="btn ghost small" style={{ width: "100%" }}>Join community</Link>
        </div>
      </div>
    </main>
  );
}
