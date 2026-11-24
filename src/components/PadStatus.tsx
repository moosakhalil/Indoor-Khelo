// Phase E1: the sync line and the notices at the top of the scoring pad (saved / waiting / offline / signed out, balls the server
// refused, storage warnings, and the scoring-lock notices). They sit ABOVE the board, inside the scrolling area, so a notice
// never pushes the keypad down in the middle of an over. Every button only calls a function the pad hands in.
import "./pp.css";
import Link from "next/link";
import { IcAlert, IcCheck, IcClock, IcLock, IcOffline, IcPhone, IcRefresh } from "@/components/PpIcons";
import { statusWording } from "@/components/padInfo";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function PadStatusBar(p: { signin: boolean; online: boolean; syncing: boolean; waiting: number; failed: boolean; scorerName: string; onSend: () => void }) {
  const w = statusWording(p);
  const Icon = w.tone === "red" ? IcAlert : w.tone === "blue" ? IcOffline : w.tone === "orange" ? (p.syncing ? IcRefresh : IcClock) : IcCheck;
  return (
    <div className={`pp-status ${w.tone}`}>
      <span className="pp-st-ico" aria-hidden="true"><Icon size={16} /></span>
      <span className="pp-st-text" role="status" aria-live="polite">
        <span className="pp-st-main">{w.text}</span>
        <span className="pp-st-by"> · {p.scorerName} scoring</span>
      </span>
      {(!p.online || p.waiting > 0) && <span className="pp-pill">Saved on this phone</span>}
      {p.waiting > 0 && p.online && !p.syncing && <button type="button" className="pp-send" onClick={p.onSend}>Send now</button>}
    </div>
  );
}

export type NoticeProps = {
  saveFailed: boolean;
  storageLow: boolean;
  /** The browser has not promised to keep the data, and balls are waiting while offline. */
  notPromised: boolean;
  signin: boolean;
  heldCount: number;
  lockLost: boolean;
  requester: string | null;
  waiting: number;
  otherDevice: boolean;
  onFix: () => void;
  onSee: () => void;
  onHandOver: () => void;
  onNotNow: () => void;
  onMove: () => void;
};

export function PadNotices(p: NoticeProps) {
  const first = p.requester ? p.requester.split(" ")[0] : "";
  return (
    <>
      {p.saveFailed && (
        <div className="pp-note bad" role="alert"><span className="pp-note-ico"><IcAlert /></span>
          <div><b>Not kept on this phone.</b> This phone could not keep the last ball in its own storage. Keep this screen open until the balls are sent, and get a signal soon.</div></div>
      )}
      {p.storageLow && (
        <div className="pp-note bad" role="alert"><span className="pp-note-ico"><IcAlert /></span>
          <div><b>Phone storage is almost full.</b> Unsent balls could be lost. Free some space or get a signal soon.</div></div>
      )}
      {p.notPromised && (
        <div className="pp-note info"><span className="pp-note-ico"><IcOffline /></span>
          <div><b>Saved on this phone.</b> Balls are saved on this phone, but the browser has not promised to keep them. Reconnect when you can.</div></div>
      )}
      {p.signin && (
        <div className="pp-note bad"><span className="pp-note-ico"><IcAlert /></span>
          <div><b>Signed out.</b> Your sign-in ran out. Your balls are safe on this phone. Sign in again and they will be sent.
            <div className="pp-note-act"><Link href="/" className="btn gold small">Sign in again</Link></div></div></div>
      )}
      {p.heldCount > 0 && !p.lockLost && (
        <div className="pp-note bad" role="alert"><span className="pp-note-ico"><IcAlert /></span>
          <div><span>{p.heldCount} ball{p.heldCount === 1 ? " was" : "s were"} not accepted by the server.</span> Your balls are still on this phone.
            <div className="pp-note-act"><button type="button" className="btn red small" onClick={p.onFix}>{`Fix ${plural(p.heldCount, "ball", "balls")}`}</button></div></div></div>
      )}
      {p.lockLost && (
        <div className="pp-note bad" role="alert"><span className="pp-note-ico"><IcLock /></span>
          <div><b>You are no longer the scorer.</b> Someone else took over, so new balls cannot be added here. {p.heldCount ? `${p.heldCount} ball(s) on this phone were not saved.` : ""}
            <div className="pp-note-act">
              <button type="button" className="btn gold small" onClick={p.onSee}>See the live score</button>
              {p.heldCount > 0 && <button type="button" className="btn red small" onClick={p.onFix}>Review unsent balls</button>}
            </div></div></div>
      )}
      {p.requester && !p.lockLost && (
        <div className="pp-note gold" role="alert"><span className="pp-note-ico"><IcLock /></span>
          <div><p className="pp-note-line"><b>{p.requester}</b> would like to take over scoring.</p>
            {p.waiting > 0 && <p className="pp-note-line">{p.waiting} ball{p.waiting === 1 ? " is" : "s are"} still waiting to sync. Get a signal before handing over. They are saved only on this phone.</p>}
            <div className="pp-note-act">
              <button type="button" className="btn gold small" disabled={p.waiting > 0} onClick={p.onHandOver}>Hand over to {first}</button>
              <button type="button" className="btn ghost small" onClick={p.onNotNow}>Not now</button>
            </div></div></div>
      )}
      {p.otherDevice && (
        <div className="pp-note gold" role="alert"><span className="pp-note-ico"><IcPhone /></span>
          <div><b>Scoring is open on another phone.</b> You are scoring this match on another phone. Only one device can score at a time.
            <div className="pp-note-act"><button type="button" className="btn gold small" onClick={p.onMove}>Move scoring to this phone</button></div></div></div>
      )}
    </>
  );
}
