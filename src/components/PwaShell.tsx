"use client";

import { useRouter } from "next/navigation";
import { flushAllWaiting } from "@/lib/outbox";
import { useEffect, useRef, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "ik-install-dismissed-at";
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

function dismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return t > 0 && Date.now() - t < FOURTEEN_DAYS;
  } catch {
    return false;
  }
}
function rememberDismiss() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage can be blocked */ }
}

function detectEnvironment() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|MicroMessenger/i.test(ua);
  const otherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return { isIos, standalone, inApp, otherIosBrowser };
}

/** Mounted once in the root layout. Offline banner, new-version banner, install help, service worker. */
export default function PwaShell() {
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [iosHelp, setIosHelp] = useState<"safari-steps" | "open-safari" | null>(null);
  const reloaded = useRef(false);
  const router = useRouter();

  // Balls scored with no signal are sent when the app opens, and again when the signal comes back (on any screen).
  useEffect(() => {
    void flushAllWaiting();
    const on = () => { void flushAllWaiting(); };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);

  // Match times are shown in the viewer's own time zone. The server learns it from this cookie (only a zone name, nothing personal).
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz || document.cookie.split("; ").some((c) => c === `ik_tz=${encodeURIComponent(tz)}`)) return;
      document.cookie = `ik_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    } catch { /* an unreadable zone just means times show in UTC */ }
  }, [router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Service worker: production only (a service worker in development keeps old code alive).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      if (cancelled) return;
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) setWaiting(nw);
        });
      });
    }).catch(() => { /* the app still works without a service worker */ });
    const onChange = () => {
      if (reloaded.current) return;
      reloaded.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () => { cancelled = true; navigator.serviceWorker.removeEventListener("controllerchange", onChange); };
  }, []);

  // Install: one-tap button on Android and desktop Chrome, steps on iPhone.
  useEffect(() => {
    const env = detectEnvironment();
    if (env.standalone || dismissedRecently()) return;
    if (env.isIos) {
      if (env.inApp) return; // cannot add to home screen from inside another app's browser
      setIosHelp(env.otherIosBrowser ? "open-safari" : "safari-steps");
      return;
    }
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  function refresh() { waiting?.postMessage({ type: "SKIP_WAITING" }); }
  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }
  function notNow() { rememberDismiss(); setInstallEvent(null); setIosHelp(null); }

  return (
    <div className="pwa-banners" aria-live="polite">
      {!online && (
        <div className="banner gold" role="status">Offline · your saved data is safe on this phone. Some things need internet.</div>
      )}
      {waiting && (
        <div className="banner green row space" role="status">
          <span>New version is ready</span>
          <button type="button" className="chip" onClick={refresh}>Refresh</button>
        </div>
      )}
      {installEvent && (
        <div className="card">
          <b>Install Indoor Khelo</b>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>Add it to your home screen. It opens full screen and works offline.</p>
          <div className="two">
            <button type="button" className="btn gold small" onClick={install}>Install</button>
            <button type="button" className="btn ghost small" onClick={notNow}>Not now</button>
          </div>
        </div>
      )}
      {iosHelp === "safari-steps" && (
        <div className="card">
          <b>Add Indoor Khelo to your iPhone</b>
          <ol className="steps">
            <li><i>1</i><span>Tap the <b>Share</b> button at the bottom of Safari.</span></li>
            <li><i>2</i><span>Scroll and tap <b>Add to Home Screen</b>.</span></li>
            <li><i>3</i><span>Tap <b>Add</b>. Open Indoor Khelo from your home screen.</span></li>
          </ol>
          <button type="button" className="btn ghost small" style={{ marginTop: 10 }} onClick={notNow}>Not now</button>
        </div>
      )}
      {iosHelp === "open-safari" && (
        <div className="card">
          <b>Open this page in Safari to install</b>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>On iPhone only Safari can add an app to the home screen. Copy this page&rsquo;s address and open it in Safari.</p>
          <button type="button" className="btn ghost small" onClick={notNow}>Not now</button>
        </div>
      )}
    </div>
  );
}
