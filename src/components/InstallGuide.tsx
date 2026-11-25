"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import AcIcon from "@/components/AcIcons";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Platform = "ios" | "android";

function detect() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  // Browsers inside other apps (WhatsApp, Instagram, Facebook...) cannot install anything.
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|MicroMessenger|; wv\)/i.test(ua);
  const otherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return { isIos, isAndroid, standalone, inApp, otherIosBrowser };
}

/* ---------- small pictures of the phone screens (decorative; the words next to them carry the meaning) ---------- */

/** The address shown inside the little pictures: this site's own address once the page is open in a browser. */
function useHost(): string {
  const [h, setH] = useState("indoor-khelo.app");
  useEffect(() => { setH(window.location.host); }, []);
  return h;
}

const Dots = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);

function Shot({ label, children, tone }: { label: string; children: ReactNode; tone: "ios" | "and" }) {
  return (
    <div className={`ins-shot ${tone}`} aria-hidden="true">
      <div className="ins-shot-in">{children}</div>
      <span className="ins-shot-cap">{label}</span>
    </div>
  );
}

function IosBar() {
  return (
    <Shot tone="ios" label="Bottom of Safari">
      <div className="ins-safbar">
        <span className="ins-sbtn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></span>
        <span className="ins-sbtn dim"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></span>
        <span className="ins-sbtn hot"><AcIcon name="share" size={22} /></span>
        <span className="ins-sbtn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v15H6.5A1.5 1.5 0 0 0 5 20.5z" /></svg></span>
        <span className="ins-sbtn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="4" y="7" width="12" height="12" rx="2.5" /><path d="M8 4h10a2 2 0 0 1 2 2v10" /></svg></span>
      </div>
      <span className="ins-tag" style={{ left: "50%" }}>Share</span>
    </Shot>
  );
}
function IosSheet() {
  return (
    <Shot tone="ios" label="The Share menu">
      <ul className="ins-list">
        <li><span>Copy</span><AcIcon name="copy" size={18} /></li>
        <li><span>Add to Bookmarks</span><span className="ins-dot" /></li>
        <li className="hot"><span>Add to Home Screen</span><AcIcon name="addsquare" size={20} /></li>
        <li><span>Find on Page</span><span className="ins-dot" /></li>
      </ul>
    </Shot>
  );
}
function IosAdd() {
  const host = useHost();
  return (
    <Shot tone="ios" label="Add to Home Screen">
      <div className="ins-dlg">
        <div className="ins-dlg-top"><span>Cancel</span><b>Add to Home Screen</b><span className="hot">Add</span></div>
        <div className="ins-dlg-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={44} height={44} />
          <div><b>Indoor Khelo</b><small>{host}</small></div>
        </div>
      </div>
    </Shot>
  );
}
function HomeGrid({ tone }: { tone: "ios" | "and" }) {
  return (
    <Shot tone={tone} label="Your home screen">
      <div className="ins-home">
        {Array.from({ length: 7 }).map((_, i) => <span key={i} className="ins-app-ph" />)}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className="ins-app-me"><img src="/icons/icon-192.png" alt="" width={44} height={44} /><small>Indoor Khelo</small></span>
      </div>
    </Shot>
  );
}
function AndMenuBtn() {
  const host = useHost();
  return (
    <Shot tone="and" label="Top right of Chrome">
      <div className="ins-chrome">
        <span className="ins-url">{host}</span>
        <span className="ins-sbtn hot"><Dots /></span>
      </div>
      <span className="ins-tag" style={{ right: "6px" }}>Menu</span>
    </Shot>
  );
}
function AndMenuList() {
  return (
    <Shot tone="and" label="Chrome menu">
      <ul className="ins-list and">
        <li><span>New tab</span><span className="ins-dot" /></li>
        <li><span>Bookmarks</span><span className="ins-dot" /></li>
        <li className="hot"><span>Install app</span><AcIcon name="download" size={20} /></li>
        <li><span>Share…</span><span className="ins-dot" /></li>
      </ul>
    </Shot>
  );
}
function AndInstallDlg() {
  const host = useHost();
  return (
    <Shot tone="and" label="Install app?">
      <div className="ins-dlg and">
        <b className="ins-dlg-t">Install app?</b>
        <div className="ins-dlg-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={44} height={44} />
          <div><b>Indoor Khelo</b><small>{host}</small></div>
        </div>
        <div className="ins-dlg-act"><span>Cancel</span><span className="hot">Install</span></div>
      </div>
    </Shot>
  );
}

