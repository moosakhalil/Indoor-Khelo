"use client";

// Phase F5: the log-out controls of My profile. Same behaviour as SignOutButton / SignOutAllButton (forget the pages cached on this
// phone, then sign out), with the failure shown as a red banner that says what to do next.
import { useState } from "react";
import PfIcon from "@/components/PfIcons";
import { authClient } from "@/lib/auth/client";
import "./pf.css";

export const LOGOUT_ALL_ERROR = "Could not log out of all devices. Please check your internet and try again.";

async function forgetCachedPages() {
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    reg?.active?.postMessage({ type: "CLEAR_PAGES" });
  } catch { /* nothing to clear */ }
}

async function signOutHere() {
  await forgetCachedPages();
  try { await authClient.signOut(); } finally { window.location.href = "/"; }
}

/** The small log-out icon in the top bar. It has a text label for screen readers. */
export function PfLogoutIcon() {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="pf-iconbtn" aria-label="Log out" disabled={busy} onClick={() => { setBusy(true); void signOutHere(); }}>
      <PfIcon name="logout" size={22} />
    </button>
  );
}

/** "Log out" and "Log out of all devices". */
export function PfLogoutCard() {
  const [busy, setBusy] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function outAll() {
    setBusyAll(true);
    setError(null);
    await forgetCachedPages();
    try {
      const res = await authClient.revokeSessions();
      if (res && "error" in res && res.error) throw new Error("revoke failed");
      window.location.href = "/";
    } catch {
      setError(LOGOUT_ALL_ERROR);
      setBusyAll(false);
    }
  }

  return (
    <section className="pf-box pf-logout" aria-label="Log out">
      <button type="button" className="btn ghost" disabled={busy || busyAll} onClick={() => { setBusy(true); void signOutHere(); }}>
        <PfIcon name="logout" size={18} /> {busy ? "Signing out…" : "Log out"}
      </button>
      <button type="button" className="btn ghost" disabled={busy || busyAll} onClick={outAll}>
        {busyAll ? "Logging out everywhere…" : "Log out of all devices"}
      </button>
      {error && (
        <div className="banner red pf-fail" role="alert">
          <PfIcon name="alert" size={18} />
          <div><b>Log out of all devices failed</b><span>{error}</span></div>
        </div>
      )}
    </section>
  );
}
