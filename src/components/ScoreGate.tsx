"use client";
// Phase 5: who is scoring. One member at a time: take it if free, ask if someone else has it, or (Admin) take over.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { lockAction, type LockAction } from "@/app/actions5";
import { deviceId } from "@/lib/outbox";

const TEXT: Record<string, string> = {
  held: "Someone else is scoring now.", forbidden: "Only members of this community can score.", bad_state: "That cannot be done right now.",
  busy: "Someone else has already asked to take over. Please wait a moment.", not_found: "That match could not be found.", not_holder: "You are not the scorer.",
  no_request: "There is no request to answer.", not_admin: "Only an Admin can take over this way.",
};

export default function ScoreGate({ communityId, matchId, me, isAdmin, scorerId, scorerName, takeoverBy, takeoverName, canScore, reason, started }: {
  communityId: string; matchId: string; me: string; isAdmin: boolean; scorerId: string | null; scorerName: string | null;
  takeoverBy: string | null; takeoverName: string | null; canScore: boolean; reason: string | null; started: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const run = (a: LockAction) => start(async () => {
    const out = await lockAction(communityId, matchId, a, deviceId());
    setNote(out === "ok" ? null : TEXT[out] ?? "That did not work.");
    router.refresh();
  });
  // a request that was accepted turns this page into the scoring pad on the next refresh
  useEffect(() => { setNote(null); }, [scorerId]);

  if (!canScore) return <div className="banner mute">{reason}</div>;
  return (
    <section className="card">
      {!scorerId && (
        <>
          <b>Nobody is scoring this match</b>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>Any member can score. Only one person scores at a time, and everyone else watches live.</p>
          <button className="btn gold" disabled={pending} onClick={() => run("take")}>{started ? "Take over scoring" : "Start scoring"}</button>
        </>
      )}
      {scorerId && scorerId !== me && (
        <>
          <b>{scorerName ?? "Another member"} is scoring</b>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>You are watching the live score. Ask to take over, and they can hand it to you.</p>
          {takeoverBy && takeoverBy === me ? (
            <div className="stack">
              <div className="banner mute">Waiting for {scorerName ?? "the scorer"} to hand over…</div>
              <button className="btn ghost" disabled={pending} onClick={() => run("cancel")}>Cancel my request</button>
            </div>
          ) : (
            <button className="btn ghost" disabled={pending || (!!takeoverBy && takeoverBy !== me)} onClick={() => run("request")}>
              {takeoverBy && takeoverBy !== me ? `${takeoverName} has already asked` : "Ask to take over scoring"}
            </button>
          )}
          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <button className="btn red small" disabled={pending} onClick={() => run("admin")}>Take over as Admin</button>
              <p className="muted small" style={{ margin: "6px 0 0" }}>Use this if the scorer cannot hand over (for example their phone has died). Their unsent balls will not be saved.</p>
            </div>
          )}
        </>
      )}
      {note && <p className="err" role="alert">{note}</p>}
    </section>
  );
}
