"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { deleteCommunityAction } from "@/app/actions2";
import type { FormState } from "@/app/actions";
import CnIc from "@/components/CnIcons";
import { communityAbbr, plural, sameName } from "@/lib/cn";
import type { DeleteCounts } from "@/lib/cnData";
import "./cn.css";

const initial: FormState = {};
const MISMATCH = "The name you typed does not match. Type the community name exactly.";

/**
 * Delete a community (Admin). A card that says what will be lost, then the typed-name field. The red button stays off until
 * the name matches (the same rule the server uses); a green tick says so. The server still checks the name and the Admin role,
 * and its message is shown if it ever disagrees. "Keep {short name}" is the safe way out.
 */
export default function CnDelete({ communityId, name, counts }: { communityId: string; name: string; counts: DeleteCounts }) {
  const [state, action, pending] = useActionState(deleteCommunityAction, initial);
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const lastSent = useRef<string | null>(null);
  const ok = sameName(typed, name);
  const serverError = state.error && lastSent.current === typed ? state.error : null;
  const clientError = !ok && touched && typed.trim().length > 0 ? MISMATCH : null;
  const error = serverError ?? clientError;
  const short = communityAbbr(name);

  return (
    <div className="stack cn-del">
      <section className="cn-danger" aria-labelledby="cn-del-h">
        <div className="cn-id">
          <span className="cn-trash" aria-hidden="true"><CnIc name="trash" /></span>
          <div className="cn-idt">
            <h2 id="cn-del-h">Delete {name}?</h2>
            <b className="cn-cannot">This cannot be undone.</b>
          </div>
        </div>
        <p className="cn-lead">This deletes <b>{name}</b>, all its members and its history for everyone.</p>
        <ul className="cn-facts red">
          <li>
            <i aria-hidden="true"><CnIc name="users" /></i>
            <span><b>{plural(counts.members, "member leaves", "members leave")}</b><small>Their career stats stay with them.</small></span>
          </li>
          <li>
            <i aria-hidden="true"><CnIc name="trophy" /></i>
            <span>
              <b>{plural(counts.teams, "team", "teams")}, {plural(counts.series, "series", "series")} and {counts.matches === 1 ? "1 match" : `${counts.matches} matches`}</b>
              <small>Scorecards and records for this community are removed.</small>
            </span>
          </li>
          <li>
            <i aria-hidden="true"><CnIc name="wallet" /></i>
            <span>
              <b>{counts.bookings === 0 ? "Bookings and payment records" : `${plural(counts.bookings, "booking", "bookings")} and payment records`}</b>
              <small>{counts.bookings === 0 ? "None yet. Nothing to remove here." : "Removed for everyone."}</small>
            </span>
          </li>
        </ul>
      </section>

      <form
        action={action}
        className="cn-card cn-del-form"
        onSubmit={() => { lastSent.current = typed; }}
      >
        <input type="hidden" name="communityId" value={communityId} />
        <label className="cn-del-lb" htmlFor="cn-typed">Type <b>{name}</b> to confirm</label>
        <div className={`cn-typed${error ? " bad" : ok ? " ok" : ""}`}>
          <input
            id="cn-typed"
            name="typedName"
            className="field"
            value={typed}
            placeholder="Type the community name"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby="cn-typed-msg"
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {ok && <span className="cn-tick" aria-hidden="true"><CnIc name="check" /></span>}
        </div>
        <p id="cn-typed-msg" className={`cn-hint${error ? " err" : ok ? " ok" : ""}`} role={error ? "alert" : "status"}>
          {error ? <><CnIc name="warn" />{error}</> : ok ? "The name matches." : "Type it exactly, including capital letters."}
        </p>
        <button className="btn cn-delbtn" disabled={!ok || pending} aria-busy={pending}>
          {pending ? <><span className="cn-spin" aria-hidden="true" />Deleting…</> : "Delete this community for everyone"}
        </button>
        <Link href={`/c/${communityId}/settings`} className="btn ghost">Keep {short}</Link>
      </form>

      <p className="muted small center cn-alt">
        Want to step away instead? <Link href={`/c/${communityId}/leave`}>Make someone else Admin and leave</Link>.
      </p>
    </div>
  );
}
