"use client";
// The start-the-match / start-an-innings panel of the scoring pad. UI redesign (Phase E1): progress bar, team badges, gold shirts
// on the player chips, a button that says what is missing or what it will do, no false target in the first super-over innings.
// The choices, the checks and the events made on Start are exactly as before (see `submit`).
import "./pp.css";
import { useState } from "react";
import CoinToss from "@/components/CoinToss";
import { Chip, type Add } from "@/components/PadSheets";
import { openersLine, chaseFor } from "@/components/padInfo";
import { IcAlert, IcCheck } from "@/components/PpIcons";
import type { PadProps } from "@/components/ScoringPad";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { battingSideFor } from "@/lib/engine/engine";
import type { MatchState, PlayerEntry, ScoreEventBody, Side } from "@/lib/engine/types";

/* ---------- starting the match, and each later innings ---------- */
export function StartPanel({ mode, m, start, add }: { mode: "match" | "innings"; m: MatchState; start: PadProps["start"]; add: Add }) {
  const [winner, setWinner] = useState<"" | "1" | "2">(start.toss ? String(start.toss.winner) as "1" | "2" : "");
  const [decision, setDecision] = useState<"" | "bat" | "bowl">(start.toss?.decision ?? "");
  const [first, setFirst] = useState<"" | "1" | "2">(start.battingFirst ? String(start.battingFirst) as "1" | "2" : "");
  const [striker, setStriker] = useState("");
  const [non, setNon] = useState("");
  const [bowler, setBowler] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tossMode, setTossMode] = useState<"coin" | "manual" | "done">(start.toss ? "done" : "coin");

  const players: PlayerEntry[] = mode === "match" ? start.base.players : Object.values(m.players).filter((p) => !m.gone[p.id]);
  const sides = mode === "match" ? start.base.sides : m.sides;
  const tossBat: Side | null = winner && decision ? (decision === "bat" ? (Number(winner) as Side) : ((winner === "1" ? 2 : 1) as Side)) : null;
  const battingSide: Side | null = mode === "match" ? (tossBat ?? (first ? (Number(first) as Side) : null)) : battingSideFor(m, m.nextInnings);
  const bowlingSide: Side | null = battingSide ? ((battingSide === 1 ? 2 : 1) as Side) : null;
  const batList = battingSide ? players.filter((p) => p.side === battingSide) : [];
  const bowlList = bowlingSide ? players.filter((p) => p.side === bowlingSide) : [];
  const idx = m.nextInnings;
  const title = mode === "match" ? "Start the match" : idx >= 2 ? "Start the super over" : `Start innings ${idx + 1}`;
  // the target only exists for the second innings of the match and of a super over (the engine sets none for the first super-over innings)
  const chase = mode === "innings" ? chaseFor(m, idx) : null;

  const submit = () => {
    setErr(null);
    if (!battingSide) return setErr("Choose who bats first (from the toss, or directly).");
    if (!striker || !non || !bowler) return setErr("Choose the striker, the non-striker and the opening bowler.");
    const inningsBody: ScoreEventBody = { type: "innings_start", payload: { striker, nonStriker: non, bowler } };
    if (mode === "match") {
      const toss = winner && decision ? { winner: Number(winner) as Side, decision } : null;
      const ok = add([{ type: "match_start", payload: { ...start.base, toss, battingFirst: battingSide } }, inningsBody]);
      if (!ok) return;
    } else if (!add([inningsBody])) return;
  };

  // progress and the words on the button (display only)
  const tossDone = mode === "innings" || !!battingSide;
  const openersDone = !!striker && !!non && !!bowler && striker !== non;
  const ready = !!battingSide && openersDone;
  const outcome = ready ? openersLine(players, striker, non, bowler) : null;
  const missing = !battingSide ? "Choose who bats first" : !striker || !non || !bowler ? "Pick both openers and the bowler" : striker === non ? "Pick two different openers" : null;
  const steps: [string, boolean][] = [[mode === "match" ? "Toss" : "Innings", tossDone], ["Openers", openersDone], ["Start", ready]];
  const overs = idx >= 2 ? 1 : m.overs;
  const pickChip = (p: PlayerEntry, on: boolean, bad: boolean, onClick: () => void) => (
    <Chip key={p.id} on={on} bad={bad} onClick={onClick}>
      <span aria-hidden="true" className="pp-chip-shirt"><Shirt size="small" number={p.number} /></span>
      {on && <IcCheck size={16} />}
      <span>{p.name}</span>
      {p.number !== null && <span className="pp-sr"> ({p.number})</span>}
    </Chip>
  );

  return (
    <div className="pp-start stack">
      <ol className="pp-steps" aria-label="Progress">
        {steps.map(([t, done], i) => <li key={t} className={done ? "done" : ""}><span className="pp-seg" aria-hidden="true" /><span>{done ? <IcCheck size={12} /> : i + 1} {t}</span></li>)}
      </ol>
      <h2 className="pp-start-h">{title}</h2>
      {mode === "match" && (
        <>
          <div className="pp-teams"><TeamBadge name={sides[0]} size="md" /><b>{sides[0]}</b><span className="muted" aria-hidden="true">v</span><TeamBadge name={sides[1]} size="md" /><b>{sides[1]}</b></div>
          <p className="muted small" style={{ margin: 0 }}>{sides[0]} v {sides[1]} · {start.base.overs} overs · {start.base.playersPerSide} a side · {start.base.players.filter((p) => p.side === 1).length} and {start.base.players.filter((p) => p.side === 2).length} players picked. You are the scorer.</p>
          {tossMode === "coin" && (
            <>
              <CoinToss sides={start.base.sides} onDone={(r) => { setWinner(String(r.winner) as "1" | "2"); setDecision(r.decision); setStriker(""); setNon(""); setBowler(""); }} />
              <button type="button" className="pp-link" onClick={() => { setWinner(""); setDecision(""); setTossMode("manual"); }}>The toss was already done: enter the result by hand</button>
            </>
          )}
          {tossMode === "done" && (
            <div className="pp-card green"><span className="pp-card-ico" aria-hidden="true"><IcCheck size={22} /></span><div><b>{sides[Number(winner) - 1]} won the toss</b><span>and chose to {decision}.</span></div><button type="button" className="pp-chipbtn" onClick={() => { setWinner(""); setDecision(""); setTossMode("coin"); }}>Toss again</button></div>
          )}
          {tossMode === "manual" && (
            <>
              <div className="two">
                <div>
                  <label className="lb" htmlFor="st-w" style={{ marginTop: 0 }}>Toss won by</label>
                  <select id="st-w" className="field" value={winner} onChange={(e) => setWinner(e.target.value as "" | "1" | "2")}><option value="">Not recorded</option><option value="1">{sides[0]}</option><option value="2">{sides[1]}</option></select>
                </div>
                <div>
                  <label className="lb" htmlFor="st-d" style={{ marginTop: 0 }}>Chose to</label>
                  <select id="st-d" className="field" value={decision} onChange={(e) => setDecision(e.target.value as "" | "bat" | "bowl")}><option value="">Not recorded</option><option value="bat">Bat</option><option value="bowl">Bowl</option></select>
                </div>
              </div>
              <button type="button" className="pp-link" onClick={() => { setWinner(""); setDecision(""); setTossMode("coin"); }}>Use the coin instead</button>
            </>
          )}
          {winner && !decision && <p className="err pp-err"><IcAlert size={16} /> Choose what the toss winner decided.</p>}
          {!tossBat && (
            <>
              <label className="lb" htmlFor="st-f">Batting first</label>
              <select id="st-f" className="field" value={first} onChange={(e) => { setFirst(e.target.value as "" | "1" | "2"); setStriker(""); setNon(""); setBowler(""); }}><option value="">Choose</option><option value="1">{sides[0]}</option><option value="2">{sides[1]}</option></select>
            </>
          )}
        </>
      )}
      {mode === "innings" && battingSide && (
        chase !== null
          ? <div className="pp-card gold"><div><b>{sides[battingSide - 1]} need {chase} to win</b><span>from {overs} over{overs === 1 ? "" : "s"}. Choose the openers and the bowler.</span></div></div>
          : <div className="pp-card gold"><div><b>{sides[battingSide - 1]} bat{idx >= 2 ? ". One over each" : ""}.</b><span>{idx >= 2 ? "There is no bowler limit in a super over." : "Choose the openers and the bowler."}</span></div></div>
      )}
      {battingSide && (
        <>
          <b className="pp-group-h">Striker (faces the first ball)</b>
          <div className="chips pp-chips" role="group" aria-label="Striker">
            {batList.map((p) => pickChip(p, striker === p.id, striker === p.id && non === p.id, () => setStriker(p.id)))}
          </div>
          <b className="pp-group-h">Non-striker</b>
          <div className="chips pp-chips" role="group" aria-label="Non-striker">
            {batList.map((p) => pickChip(p, non === p.id, non === p.id && striker === p.id, () => setNon(p.id)))}
          </div>
          {striker && striker === non && <p className="err pp-err" role="alert"><IcAlert size={16} /> Striker and non-striker must be different players.</p>}
          <b className="pp-group-h">First bowler ({sides[(bowlingSide ?? 2) - 1]})</b>
          <div className="chips pp-chips" role="group" aria-label="First bowler">
            {bowlList.map((p) => pickChip(p, bowler === p.id, false, () => setBowler(p.id)))}
          </div>
        </>
      )}
      {err && <p className="err pp-err" role="alert"><IcAlert size={16} /> {err}</p>}
      <div className="pp-startbar">
        <p className={`pp-startnote${ready ? " ok" : ""}`} id="pp-start-note" role="status">{ready ? (outcome ?? "Ready to start") : (missing ?? "")}</p>
        <button type="button" className="btn gold pp-big" aria-describedby="pp-start-note" disabled={!battingSide || !striker || !non || !bowler || striker === non} onClick={submit}>{mode === "match" ? "Start scoring" : "Start the innings"}</button>
      </div>
    </div>
  );
}
