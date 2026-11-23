"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

async function forgetCachedPages() {
  // Forget cached pages on this phone so nothing is left on a shared device.
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    reg?.active?.postMessage({ type: "CLEAR_PAGES" });
  } catch { /* nothing to clear */ }
}

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function out() {
    setBusy(true);
    await forgetCachedPages();
    try { await authClient.signOut(); } finally { window.location.href = "/"; }
  }
  return (
    <button type="button" className="btn ghost" onClick={out} disabled={busy}>
      {busy ? "Signing out…" : "Log out"}
    </button>
  );
}

/** Ends every session on every phone and computer, including this one. */
export function SignOutAllButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function outAll() {
    setBusy(true);
    setError(null);
    await forgetCachedPages();
    try {
      const res = await authClient.revokeSessions();
      if (res && "error" in res && res.error) throw new Error("revoke failed");
      window.location.href = "/";
    } catch {
      setError("Could not log out of all devices. Please check your internet and try again.");
      setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" className="btn ghost" onClick={outAll} disabled={busy}>
        {busy ? "Logging out everywhere…" : "Log out of all devices"}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
