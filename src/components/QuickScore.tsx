"use client";
// Scoring a match that was set up with no signal. Everything is read from this phone (IndexedDB), so it opens with no server at all.
// The match is created on the server, and the balls are sent, when the signal returns (see src/lib/outbox.ts).
// UI redesign (Phase C4): only the states around the scoring pad are new (loading, missing, on the server, sync banner). The pad is untouched.
import "./qm.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconCheck, IconSignalOff, IconWarn } from "@/components/B4Icons";
import ScoringPad from "@/components/ScoringPad";
import type { PlayerEntry } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { deviceId, readNewMatch, readOutbox, readRoster, type NewMatchItem } from "@/lib/outbox";
import type { Roster } from "@/lib/quickMatchRules";

type Phase = { kind: "loading" } | { kind: "missing" } | { kind: "on_server" } | { kind: "ready" };

/** Shown while the match is read from this phone (also the page's own loading state). */
export function QuickScoreLoading() {
  return (
    <main className="qm-center" aria-busy="true">
      <div className="qm-cardc" role="status">
        <span className="logo-mark big" aria-hidden="true">IK</span>
        <b className="qm-cardc-h">Opening the match…</b>
        <div className="qm-skel" aria-hidden="true"><i /><i /></div>
        <span className="qm-pill"><span className="qm-dot" aria-hidden="true" />Reading from this phone</span>
      </div>
    </main>
  );
}

export default function QuickScore({ communityId }: { communityId: string }) {
  const m = useSearchParams().get("m") ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [item, setItem] = useState<NewMatchItem | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const it = m ? await readNewMatch(m) : null;
      if (!alive) return;
      if (!it || it.communityId !== communityId) { setPhase({ kind: "missing" }); return; }
      setRoster(await readRoster(communityId));
      const waitingNow = (await readOutbox(m)).filter((i) => i.status === "pending").length;
      setItem(it);
      setWaiting(waitingNow);
      // already on the server and nothing waiting: the normal scoring page takes over
      setPhase(it.status === "synced" && waitingNow === 0 ? { kind: "on_server" } : { kind: "ready" });
    })();
    return () => { alive = false; };
  }, [m, communityId]);

  // keep the banner honest while scoring: has the match reached the server yet, and how many balls are still waiting?
  useEffect(() => {
    if (phase.kind !== "ready" || !m) return;
    const t = setInterval(() => {
      void readNewMatch(m).then((it) => { if (it) setItem(it); });
      void readOutbox(m).then((all) => setWaiting(all.filter((i) => i.status === "pending").length));
    }, 3000);
    return () => clearInterval(t);
  }, [phase.kind, m]);

  if (phase.kind === "loading") return <QuickScoreLoading />;
  if (phase.kind === "missing" || !item) {
    return (
      <main className="qm-center">
        <div className="qm-cardc" role="alert">
          <span className="qm-cardc-ico warn" aria-hidden="true"><IconWarn size={26} /></span>
          <b className="qm-cardc-h">This match is not saved on this phone</b>
          <p className="muted small">It was probably started on another phone, or this phone&rsquo;s storage was cleared. If it was synced, it is in Matches.</p>
          <Link href={`/c/${communityId}/matches/quick`} className="btn gold">Set up a new match with no signal</Link>
          <Link href={`/c/${communityId}/matches`} className="btn ghost">Back to matches</Link>
        </div>
      </main>
    );
  }
  if (phase.kind === "on_server") {
    return (
      <main className="qm-center">
        <div className="qm-cardc" role="status">
          <span className="qm-cardc-ico ok" aria-hidden="true"><IconCheck size={26} /></span>
          <b className="qm-cardc-h">This match is on the server now</b>
          <p className="muted small">All balls have been sent. Anyone in the community can follow it live.</p>
          <Link href={`/c/${communityId}/matches/${item.id}/score`} className="btn gold">Open the match</Link>
        </div>
      </main>
    );
  }

  const players: PlayerEntry[] = item.match.players.map((p) => ({
    id: p.id, side: p.side, name: item.names[p.id]?.name ?? "Player", number: item.names[p.id]?.number ?? null, kind: p.userId ? "member" : "guest", userId: p.userId,
  }));
  const inMatch = new Set(item.match.players.map((p) => p.userId).filter(Boolean));
  const lateMembers = (roster?.members ?? []).filter((x) => !inMatch.has(x.id)).map((x) => ({ userId: x.id, name: x.name, number: x.number }));
  const refused = item.status === "refused";
  const synced = item.status === "synced";
  const waitingText = waiting > 0 ? `${waiting} ball${waiting === 1 ? "" : "s"} saved on this phone, waiting to send.` : null;
  return (
    <div className="qm-score">
      <div className="qm-scorebar">
        <span className="qm-scorebar-t"><IconSignalOff size={16} />No-signal match</span>
        <span className={`qm-pill ${refused ? "bad" : synced ? "ok" : "phone"}`}><span className="qm-dot" aria-hidden="true" />{refused ? "Not accepted" : synced ? "On the server" : "Saved on phone"}</span>
      </div>
      {!synced && !refused && (
        <div className="qm-note" role="status">
          <span className="qm-note-ico"><IconSignalOff size={20} /></span>
          <div>
            <b>Saved on this phone, not on the server yet</b>
            <p>The match and every ball you score are kept here and will be sent when you are back online.</p>
            {waitingText && <p className="qm-wait">{waitingText}</p>}
          </div>
        </div>
      )}
      {refused && (
        <div className="qm-alert" role="alert">
          <span className="qm-note-ico"><IconWarn size={20} /></span>
          <div>
            <p className="qm-alert-h">{`The server did not accept this match${item.reason ? `: ${item.reason}` : "."}`}</p>
            <p>Your balls are safe on this phone.</p>
            {waitingText && <p className="qm-wait">{waitingText}</p>}
            <button type="button" className="qm-help" aria-expanded={help} onClick={() => setHelp((v) => !v)}>What can I do?</button>
            {help && (
              <div className="qm-helpbox">
                <p>You can keep scoring. Every ball stays on this phone and nothing is lost or sent to a match the server does not have.</p>
                <p>The match cannot be created until the reason above is fixed, for example when a player has left the community. Ask an Admin to look at it, or set up a new match with the right players.</p>
                <div className="qm-helpbtns">
                  <Link href={`/c/${communityId}/matches/quick`} className="btn ghost small">Set up a new match with no signal</Link>
                  <Link href={`/c/${communityId}/matches`} className="btn ghost small">Back to matches</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {synced && waitingText && (
        <div className="qm-note ok" role="status">
          <span className="qm-note-ico"><IconCheck size={20} /></span>
          <div><b>This match is on the server</b><p className="qm-wait">{waitingText}</p></div>
        </div>
      )}
      <ScoringPad
        communityId={communityId} matchId={item.id} matchHref={`/c/${communityId}/matches`} serverEvents={[]}
        start={{ base: { sides: [item.match.sides[0].name, item.match.sides[1].name], overs: item.match.overs, playersPerSide: item.match.playersPerSide, rules: DEFAULT_RULES, players }, toss: null, battingFirst: null }}
        lateMembers={lateMembers} scorerDevice={deviceId()} scorerName="You"
      />
    </div>
  );
}
