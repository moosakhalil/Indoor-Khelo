// Phase E1: the keypad of the scoring pad, in the lower half of the screen: a labelled Undo bar that shows the ball it will take
// back, then 0-6, Wicket, Wide, No ball, Run out and More as big keys with a word under the number.
// The keys only call the functions the pad hands in (the same calls the old buttons made); this file makes no events itself.
import "./pp.css";
import { IcUndo } from "@/components/PpIcons";

export type KeypadProps = {
  /** All keys that score a ball are off (no scorer lock, paused, a batter or bowler is needed...). */
  blocked: boolean;
  /** Undo is off for its own reason (nothing to undo, or this phone is not the scorer). */
  undoOff: boolean;
  /** What the next Undo takes back, as a sentence ("Four runs · Hamza Khan off Bilal Ahmed"), or the reason it is off. */
  undoNote: string;
  armed: null | "wide" | "noball";
  freeHit: boolean;
  onRun: (n: number) => void;
  onUndo: () => void;
  onArm: (k: "wide" | "noball") => void;
  onOut: (preset: "run_out" | undefined) => void;
  onMore: () => void;
};

const CAPS = ["DOT", "RUN", "RUNS", "RUNS", "FOUR", "RUNS", "SIX"];

export default function PadKeypad(p: KeypadProps) {
  return (
    <div className="pp-keys" role="group" aria-label="Scoring pad">
      {[0, 1, 2, 3].map((n) => <button key={n} type="button" className="pp-key" data-cap={CAPS[n]} disabled={p.blocked} onClick={() => p.onRun(n)}>{n}</button>)}
      {[4, 5, 6].map((n) => <button key={n} type="button" className={`pp-key k${n}`} data-cap={CAPS[n]} disabled={p.blocked} onClick={() => p.onRun(n)}>{n}</button>)}
      <div className="pp-undo-bar">
        <button type="button" className="pp-undo" disabled={p.undoOff} aria-describedby="pp-undo-note" onClick={p.onUndo}><IcUndo size={20} />UNDO</button>
        <span className="pp-undo-note" id="pp-undo-note">{p.undoNote}</span>
      </div>
      <button type="button" className={`pp-key x wd${p.armed === "wide" ? " armed" : ""}`} disabled={p.blocked} aria-pressed={p.armed === "wide"} onClick={() => p.onArm("wide")}>WIDE</button>
      <button type="button" className={`pp-key x nb${p.armed === "noball" ? " armed" : ""}`} disabled={p.blocked} aria-pressed={p.armed === "noball"} onClick={() => p.onArm("noball")}>NO BALL</button>
      <button type="button" className={`pp-key w wk${p.freeHit ? " off" : ""}`} data-cap={p.freeHit ? "RUN OUT ONLY" : undefined} aria-describedby={p.freeHit ? "pp-fh-note" : undefined} disabled={p.blocked || !!p.armed} onClick={() => p.onOut(undefined)}>WICKET</button>
      <button type="button" className={`pp-key w ro${p.freeHit ? " allowed" : ""}`} data-cap={p.freeHit ? "ALLOWED" : undefined} disabled={p.blocked || !!p.armed} onClick={() => p.onOut("run_out")}>RUN OUT</button>
      <button type="button" className="pp-key more" onClick={p.onMore}>More <span aria-hidden="true">↑</span></button>
    </div>
  );
}
