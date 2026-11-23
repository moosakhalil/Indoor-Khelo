import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicProfileView from "@/components/PublicProfileView";
import { publicProfile } from "@/lib/profileShare";

// A shared player profile: read-only, opens without signing in, never listed by search engines.
export const metadata: Metadata = { title: "Player profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await publicProfile(token);
  if (!p) notFound();
  return (
    <main className="app">
      <header className="topbar"><h1>Player profile</h1><Link href="/" className="chip gold">Indoor Khelo</Link></header>
      <div className="stack" style={{ paddingBottom: 24 }}>
        <PublicProfileView p={p} />
        <section className="card center">
          <b>Scored with Indoor Khelo</b>
          <p className="muted small" style={{ margin: "6px 0 10px" }}>Score your own indoor cricket matches, with live scoring, stats and leaderboards.</p>
          <Link href="/" className="btn gold">Open Indoor Khelo</Link>
        </section>
      </div>
    </main>
  );
}
