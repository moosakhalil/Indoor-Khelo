"use client";

import Link from "next/link";
import { createContext, startTransition, useActionState, useContext, useEffect, useMemo, useRef, useState } from "react";
import { updateCommunityAction } from "@/app/actions2";
import type { FormState } from "@/app/actions";
import Ic from "@/components/B3Icons";
import { counterTone } from "@/lib/b3";
import { COMMUNITY_MEMBER_CAP, DESCRIPTION_MAX, LOCATION_MAX, NAME_MAX, initials } from "@/lib/validation";
import "./b3.css";

export type Draft = { name: string; location: string; description: string; approval: boolean };

type Ctx = {
  draft: Draft;
  base: Draft;
  dirty: boolean;
  set: (patch: Partial<Draft>) => void;
  discard: () => void;
  markSaved: (d: Draft) => void;
  memberCount: number;
};

const SettingsCtx = createContext<Ctx | null>(null);
const useDraft = () => {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("Settings parts must sit inside <SettingsProvider>.");
  return c;
};

/** Holds what is typed, so the form and the preview (which can sit in the side panel) always agree. */
export function SettingsProvider({ initial, memberCount, children }: { initial: Draft; memberCount: number; children: React.ReactNode }) {
  const [base, setBase] = useState<Draft>(initial);
  const [draft, setDraft] = useState<Draft>(initial);
  const value = useMemo<Ctx>(() => ({
    draft,
    base,
    dirty: draft.name !== base.name || draft.location !== base.location || draft.description !== base.description || draft.approval !== base.approval,
    set: (patch) => setDraft((d) => ({ ...d, ...patch })),
    discard: () => setDraft(base),
    markSaved: (d) => setBase(d),
    memberCount,
  }), [draft, base, memberCount]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

function Counter({ len, max, id }: { len: number; max: number; id: string }) {
  const tone = counterTone(len, max);
  return <span id={id} className={`st-count${tone === "ok" ? "" : ` ${tone}`}`} aria-label={`${len} of ${max} characters${len >= max ? ", limit reached" : ""}`}>{len}/{max}</span>;
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} className="st-err" role="alert"><Ic name="warn" />{text}</p> : null;
}

const initialState: FormState = {};

/** Two cards (Identity, Joining), live counters, an "Open joining" warning and a save bar that only wakes up after an edit. */
export function SettingsForm({ communityId }: { communityId: string }) {
  const { draft, base, dirty, set, discard, markSaved } = useDraft();
  const [state, action, pending] = useActionState(updateCommunityAction, initialState);
  const [shown, setShown] = useState<FormState>({});
  const submitted = useRef<Draft>(draft);
  const nameRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef(markSaved);
  saveRef.current = markSaved;

  // A new answer from the server: remember it for display, and a successful save becomes the new "saved" version.
  useEffect(() => {
    setShown(state);
    if (state.message) saveRef.current(submitted.current);
    if (state.fieldErrors?.name) nameRef.current?.focus();
  }, [state]);

  const fe = shown.fieldErrors ?? {};
  const edit = (patch: Partial<Draft>, clear?: "name" | "location" | "description") => {
    set(patch);
    setShown((s) => {
      if (!s.message && !s.error && !s.fieldErrors) return s;
      const rest = { ...(s.fieldErrors ?? {}) };
      if (clear) delete rest[clear];
      return { fieldErrors: Object.keys(rest).length ? rest : undefined };
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    submitted.current = draft;
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };

  const saved = !!shown.message && !dirty;
  const generalError = shown.error && !shown.fieldErrors ? shown.error : null;

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      <input type="hidden" name="communityId" value={communityId} />

      <section className="card st-card" aria-labelledby="st-id-h">
        <h2 id="st-id-h">Identity</h2>
        <div className="st-lbrow"><label htmlFor="s-name">Community name</label><Counter id="s-name-n" len={draft.name.length} max={NAME_MAX} /></div>
        <input
          id="s-name" name="name" ref={nameRef} placeholder="e.g. Karachi Indoor Cricket Club" maxLength={NAME_MAX} autoComplete="off"
          className={`field${fe.name ? " st-bad" : draft.name !== base.name ? " st-changed" : ""}`}
          value={draft.name} onChange={(e) => edit({ name: e.target.value }, "name")}
          aria-invalid={!!fe.name} aria-describedby={`s-name-n${fe.name ? " s-name-e" : ""}`}
        />
        <FieldError id="s-name-e" text={fe.name} />

        <div className="st-lbrow"><label htmlFor="s-loc">Location</label><Counter id="s-loc-n" len={draft.location.length} max={LOCATION_MAX} /></div>
        <div className="st-field">
          <span className="st-pin" aria-hidden="true"><Ic name="pin" /></span>
          <input
            id="s-loc" name="location" placeholder="e.g. Clifton, Karachi" maxLength={LOCATION_MAX} autoComplete="off"
            className={`field pad${fe.location ? " st-bad" : draft.location !== base.location ? " st-changed" : ""}`}
            value={draft.location} onChange={(e) => edit({ location: e.target.value }, "location")}
            aria-invalid={!!fe.location} aria-describedby={`s-loc-n${fe.location ? " s-loc-e" : ""}`}
          />
        </div>
        <FieldError id="s-loc-e" text={fe.location} />

        <div className="st-lbrow"><label htmlFor="s-desc">Short description</label><Counter id="s-desc-n" len={draft.description.length} max={DESCRIPTION_MAX} /></div>
        <textarea
          id="s-desc" name="description" maxLength={DESCRIPTION_MAX}
          className={`field${fe.description ? " st-bad" : draft.description !== base.description ? " st-changed" : ""}`}
          value={draft.description} onChange={(e) => edit({ description: e.target.value }, "description")}
          aria-invalid={!!fe.description} aria-describedby={`s-desc-n${fe.description ? " s-desc-e" : ""}`}
        />
        <FieldError id="s-desc-e" text={fe.description} />
      </section>

      <section className="card st-card" aria-labelledby="st-join-h">
        <h2 id="st-join-h">Joining</h2>
        <label className="switch st-switch">
          <span className="t">
            <b>Admin approves new members</b>
            <small className="muted">{draft.approval ? "New people wait in Join requests until an Admin says yes." : "Anyone with the link joins straight away."}</small>
          </span>
          <input type="checkbox" name="approvalRequired" checked={draft.approval} onChange={(e) => edit({ approval: e.target.checked })} />
          <span className="track" aria-hidden="true" />
        </label>
        {!draft.approval && (
          <div className="mb-banner gold" role="status">
            <Ic name="warn" />
            <div className="mb-bt"><b>Open joining</b><span>Anyone who gets the link can join. You can turn approval back on at any time.</span></div>
          </div>
        )}
      </section>

      {generalError && (
        <div className="mb-banner red" role="alert"><Ic name="warn" /><div className="mb-bt"><b>Could not save</b><span>{generalError}</span></div></div>
      )}
      {saved && (
        <div className="mb-banner green" role="status"><Ic name="check" /><div className="mb-bt"><b>Saved</b><span>Everyone now sees the new details.</span></div></div>
      )}

      <div className="st-bar">
        <button className="btn gold" disabled={!dirty || pending}>{pending ? "Saving…" : "Save changes"}</button>
        {dirty && <button type="button" className="btn ghost" disabled={pending} onClick={discard}>Discard</button>}
      </div>
    </form>
  );
}

/** How the name, place and description look to members; updates while typing. */
export function SettingsPreview({ className }: { className?: string }) {
  const { draft, memberCount } = useDraft();
  const name = draft.name.trim();
  const place = draft.location.trim();
  return (
    <section className={`card st-prev ${className ?? ""}`} aria-label="Preview">
      <div className="st-ph"><b>Preview</b><small>How members see it</small></div>
      <div className="st-pn">
        <span className="logo-mark" aria-hidden="true">{name ? initials(name) : "?"}</span>
        <span className="t">
          <b>{name || "Community name"}</b>
          <small>{memberCount} of {COMMUNITY_MEMBER_CAP} members{place ? ` · ${place}` : ""}</small>
        </span>
      </div>
      {draft.description.trim() && <p>{draft.description.trim()}</p>}
    </section>
  );
}

export function SettingsHistory({ added, changed, className }: { added: string; changed: string; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`} aria-label="History">
      <b>History</b>
      <dl className="st-hist">
        <dt>Added by</dt><dd>{added}</dd>
        <dt>Last changed by</dt><dd>{changed}</dd>
      </dl>
    </section>
  );
}

export function DangerZone({ communityId, className }: { communityId: string; className?: string }) {
  return (
    <section className={`card st-danger ${className ?? ""}`} aria-label="Danger zone">
      <b>Danger zone</b>
      <p className="muted small">Deleting removes the community, its members and its history for everyone. It cannot be undone. You will type the community name to confirm.</p>
      <Link href={`/c/${communityId}/delete`} className="mb-btn red"><Ic name="trash" />Delete community…</Link>
    </section>
  );
}
