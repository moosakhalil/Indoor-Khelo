"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>,
  matches: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M5 8c4 2 10 2 14 0M5 16c4-2 10-2 14 0" /></svg>,
  teams: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 2 6 6" /></svg>,
  payments: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12h5M3 10h14" /></svg>,
  profile: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-5 4-7 8-7s8 2 8 7" /></svg>,
};

// The same five tabs on every screen size, never an icon without a label:
//   phone (under 640 px)  bar at the bottom
//   tablet (640 px up)    narrow rail on the left, icons with small labels
//   desktop (1024 px up)  sidebar with the app name, full labels and a "More" list
export const MAIN_TABS = [
  { key: "home", label: "Home", path: "", exact: true },
  { key: "matches", label: "Matches", path: "/matches" },
  { key: "teams", label: "Teams", path: "/teams" },
  { key: "payments", label: "Payments", path: "/payments" },
  { key: "profile", label: "Profile", path: "/profile" },
] as const;

// Only shown in the sidebar (they stay reachable from the pages on a phone).
export const MORE_LINKS = [
  { label: "Community", path: "/community" },
  { label: "Series", path: "/series" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Insights", path: "/insights" },
  { label: "Members", path: "/members" },
  { label: "Alerts", path: "/alerts" },
] as const;

// Pages that belong to the Home tab: the tab stays lit on them, so one tab is always active.
const HOME_PAGES = ["/members", "/alerts", "/community", "/invite", "/requests", "/settings"] as const;

/**
 * The navigation. The four optional slots hold small server pieces (see ShellParts.tsx) and are all optional:
 * `header` is the community switcher at the top of the sidebar, `footer` is who you are, `matchesSlot` is the live dot
 * on the Matches tab and `alertsSlot` is the unread count beside Alerts in the sidebar list.
 */
export default function BottomNav({
  communityId, header, footer, matchesSlot, alertsSlot,
}: { communityId: string; header?: React.ReactNode; footer?: React.ReactNode; matchesSlot?: React.ReactNode; alertsSlot?: React.ReactNode }) {
  const path = usePathname();
  const base = `/c/${communityId}`;
  const onHomePage = HOME_PAGES.some((p) => path === `${base}${p}` || path.startsWith(`${base}${p}/`));
  return (
    <nav className="nav" aria-label="Main">
      <Link href={base} className="nav-brand" tabIndex={-1} aria-hidden="true">
        <span className="logo-mark">IK</span>
        <b>Indoor Khelo</b>
      </Link>
      {header && <div className="hm-nav-head">{header}</div>}
      <ul>
        {MAIN_TABS.map((t) => {
          const href = `${base}${t.path}`;
          const active = "exact" in t && t.exact ? path === href || path === `${href}/` || onHomePage : path.startsWith(href);
          return (
            <li key={t.key} className="hm-nav-li">
              <Link href={href} aria-current={active ? "page" : undefined}>
                {ICONS[t.key]}
                <span>{t.label}</span>
              </Link>
              {t.key === "matches" && matchesSlot}
            </li>
          );
        })}
      </ul>
      <div className="nav-more">
        <p className="nav-more-h">More</p>
        <ul>
          {MORE_LINKS.map((l) => {
            const href = `${base}${l.path}`;
            return (
              <li key={l.path} className="hm-nav-li">
                <Link href={href} aria-current={path.startsWith(href) ? "page" : undefined}>{l.label}</Link>
                {l.path === "/alerts" && alertsSlot}
              </li>
            );
          })}
          <li><Link href="/switch">Switch community</Link></li>
        </ul>
      </div>
      {footer && <div className="hm-nav-foot">{footer}</div>}
    </nav>
  );
}
