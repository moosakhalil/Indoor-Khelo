"use client";
// Phase 5: who is scoring. One member at a time: take it if free, ask if someone else has it, or (Admin) take over.
// Phase D2 (UI redesign): same actions, same permissions, same server action (lockAction). New: states drawn as clear blocks, errors as a
// banner with an icon, "waiting" says what happens next, "already asked" says why, the reason a match cannot be scored sits in one block
// with "Pick lineups", and the Admin take-over asks first and names the consequence.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { lockAction, type LockAction } from "@/app/actions5";
import ConfirmDialog from "@/components/ConfirmDialog";
import { IconClock, IconPencil, IconShield, IconSwap, IconUsers, IconWarn } from "@/components/LvIcons";
import Shirt from "@/components/Shirt";
import { deviceId } from "@/lib/outbox";
import "./lv.css";

const TEXT: Record<string, string> = {
  held: "Someone else is scoring now.", forbidden: "Only members of this community can score.", bad_state: "That cannot be done right now.",
  busy: "Someone else has already asked to take over. Please wait a moment.", not_found: "That match could not be found.", not_holder: "You are not the scorer.",
  no_request: "There is no request to answer.", not_admin: "Only an Admin can take over this way.",
};

export default function ScoreGate({ communityId, matchId, me, isAdmin, scorerId, scorerName, takeoverBy, takeoverName, canScore, reason, started, scorerNumber, lineupsHref }: {
  communityId: string; matchId: string; me: string; isAdmin: boolean; scorerId: string | null; scorerName: string | null;
  takeoverBy: string | null; takeoverName: string | null; canScore: boolean; reason: string | null; started: boolean;
  /** The scorer's player number, for their shirt. Optional: a grey shirt shows when it is not given. */
  scorerNumber?: number | null;
  /** When the reason is "each side needs 2 players", where to pick the lineups. The button sits inside the same block as the reason. */
  lineupsHref?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [askAdmin, setAskAdmin] = useState(false);
  const run = (a: LockAction) => start(async () => {
    const out = await lockAction(communityId, matchId, a, deviceId());
    setNote(out === "ok" ? null : TEXT[out] ?? "That did not work.");
    router.refresh();
  });
  // a request that was accepted turns this page into the scoring pad on the next refresh
  useEffect(() => { setNote(null); }, [scorerId]);

  if (!canScore) {
    return (
      <section className="lv-reason" aria-label="Scoring">
        <div className="lv-warn" role="status"><IconWarn size={20} /><span>{reason}</span></div>
        {lineupsHref && <Link href={lineupsHref} className="btn gold lv-btn"><IconUsers size={18} />Pick lineups</Link>}
      </section>
    );
  }
  const other = scorerName ?? "Another member";
  const mine = !!takeoverBy && takeoverBy === me;
  const taken = !!takeoverBy && takeoverBy !== me;
  return (
    <section className="card lv-gate" aria-label="Who is scoring">
      {!scorerId && (
        <>
          <div className="lv-who2">
            <span className="lv-q" aria-hidden="true">?</span>
            <div className="lv-wt">
              <b>Nobody is scoring this match</b>
              <p>Any member can score. Only one person scores at a time, and everyone else watches live.</p>
            </div>
          </div>
          <button className="btn gold lv-btn wide" disabled={pending} onClick={() => run("take")}>
            {started ? <IconSwap size={18} /> : <IconPencil size={18} />}{started ? "Take over scoring" : "Start scoring"}
          </button>
        </>
      )}
      {scorerId && scorerId !== me && (
        <>
          <div className="lv-who2">
            <Shirt number={scorerNumber ?? null} size="small" label={`${other}${scorerNumber != null ? `, number ${scorerNumber}` : ""}`} />
            <div className="lv-wt">
              <b>{other} is scoring</b>
              <p>You are watching the live score. Ask to take over, and they can hand it to you.</p>
            </div>
            <span className="lv-livechip"><span className="lv-dot" aria-hidden="true" />Live</span>
          </div>
          {mine ? (
            <>
              <div className="lv-wait" role="status">
                <IconClock size={18} />
                <span><b>Waiting for {other} to hand over…</b>You will be taken to the pad as soon as they accept.</span>
              </div>
              <button className="btn ghost lv-btn wide" disabled={pending} onClick={() => run("cancel")}>Cancel my request</button>
            </>
          ) : (
            <>
              <button className={`btn ${taken ? "ghost" : "gold"} lv-btn wide`} disabled={pending || taken} aria-describedby={taken ? "lv-one-at-a-time" : undefined} onClick={() => run("request")}>
                {!taken && <IconSwap size={18} />}{taken ? `${takeoverName ?? "Someone"} has already asked` : "Ask to take over scoring"}
              </button>
              {taken && <p id="lv-one-at-a-time" className="lv-hint">Only one request at a time. Try again in a moment.</p>}
            </>
          )}
          {isAdmin && (
            <div className="lv-admin">
              <h3>Admin</h3>
              <p>Use this if the scorer cannot hand over (for example their phone has died). Their unsent balls will not be saved.</p>
              <button className="btn red lv-btn" disabled={pending} onClick={() => setAskAdmin(true)}><IconShield size={18} />Take over as Admin</button>
            </div>
          )}
        </>
      )}
      {note && <div className="lv-err" role="alert"><IconWarn size={18} /><span>{note}</span></div>}
      <ConfirmDialog
        open={askAdmin}
        title="Take over scoring now?"
        body={(
          <>
            <p style={{ margin: "0 0 10px" }}>{other} is scoring. If you take over, balls they have not sent yet (for example from a phone that died) will not be saved.</p>
            <div className="lv-dlg-note"><IconWarn size={18} /><span>Use this only if they cannot hand over.</span></div>
          </>
        )}
        confirmLabel="Take over as Admin"
        cancelLabel="Keep watching"
        danger
        onConfirm={() => { setAskAdmin(false); run("admin"); }}
        onClose={() => setAskAdmin(false)}
      />
    </section>
  );
}
