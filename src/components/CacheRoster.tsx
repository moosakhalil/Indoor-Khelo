"use client";
// Keeps the community's players on this phone so a match can be set up with no signal, and asks the phone to keep the two
// "no signal" screens ready to open offline. Mounted on Home and on the matches screens.
import Link from "next/link";
import { useEffect, useState } from "react";
import { saveRoster } from "@/lib/outbox";
import type { RosterMember, RosterTeam } from "@/lib/quickMatchRules";

export default function CacheRoster({ communityId, me, members, teams }: { communityId: string; me: string; members: RosterMember[]; teams: RosterTeam[] }) {
  useEffect(() => {
    void saveRoster({ communityId, me, savedAt: Date.now(), members, teams });
    // Production only: the service worker is not active in development.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: "CACHE_PAGES", urls: [`/c/${communityId}/matches/quick`, `/c/${communityId}/matches/quick/score`] });
      }).catch(() => undefined);
    }
  }, [communityId, me, members, teams]);
  return null;
}

/** "New match with no signal": always on the matches screen, and on Home only while the phone is offline. */
export function QuickMatchLink({ communityId, onlyOffline }: { communityId: string; onlyOffline?: boolean }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (onlyOffline && online) return null;
  return (
    <Link href={`/c/${communityId}/matches/quick`} className={onlyOffline ? "btn gold" : "btn ghost small"} style={{ width: "100%" }}>
      New match with no signal
    </Link>
  );
}
