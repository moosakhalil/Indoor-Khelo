"use client";

import { useActionState, useState } from "react";
import { findCommunityAction, type FormState } from "@/app/actions";
import EnIcon, { EnSpinner } from "@/components/EnIcons";
import { EnFieldError } from "@/components/EnParts";

const initial: FormState = {};

/** Find a community by invite link or code. Same action (`findCommunityAction`) and field name (`code`) as the old
 *  FindCommunityForm. New: a Paste button (invites arrive in WhatsApp), the error on the field with an icon, a spinner. */
export default function EnJoinForm() {
  const [state, action, pending] = useActionState(findCommunityAction, initial);
  const [code, setCode] = useState("");
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const bad = !!state.error;

  async function paste() {
    setPasteNote(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setCode(text.trim());
      else setPasteNote("The clipboard is empty. Copy the invite link or code first.");
    } catch {
      setPasteNote("Could not read the clipboard. Long-press the box and choose Paste.");
    }
  }

  return (
    <form action={action} noValidate className="en-card en-form">
      <label className="en-lb" htmlFor="code">Invite link or code</label>
      <div className={`en-input en-paste${bad ? " bad" : ""}`}>
        <EnIcon name="link" size={18} />
        <input
          id="code" name="code" autoComplete="off" autoCapitalize="characters" placeholder="khelo.app/join/… or KH-XXXX"
          className={`field${bad ? " bad" : ""}`} value={code} onChange={(e) => setCode(e.target.value)}
          aria-invalid={bad} aria-describedby={bad ? "code-err" : "code-hint"}
        />
        <button type="button" className="en-paste-btn" onClick={paste} aria-label="Paste from clipboard">
          <EnIcon name="clipboard" size={16} />Paste
        </button>
      </div>
      <EnFieldError id="code-err" text={state.error} />
      {!bad && <p className="en-hint" id="code-hint"><span>{pasteNote ?? "A link or a code both work."}</span></p>}
      {bad && pasteNote && <p className="en-hint"><span>{pasteNote}</span></p>}
      <button className="btn gold en-cta" disabled={pending} aria-busy={pending}>
        {pending && <EnSpinner />}
        {pending ? "Finding…" : "Find community"}
      </button>
    </form>
  );
}
