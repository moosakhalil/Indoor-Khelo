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

// The five tabs: Home, Matches, Teams, Payments, Profile. Every tab has a label, never an icon alone.
export default function BottomNav({ communityId }: { communityId: string }) {
  const path = usePathname();
  const base = `/c/${communityId}`;
  const tabs = [
    { key: "home", label: "Home", href: base, exact: true },
    { key: "matches", label: "Matches", href: `${base}/matches` },
    { key: "teams", label: "Teams", href: `${base}/teams` },
    { key: "payments", label: "Payments", href: `${base}/payments` },
    { key: "profile", label: "Profile", href: `${base}/profile` },
  ];
  return (
    <nav className="nav" aria-label="Main">
      <ul>
        {tabs.map((t) => {
          const active = t.exact ? path === t.href || path === `${base}/` : path.startsWith(t.href);
          return (
            <li key={t.key}>
              <Link href={t.href} aria-current={active ? "page" : undefined}>
                {ICONS[t.key]}
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
