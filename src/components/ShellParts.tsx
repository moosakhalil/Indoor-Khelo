// Small server pieces of the page shell. Each one loads its own data and is meant to sit inside <Suspense>, so the
// page itself never waits for them. None of them redirects: with no signed-in person they simply render nothing.
import Link from "next/link";
import { Suspense } from "react";
import CommunitySwitcher from "@/components/CommunitySwitcher";
import HmIcon from "@/components/HmIcons";
import Shirt from "@/components/Shirt";
import { shellCommunities, shellCommunityName, shellHasLive, shellMember, shellUnread, shellUser } from "@/lib/shellData";

/** "99+" for big numbers, so the badge never grows wide. */
export const countLabel = (n: number) => (n > 99 ? "99+" : String(n));

/** The alerts bell with the unread count, for the top bar of every page. */
export async function AlertsBell({ communityId }: { communityId: string }) {
  const user = await shellUser();
  if (!user) return null;
  const n = await shellUnread(communityId);
  return <BellLink communityId={communityId} count={n} />;
}

/** Presentational part (also used by the tests). */
export function BellLink({ communityId, count }: { communityId: string; count: number }) {
  return (
    <Link href={`/c/${communityId}/alerts`} className="hm-bell" aria-label={count > 0 ? `Alerts, ${count} unread` : "Alerts"}>
      <HmIcon name="bell" size={24} />
      {count > 0 && <span className="hm-bell-n" aria-hidden="true">{countLabel(count)}</span>}
    </Link>
  );
}

async function SwitcherLoader({ communityId, variant, name }: { communityId: string; variant: "topbar" | "sidebar"; name?: string }) {
  const [items, fetched] = await Promise.all([shellCommunities(), name ? Promise.resolve(name) : shellCommunityName(communityId)]);
  const communityName = name ?? fetched;
  if (!communityName) return null;
  return <CommunitySwitcher communityId={communityId} communityName={communityName} items={items} variant={variant} />;
}

/** The switcher entry (top bar on Home, sidebar on a desktop). Shows the plain name while the list loads. */
export function CommunitySwitcherSlot({ communityId, variant = "topbar", name }: { communityId: string; variant?: "topbar" | "sidebar"; name?: string }) {
  return (
    <Suspense fallback={name ? <span className="hm-sw-trigger hm-sw-wait">{name}</span> : null}>
      <SwitcherLoader communityId={communityId} variant={variant} name={name} />
    </Suspense>
  );
}

/** Red dot on the Matches tab while a match is being scored. The tab keeps its word; the dot has its own text. */
export async function LiveDot({ communityId }: { communityId: string }) {
  if (!(await shellHasLive(communityId))) return null;
  return <span className="hm-live" role="img" aria-label="A match is being scored now" />;
}

/** Unread count next to "Alerts" in the sidebar list. */
export async function AlertsCount({ communityId }: { communityId: string }) {
  const n = await shellUnread(communityId);
  if (n <= 0) return null;
  return <span className="hm-nav-count" aria-label={`${n} unread`}>{countLabel(n)}</span>;
}

/** The sidebar foot: who you are and your role here. */
export async function SidebarFoot({ communityId }: { communityId: string }) {
  const me = await shellMember(communityId);
  if (!me) return null;
  return (
    <Link href={`/c/${communityId}/profile`} className="hm-foot" aria-label={`Your profile: ${me.name}`}>
      <Shirt number={me.number} size="small" />
      <span className="t grow"><b>{me.name}</b><small className="muted">{me.role === "admin" ? "Admin" : "Member"}{me.number === null ? "" : ` · #${me.number}`}</small></span>
    </Link>
  );
}

/** Everything the navigation needs from the server, each piece in its own Suspense. */
export function navSlots(communityId: string) {
  return {
    header: <CommunitySwitcherSlot communityId={communityId} variant="sidebar" />,
    footer: <Suspense fallback={null}><SidebarFoot communityId={communityId} /></Suspense>,
    matchesSlot: <Suspense fallback={null}><LiveDot communityId={communityId} /></Suspense>,
    alertsSlot: <Suspense fallback={null}><AlertsCount communityId={communityId} /></Suspense>,
  };
}
