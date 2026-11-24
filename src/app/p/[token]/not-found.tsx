import type { Metadata } from "next";
import Link from "next/link";
import AcIcon from "@/components/AcIcons";
import "@/components/ac-public.css";

// Shown (with the real 404 status) when the link is switched off, replaced, mistyped or the account is gone. It says the two likely
// reasons and nothing else, so it never confirms whether a player exists.
export const metadata: Metadata = { title: "Link not working", robots: { index: false, follow: false } };

export default function ProfileLinkNotWorking() {
  return (
    <main className="app ac-pub-page">
      <header className="topbar ac-pub-bar">
        <Link href="/" className="ac-pub-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={28} height={28} />
          <span>Indoor <b>Khelo</b></span>
        </Link>
      </header>
      <div className="ac-dead">
        <section className="ac-dead-card" aria-labelledby="ac-dead-h">
          <span className="ac-dead-ic" aria-hidden="true"><AcIcon name="link" size={30} /></span>
          <h1 id="ac-dead-h">This link isn&rsquo;t working</h1>
          <p>The player may have switched sharing off, or the link was copied with a letter missing. Ask them to send it again.</p>
          <Link href="/" className="btn gold">Open Indoor Khelo</Link>
          <small>Error 404 · profile link not found</small>
        </section>
      </div>
    </main>
  );
}
