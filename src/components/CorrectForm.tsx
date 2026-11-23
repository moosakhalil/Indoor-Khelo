"use client";

import { startTransition, useActionState, useState } from "react";
import { correctBallAction } from "@/app/actions6";
import type { FormState } from "@/app/actions";
import { DISMISSALS } from "@/lib/matchRules";

type P = { id: string; name: string };
const initial: FormState = {};
const Err = ({ text }: { text?: string }) => (text ? <p className="err" role="alert">{text}</p> : null);

export default function CorrectForm({ communityId, matchId, ballId, bat, field, current }: {
  communityId: string; matchId: string; ballId: string; bat: P[]; field: P[];
  current: { extra: string; runs: number; wicket: string; out: string; fielder: string };
}) {
  const [state, action, pending] = useActionState(correctBallAction, initial);
  const [wk, setWk] = useState(current.wicket);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="ballId" value={ballId} />
      <label className="lb" htmlFor="c-x" style={{ marginTop: 0 }}>Kind of ball</label>
      <select id="c-x" name="extra" className="field" defaultValue={current.extra}>
        <option value="">Normal ball</option><option value="wide">Wide</option><option value="noball">No ball</option><option value="bye">Bye</option><option value="legbye">Leg-bye</option>
      </select>
      <label className="lb" htmlFor="c-r">Runs (off the bat, byes, extra runs run, or runs completed before a run out)</label>
      <input id="c-r" name="runs" className={`field${fe.runs ? " bad" : ""}`} inputMode="numeric" defaultValue={String(current.runs)} maxLength={2} />
      <Err text={fe.runs} />
      <label className="lb" htmlFor="c-w">Wicket</label>
      <select id="c-w" name="wicket" className="field" value={wk} onChange={(e) => setWk(e.target.value)}>
        <option value="">No wicket</option>
        {DISMISSALS.filter((d) => d.value !== "retired_out").map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
      {wk === "run_out" && (
        <>
          <label className="lb" htmlFor="c-o">Who was run out</label>
          <select id="c-o" name="out" className={`field${fe.out ? " bad" : ""}`} defaultValue={current.out}>
            <option value="">Choose</option>{bat.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Err text={fe.out} />
        </>
      )}
      {(wk === "caught" || wk === "stumped" || wk === "run_out") && (
        <>
          <label className="lb" htmlFor="c-f">{wk === "caught" ? "Who took the catch (required)" : wk === "stumped" ? "Wicket-keeper (required)" : "Fielder (required)"}</label>
          <select id="c-f" name="fielder" className={`field${fe.fielder ? " bad" : ""}`} defaultValue={current.fielder}>
            <option value="">Choose</option>{field.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Err text={fe.fielder} />
        </>
      )}
      <label className="lb" htmlFor="c-why">Reason (optional)</label>
      <input id="c-why" name="reason" className="field" maxLength={200} placeholder="For the match history" />
      <p className="muted small" style={{ margin: "10px 2px" }}>Your name is saved with the change. The original ball stays in the record, and the scorecard, stats and Player of the Match are worked out again.</p>
      {state.error && <Err text={state.error} />}
      <button className="btn gold" disabled={pending}>{pending ? "Saving…" : "Save the correction"}</button>
    </form>
  );
}
