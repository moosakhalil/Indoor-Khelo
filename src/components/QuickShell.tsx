// The page frame for the "new match with no signal" screen. It looks like the normal frame (top bar, bottom bar, rail, sidebar)
// but it asks the server for NOTHING of its own: no alerts count, no community switcher, no member name. That keeps the saved
// copy of this page free of personal data and makes sure it draws the same with no signal at all.
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { IconSignalOff } from "@/components/B4Icons";
import "./qm.css";

export default function QuickShell({ communityId, title, back, ready, children }: { communityId: string; title: string; back: string; ready: boolean; children: React.ReactNode }) {
  return (
    <>
      <main className="app has-nav qm-app">
        <div className="page">
          <header className="topbar">
            <Link href={back} className="back" aria-label="Back">‹</Link>
            <h1>{title}</h1>
            <span className={`qm-status${ready ? "" : " warn"}`}><IconSignalOff size={14} />{ready ? "Offline-ready" : "Needs players"}</span>
          </header>
          {children}
        </div>
      </main>
      <BottomNav communityId={communityId} />
    </>
  );
}
