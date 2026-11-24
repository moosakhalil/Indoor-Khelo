"use client";
// Home while the phone has no signal: a calm blue banner (offline is not an error) that says what still works,
// holds the gold "New match with no signal" button and tells the person the players are already saved on the phone.
// Online it renders nothing. The button itself is QuickMatchLink, unchanged.
import { useEffect, useState } from "react";
import { QuickMatchLink } from "@/components/CacheRoster";
import HmIcon from "@/components/HmIcons";
import "./home.css";

export default function OfflineBanner({ communityId }: { communityId: string }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <section className="hm-offline" role="status" aria-label="You are offline">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <HmIcon name="wifioff" size={22} />
        <span className="t grow">
          <b>You are offline</b>
          <small>Players are saved on this phone, so you can still set up and score a match. It is sent when the signal is back.</small>
        </span>
      </div>
      <QuickMatchLink communityId={communityId} onlyOffline />
    </section>
  );
}
