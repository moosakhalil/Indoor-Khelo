"use client";

import { useActionState } from "react";
import { requestJoinAction, type FormState } from "@/app/actions";
import EnIcon, { EnSpinner } from "@/components/EnIcons";
import { EnAlert } from "@/components/EnParts";

const initial: FormState = {};

/** The signed-in action on the invite page. Same action (`requestJoinAction`) and field (`code`) as the old
 *  RequestJoinForm, same words ("Request to join" / "Join community", "Sending…"). New: send icon, spinner,
 *  the server's error shown as a banner with an icon above the button. */
export default function EnRequestJoin({ code, approval }: { code: string; approval: boolean }) {
  const [state, action, pending] = useActionState(requestJoinAction, initial);
  return (
    <form action={action} className="en-form-stack">
      <input type="hidden" name="code" value={code} />
      {state.error && <EnAlert>{state.error}</EnAlert>}
      <button className="btn gold en-cta" disabled={pending} aria-busy={pending}>
        {pending ? <EnSpinner /> : <EnIcon name={approval ? "send" : "userplus"} size={18} />}
        {pending ? "Sending…" : approval ? "Request to join" : "Join community"}
      </button>
      <p className="en-hint center"><span>You will choose your player number {approval ? "after you are approved" : "next"}.</span></p>
    </form>
  );
}
