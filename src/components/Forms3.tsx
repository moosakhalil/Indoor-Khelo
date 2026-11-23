"use client";

import { useActionState } from "react";
import { createTeamAction, saveProfileAction, updateTeamAction } from "@/app/actions3";
import type { FormState } from "@/app/actions";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES } from "@/lib/validation";

const initial: FormState = {};
function Err({ text }: { text?: string }) {
  return text ? <p className="err" role="alert">{text}</p> : null;
}

function Choice({ id, name, label, options, value, empty = "Not set" }: {
  id: string; name: string; label: string; options: readonly { value: string; label: string }[]; value: string | null; empty?: string | null;
}) {
  return (
    <>
      <label className="lb" htmlFor={id}>{label}</label>
      <select id={id} name={name} className="field" defaultValue={value ?? ""}>
        {empty !== null && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </>
  );
}

/* ---------- my player profile ---------- */
export function ProfileForm({ communityId, profile }: {
  communityId: string;
  profile: { name: string; batting_hand: string | null; batting_position: string | null; bowling_style: string | null; playing_role: string | null };
}) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  return (
    <form action={action} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <label className="lb" htmlFor="pf-name" style={{ marginTop: 0 }}>Name</label>
      <input id="pf-name" name="name" className="field" defaultValue={profile.name} maxLength={60} autoComplete="name" />
      <Choice id="pf-role" name="playingRole" label="Playing role" options={PLAYING_ROLES} value={profile.playing_role} />
      <Choice id="pf-hand" name="battingHand" label="Batting hand" options={BATTING_HANDS} value={profile.batting_hand} />
      <Choice id="pf-pos" name="battingPosition" label="Batting position" options={BATTING_POSITIONS} value={profile.batting_position} />
      <Choice id="pf-bowl" name="bowlingStyle" label="Bowling style" options={BOWLING_STYLES} value={profile.bowling_style} />
      <p className="muted small" style={{ margin: "10px 2px" }}>Only you can change this. Career stats cannot be edited by anyone: they come only from matches scored in the app.</p>
      <Err text={state.error} />
      {state.message && <p className="banner green" role="status">{state.message}</p>}
      <button className="btn gold" disabled={pending} style={{ marginTop: 8 }}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

/* ---------- team (create and edit) ---------- */
type Person = { user_id: string; name: string; player_number: number | null };

export function TeamForm({ mode, communityId, teamId, members, team }: {
  mode: "create" | "edit";
  communityId: string;
  teamId?: string;
  members: Person[];
  team?: { name: string; description: string; captain_id: string | null; vice_captain_id: string | null };
}) {
  const [state, action, pending] = useActionState(mode === "create" ? createTeamAction : updateTeamAction, initial);
  const fe = state.fieldErrors ?? {};
  const options = (
    <>
      <option value="">Not chosen</option>
      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name} ({m.player_number ?? "–"})</option>)}
    </>
  );
  return (
    <form action={action} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      {teamId && <input type="hidden" name="teamId" value={teamId} />}
      <label className="lb" htmlFor="t-name" style={{ marginTop: 0 }}>Team name</label>
      <input id="t-name" name="name" className={`field${fe.name ? " bad" : ""}`} defaultValue={team?.name} maxLength={40} autoComplete="off" placeholder="Alpha" aria-invalid={!!fe.name} />
      <Err text={fe.name} />
      <label className="lb" htmlFor="t-desc">Description (optional)</label>
      <input id="t-desc" name="description" className={`field${fe.description ? " bad" : ""}`} defaultValue={team?.description} maxLength={200} placeholder="Friday night regulars" />
      <Err text={fe.description} />
      <label className="lb" htmlFor="t-cap">Captain</label>
      <select id="t-cap" name="captainId" className="field" defaultValue={team?.captain_id ?? ""}>{options}</select>
      <label className="lb" htmlFor="t-vice">Vice-captain</label>
      <select id="t-vice" name="viceCaptainId" className="field" defaultValue={team?.vice_captain_id ?? ""}>{options}</select>
      <Err text={fe.captain} />
      <p className="muted small" style={{ margin: "10px 2px" }}>The team is shown by its initials. A captain or vice-captain is added to the squad automatically.</p>
      {state.error && !state.fieldErrors && <Err text={state.error} />}
      {state.message && <p className="banner green" role="status">{state.message}</p>}
      <button className="btn gold" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Saving…" : mode === "create" ? "Next: choose the squad" : "Save team"}
      </button>
    </form>
  );
}
