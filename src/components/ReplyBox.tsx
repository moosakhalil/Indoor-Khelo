"use client";
// "Are you coming?" on Home: two clear buttons, or (once answered) a calm row with a Change button.
// It uses the same server action as the match page (setAvailabilityAction), so the rules are the same:
// replies can be changed until the match starts. "You are out" is neutral, never green.
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { setAvailabilityAction } from "@/app/actions4";
import HmIcon from "@/components/HmIcons";
import "./home.css";

function AnswerButton({ label, tone, icon }: { label: string; tone: "green" | "plain"; icon: "check" | "close" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn${tone === "green" ? " green hm-in" : " ghost"}`} disabled={pending}>
      <HmIcon name={icon} size={18} /> {label}
    </button>
  );
}

function AnswerForm({ communityId, matchId, answer, label, tone, icon }: { communityId: string; matchId: string; answer: "in" | "out"; label: string; tone: "green" | "plain"; icon: "check" | "close" }) {
  return (
    <form action={setAvailabilityAction}>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="answer" value={answer} />
      <input type="hidden" name="next" value="home" />
      <AnswerButton label={label} tone={tone} icon={icon} />
    </form>
  );
}

export default function ReplyBox({ communityId, matchId, answer }: { communityId: string; matchId: string; answer: "in" | "out" | null }) {
  const [changing, setChanging] = useState(false);
  if (answer && !changing) {
    const isIn = answer === "in";
    return (
      <div className={`hm-reply ${isIn ? "is-in" : "is-out"}`} role="status">
        <HmIcon name={isIn ? "check" : "close"} size={20} />
        <b className="grow">{isIn ? "You are in" : "You are out"}</b>
        <button type="button" className="btn small ghost" aria-label={`Change your reply. Now: ${isIn ? "you are in" : "you are out"}`} onClick={() => setChanging(true)}>Change</button>
      </div>
    );
  }
  return (
    <div>
      <div className="two hm-reply-btns" role="group" aria-label="Are you coming?">
        <AnswerForm communityId={communityId} matchId={matchId} answer="in" label="I'm in" tone="green" icon="check" />
        <AnswerForm communityId={communityId} matchId={matchId} answer="out" label="Can't make it" tone="plain" icon="close" />
      </div>
      {answer && <button type="button" className="hm-cancel" onClick={() => setChanging(false)}>Keep my reply</button>}
    </div>
  );
}
