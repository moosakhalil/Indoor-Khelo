"use client";

// "Tell us how you play": shown once, right after a player picks their number for the first time. Every choice is optional,
// "Not set" is always available, and Skip goes straight on. Same four choices, same validation and same save as Edit profile.
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveProfileSetupAction } from "@/app/actions3";
import type { FormState } from "@/app/actions";
import PfIcon from "@/components/PfIcons";
import { Chips } from "@/components/PfProfileForm";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES } from "@/lib/validation";
import "./pf.css";

const initial: FormState = {};

export default function ProfileSetupForm({ communityId, isNew, skipHref }: { communityId: string; isNew: boolean; skipHref: string }) {
  const [state, action, pending] = useActionState(saveProfileSetupAction, initial);
  const [role, setRole] = useState("");
  const [hand, setHand] = useState("");
  const [pos, setPos] = useState("");
  const [bowl, setBowl] = useState("");
  return (
    <form action={action} noValidate className="pf-edit">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="isNew" value={isNew ? "1" : "0"} />
      {state.error && (
        <div className="banner red pf-fail" role="alert">
          <PfIcon name="alert" size={18} />
          <div><b>{state.error}</b><span>Tap one of the options, or Not set, then try again. You can also skip.</span></div>
        </div>
      )}
      <div className="pf-box">
        <Chips name="playingRole" label="Playing role" options={PLAYING_ROLES} value={role} onChange={setRole} />
        <Chips name="battingHand" label="Batting hand" options={BATTING_HANDS} value={hand} onChange={setHand} />
        <Chips name="battingPosition" label="Batting position" options={BATTING_POSITIONS} value={pos} onChange={setPos} />
        <Chips name="bowlingStyle" label="Bowling style" options={BOWLING_STYLES} value={bowl} onChange={setBowl} />
      </div>
      <p className="pf-info"><PfIcon name="info" size={18} /><span>Fill in as much or as little as you like. Only you can change this, and you can do it any time from your Profile.</span></p>
      <div className="pf-savebar">
        <Link href={skipHref} className="btn ghost pf-cancel">Skip for now</Link>
        <button className="btn gold pf-save" disabled={pending}>{pending ? "Saving…" : <><PfIcon name="check" size={18} /> Save and continue</>}</button>
      </div>
    </form>
  );
}
