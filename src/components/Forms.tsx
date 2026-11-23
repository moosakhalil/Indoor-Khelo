"use client";

import { useActionState, useState } from "react";
import {
  acceptTermsAction,
  chooseNumberAction,
  createCommunityAction,
  findCommunityAction,
  requestJoinAction,
  updateNameAction,
  type FormState,
} from "@/app/actions";
import Shirt from "@/components/Shirt";
import { PLAYER_NUMBER_MAX, PLAYER_NUMBER_MIN } from "@/lib/validation";

const initial: FormState = {};

function Err({ text }: { text?: string }) {
  return text ? <p className="err" role="alert">{text}</p> : null;
}

/* ---------- terms ---------- */
export function TermsForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(acceptTermsAction, initial);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <label className="check">
        <input type="checkbox" name="accept" />
        <span>I accept the Terms and the Privacy notice</span>
      </label>
      <Err text={state.error} />
      <button className="btn gold" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}

/* ---------- create a community ---------- */
export function CreateCommunityForm() {
  const [state, action, pending] = useActionState(createCommunityAction, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      <label className="lb" htmlFor="name">Community name</label>
      <input id="name" name="name" className={`field${fe.name ? " bad" : ""}`} maxLength={60} autoComplete="off" placeholder="Alpha Indoor Club" aria-invalid={!!fe.name} />
      <Err text={fe.name} />

      <label className="lb" htmlFor="description">Short description (optional)</label>
      <textarea id="description" name="description" className={`field${fe.description ? " bad" : ""}`} maxLength={300} placeholder="A friendly group that plays 4-over indoor cricket." />
      <Err text={fe.description} />

      <label className="lb" htmlFor="location">Location (optional)</label>
      <input id="location" name="location" className={`field${fe.location ? " bad" : ""}`} maxLength={80} autoComplete="off" placeholder="Lahore" />
      <Err text={fe.location} />

      <div className="card" style={{ marginTop: 16 }}>
        <label className="switch">
          <span>
            <b>Admin approves new members</b>
            <br /><small className="muted">Turn off to let anyone with the link join straight away</small>
          </span>
          <input type="checkbox" name="approvalRequired" defaultChecked />
          <span className="track" aria-hidden="true" />
        </label>
      </div>
      <p className="muted small">You become the Admin automatically. Next you choose your player number, then you get an invite link and a code to share.</p>
      {state.error && !state.fieldErrors && <Err text={state.error} />}
      <button className="btn gold" disabled={pending} style={{ marginTop: 8 }}>{pending ? "Creating…" : "Next: choose my player number"}</button>
    </form>
  );
}

/* ---------- join ---------- */
export function FindCommunityForm() {
  const [state, action, pending] = useActionState(findCommunityAction, initial);
  return (
    <form action={action} className="stack" noValidate>
      <div>
        <label className="lb" htmlFor="code" style={{ marginTop: 0 }}>Invite link or code</label>
        <input id="code" name="code" className={`field${state.error ? " bad" : ""}`} autoComplete="off" autoCapitalize="characters" placeholder="khelo.app/join/… or KH-XXXX" aria-invalid={!!state.error} />
        <Err text={state.error} />
      </div>
      <button className="btn gold" disabled={pending}>{pending ? "Finding…" : "Find community"}</button>
    </form>
  );
}

export function RequestJoinForm({ code, approval }: { code: string; approval: boolean }) {
  const [state, action, pending] = useActionState(requestJoinAction, initial);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="code" value={code} />
      <Err text={state.error} />
      <button className="btn gold" disabled={pending}>
        {pending ? "Sending…" : approval ? "Request to join" : "Join community"}
      </button>
      <p className="muted small center" style={{ margin: 0 }}>You will choose your player number {approval ? "after you are approved" : "next"}.</p>
    </form>
  );
}

/* ---------- player number picker (required, first come first served) ---------- */
export function NumberPicker({
  communityId,
  taken,
  mine,
  isNew,
}: {
  communityId: string;
  taken: number[];
  mine: number | null;
  isNew: boolean;
}) {
  const [state, action, pending] = useActionState(chooseNumberAction, initial);
  const [picked, setPicked] = useState<number | null>(mine);
  const takenSet = new Set(taken.filter((n) => n !== mine));
  const numbers = Array.from({ length: PLAYER_NUMBER_MAX - PLAYER_NUMBER_MIN + 1 }, (_, i) => i + PLAYER_NUMBER_MIN);
  return (
    <form action={action}>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="isNew" value={isNew ? "1" : "0"} />
      <input type="hidden" name="number" value={picked ?? ""} />
      <div className="ngrid" role="group" aria-label="Player numbers 1 to 99">
        {numbers.map((n) => {
          const isTaken = takenSet.has(n);
          return (
            <button
              key={n}
              type="button"
              className={`num${isTaken ? " taken" : ""}${n === mine ? " mine" : ""}`}
              disabled={isTaken}
              aria-pressed={picked === n}
              aria-label={isTaken ? `${n}, already taken` : n === mine ? `${n}, your current number` : `${n}`}
              onClick={() => setPicked(n)}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="stickybar stack">
        <div className="row">
          <Shirt number={picked} />
          <span className="muted">{picked ? `Number ${picked} is free` : "Tap a free number"}</span>
        </div>
        <Err text={state.error} />
        <button className="btn gold" disabled={pending || picked === null}>
          {pending ? "Saving…" : picked ? `Confirm number ${picked}` : "Choose a number"}
        </button>
      </div>
    </form>
  );
}

/* ---------- profile name ---------- */
export function NameForm({ name, communityId }: { name: string; communityId: string }) {
  const [state, action, pending] = useActionState(updateNameAction, initial);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="communityId" value={communityId} />
      <div>
        <label className="lb" htmlFor="pname" style={{ marginTop: 0 }}>Name</label>
        <input id="pname" name="name" className={`field${state.error ? " bad" : ""}`} defaultValue={name} maxLength={60} autoComplete="name" />
        <Err text={state.error} />
        {state.message && <p className="muted small" role="status">{state.message}</p>}
      </div>
      <button className="btn ghost" disabled={pending}>{pending ? "Saving…" : "Save name"}</button>
    </form>
  );
}
