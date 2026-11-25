"use client";

// Phase F5: Edit my profile. Same fields, same server action (saveProfileAction) and same validation as before.
// Choices are single-choice chips (real radio buttons, so the form posts the same values), the name has a counter,
// the Save bar stays on screen, and wide screens show a live preview of the player card.
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { saveProfileAction } from "@/app/actions3";
import type { FormState } from "@/app/actions";
import PfIcon from "@/components/PfIcons";
import { PfPlayerCard, type PfTeam } from "@/components/PfParts";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PERSON_NAME_MAX, PLAYING_ROLES, labelOf } from "@/lib/validation";
import "./pf.css";

const initial: FormState = {};
type Opt = { value: string; label: string };

/** A choice error from the server names the list ("Please choose a playing role from the list."); anything else is about the name. */
export const isChoiceError = (e: string | undefined) => !!e && /from the list\.?$/.test(e);

export function Chips({ name, label, options, value, onChange }: { name: string; label: string; options: readonly Opt[]; value: string; onChange: (v: string) => void }) {
  const gid = useId();
  const all: Opt[] = [...options, { value: "", label: "Not set" }];
  return (
    <fieldset className="pf-fs">
      <legend className="lb">{label}</legend>
      <div className="pf-opts" role="radiogroup" aria-label={label}>
        {all.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value || "unset"} className={`pf-opt${on ? " on" : ""}`} htmlFor={`${gid}-${o.value || "unset"}`}>
              <input id={`${gid}-${o.value || "unset"}`} type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} />
              {on && <PfIcon name="check" size={16} />}
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function PfProfileForm({ communityId, profile, number, adminLabel, teams }: {
  communityId: string;
  profile: { name: string; batting_hand: string | null; batting_position: string | null; bowling_style: string | null; playing_role: string | null };
  number: number | null;
  adminLabel: string;
  teams: PfTeam[];
}) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.playing_role ?? "");
  const [hand, setHand] = useState(profile.batting_hand ?? "");
  const [pos, setPos] = useState(profile.batting_position ?? "");
  const [bowl, setBowl] = useState(profile.bowling_style ?? "");
  const nameId = useId();
  const errId = useId();
  const choiceError = isChoiceError(state.error) ? state.error : undefined;
  const nameError = state.error && !choiceError ? state.error : undefined;
  const shown = name.trim() || "Your name";

  return (
    <form action={action} noValidate className="pf-edit">
      <input type="hidden" name="communityId" value={communityId} />
      <div className="pf-edit-main">
        {state.message && (
          <div className="banner green pf-saved" role="status">
            <PfIcon name="check" size={18} />
            <div><b>{state.message}</b><span>Your changes are live for every member.</span></div>
          </div>
        )}
        {choiceError && (
          <div className="banner red pf-fail" role="alert">
            <PfIcon name="alert" size={18} />
            <div><b>{choiceError}</b><span>Tap one of the options below, or Not set, then save again.</span></div>
          </div>
        )}

        <div className="pf-box">
          <label className="lb" htmlFor={nameId} style={{ marginTop: 0 }}>Name</label>
          <div className={`pf-namebox${nameError ? " bad" : ""}`}>
            <input id={nameId} name="name" className="pf-nameinput" value={name} onChange={(e) => setName(e.target.value)} maxLength={PERSON_NAME_MAX} autoComplete="name" placeholder="Your full name" aria-invalid={!!nameError} aria-describedby={nameError ? errId : undefined} />
            <span className={`pf-count${name.length >= PERSON_NAME_MAX ? " max" : ""}`} aria-label={`${name.length} of ${PERSON_NAME_MAX} letters`}>{name.length}/{PERSON_NAME_MAX}</span>
          </div>
          {nameError ? <p id={errId} className="pf-err" role="alert"><PfIcon name="alert" size={16} />{nameError}</p> : <p className="pf-hint">This is the name every member sees.</p>}
          <Chips name="playingRole" label="Playing role" options={PLAYING_ROLES} value={role} onChange={setRole} />
          <Chips name="battingHand" label="Batting hand" options={BATTING_HANDS} value={hand} onChange={setHand} />
          <Chips name="battingPosition" label="Batting position" options={BATTING_POSITIONS} value={pos} onChange={setPos} />
          <Chips name="bowlingStyle" label="Bowling style" options={BOWLING_STYLES} value={bowl} onChange={setBowl} />
        </div>

        <p className="pf-info"><PfIcon name="info" size={18} /><span>Only you can change this. Career stats cannot be edited by anyone: they come only from matches scored in the app.</span></p>
        <p className="pf-info"><PfIcon name="swap" size={18} /><span>Your player number is changed on its own page. <Link href={`/c/${communityId}/number`} className="pf-link">Change number</Link></span></p>

        <div className="pf-savebar">
          <Link href={`/c/${communityId}/profile`} className="btn ghost pf-cancel">Cancel</Link>
          <button className="btn gold pf-save" disabled={pending}>{pending ? "Saving…" : <><PfIcon name="check" size={18} /> Save profile</>}</button>
        </div>
      </div>

      <aside className="pf-edit-side" aria-label="How other members see you">
        <p className="pf-eyebrow">How other members see you</p>
        <PfPlayerCard
          communityId={communityId} name={shown} number={number} subtitle={`${adminLabel}Number ${number ?? "–"}`}
          role={labelOf(PLAYING_ROLES, role || null)} hand={labelOf(BATTING_HANDS, hand || null)}
          position={labelOf(BATTING_POSITIONS, pos || null)} bowling={labelOf(BOWLING_STYLES, bowl || null)} teams={teams} label="Preview of your player card"
        />
        <div className="pf-box pf-numtile">
          <div><b>Player number {number ?? "–"}</b><small className="muted">Changed on its own page</small></div>
          <Link href={`/c/${communityId}/number`} className="btn ghost small">Change number</Link>
        </div>
      </aside>
    </form>
  );
}
