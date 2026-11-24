"use client";

// Phase G3: the Account page controls. Same behaviour as SignOutButton / SignOutAllButton / DeleteAccountPanel
// (forget the pages cached on this phone, sign out; delete the app data first, then the sign-in record, then sign out),
// with the PDF's three zones: Sessions (log out, log out everywhere) and the red Danger zone.
import Link from "next/link";
import { useState } from "react";
import { deleteAccountDataAction } from "@/app/actions2";
import AcIcon from "@/components/AcIcons";
import { authClient } from "@/lib/auth/client";
import { initials } from "@/lib/validation";
import "./ac.css";

export const LOGOUT_ALL_ERROR = "Could not log out of all devices. Please check your internet and try again.";
export const KEPT_RECORD_NOTE =
  "Your data in Indoor Khelo is removed and you are signed out. Your Google sign-in record could not be deleted automatically, so it will be removed by hand. If you sign in again, you start fresh.";

type Community = { id: string; name: string };

async function forgetCachedPages() {
  // Forget cached pages on this phone so nothing is left on a shared device.
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    reg?.active?.postMessage({ type: "CLEAR_PAGES" });
  } catch { /* nothing to clear */ }
}

function Spinner() {
  return <span className="ac-spin" aria-hidden="true" />;
}

/** Zone 2: Sessions. "Log out" is the normal button, "Log out of all devices" is the quieter one. */
export function AcSessions() {
  const [busy, setBusy] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function out() {
    setBusy(true);
    await forgetCachedPages();
    try { await authClient.signOut(); } finally { window.location.href = "/"; }
  }
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
  const any = busy || busyAll;
  return (
    <section className="ac-zone" aria-labelledby="ac-sessions-h">
      <h2 id="ac-sessions-h" className="ac-zone-h">Sessions</h2>
      <div className="ac-sess">
        <button type="button" className="btn ghost ac-logout" onClick={out} disabled={any} aria-busy={busy}>
          {busy ? <Spinner /> : <AcIcon name="logout" size={18} />}
          {busy ? "Signing out…" : "Log out"}
        </button>
        <button type="button" className="btn ac-lessbtn" onClick={outAll} disabled={any} aria-busy={busyAll}>
          {busyAll && <Spinner />}
          {busyAll ? "Logging out everywhere…" : "Log out of all devices"}
        </button>
      </div>
      <p className="ac-hint">Ends every session on every phone and computer, including this one.</p>
      {error && (
        <div className="ac-note red" role="alert">
          <AcIcon name="wifioff" size={20} />
          <div><b>Log out of all devices failed</b><span>{error}</span></div>
        </div>
      )}
    </section>
  );
}

function Mark({ name }: { name: string }) {
  return <span className="ac-mark" aria-hidden="true">{initials(name)}</span>;
}

/** Zone 3: the red Danger zone. `blockers` / `willDelete` / `willLeave` come from accountPlan (read on the server). */
export function AcDangerZone({ blockers, willDelete, willLeave }: { blockers: Community[]; willDelete: Community[]; willLeave: Community[] }) {
  const blocked = blockers.length > 0;
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await deleteAccountDataAction();
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    // Now remove the sign-in record too, then sign out. If the sign-in service refuses, say so honestly.
    let removed = true;
    try {
      const r = await authClient.deleteUser();
      if (r && "error" in r && r.error) removed = false;
    } catch {
      removed = false;
    }
    try { await authClient.signOut(); } catch { /* already gone */ }
    if (!removed) {
      setNote(KEPT_RECORD_NOTE);
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <section className="ac-zone danger" aria-labelledby="ac-danger-h">
      <h2 id="ac-danger-h" className="ac-zone-h danger"><AcIcon name="alert" size={22} /> Delete my account</h2>
      <p className="ac-body">Your name is removed and you leave every community. Past scorecards keep the record that a player took part, shown as &ldquo;Deleted player&rdquo;.</p>

      {blocked && (
        <div className="ac-note gold" role="note">
          <AcIcon name="shield" size={20} />
          <div>
            <b>You are the only Admin of {blockers.map((c) => c.name).join(", ")}, which still {blockers.length === 1 ? "has" : "have"} members.</b>
            <span>Make someone else Admin first (Community page, Manage members), or delete that community.</span>
          </div>
        </div>
      )}
      {blocked && (
        <ul className="ac-rows" aria-label="Communities you must sort out first">
          {blockers.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.id}/leave`} className="ac-row">
                <Mark name={c.name} />
                <span className="ac-row-t"><b>{c.name}</b><small>Choose a new Admin or delete it</small></span>
                <AcIcon name="chevron" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {willDelete.length > 0 && (
        <div className="ac-note red" role="note">
          <AcIcon name="trash" size={20} />
          <div>
            <b>These communities will be deleted too</b>
            <span>These communities have only you in them, so they will be deleted too: {willDelete.map((c) => c.name).join(", ")}.</span>
          </div>
        </div>
      )}

      {willLeave.length > 0 && (
        <div className="ac-leave">
          <span className="ac-hint" style={{ margin: 0 }}>You will leave:</span>
          <ul className="ac-chips">
            {willLeave.map((c) => <li key={c.id} className="ac-chip"><Mark name={c.name} />{c.name}</li>)}
          </ul>
        </div>
      )}

      {note ? (
        <div className="ac-final">
          <div className="ac-note blue" role="status">
            <AcIcon name="info" size={20} />
            <div><span>{note}</span></div>
          </div>
          <a className="btn gold" href="/">Done</a>
        </div>
      ) : (
        <>
          <label className={`ac-confirm${sure ? " on" : ""}${blocked ? " off" : ""}`}>
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} disabled={blocked || busy} />
            <span className="ac-tick" aria-hidden="true">{sure && <AcIcon name="check" size={16} />}</span>
            <span>I understand this cannot be undone. My name is removed and I leave every community.</span>
          </label>
          {error && (
            <div className="ac-note red" role="alert">
              <AcIcon name="alert" size={20} />
              <div><span>{error}</span></div>
            </div>
          )}
          <button type="button" className={`btn ac-delete${sure && !blocked ? " armed" : ""}`} disabled={!sure || busy || blocked} onClick={run} aria-busy={busy}>
            {busy && <Spinner />}
            {busy ? "Deleting…" : "Delete my account"}
          </button>
        </>
      )}
    </section>
  );
}
