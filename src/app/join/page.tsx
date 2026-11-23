import type { Metadata } from "next";
import Link from "next/link";
import { FindCommunityForm } from "@/components/Forms";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Join a community" };

export default async function JoinPage() {
  await requireAcceptedUser();
  return (
    <main className="app">
      <header className="topbar">
        <Link href="/choose" className="back" aria-label="Back">‹</Link>
        <h1>Join a community</h1>
      </header>
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>Paste the invite link or type the code your Admin gave you.</p>
        <FindCommunityForm />
        <div className="card">
          <b>Examples</b>
          <div className="list" style={{ marginTop: 6 }}>
            <div className="item"><span className="t"><small>Link</small><b className="mono" style={{ fontSize: "0.85rem" }}>…/join/KH-7Q4M</b></span></div>
            <div className="item"><span className="t"><small>Code</small><b className="mono">KH-7Q4M</b></span></div>
          </div>
        </div>
      </div>
    </main>
  );
}
