"use client";
// Phase D1: "Toss and batting order" on the Match details page (replaces TossForm). Two clearly separate ways:
//  1. flip the coin: who calls, the call, the toss, bat or bowl (a four step bar, big team tiles with badges, heads and tails tiles);
//  2. type a toss that was done in real life ("Enter or correct the toss": two selects and Save toss).
// The coin only FILLS the two fields; Save toss keeps it (same as before). Saving uses the existing tossAction (same permission,
// same "already started" lock, same redirect and "Toss saved." notice). "Not decided yet" in both clears the toss.
// The scoring pad still uses CoinToss for the toss at the start of scoring; this component is only for this page.
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { tossAction } from "@/app/actions4";
import type { FormState } from "@/app/actions";
import { IconCheck, IconInfo, IconLock, IconPencil, IconWarn } from "@/components/B4Icons";
import { MdBall, MdBat, MdCoin } from "@/components/MdIcons";
import TeamBadge from "@/components/TeamBadge";
import { flipCoin, tossWinner, type CoinSide } from "@/lib/coin";
import { validateToss } from "@/lib/matchRules";
import { TOSS_STEPS, battingFirstOf, tossProblem, tossStep, tossSummary } from "@/lib/md";
import "./md.css";

type Side = 1 | 2;
type Decision = "bat" | "bowl";
const initial: FormState = {};

