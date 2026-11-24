"use client";

import { useActionState, useState } from "react";
import { createCommunityAction, type FormState } from "@/app/actions";
import CommunityLogo from "@/components/CommunityLogo";
import EnIcon, { EnSpinner } from "@/components/EnIcons";
import { EnFieldError } from "@/components/EnParts";

const initial: FormState = {};
const NAME_MAX = 60;
const DESC_MAX = 300;
const LOC_MAX = 80;

/** Create a community. Same action (`createCommunityAction`) and same field names as the old CreateCommunityForm
 *  (name, description, location, approvalRequired). The fields are controlled, so what the person typed is kept when
 *  the server sends back an error. Counters, a live preview of how the community will look, and a switch that says what ON/OFF means. */
export default function EnCreateForm() {
  const [state, action, pending] = useActionState(createCommunityAction, initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [approval, setApproval] = useState(true);
  const fe = state.fieldErrors ?? {};

  return (
    <div className="en-create">
      <form action={action} noValidate className="en-card en-form">
        <div className="en-fld">
          <label className="en-lb" htmlFor="name">Community name</label>
          <input
            id="name" name="name" autoComplete="off" placeholder="Alpha Indoor Club" maxLength={NAME_MAX}
            className={`field${fe.name ? " bad" : ""}`} value={name} onChange={(e) => setName(e.target.value)}
            aria-invalid={!!fe.name} aria-describedby={fe.name ? "name-err" : "name-hint"}
          />
          <EnFieldError id="name-err" text={fe.name} />
          <p className="en-hint" id="name-hint"><span>Shown to everyone you invite.</span><span>{name.length} / {NAME_MAX}</span></p>
        </div>

        <div className="en-fld">
          <label className="en-lb" htmlFor="description">Short description (optional)</label>
          <textarea
            id="description" name="description" placeholder="A friendly group that plays 4-over indoor cricket." maxLength={DESC_MAX}
            className={`field${fe.description ? " bad" : ""}`} value={description} onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!fe.description} aria-describedby={fe.description ? "desc-err" : "desc-hint"}
          />
          <EnFieldError id="desc-err" text={fe.description} />
          <p className="en-hint" id="desc-hint"><span>One or two lines about your group.</span><span>{description.length} / {DESC_MAX}</span></p>
        </div>

        <div className="en-fld">
          <label className="en-lb" htmlFor="location">Location (optional)</label>
          <div className="en-input">
            <EnIcon name="pin" size={18} />
            <input
              id="location" name="location" autoComplete="off" placeholder="Lahore" maxLength={LOC_MAX}
              className={`field${fe.location ? " bad" : ""}`} value={location} onChange={(e) => setLocation(e.target.value)}
              aria-invalid={!!fe.location} aria-describedby={fe.location ? "loc-err" : "loc-hint"}
            />
          </div>
          <EnFieldError id="loc-err" text={fe.location} />
          <p className="en-hint" id="loc-hint"><span>Town or area.</span><span>{location.length} / {LOC_MAX}</span></p>
        </div>

        <div className="en-switchcard">
          <label className="switch">
            <span>
              <b>Admin approves new members</b>
              <br /><small className="muted" id="approval-help">
                {approval ? "People who use your link wait until you approve them" : "Anyone with the link joins straight away"}
              </small>
            </span>
            <input type="checkbox" name="approvalRequired" checked={approval} onChange={(e) => setApproval(e.target.checked)} aria-describedby="approval-help" />
            <span className="track" aria-hidden="true" />
          </label>
        </div>

        <p className="en-note"><EnIcon name="shield" size={16} /><span>You become the Admin automatically. Next you choose your player number, then you get an invite link and a code to share.</span></p>
        {state.error && !state.fieldErrors && <p className="en-ferr" role="alert"><EnIcon name="warn" size={16} />{state.error}</p>}
        <button className="btn gold en-cta" disabled={pending} aria-busy={pending}>
          {pending ? <><EnSpinner />Creating…</> : <>Next: choose my player number<EnIcon name="right" size={18} /></>}
        </button>
      </form>

      <aside className="en-card en-preview" aria-label="Preview of your community">
        <p className="en-eyebrow center">Preview</p>
        <CommunityLogo name={name} big />
        <b className={`en-prev-name${name.trim() ? "" : " muted"}`}>{name.trim() || "Your community name"}</b>
        <span className="muted small">{location.trim() || "Location"}</span>
        <p className={`small en-prev-desc${description.trim() ? "" : " muted"}`}>{description.trim() || "Your description appears here."}</p>
        <p className="muted small en-prev-note">Communities are shown by initials. No logo upload is needed.</p>
      </aside>
    </div>
  );
}
