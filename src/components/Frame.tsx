import Link from "next/link";
import { Suspense } from "react";
import BottomNav from "@/components/BottomNav";
import { AlertsBell, navSlots } from "@/components/ShellParts";
import "./shell.css";

/**
 * A page inside a community: header, content and the navigation.
 * The navigation is a bottom bar on a phone, a rail on a tablet and a sidebar on a desktop.
 * `panel` is an optional extra column that only shows on very wide screens (1360 px and up).
 * `subtitle` is an optional line under the title (Home puts the community switcher there).
 * The alerts bell with the unread count is added to the top bar of every page; it loads on its own
 * (inside Suspense) and shows nothing when nobody is signed in.
 */
export default function Frame({
  communityId,
  title,
  back,
  right,
  panel,
  subtitle,
  children,
}: {
  communityId: string;
  title: string;
  back?: string;
  right?: React.ReactNode;
  panel?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="app has-nav">
        <div className="page">
          <header className="topbar">
            {back && <Link href={back} className="back" aria-label="Back">‹</Link>}
            {subtitle ? <div className="hm-title"><h1>{title}</h1>{subtitle}</div> : <h1>{title}</h1>}
            {right}
            <Suspense fallback={null}><AlertsBell communityId={communityId} /></Suspense>
          </header>
          {children}
        </div>
        {panel && <aside className="panel" aria-label="Details">{panel}</aside>}
      </main>
      <BottomNav communityId={communityId} {...navSlots(communityId)} />
    </>
  );
}
