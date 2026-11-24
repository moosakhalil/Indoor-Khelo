"use client";
// New team and Edit team: the same fields, limits and messages as before (name, description, captain, vice-captain),
// with a live badge preview, character counters, member pickers with shirts, and the saved message as a snackbar.
import "./b4.css";
import { useActionState, useEffect, useState } from "react";
import { createTeamAction, updateTeamAction } from "@/app/actions3";
import type { FormState } from "@/app/actions";
import { IconWarn } from "@/components/B4Icons";
import MemberPicker, { type PickPerson } from "@/components/MemberPicker";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import TeamBadge from "@/components/TeamBadge";
import { TEAM_DESCRIPTION_MAX, TEAM_NAME_MAX } from "@/lib/validation";

const initial: FormState = {};

function FieldError({ text, id }: { text?: string; id?: string }) {
  return text ? <p className="err tm-err" role="alert" id={id}><IconWarn size={16} /> <span>{text}</span></p> : null;
}

export function StepBar({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="tm-steps" role="group" aria-label={`Step ${step} of ${total}: ${title}`}>
      <div className="tm-steps-bars" aria-hidden="true">{Array.from({ length: total }, (_, i) => <span key={i} className={i < step ? "on" : ""} />)}</div>
      <small>Step {step} of {total} · {title}</small>
    </div>
  );
}

export default function TeamEditor({ mode, communityId, teamId, members, team, aside }: {
  mode: "create" | "edit";
  communityId: string;
  teamId?: string;
  members: PickPerson[];
  team?: { name: string; description: string; captain_id: string | null; vice_captain_id: string | null };
  /** Shown under the preview on wide screens (the delete card on the edit page). */
  aside?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(mode === "create" ? createTeamAction : updateTeamAction, initial);
  const snack = useSnackbar();
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [captainId, setCaptainId] = useState(team?.captain_id ?? "");
  const [viceId, setViceId] = useState(team?.vice_captain_id ?? "");
  const fe = state.fieldErrors ?? {};
  const same = !!captainId && captainId === viceId;
  const captainError = fe.captain ?? (same ? "The captain and vice-captain must be two different people." : undefined);
  const cap = members.find((m) => m.user_id === captainId);
  const vice = members.find((m) => m.user_id === viceId);
  const shownName = name.trim() || (team?.name ?? "");

  // "Saved." appears where the person is looking, not as a green banner under the button.
  useEffect(() => {
    if (state.message) snack.show({ message: state.message, tone: "success" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
    {mode === "create" && <StepBar step={1} total={2} title="Team details" />}
    <div className="tm-edit">
      <form action={action} noValidate className="tm-form-col">
        <input type="hidden" name="communityId" value={communityId} />
        {teamId && <input type="hidden" name="teamId" value={teamId} />}

        <label className="lb" htmlFor="t-name" style={{ marginTop: 0 }}>Team name</label>
        <input id="t-name" name="name" className={`field${fe.name ? " bad" : ""}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={TEAM_NAME_MAX} autoComplete="off" placeholder="Alpha" aria-invalid={!!fe.name} aria-describedby={fe.name ? "t-name-err" : "t-name-hint"} />
        <div className="tm-hintrow"><small id="t-name-hint" className="muted">Names are unique in this community.</small><small className="muted tm-count" aria-live="polite">{name.length}/{TEAM_NAME_MAX}</small></div>
        <FieldError text={fe.name} id="t-name-err" />

        <label className="lb" htmlFor="t-desc">Description (optional)</label>
        <input id="t-desc" name="description" className={`field${fe.description ? " bad" : ""}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={TEAM_DESCRIPTION_MAX} placeholder="Friday night regulars" aria-invalid={!!fe.description} />
        <div className="tm-hintrow"><span /><small className="muted tm-count">{description.length}/{TEAM_DESCRIPTION_MAX}</small></div>
        <FieldError text={fe.description} />

        <MemberPicker label="Captain" name="captainId" value={captainId} onChange={setCaptainId} members={members} />
        <MemberPicker label="Vice-captain" name="viceCaptainId" value={viceId} onChange={setViceId} members={members} error={captainError} />
        <FieldError text={captainError} />
        <p className="muted small" style={{ margin: "10px 2px" }}>The team is shown by its initials. A captain or vice-captain is added to the squad automatically.</p>
        {state.error && !state.fieldErrors && <FieldError text={state.error} />}

        <div className="tm-actions">
          <button className="btn gold" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Next: choose the squad" : "Save team"}</button>
        </div>
      </form>

      <div className="tm-aside">
        <section className="card tm-previewcard" aria-label="Preview of the team">
          <small className="muted tm-previewlabel">Preview</small>
          {shownName ? <TeamBadge name={shownName} size="lg" /> : <span className="team-badge lg tm-blank" aria-label="No name yet">?</span>}
          <b className="tm-previewname">{shownName || "Your team name"}</b>
          {description && <small className="muted">{description}</small>}
          <div className="tm-leaders">
            {cap ? <span className="tm-leader"><Shirt number={cap.player_number} size="small" /><span>{cap.name}</span><span className="tm-role">C</span></span> : null}
            {vice ? <span className="tm-leader"><Shirt number={vice.player_number} size="small" /><span>{vice.name}</span><span className="tm-role">VC</span></span> : null}
            {!cap && !vice && <small className="muted">No captain chosen yet</small>}
          </div>
        </section>
        {aside}
      </div>
    </div>
    </>
  );
}