export default function MatchToss({ communityId, matchId, sides, winner, decision, battingFirst, canEdit, mine = [false, false] }: {
  communityId: string; matchId: string; sides: [string, string]; winner: number | null; decision: string | null; battingFirst: number | null;
  /** True while the match has not started (draft, scheduled, postponed). After that the card only tells the toss. */
  canEdit: boolean; mine?: [boolean, boolean];
}) {
  const [state, action, pending] = useActionState(tossAction, initial);
  const [w, setW] = useState(winner === 1 || winner === 2 ? String(winner) : "");
  const [d, setD] = useState(decision === "bat" || decision === "bowl" ? decision : "");
  const [coin, setCoin] = useState(false);
  const [filled, setFilled] = useState<string | null>(null);
  const [local, setLocal] = useState<string | undefined>(undefined);
  const formCard = useRef<HTMLElement>(null);

  const saved = tossSummary({ winner: winner === 1 || winner === 2 ? winner : null, decision: decision === "bat" || decision === "bowl" ? decision : null, battingFirst: battingFirst === 1 || battingFirst === 2 ? battingFirst : null }, sides);
  // A message stays until the person changes a field. "Already started" is different: the card then stays read only.
  const server = tossProblem(state.error);
  const problem = local !== undefined ? tossProblem(local || undefined) : server;
  const serverLocked = !!server?.locked;
  const locked = !canEdit || serverLocked;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const t = validateToss(fd.get("winner"), fd.get("decision"));
    if (!t.ok) { setLocal(t.error); return; }
    setLocal(undefined);
    startTransition(() => action(fd));
  };
  const change = () => {
    formCard.current?.scrollIntoView?.({ block: "center" });
    formCard.current?.querySelector<HTMLElement>("select")?.focus();
  };

  return (
    <>
      <section className="md-card md-tosscard" id="toss" aria-labelledby="md-toss-h">
        <div className="md-tosshead">
          <h2 className="md-h" id="md-toss-h">Toss and batting order</h2>
          <span className={`md-tag${saved ? " ok" : ""}`}>{saved ? "Recorded" : "Not recorded"}</span>
        </div>
        {saved ? (
          <div className="md-summary">
            <span className="md-sico" aria-hidden="true"><MdCoin size={22} /></span>
            <p><b>{sides[(winner as Side) - 1]}</b> won the toss and chose to <b>{decision}</b>.
              <span className="md-bats"><TeamBadge name={sides[saved.battingSide - 1]} size="sm" /><b>{sides[saved.battingSide - 1]}</b> bats first.</span>
            </p>
          </div>
        ) : (
          <p className="md-help">{canEdit ? "Not recorded yet. Record it here before the match, or at the start of scoring." : "No toss was recorded for this match."}</p>
        )}
        {serverLocked && (
          <p className="md-error" role="alert"><IconLock size={16} /><span>{server?.text}</span></p>
        )}
        {!locked && !coin && (
          <>
            <div className="md-tossbtns">
              <button type="button" className="md-primary" onClick={() => setCoin(true)}><MdCoin size={20} />Toss the coin</button>
              {saved && <button type="button" className="md-second" onClick={change}><IconPencil size={18} />Change</button>}
            </div>
            <p className="md-help center">Or enter a toss that was done in real life below.</p>
          </>
        )}
        {!locked && coin && (
          <CoinFlow
            sides={sides}
            mine={mine}
            onClose={() => setCoin(false)}
            onFill={(r) => {
              setW(String(r.winner)); setD(r.decision); setLocal("");
              setFilled(`${sides[r.winner - 1]} chose to ${r.decision}. ${sides[battingFirstOf(r.winner, r.decision) - 1]} bats first. Filled into the form below: press Save toss to keep it.`);
            }}
            note={filled}
          />
        )}
      </section>

      {!locked && (
        <section className="md-card md-tossform" ref={formCard} aria-labelledby="md-tossform-h">
          <h3 className="md-h" id="md-tossform-h"><IconPencil size={16} />Enter or correct the toss</h3>
          <form onSubmit={submit} noValidate>
            <input type="hidden" name="communityId" value={communityId} />
            <input type="hidden" name="matchId" value={matchId} />
            <label className="md-lb" htmlFor="md-t-win">Who won the toss?</label>
            <select id="md-t-win" name="winner" className={`md-sel${problem?.field === "winner" ? " bad" : ""}`} value={w} onChange={(e) => { setW(e.target.value); setLocal(""); }} aria-invalid={problem?.field === "winner"} aria-describedby={problem?.field === "winner" ? "md-t-win-err" : undefined}>
              <option value="">Not decided yet</option>
              <option value="1">{sides[0]}</option>
              <option value="2">{sides[1]}</option>
            </select>
            {problem?.field === "winner" && <p id="md-t-win-err" className="md-error" role="alert"><IconWarn size={16} /><span>{problem.text}</span></p>}
            <label className="md-lb" htmlFor="md-t-dec">The winner chose to</label>
            <select id="md-t-dec" name="decision" className={`md-sel${problem?.field === "decision" ? " bad" : ""}`} value={d} onChange={(e) => { setD(e.target.value); setLocal(""); }} aria-invalid={problem?.field === "decision"} aria-describedby={problem?.field === "decision" ? "md-t-dec-err" : undefined}>
              <option value="">Not decided yet</option>
              <option value="bat">Bat first</option>
              <option value="bowl">Bowl first</option>
            </select>
            {problem?.field === "decision" && <p id="md-t-dec-err" className="md-error" role="alert"><IconWarn size={16} /><span>{problem.text}</span></p>}
            <p className="md-help">Who bats first follows from the toss. Choose “Not decided yet” in both to clear it.</p>
            {problem && problem.field === null && !problem.locked && <p className="md-error" role="alert"><IconWarn size={16} /><span>{problem.text}</span></p>}
            <button className="btn gold" disabled={pending}>{pending ? "Saving…" : "Save toss"}</button>
          </form>
        </section>
      )}
    </>
  );
}

