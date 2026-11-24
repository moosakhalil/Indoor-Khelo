"use client";

import { useActionState, useState } from "react";
import { acceptTermsAction, type FormState } from "@/app/actions";
import EnIcon, { EnSpinner } from "@/components/EnIcons";
import { EnFieldError } from "@/components/EnParts";

const initial: FormState = {};

/** Terms acceptance. Same action, same field names as the old TermsForm. The whole 60px row is the checkbox, it turns
 *  gold when ticked and red (with the message and an icon) when Continue was pressed without ticking. */
export default function EnTermsForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(acceptTermsAction, initial);
  const [ticked, setTicked] = useState(false);
  const bad = !!state.error && !ticked;
  return (
    <form action={action} className="en-terms-form" noValidate>
      <input type="hidden" name="next" value={next} />
      <label className={`en-tick${ticked ? " on" : ""}${bad ? " bad" : ""}`}>
        <input
          type="checkbox"
          name="accept"
          checked={ticked}
          onChange={(e) => setTicked(e.target.checked)}
          aria-invalid={bad}
          aria-describedby={bad ? "terms-err" : undefined}
        />
        <span className="en-tick-box" aria-hidden="true">{ticked && <EnIcon name="check" size={16} />}</span>
        <span className="en-tick-t">I accept the Terms and the Privacy notice</span>
      </label>
      <EnFieldError id="terms-err" text={bad ? state.error : undefined} />
      <button className="btn gold en-cta" disabled={pending} aria-busy={pending}>
        {pending && <EnSpinner />}
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
