"use client";

import { useActionState, useState } from "react";
import { deleteAccountDataAction, deleteCommunityAction, updateCommunityAction } from "@/app/actions2";
import type { FormState } from "@/app/actions";
import { authClient } from "@/lib/auth/client";

const initial: FormState = {};
function Err({ text }: { text?: string }) {
  return text ? <p className="err" role="alert">{text}</p> : null;
}

/* ---------- Admin: community settings ---------- */
export function SettingsForm({
  communityId,
  name,
  description,
  location,
  approvalRequired,
}: {
  communityId: string;
  name: string;
  description: string;
  location: string;
  approvalRequired: boolean;
}) {
  const [state, action, pending] = useActionState(updateCommunityAction, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <label className="lb" htmlFor="s-name" style={{ marginTop: 0 }}>Community name</label>
      <input id="s-name" name="name" className={`field${fe.name ? " bad" : ""}`} defaultValue={name} maxLength={60} aria-invalid={!!fe.name} />
      <Err text={fe.name} />
      <label className="lb" htmlFor="s-desc">Short description</label>
      <textarea id="s-desc" name="description" className={`field${fe.description ? " bad" : ""}`} defaultValue={description} maxLength={300} />
      <Err text={fe.description} />
      <label className="lb" htmlFor="s-loc">Location</label>
      <input id="s-loc" name="location" className={`field${fe.location ? " bad" : ""}`} defaultValue={location} maxLength={80} />
      <Err text={fe.location} />
      <div className="card" style={{ marginTop: 16 }}>
        <label className="switch">
          <span><b>Admin approves new members</b><br /><small className="muted">Turn off to let anyone with the link join straight away</small></span>
          <input type="checkbox" name="approvalRequired" defaultChecked={approvalRequired} />
          <span className="track" aria-hidden="true" />
        </label>
      </div>
      {state.error && !state.fieldErrors && <Err text={state.error} />}
      {state.message && <p className="banner green" role="status" style={{ marginTop: 12 }}>{state.message}</p>}
      <button className="btn gold" disabled={pending} style={{ marginTop: 12 }}>{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

/* ---------- Admin: delete the community (type its name) ---------- */
export function DeleteCommunityForm({ communityId, name }: { communityId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteCommunityAction, initial);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="communityId" value={communityId} />
      <div>
        <label className="lb" htmlFor="typed" style={{ marginTop: 0 }}>Type <b style={{ color: "var(--white)" }}>{name}</b> to confirm</label>
        <input id="typed" name="typedName" className={`field${state.error ? " bad" : ""}`} autoComplete="off" />
        <Err text={state.error} />
      </div>
      <button className="btn red" disabled={pending}>{pending ? "Deleting…" : "Delete this community for everyone"}</button>
    </form>
  );
}

/* ---------- delete my account ---------- */
export function DeleteAccountPanel({ blocked }: { blocked: boolean }) {
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
      setNote("Your data in Indoor Khelo is removed and you are signed out. Your Google sign-in record could not be deleted automatically, so it will be removed by hand. If you sign in again, you start fresh.");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  if (note) {
    return (
      <div className="stack">
        <div className="banner mute" role="status">{note}</div>
        <a className="btn gold" href="/">Done</a>
      </div>
    );
  }
  return (
    <div className="stack">
      <label className="check">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} disabled={blocked} />
        <span>I understand this cannot be undone. My name is removed and I leave every community.</span>
      </label>
      <Err text={error ?? undefined} />
      <button type="button" className="btn red" disabled={!sure || busy || blocked} onClick={run}>
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </div>
  );
}
