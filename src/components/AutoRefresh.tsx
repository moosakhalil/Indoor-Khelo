"use client";
// Spectators: the live score reloads itself every few seconds while the page is open and the phone is online.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