/* ---------- the guide ---------- */

function Step({ n, title, children, art }: { n: number; title: ReactNode; children?: ReactNode; art?: ReactNode }) {
  return (
    <li className="ins-step">
      <i className="ins-n">{n}</i>
      <div className="ins-step-body">
        <h3>{title}</h3>
        {children && <p>{children}</p>}
        {art}
      </div>
    </li>
  );
}

export default function InstallGuide() {
  const [tab, setTab] = useState<Platform>("android");
  const [guessed, setGuessed] = useState<Platform | null>(null);
  const [env, setEnv] = useState({ standalone: false, inApp: false, otherIosBrowser: false });
  const [ev, setEv] = useState<InstallEvent | null>(null);
  const [copied, setCopied] = useState<"done" | "manual" | null>(null);
  const [link, setLink] = useState("");

  useEffect(() => {
    const d = detect();
    const p: Platform | null = d.isIos ? "ios" : d.isAndroid ? "android" : null;
    if (p) { setTab(p); setGuessed(p); }
    setEnv({ standalone: d.standalone, inApp: d.inApp, otherIosBrowser: d.otherIosBrowser });
    setLink(`${window.location.origin}/install`);
    const onPrompt = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    const onInstalled = () => { setEv(null); setEnv((s) => ({ ...s, standalone: true })); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!ev) return;
    try { await ev.prompt(); await ev.userChoice; } catch { /* the browser refused: the steps below still work */ }
    setEv(null);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link || window.location.href); setCopied("done"); } catch { setCopied("manual"); }
  }

  const needsSafari = tab === "ios" && (env.otherIosBrowser || env.inApp) && guessed === "ios";
  const needsChrome = tab === "android" && env.inApp && guessed === "android";

  return (
    <div className="ins">
      <header className="ins-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512.png" alt="Indoor Khelo logo" width={96} height={96} className="ins-logo" />
        <h1>Install <span>Indoor Khelo</span></h1>
        <p>Put it on your home screen. It opens full screen, like a real app, and scoring keeps working with no signal.</p>
      </header>

      {env.standalone ? (
        <section className="ins-done" aria-live="polite">
          <span className="ins-done-ic"><AcIcon name="check" size={28} /></span>
          <h2>Indoor Khelo is installed</h2>
          <p>You are already using the app from your home screen.</p>
          <Link href="/" className="ac-btn gold">Open Indoor Khelo</Link>
        </section>
      ) : (
        <>
          <div className="ins-tabs" role="tablist" aria-label="Choose your phone">
            <button type="button" role="tab" aria-selected={tab === "ios"} className={tab === "ios" ? "on" : ""} onClick={() => setTab("ios")}>iPhone</button>
            <button type="button" role="tab" aria-selected={tab === "android"} className={tab === "android" ? "on" : ""} onClick={() => setTab("android")}>Android</button>
          </div>
          {guessed && <p className="ins-guess">We think you are on {guessed === "ios" ? "an iPhone" : "an Android phone"}. Wrong one? Switch above.</p>}

          {tab === "ios" && (
            <section className="ins-panel" aria-label="Steps for iPhone">
              {needsSafari && (
                <div className="ins-warn" role="note">
                  <b>Open this page in Safari first</b>
                  <span>On iPhone only Safari can add an app to the home screen. Copy the link, open Safari, paste it in the address bar.</span>
                  <button type="button" className="ac-btn gold" onClick={copyLink}><AcIcon name={copied === "done" ? "check" : "copy"} size={18} /> {copied === "done" ? "Link copied" : "Copy link"}</button>
                  {copied === "manual" && <input className="ac-addr" readOnly value={link} aria-label="Page address" onFocus={(e) => e.currentTarget.select()} />}
                </div>
              )}
              <ol className="ins-steps">
                <Step n={1} title="Open this page in Safari">The blue compass app. Chrome and other browsers on iPhone cannot do this.</Step>
                <Step n={2} title={<>Tap the <b>Share</b> button</>} art={<IosBar />}>It is the square with an arrow pointing up, in the bar at the bottom. Cannot see it? Tap the <b>•••</b> button first. On iPad it is at the top.</Step>
                <Step n={3} title={<>Tap <b>Add to Home Screen</b></>} art={<IosSheet />}>Scroll down in the menu until you see it.</Step>
                <Step n={4} title={<>Tap <b>Add</b></>} art={<IosAdd />}>Keep the name <b>Indoor Khelo</b>. The Add button is at the top right.</Step>
                <Step n={5} title="Open it from your home screen" art={<HomeGrid tone="ios" />}>Look for the gold Indoor Khelo icon. Always open the app from there, not from Safari.</Step>
              </ol>
            </section>
          )}

          {tab === "android" && (
            <section className="ins-panel" aria-label="Steps for Android">
              {needsChrome && (
                <div className="ins-warn" role="note">
                  <b>Open this page in Chrome first</b>
                  <span>This page is open inside another app, which cannot install anything. Tap the menu at the top right and choose <b>Open in Chrome</b>, or copy the link and paste it into Chrome.</span>
                  <button type="button" className="ac-btn gold" onClick={copyLink}><AcIcon name={copied === "done" ? "check" : "copy"} size={18} /> {copied === "done" ? "Link copied" : "Copy link"}</button>
                  {copied === "manual" && <input className="ac-addr" readOnly value={link} aria-label="Page address" onFocus={(e) => e.currentTarget.select()} />}
                </div>
              )}
              {ev ? (
                <div className="ins-oneTap">
                  <b>One tap and it is done</b>
                  <span>Your phone is ready to install the app.</span>
                  <button type="button" className="ac-btn gold ins-big" onClick={install}><AcIcon name="download" size={20} /> Install Indoor Khelo</button>
                </div>
              ) : (
                <p className="ins-orsteps">No Install button? Follow these steps in Chrome.</p>
              )}
              <ol className="ins-steps">
                <Step n={1} title="Open this page in Chrome">The round red, yellow, green and blue app.</Step>
                <Step n={2} title={<>Tap the <b>menu</b> (three dots)</>} art={<AndMenuBtn />}>It is at the top right of Chrome.</Step>
                <Step n={3} title={<>Tap <b>Install app</b></>} art={<AndMenuList />}>If you see <b>Add to Home screen</b> instead, tap that, then choose <b>Install</b>.</Step>
                <Step n={4} title={<>Tap <b>Install</b></>} art={<AndInstallDlg />}>Chrome puts the app on your home screen and in your app list.</Step>
                <Step n={5} title="Open it from your home screen" art={<HomeGrid tone="and" />}>Look for the gold Indoor Khelo icon.</Step>
              </ol>
              <p className="ins-note">Using Samsung Internet? Tap the menu (three lines), then <b>Add page to</b>, then <b>Home screen</b>.</p>
            </section>
          )}

          <section className="ins-why" aria-label="Why install">
            <h2>Why install?</h2>
            <ul>
              <li><AcIcon name="check" size={18} /><span>Opens full screen, with no browser bars</span></li>
              <li><AcIcon name="check" size={18} /><span>Score a match even with no internet</span></li>
              <li><AcIcon name="check" size={18} /><span>One tap from your home screen on match day</span></li>
            </ul>
          </section>

          <div className="ins-share">
            <p>Send this page to a friend</p>
            <button type="button" className="ac-btn" onClick={copyLink}><AcIcon name={copied === "done" ? "check" : "link"} size={18} /> {copied === "done" ? "Link copied" : "Copy install link"}</button>
          </div>
          <Link href="/" className="ins-skip">Skip. Use it in the browser for now</Link>
        </>
      )}
    </div>
  );
}
