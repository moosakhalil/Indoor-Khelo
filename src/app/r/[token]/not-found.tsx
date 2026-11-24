import type { Metadata } from "next";
import Link from "next/link";
import { AppMark } from "@/components/RpBrand";
import RpIcon from "@/components/RpIcons";
import "@/components/rp.css";

// What a visitor sees when a shared report link was switched off, or never existed. It says nothing about any community or match.
export const metadata: Metadata = { title: "Report link not active", robots: { index: false, follow: false } };

export default function ReportLinkGone() {
  return (
    <main className="app rp-pub">
      <header className="rp-pub-bar">
        <Link href="/" className="rp-pub-brand"><AppMark /> <span>Indoor Khelo</span></Link>
      </header>
      <div className="rp-gone" role="status">
        <span className="rp-empty-ic"><RpIcon name="link" size={28} /></span>
        <h1>This report link is not active</h1>
        <p>The person who shared it may have stopped sharing, or the link was typed wrongly. Ask them to send the link again.</p>
        <Link href="/" className="btn gold">Open Indoor Khelo</Link>
      </div>
      <p className="rp-pub-foot muted">Nothing is shown from the community when a link is not active.</p>
    </main>
  );
}
