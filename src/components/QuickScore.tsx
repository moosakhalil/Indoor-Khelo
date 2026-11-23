"use client";
// Scoring a match that was set up with no signal. Everything is read from this phone (IndexedDB), so it opens with no server at all.
// The match is created on the server, and the balls are sent, when the signal returns (see src/lib/outbox.ts).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ScoringPad from "@/components/ScoringPad";
import type { PlayerEntry } from "@/lib/engine/types";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { deviceId, readNewMatch, readOutbox, readRoster, type NewMatchItem } from "@/lib/outbox";
import type { Roster } from "@/lib/quickMatchRules";

type Phase = { kind: "loading" } | { kind: "missing" } | { kind: "on_server" } | { kind: "ready" };

export default function QuickScore({ communityId }: { communityId: string }) {
  const m = useSearchParams().get("m") ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [item, setItem] = useState<NewMatchItem | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const it = m ? await readNewMatch(m) : null;
      if (!alive) return;
      if (!it || it.communityId !== communityId) { setPhase({ kind: "missing" }); return; }
      setRoster(await readRoster(communityId));
      const waiting = (await readOutbox(m)).filter((i) => i.status === "pending").length;
      setItem(it);
      // already on the server and nothing waiting: the normal scoring page takes over
      setPhase(it.status === "synced" && waiting === 0 ? { kind: "on_server" } : { kind: "ready" });
    })();
    return () => { alive = false; };
  }, [m, communityId]);

  // keep the banner honest while scoring: has the match reached the server yet?
  useEffect(() => {
    if (phase.kind !== "ready" || !m) return;
    const t = setInterval(() => { void readNewMatch(m).then((it) => { if (it) setItem(it); }); }, 3000);
    return () => clearInterval(t);
  }, [phase.kind, m]);

  if (phase.kind === "loading") return <main className="app"><p className="muted center" style={{ marginTop: 40 }}>Opening the match…</p></main>;
  if (phase.kind === "missing" || !item) {
    return (
      <main className="app">
        <div className="stack" style={{ marginTop: 24 }}>
          <div className="banner red" role="alert">This match is not saved on this phone.</div>
          <Link href={`/c/${communityId}/matches/quick`} className="btn gold">Set up a new match with no signal</Link>
          <Link href={`/c/${communityId}/matches`} className="btn ghost">Back to matches</Link>
        </div>
      </main>
    );
  }
  if (phase.kind === "on_server") {
    return (
      <main className="app">
        <div className="stack" style={{ marginTop: 24 }}>
          <div className="banner green" role="status">This match is on the server now.</div>
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
  return (
    <>
      {item.status !== "synced" && (
        <div className={`banner ${item.status === "refused" ? "red" : "mute"}`} role="status" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 70, borderRadius: 0, textAlign: "center", fontSize: "0.8rem", padding: "4px 10px" }}>
          {item.status === "refused" ? `The server did not accept this match: ${item.reason ?? ""} Your balls are safe on this phone.` : "This match is saved on this phone and is not on the server yet. It will be created when you are online."}
        </div>
      )}
      <ScoringPad
        communityId={communityId} matchId={item.id} matchHref={`/c/${communityId}/matches`} serverEvents={[]}
        start={{ base: { sides: [item.match.sides[0].name, item.match.sides[1].name], overs: item.match.overs, playersPerSide: item.match.playersPerSide, rules: DEFAULT_RULES, players }, toss: null, battingFirst: null }}
        lateMembers={lateMembers} scorerDevice={deviceId()} scorerName="You"
      />
    </>
  );
}
