import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AcIcon from "@/components/AcIcons";
import PublicProfileView from "@/components/PublicProfileView";
import { publicProfile } from "@/lib/profileShare";
import "@/components/ac-public.css";

// A shared player profile: read-only, opens without signing in, never listed by search engines.
export const metadata: Metadata = { title: "Player profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await publicProfile(token);
  if (!p) notFound();
  return (
    <main className="app ac-pub-page">
      <header className="topbar ac-pub-bar">
        <Link href="/" className="ac-pub-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={28} height={28} />
          <span>Indoor <b>Khelo</b></span>
        </Link>
        <span className="ac-pub-tag"><AcIcon name="link" size={14} /> Public profile</span>
        <Link href="/" className="ac-pub-open">Open Indoor Khelo</Link>
      </header>
      <PublicProfileView
        p={p}
        after={(
          <>
            <section className="ac-cta">
              <h2>Scored with Indoor Khelo</h2>
              <p>Score your own indoor cricket matches, with live scoring, stats and leaderboards.</p>
              <Link href="/" className="btn gold">Open Indoor Khelo</Link>
            </section>
            <aside className="ac-shared" aria-label="About this page">
              <AcIcon name="shield" size={18} />
              <div>
                <b>Shared by the player</b>
                This page shows no community names, number, match list or payments, and search engines are told not to list it. The player can switch the link off at any time.
              </div>
            </aside>
          </>
        )}
      />
    </main>
  );
}
