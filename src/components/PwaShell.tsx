"use client";

import { usePathname, useRouter } from "next/navigation";
import AcIcon from "@/components/AcIcons";
import { flushAllWaiting } from "@/lib/outbox";
import { useEffect, useRef, useState } from "react";
import "./ac-pwa.css";

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
  const [copied, setCopied] = useState<"done" | "manual" | null>(null);
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
  // One tap copies this page's address so it can be pasted into Safari. If the browser refuses, the address is shown to select.
  async function copyAddress() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("done");
    } catch {
      setCopied("manual");
    }
  }

  // The welcome page has its own install row (EnInstallHint), so the floating one is not shown there too.
  // The /install page is the install help, so the floating banners stay away there too.
  const path = usePathname();
  const onInstallPage = path === "/install";
  const onWelcome = path === "/" || onInstallPage;
  const iosSteps = iosHelp === "safari-steps" && !onInstallPage;
  return (
    <>
      <div className="ac-toasts" aria-live="polite">
        {!online && (
          <div className="ac-toast" role="status">
            <span className="ac-tic orange"><AcIcon name="wifioff" size={22} /></span>
            <span className="ac-tt"><b>You are offline</b><small>Your saved data is safe on this phone. Some things need internet.</small></span>
          </div>
        )}
        {waiting && (
          <div className="ac-toast" role="status">
            <span className="ac-tic green"><AcIcon name="refresh" size={22} /></span>
            <span className="ac-tt"><b>New version is ready</b><small>Refresh to update. Your saved data is kept.</small></span>
            <button type="button" className="ac-btn gold ac-inline" onClick={refresh}>Refresh</button>
          </div>
        )}
        {installEvent && !onWelcome && (
          <div className="ac-toast stacked" role="region" aria-label="Install Indoor Khelo">
            <div className="ac-trow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ac-appicon" src="/icons/icon-192.png" alt="" width={44} height={44} />
              <span className="ac-tt"><b>Install Indoor Khelo</b><small>Add it to your home screen. It opens full screen and works offline.</small></span>
            </div>
            <div className="ac-two">
              <button type="button" className="ac-btn gold" onClick={install}><AcIcon name="download" size={18} /> Install</button>
              <button type="button" className="ac-btn" onClick={notNow}>Not now</button>
            </div>
          </div>
        )}
        {iosHelp === "open-safari" && !onInstallPage && (
          <div className="ac-toast stacked" role="region" aria-label="Open this page in Safari to install">
            <div className="ac-trow">
              <span className="ac-tic blue"><AcIcon name="link" size={22} /></span>
              <span className="ac-tt">
                <b>Open this page in Safari to install</b>
                <small>On iPhone only Safari can add an app to the home screen. Copy this page&rsquo;s address and open it in Safari.</small>
              </span>
            </div>
            {copied === "manual" && (
              <input className="ac-addr" readOnly value={typeof window === "undefined" ? "" : window.location.href} aria-label="This page's address" onFocus={(e) => e.currentTarget.select()} />
            )}
            <p className="ac-copied" role="status">{copied === "done" ? "Address copied. Open Safari and paste it." : copied === "manual" ? "Select the address above and copy it." : ""}</p>
            <div className="ac-two">
              <button type="button" className="ac-btn gold" onClick={copyAddress}><AcIcon name={copied === "done" ? "check" : "copy"} size={18} /> {copied === "done" ? "Copied" : "Copy address"}</button>
              <button type="button" className="ac-btn" onClick={notNow}>Not now</button>
            </div>
          </div>
        )}
      </div>
      {iosSteps && (
        <div className="ac-bottom" aria-live="polite">
          <div className="ac-toast stacked ac-steps" role="region" aria-label="Add Indoor Khelo to your iPhone">
            <b className="ac-st">Add Indoor Khelo to your iPhone</b>
            <ol>
              <li><i>1</i><span>Tap the <b>Share</b> button at the bottom of Safari. <em className="ac-key"><AcIcon name="share" size={16} /></em></span></li>
              <li><i>2</i><span>Scroll and tap <b>Add to Home Screen</b>. <em className="ac-key"><AcIcon name="addsquare" size={16} /></em></span></li>
              <li><i>3</i><span>Tap <b>Add</b>. Open Indoor Khelo from your home screen.</span></li>
            </ol>
            <div><button type="button" className="ac-btn ac-inline" onClick={notNow}>Not now</button></div>
          </div>
          <span className="ac-arrow" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
