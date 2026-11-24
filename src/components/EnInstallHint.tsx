"use client";

import { useEffect, useState } from "react";
import EnIcon from "@/components/EnIcons";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Same key and 14-day rule as the install banner in PwaShell: if the person said "Not now" there, the hint stays away too.
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

/** A quiet row under the privacy line on the welcome page: "Install the app" with an Install button.
 *  Shown only when the browser says the app can be installed (the `beforeinstallprompt` event), never on iPhone
 *  (iPhone has no such event; PwaShell shows the Safari steps there). Non-blocking. It does not replace PwaShell's banner. */
export default function EnInstallHint() {
  const [ev, setEv] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
    if (standalone || dismissedRecently()) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    const onInstalled = () => setEv(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ev) return null;
  async function install() {
    if (!ev) return;
    try {
      await ev.prompt();
      await ev.userChoice;
    } catch { /* the browser refused to show it: nothing else to do */ }
    setEv(null);
  }
  return (
    <div className="en-install">
      <EnIcon name="download" size={22} />
      <p><b>Install the app</b><span>Full screen, and scoring works offline.</span></p>
      <button type="button" className="en-install-btn" onClick={install}>Install</button>
    </div>
  );
}
