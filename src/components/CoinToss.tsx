"use client";
// The coin toss: one team calls heads or tails, the coin spins, and the winner chooses to bat or bowl.
import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/PadSheets";
import { flipCoin, tossWinner, type CoinSide } from "@/lib/coin";

type Side = 1 | 2;
export type TossResult = { winner: Side; decision: "bat" | "bowl" };

export default function CoinToss({ sides, onDone }: { sides: [string, string]; onDone: (r: TossResult) => void }) {
  const [caller, setCaller] = useState<Side>(1);
  const [call, setCall] = useState<CoinSide | null>(null);
  const [phase, setPhase] = useState<"ready" | "flipping" | "result">("ready");
  const [result, setResult] = useState<CoinSide | null>(null);
  const [decision, setDecision] = useState<"bat" | "bowl" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const winner: Side | null = result && call ? tossWinner(caller, call, result) : null;
  const toss = () => {
    if (!call || phase !== "ready") return;
    const r = flipCoin();          // decided now; the animation then shows exactly this result
    setResult(r);
    setPhase("flipping");
    navigator.vibrate?.(20);
    timer.current = setTimeout(() => { setPhase("result"); navigator.vibrate?.([30, 40, 30]); }, 2200);
  };
  const choose = (d: "bat" | "bowl") => {
    setDecision(d);
    if (winner) onDone({ winner, decision: d });
  };

  return (
    <section className="toss" aria-label="Coin toss">
      <div className="coin-stage" aria-hidden="true">
        <div className={`coin${phase === "flipping" ? ` flipping ${result === "heads" ? "h" : "t"}` : ""}${phase === "result" ? ` ${result === "heads" ? "h" : "t"}` : ""}`}>
          <div className="coin-face heads"><span>H</span><small>HEADS</small></div>
          <div className="coin-face tails"><span>T</span><small>TAILS</small></div>
        </div>
        <div className="coin-shadow" />
      </div>

      {phase === "ready" && (
        <>
          <b style={{ display: "block" }}>Who calls?</b>
          <div className="chips" role="group" aria-label="Who calls the toss">
            {([1, 2] as Side[]).map((s) => <Chip key={s} on={caller === s} onClick={() => setCaller(s)}>{sides[s - 1]}</Chip>)}
          </div>
          <b style={{ display: "block" }}>{sides[caller - 1]} calls</b>
          <div className="chips" role="group" aria-label="The call">
            <Chip on={call === "heads"} onClick={() => setCall("heads")}>Heads</Chip>
            <Chip on={call === "tails"} onClick={() => setCall("tails")}>Tails</Chip>
          </div>
          <button type="button" className="btn gold" style={{ marginTop: 10 }} disabled={!call} onClick={toss}>Toss the coin</button>
          {!call && <p className="muted small center" style={{ margin: "6px 0 0" }}>Choose heads or tails first.</p>}
        </>
      )}

      {phase === "flipping" && <p className="center" role="status" style={{ margin: "10px 0 0" }}><b>{sides[caller - 1]} called {call}. The coin is in the air…</b></p>}

      {phase === "result" && result && winner && (
        <div className="stack" style={{ marginTop: 8 }}>
          <div className="banner green center" role="status">
            <b style={{ fontSize: "1.1rem", display: "block" }}>It&rsquo;s {result.toUpperCase()}</b>
            {sides[caller - 1]} called {call}. <b>{sides[winner - 1]} won the toss.</b>
          </div>
          <b>{sides[winner - 1]} chooses to</b>
          <div className="chips" role="group" aria-label="The winner chooses">
            <Chip on={decision === "bat"} onClick={() => choose("bat")}>Bat first</Chip>
            <Chip on={decision === "bowl"} onClick={() => choose("bowl")}>Bowl first</Chip>
          </div>
          {!decision && <p className="muted small center" style={{ margin: 0 }}>Choose bat or bowl to continue.</p>}
        </div>
      )}
    </section>
  );
}