/* ---------- the coin ---------- */
function CoinFlow({ sides, mine, onClose, onFill, note }: {
  sides: [string, string]; mine: [boolean, boolean]; onClose: () => void; onFill: (r: { winner: Side; decision: Decision }) => void; note: string | null;
}) {
  const [caller, setCaller] = useState<Side>(1);
  const [call, setCall] = useState<CoinSide | null>(null);
  const [phase, setPhase] = useState<"ready" | "flipping" | "result">("ready");
  const [result, setResult] = useState<CoinSide | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const won: Side | null = result && call ? tossWinner(caller, call, result) : null;
  const toss = () => {
    if (!call || phase !== "ready") return;
    const r = flipCoin();               // decided now; the animation then shows exactly this result
    setResult(r);
    const calm = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) { setPhase("result"); return; }          // reduced motion: show the result at once
    setPhase("flipping");
    navigator.vibrate?.(20);
    timer.current = setTimeout(() => { setPhase("result"); navigator.vibrate?.([30, 40, 30]); }, 2200);
  };
  const choose = (x: Decision) => {
    setDecision(x);
    if (won) onFill({ winner: won, decision: x });
  };
  const step = tossStep({ call: !!call, phase });
  const face = result === "heads" ? "h" : result === "tails" ? "t" : "";

  return (
    <div className="md-coinflow" aria-label="Coin toss">
      <ol className="md-steps" aria-label={`Step ${step + 1} of 4: ${TOSS_STEPS[step]}`}>
        {TOSS_STEPS.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}><span className="md-seg" /><small>{s}</small></li>)}
      </ol>

      {phase !== "ready" && (
        <div className="md-coinstage" aria-hidden="true">
          <div className="coin-stage">
            <div className={`coin${phase === "flipping" ? ` flipping ${face}` : ""}${phase === "result" ? ` ${face}` : ""}`}>
              <div className="coin-face heads"><span>H</span><small>HEADS</small></div>
              <div className="coin-face tails"><span>T</span><small>TAILS</small></div>
            </div>
            <div className="coin-shadow" />
          </div>
        </div>
      )}

      {phase === "ready" && (
        <>
          <b className="md-q">Who calls?</b>
          <div className="md-tiles" role="radiogroup" aria-label="Who calls the toss">
            {([1, 2] as Side[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={caller === s} className={`md-tile${caller === s ? " on" : ""}`} onClick={() => setCaller(s)}>
                <span className={mine[s - 1] ? "md-own" : undefined}><TeamBadge name={sides[s - 1]} size="sm" /></span>
                <b>{sides[s - 1]}</b><span className="md-radio" aria-hidden="true" />
              </button>
            ))}
          </div>
          <b className="md-q">{sides[caller - 1]} calls</b>
          <div className="md-calls" role="radiogroup" aria-label="The call">
            {(["heads", "tails"] as CoinSide[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={call === c} className={`md-call${call === c ? " on" : ""}`} onClick={() => setCall(c)}>
                <span className="md-mini" aria-hidden="true">{c === "heads" ? "H" : "T"}</span><b>{c === "heads" ? "Heads" : "Tails"}</b>
              </button>
            ))}
          </div>
          <button type="button" className="md-primary" disabled={!call} onClick={toss}><MdCoin size={20} />Toss the coin</button>
          {!call && <p className="md-help center">Choose heads or tails first.</p>}
        </>
      )}

      {phase === "flipping" && (
        <>
          <span className="md-air" role="status"><i aria-hidden="true" />Coin in the air</span>
          <p className="center md-q" role="status">{sides[caller - 1]} called {call}. The coin is in the air…</p>
          <button type="button" className="md-primary" disabled>Tossing…</button>
        </>
      )}

      {phase === "result" && result && won && (
        <div className="md-result-box">
          <div className="md-itis" role="status">
            <IconCheck size={18} />
            <span><b>It&rsquo;s {result.toUpperCase()}</b>{sides[caller - 1]} called {call}. <b>{sides[won - 1]} won the toss.</b></span>
          </div>
          <b className="md-q">{sides[won - 1]} chooses to</b>
          <div className="md-bb" role="radiogroup" aria-label="The winner chooses">
            <button type="button" role="radio" aria-checked={decision === "bat"} className={`md-bbtn${decision === "bat" ? " on" : ""}`} onClick={() => choose("bat")}><MdBat size={22} />Bat first</button>
            <button type="button" role="radio" aria-checked={decision === "bowl"} className={`md-bbtn${decision === "bowl" ? " on" : ""}`} onClick={() => choose("bowl")}><MdBall size={22} />Bowl first</button>
          </div>
          {!decision && <p className="md-help center">Choose bat or bowl to continue.</p>}
          {decision && note && <p className="md-info" role="status"><IconInfo size={16} /><span>{note}</span></p>}
        </div>
      )}

      <button type="button" className="md-second wide" onClick={onClose}>Close the coin</button>
    </div>
  );
}
