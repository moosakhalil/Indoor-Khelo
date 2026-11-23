"use client";
// Phase 5: the scoring pad. It works from the saved events on the phone, so it keeps working with no signal:
// every tap is checked by the engine, saved on the phone first, then sent to the server in order.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lockAction, lockStatus } from "@/app/actions5";
import CoinToss from "@/components/CoinToss";
import { LiveScore } from "@/components/Live";
import {
  BatterSheet, BowlerSheet, ByeSheet, CreaseSheet, EditSheet, EndInningsSheet, EndMatchSheet, GuideSheet, LateSheet, LimitSheet, OrderSheet,
  OutSheet, OversSheet, PenaltySheet, PlayersSheet, RetireSheet, ScorecardSheet, Sheet, SubSheet, TargetSheet, Chip, type Add,
} from "@/components/PadSheets";
import { battingSideFor, buildState, currentInnings, describeBall, effectiveEvents, activeInnings } from "@/lib/engine/engine";
import type { MatchState, PlayerEntry, ScoreEvent, ScoreEventBody, Side, StartPayload } from "@/lib/engine/types";
import { deviceId, flushMatch, protectStorage, putOutbox, readMatchCache, readOutbox, removeOutbox, saveMatchCache, type OutboxItem } from "@/lib/outbox";

export type PadProps = {
  communityId: string;
  matchId: string;
  matchHref: string;
  serverEvents: ScoreEvent[];
  start: { base: Omit<StartPayload, "battingFirst" | "toss">; toss: StartPayload["toss"]; battingFirst: Side | null };
  lateMembers: { userId: string; name: string; number: number | null }[];
  scorerDevice: string | null;
  scorerName: string;
};

type Sheet_ = null | "out" | "more" | "bye" | "penalty" | "retire" | "bowler" | "changebowler" | "batter" | "late" | "overs" | "players" | "limit" | "crease" | "order" | "sub" | "edit" | "endinnings" | "endmatch" | "target" | "guide" | "scorecard" | "trouble" | "release";

const lastSeq = (list: ScoreEvent[]) => (list.length ? list[list.length - 1]!.seq : 0);
const WORDS: Record<string, string> = {
  ball: "the last ball", batter_in: "choosing the batter", bowler: "choosing the bowler", swap_strike: "the strike swap", set_crease: "the batter correction", batting_order: "the batting order",
  player_added: "adding the player", retire: "the retirement", substitute: "the substitute", overs_change: "the overs change", players_change: "the players change", limit_change: "the limit change",
  penalty: "the penalty runs", target_manual: "the revised target", innings_end: "ending the innings", super_over_decision: "the super over answer", innings_start: "starting the innings",
  pause: "the pause", resume: "the resume", edit: "the edit",
};

export default function ScoringPad(props: PadProps) {
  const { communityId, matchId, serverEvents, start } = props;
  const router = useRouter();
  const [confirmed, setConfirmed] = useState<ScoreEvent[]>(serverEvents);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [signin, setSignin] = useState(false);
  const [lockLost, setLockLost] = useState(false);
  const [otherDevice, setOtherDevice] = useState(props.scorerDevice !== null && typeof window !== "undefined" && props.scorerDevice !== deviceId());
  const [saveFailed, setSaveFailed] = useState(false);
  const [requester, setRequester] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ persisted: boolean; low: boolean } | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "mute" | "warn"; text: string; long?: boolean } | null>(null);
  const [armed, setArmed] = useState<null | "wide" | "noball">(null);
  const [outPreset, setOutPreset] = useState<"run_out" | undefined>(undefined);
  const [editBall, setEditBall] = useState<string | undefined>(undefined);
  const [sheet, setSheet] = useState<Sheet_>(null);
  const [hiddenAt, setHiddenAt] = useState(-1);
  const [flash, setFlash] = useState<"six" | "wicket" | null>(null);
  // The record lives in this ref and is changed only through commit(), never from a stale screen value, so two things
  // happening at once (a tap and a send finishing) cannot undo each other. The state below only drives drawing.
  const store = useRef<{ confirmed: ScoreEvent[]; pending: OutboxItem[] }>({ confirmed: serverEvents, pending: [] });
  const commit = useCallback((confirmedNext: ScoreEvent[], pendingNext: OutboxItem[]) => {
    store.current = { confirmed: confirmedNext, pending: pendingNext };
    setConfirmed(confirmedNext);
    setPending(pendingNext);
  }, []);

  const events = useMemo(() => [...confirmed, ...pending.map((p) => p.event)], [confirmed, pending]);

  const built = useMemo(() => buildState(events), [events]);
  const fallback = useMemo(() => (built.ok ? null : buildState(confirmed)), [built, confirmed]);
  const m: MatchState | null = built.ok ? built.state : fallback && fallback.ok ? fallback.state : null;
  const inn = m ? currentInnings(m) : null;
  const live = m ? activeInnings(m) : null;

  /* ----- sending ----- */
  const busy = useRef(false);
  const again = useRef(false);
  const flush = useCallback(async (): Promise<void> => {
    if (!store.current.pending.some((p) => p.status === "pending")) return;
    // one send at a time; a request that arrives meanwhile (new ball, signal back) is run straight after, never lost
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    setSyncing(true);
    try {
      const r = await flushMatch(communityId, matchId);
      if (r.kind === "busy") { setTimeout(() => void flush(), 400); return; }
      if (r.kind === "offline") { setOnline(false); return; }
      setOnline(true);
      if (r.kind === "signin") { setSignin(true); return; }
      if (r.kind === "error") { setMsg({ tone: "mute", text: r.message }); return; }
      if (r.kind === "done") {
        setSignin(false);
        const gone = new Set([...r.accepted, ...r.duplicates]);
        const held = new Map(r.held.map((h) => [h.id, h]));
        const cur = store.current;
        commit(
          [...cur.confirmed, ...r.saved.filter((e) => !cur.confirmed.some((x) => x.id === e.id))],
          cur.pending.filter((p) => !gone.has(p.id)).map((p) => (held.has(p.id) ? { ...p, status: held.get(p.id)!.status, reason: held.get(p.id)!.reason } : p)),
        );
        if (r.lockLost) setLockLost(true);
        else if (r.held.length) { setSheet("trouble"); }
      }
    } finally {
      busy.current = false;
      setSyncing(false);
      if (again.current) { again.current = false; void flush(); }
    }
  }, [commit, communityId, matchId]);

  // first load: what is waiting on this phone, and keep what the server already has
  useEffect(() => {
    let alive = true;
    (async () => {
      // If this phone saved a longer record than the page it was given (a page kept from before the signal went), use the longer one.
      const cache = await readMatchCache(matchId);
      let base = serverEvents;
      if (cache && lastSeq(cache.events) > lastSeq(serverEvents) && serverEvents.every((e, i) => cache.events[i]?.id === e.id)) base = cache.events;
      const items = await readOutbox(matchId);
      const serverIds = new Set(base.map((e) => e.id));
      const top = lastSeq(base);
      const stale = items.filter((i) => serverIds.has(i.id));
      await removeOutbox(stale.map((i) => i.id));
      const rest = items.filter((i) => !serverIds.has(i.id)).map((i): OutboxItem => (i.seq <= top ? { ...i, status: "rejected", reason: "The match moved on while this phone was away, so this ball no longer fits." } : i));
      if (!alive) return;
      commit(base, [...rest, ...store.current.pending.filter((p) => !rest.some((r) => r.id === p.id) && !serverIds.has(p.id))]);
      setReady(true);
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
      void protectStorage().then((s) => alive && setStorage(s));
      if (props.scorerDevice === null) void lockAction(communityId, matchId, "claim", deviceId()).catch(() => undefined);
      if (store.current.pending.some((i) => i.status === "pending")) void flush();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ready) void saveMatchCache(matchId, confirmed); }, [confirmed, ready, matchId]);

  useEffect(() => {
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(() => { if (store.current.pending.some((p) => p.status === "pending")) void flush(); }, 8000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(t); };
  }, [flush]);

  // does someone want to take over, and do I still hold the lock? (asked every few seconds while there is a signal)
  useEffect(() => {
    const t = setInterval(async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const s = await lockStatus(communityId, matchId);
        if (!s) return;
        setRequester(s.requester);
        if (s.scorerId !== s.me) setLockLost(true);
        else if (s.scorerDevice && s.scorerDevice !== deviceId()) setOtherDevice(true);
      } catch { /* offline: try again next time */ }
    }, 7000);
    return () => clearInterval(t);
  }, [communityId, matchId]);

  // messages slide up for about three seconds (five for an undo)
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.long ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [msg]);

  // first time on this phone: show the guide, once
  useEffect(() => {
    try { if (!localStorage.getItem("ik_guide_done")) setSheet("guide"); } catch { /* storage blocked */ }
  }, []);

  /* ----- adding events ----- */
  const addInternal = useCallback((bodies: ScoreEventBody[], opts: { reason?: string } | undefined, silent: boolean) => {
    const fail = (text: string) => { if (!silent) setMsg({ tone: "red", text }); return false; };
    if (lockLost) return fail("You are no longer the scorer, so nothing more can be added.");
    if (otherDevice) return fail("Scoring is on another device. Move it to this phone first.");
    let list = [...store.current.confirmed, ...store.current.pending.map((p) => p.event)];
    const made: ScoreEvent[] = [];
    let undoText = "";
    for (const body of bodies) {
      if (body.type === "undo") {
        const eff = effectiveEvents(list);
        const last = eff.ok ? eff.list[eff.list.length - 1] : undefined;
        if (last) {
          const rules = buildState(list);
          undoText = last.type === "ball" && rules.ok ? describeBall(last.payload, rules.state.rules).toLowerCase() : WORDS[last.type] ?? "that";
        }
      }
      const ev = { ...body, id: crypto.randomUUID(), seq: lastSeq(list) + 1, at: new Date().toISOString(), ...(opts?.reason ? { reason: opts.reason } : {}) } as ScoreEvent;
      const r = buildState([...list, ev]);
      if (!r.ok) return fail(r.error);
      list = [...list, ev];
      made.push(ev);
    }
    const items = made.map((ev): OutboxItem => ({ id: ev.id, communityId, matchId, seq: ev.seq, event: ev, status: "pending", reason: null }));
    commit(store.current.confirmed, [...store.current.pending, ...items]);
    void Promise.all(items.map((i) => putOutbox(i))).then((saved) => { if (saved.some((ok) => !ok)) setSaveFailed(true); return flush(); });
    const lastBody = bodies[bodies.length - 1]!;
    const after = buildState(list);
    if (lastBody.type === "ball" && after.ok) {
      const freeHitNext = lastBody.payload.extra === "noball" && after.state.rules.freeHit;
      setMsg({ tone: freeHitNext ? "warn" : "green", text: freeHitNext ? "No ball: the next ball is a Free Hit." : describeBall(lastBody.payload, after.state.rules) });
      if (lastBody.payload.wicket) { setFlash("wicket"); navigator.vibrate?.([30, 40, 30]); }
      else if ((lastBody.payload.runs ?? 0) === 6 && !lastBody.payload.extra) { setFlash("six"); navigator.vibrate?.(25); }
      else navigator.vibrate?.(12);
      setTimeout(() => setFlash(null), 600);
    } else if (lastBody.type === "undo") {
      setMsg({ tone: "mute", long: true, text: `Undone: ${undoText || "the last action"}` });
      navigator.vibrate?.(12);
    } else if (!silent) {
      setMsg({ tone: "green", text: "Saved." });
    }
    return true;
  }, [commit, communityId, flush, lockLost, matchId, otherDevice]);

  const add: Add = useCallback((bodies, opts) => {
    const ok = addInternal(bodies, opts, false);
    if (ok) for (const f of opts?.then ?? []) addInternal([f], undefined, true);
    return ok;
  }, [addInternal]);

  const newId = useCallback(() => crypto.randomUUID(), []);
  const close = useCallback(() => setSheet(null), []);

  if (!m) {
    return (
      <main className="app"><div className="banner red" role="alert">The saved balls on this phone could not be read: {built.ok ? "" : built.error}. Nothing has been lost on the server. Reload the page.</div></main>
    );
  }

  const waiting = pending.filter((p) => p.status === "pending").length;
  const held = pending.filter((p) => p.status !== "pending");
  const needBatter = !!live?.needBatter;
  const needBowler = !!live?.needBowler;
  const blocked = lockLost || otherDevice || m.paused || !live || needBatter || needBowler;
  const promptOpen = hiddenAt !== events.length;
  const eff = effectiveEvents(events);
  const lastEff = eff.ok ? eff.list[eff.list.length - 1] : undefined;
  const canUndo = !!lastEff && lastEff.type !== "match_start" && lastEff.type !== "finish" && lastEff.type !== "match_end" && m.phase !== "finished" && m.phase !== "abandoned";
  const common = { m, inn: inn as NonNullable<typeof inn>, add, close };
  const run = (n: number) => {
    if (armed) { if (add([{ type: "ball", payload: { extra: armed, runs: n } }])) setArmed(null); return; }
    add([{ type: "ball", payload: { runs: n } }]);
  };
  const toggleArm = (k: "wide" | "noball") => setArmed((a) => (a === k ? null : k));

  const statusText = signin
    ? "Signed out · balls are safe on this phone"
    : !online ? `Offline${waiting ? ` · ${waiting} ball${waiting === 1 ? "" : "s"} waiting to sync` : ""}`
    : syncing ? "Syncing…" : waiting ? `${waiting} waiting to sync` : "All saved";

  return (
    <main className={`pad-page${flash ? ` flash-${flash}` : ""}`}>
      <header className="pad-top">
        <Link href={props.matchHref} className="back" aria-label="Leave the scoring screen (it keeps its place)">‹</Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.started ? `${m.sides[0]} v ${m.sides[1]}` : `${start.base.sides[0]} v ${start.base.sides[1]}`}</b>
          <small className="muted" role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="live-dot" aria-hidden="true" style={{ background: !online || signin ? "var(--red)" : waiting ? "var(--gold)" : "var(--green)" }} />
            <span>{statusText} · {props.scorerName} scoring</span>
            {waiting > 0 && online && !syncing && <button className="chip" style={{ minHeight: 26, padding: "0 8px", fontSize: "0.72rem" }} onClick={() => void flush()}>Send now</button>}
          </small>
        </div>
        <button className="chip" disabled={!inn} onClick={() => { setEditBall(undefined); setSheet("edit"); }}>History</button>
        <button className="chip" onClick={() => setSheet("scorecard")}>Scorecard</button>
      </header>
      {saveFailed && <div className="banner red" role="alert" style={{ margin: "6px 0" }}>This phone could not keep the last ball in its own storage. Keep this screen open until the balls are sent, and get a signal soon.</div>}
      {storage?.low && <div className="banner red" role="alert" style={{ margin: "6px 0" }}>This phone is almost out of storage. Unsent balls could be lost. Free some space or get a signal soon.</div>}
      {storage && !storage.persisted && waiting > 0 && !online && <div className="banner mute" style={{ margin: "6px 0" }}>Balls are saved on this phone, but the browser has not promised to keep them. Reconnect when you can.</div>}
      {signin && <div className="banner mute" style={{ margin: "6px 0" }}>Your sign-in ran out. Your balls are safe on this phone. <Link href="/" style={{ textDecoration: "underline" }}>Sign in again</Link> and they will be sent.</div>}
      {held.length > 0 && !lockLost && <button className="banner red" style={{ margin: "6px 0", textAlign: "left" }} onClick={() => setSheet("trouble")}>{held.length} ball{held.length === 1 ? " was" : "s were"} not accepted by the server. Tap to fix.</button>}
      {lockLost && (
        <div className="banner red" role="alert" style={{ margin: "6px 0" }}>
          <b>You are no longer the scorer.</b> Someone else took over, so new balls cannot be added here. {held.length ? `${held.length} ball(s) on this phone were not saved.` : ""}
          <div className="row" style={{ marginTop: 8 }}><button className="chip" onClick={() => router.refresh()}>See the live score</button>{held.length > 0 && <button className="chip" onClick={() => setSheet("trouble")}>Review unsent balls</button>}</div>
        </div>
      )}
      {requester && !lockLost && (
        <div className="banner gold" role="alert" style={{ margin: "6px 0" }}>
          <b>{requester}</b> would like to take over scoring.
          {waiting > 0 ? <p style={{ margin: "6px 0 0" }}>{waiting} ball{waiting === 1 ? " is" : "s are"} still waiting to sync. Get a signal before handing over.</p> : (
            <div className="two" style={{ marginTop: 8 }}>
              <button className="btn small" onClick={async () => { await lockAction(communityId, matchId, "accept", deviceId()); setRequester(null); setLockLost(true); }}>Hand over</button>
              <button className="btn ghost small" onClick={async () => { await lockAction(communityId, matchId, "decline", deviceId()); setRequester(null); }}>Not now</button>
            </div>
          )}
        </div>
      )}
      {otherDevice && (
        <div className="banner gold" role="alert" style={{ margin: "6px 0" }}>
          You are scoring this match on another phone. Only one device can score at a time.
          <div style={{ marginTop: 8 }}><button className="btn small" onClick={async () => { await lockAction(communityId, matchId, "take", deviceId()); setOtherDevice(false); router.refresh(); }}>Move scoring to this phone</button></div>
        </div>
      )}

      <div className="pad-info">
        <LiveScore m={m} onBall={live ? (id) => { setEditBall(id); setSheet("edit"); } : undefined} />
      </div>

      <div className="pad-controls">
        {!m.started ? (
          <StartPanel mode="match" m={m} start={start} add={add} />
        ) : m.phase === "need_innings" ? (
          <StartPanel mode="innings" m={m} start={start} add={add} />
        ) : m.phase === "level_prompt" ? (
          <div className="stack">
            <div className="banner gold center"><b>The scores are level.</b> Play a super over?</div>
            <div className="two"><button className="btn gold" onClick={() => add([{ type: "super_over_decision", payload: { play: true } }])}>Yes, super over</button><button className="btn ghost" onClick={() => add([{ type: "super_over_decision", payload: { play: false } }])}>No, it is a tie</button></div>
            {canUndo && <button className="btn ghost small" onClick={() => add([{ type: "undo", payload: {} }])}>Undo the last ball</button>}
          </div>
        ) : m.phase === "result" ? (
          <div className="stack">
            <div className="banner green center"><b>{m.result?.text}</b></div>
            <button className="btn gold" onClick={() => add([{ type: "finish", payload: {} }])}>Finish the match</button>
            <p className="muted small center" style={{ margin: 0 }}>Finishing locks the scorecard. Player of the Match arrives with the match report.</p>
            {canUndo && <button className="btn ghost small" onClick={() => add([{ type: "undo", payload: {} }])}>Undo the last action</button>}
          </div>
        ) : m.phase === "finished" || m.phase === "abandoned" ? (
          <div className="stack">
            <div className="banner green center"><b>{m.result?.text ?? "Match finished"}</b></div>
            <Link href={props.matchHref} className="btn gold">Back to the match</Link>
          </div>
        ) : needBatter && live ? (
          <div className="stack">
            <button className="btn gold" onClick={() => { setHiddenAt(-1); setSheet("batter"); }}>Choose the next batter</button>
            {canUndo && <button className="btn ghost small" onClick={() => add([{ type: "undo", payload: {} }])}>Undo the last ball</button>}
          </div>
        ) : needBowler && live ? (
          <div className="stack">
            <button className="btn gold" onClick={() => { setHiddenAt(-1); setSheet("bowler"); }}>Choose the bowler for the next over</button>
            {canUndo && <button className="btn ghost small" onClick={() => add([{ type: "undo", payload: {} }])}>Undo the last ball</button>}
          </div>
        ) : (
          <>
            {m.paused && <button className="btn gold" style={{ marginBottom: 8 }} onClick={() => add([{ type: "resume", payload: {} }])}>Match paused. Resume</button>}
            {armed && (
              <div className="armed-bar" role="status">
                <span className="grow">{armed === "wide" ? "Wide: now tap the extra runs that were run" : "No Ball: now tap the runs off the bat"}</span>
                {armed === "wide" && <button className="chip" onClick={() => { if (add([{ type: "ball", payload: { extra: "wide", runs: 0 } }])) setArmed(null); }}>Just the wide</button>}
                <button className="chip" onClick={() => setArmed(null)}>Cancel</button>
              </div>
            )}
            <div className="pad-grid" aria-label="Scoring pad">
              {[0, 1, 2, 3].map((n) => <button key={n} className="pbtn" disabled={blocked} onClick={() => run(n)}>{n}</button>)}
              {[4, 5, 6].map((n) => <button key={n} className={`pbtn${n !== 5 ? " blue" : ""}`} disabled={blocked} onClick={() => run(n)}>{n}</button>)}
              <button className="pbtn undo" disabled={!canUndo || lockLost || otherDevice} onClick={() => { setArmed(null); add([{ type: "undo", payload: {} }]); }}>UNDO</button>
              <button className={`pbtn x${armed === "wide" ? " armed" : ""}`} disabled={blocked} aria-pressed={armed === "wide"} onClick={() => toggleArm("wide")}>WIDE</button>
              <button className={`pbtn x${armed === "noball" ? " armed" : ""}`} disabled={blocked} aria-pressed={armed === "noball"} onClick={() => toggleArm("noball")}>NO BALL</button>
              <button className="pbtn w" disabled={blocked || !!armed} onClick={() => { setOutPreset(undefined); setSheet("out"); }}>WICKET{live?.freeHit && <small>Run Out only</small>}</button>
              <button className="pbtn w" disabled={blocked || !!armed} onClick={() => { setOutPreset("run_out"); setSheet("out"); }}>RUN OUT</button>
              <button className="pbtn more" onClick={() => setSheet("more")}>More <span aria-hidden="true">↑</span></button>
            </div>
          </>
        )}
      </div>

      {/* prompts that appear by themselves */}
      {sheet === null && live && needBatter && promptOpen && <BatterSheet {...common} close={() => setHiddenAt(events.length)} />}
      {sheet === null && live && needBowler && !needBatter && promptOpen && <BowlerSheet {...common} title={`Pick bowler for over ${Math.floor(live.legalBalls / m.rules.ballsPerOver) + 1}`} close={() => setHiddenAt(events.length)} />}

      {sheet === "out" && live && <OutSheet {...common} preset={outPreset} />}
      {sheet === "bye" && live && <ByeSheet {...common} />}
      {sheet === "penalty" && live && <PenaltySheet {...common} />}
      {sheet === "retire" && live && <RetireSheet {...common} />}
      {sheet === "batter" && live && <BatterSheet {...common} />}
      {sheet === "bowler" && live && <BowlerSheet {...common} title={`Pick bowler for over ${Math.floor(live.legalBalls / m.rules.ballsPerOver) + 1}`} />}
      {sheet === "changebowler" && live && <BowlerSheet {...common} title="Change the bowler" />}
      {sheet === "late" && inn && <LateSheet {...common} members={props.lateMembers.filter((x) => !Object.values(m.players).some((p) => p.userId === x.userId))} newId={newId} />}
      {sheet === "overs" && live && <OversSheet {...common} />}
      {sheet === "players" && inn && <PlayersSheet {...common} />}
      {sheet === "limit" && inn && <LimitSheet {...common} />}
      {sheet === "crease" && live && <CreaseSheet {...common} />}
      {sheet === "order" && live && <OrderSheet {...common} />}
      {sheet === "sub" && inn && <SubSheet {...common} />}
      {sheet === "edit" && inn && <EditSheet {...common} initial={editBall} />}
      {sheet === "endinnings" && live && <EndInningsSheet {...common} />}
      {sheet === "endmatch" && inn && <EndMatchSheet {...common} />}
      {sheet === "target" && live && <TargetSheet {...common} />}
      {sheet === "scorecard" && <ScorecardSheet m={m} close={close} />}
      {sheet === "guide" && <GuideSheet close={() => { try { localStorage.setItem("ik_guide_done", "1"); } catch { /* ignore */ } close(); }} />}
      {sheet === "trouble" && (
        <Sheet title="Balls the server did not accept" onClose={close}>
          <p className="muted small" style={{ margin: "0 0 8px" }}>These balls are still safe on this phone. Nothing is thrown away until you choose to.</p>
          <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
            {held.map((h) => <li key={h.id}><b>{h.event.type === "ball" ? describeBall(h.event.payload, m.rules) : h.event.type.replace("_", " ")}</b><br /><small className="muted">{h.reason}</small></li>)}
          </ul>
          <div className="stack" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={() => { commit(store.current.confirmed, store.current.pending.map((p) => (p.status !== "pending" ? { ...p, status: "pending", reason: null } : p))); void Promise.all(held.map((h) => putOutbox({ ...h, status: "pending", reason: null }))).then(flush); close(); }}>Try sending them again</button>
            <button className="btn red" onClick={async () => {
              const from = Math.min(...held.map((h) => h.seq));
              const drop = store.current.pending.filter((p) => p.seq >= from);
              await removeOutbox(drop.map((p) => p.id));
              commit(store.current.confirmed, store.current.pending.filter((p) => p.seq < from));
              close();
              startTransition(() => router.refresh());
            }}>Discard these balls (and any after them)</button>
          </div>
        </Sheet>
      )}
      {sheet === "release" && (
        <Sheet title="Stop scoring?" onClose={close}>
          {waiting > 0 ? <p className="err">{waiting} ball{waiting === 1 ? " is" : "s are"} still waiting to sync. Get a signal first, so nothing is lost.</p> : <p style={{ margin: "0 0 12px" }}>Someone else can then take over scoring. The score so far is saved.</p>}
          <button className="btn gold" disabled={waiting > 0} onClick={async () => { await lockAction(communityId, matchId, "release", deviceId()); router.push(props.matchHref); router.refresh(); }}>Yes, stop scoring</button>
        </Sheet>
      )}
      {msg && <div className={`toast${msg.tone === "red" ? " error" : msg.tone === "warn" ? " warn" : ""}`} role="status" aria-live="polite">{msg.text}</div>}
      {sheet === "more" && (
        <Sheet title="More" onClose={close}>
          <div className="more-grid">
            {([
              ["bye", "Byes and leg-byes", !live || blocked], ["penalty", "Penalty runs", !live],
              ["changebowler", "Change bowler", !live || needBatter], ["retire", "Retire a player", !live],
              ["late", "Add a late player or guest", !inn],
              ["overs", "Change overs", !live], ["players", "Players per side", !inn],
              ["limit", "Change bowler limit", !inn], ["crease", "Correct batters", !live],
              ["order", "Batting order", !live], ["sub", "Substitute fielder", !inn],
              ["edit", "Edit an earlier ball", !inn], ["target", "Revised target", !live || (live.target === null)],
              ["endinnings", "End the innings", !live],
            ] as [Sheet_, string, boolean][]).map(([k, t, off], i) => (
              <button key={i} className="btn ghost small" style={{ width: "100%" }} disabled={off} onClick={() => setSheet(k)}>{t}</button>
            ))}
            <button className="btn ghost small" style={{ width: "100%" }} disabled={!inn} onClick={() => { close(); if (m.paused) add([{ type: "resume", payload: {} }]); else add([{ type: "pause", payload: {} }]); }}>{m.paused ? "Resume the match" : "Pause the match"}</button>
          </div>
          <div className="two" style={{ marginTop: 10 }}>
            <button className="btn ghost small" style={{ width: "100%" }} disabled={!live || !live.nonStriker} onClick={() => { close(); add([{ type: "swap_strike", payload: {} }]); }}>Swap striker and non-striker</button>
            <button className="btn ghost small" style={{ width: "100%" }} onClick={() => setSheet("guide")}>How to score</button>
          </div>
          <hr className="line" />
          <div className="two">
            <button className="btn red small" style={{ width: "100%" }} disabled={!inn} onClick={() => setSheet("endmatch")}>End or abandon the match</button>
            <button className="btn ghost small" style={{ width: "100%" }} onClick={() => setSheet("release")}>Stop scoring (hand over)</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

/* ---------- starting the match, and each later innings ---------- */
function StartPanel({ mode, m, start, add }: { mode: "match" | "innings"; m: MatchState; start: PadProps["start"]; add: Add }) {
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
  const chase = mode === "innings" && idx >= 1 ? (m.innings[idx - 1] ? m.innings[idx - 1]!.runs + 1 : null) : null;

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

  return (
    <div className="stack">
      <h2 style={{ fontSize: "1.05rem" }}>{title}</h2>
      {mode === "match" && (
        <>
          <p className="muted small" style={{ margin: 0 }}>{sides[0]} v {sides[1]} · {start.base.overs} overs · {start.base.playersPerSide} a side · {start.base.players.filter((p) => p.side === 1).length} and {start.base.players.filter((p) => p.side === 2).length} players picked. You are the scorer.</p>
          {tossMode === "coin" && (
            <>
              <CoinToss sides={start.base.sides} onDone={(r) => { setWinner(String(r.winner) as "1" | "2"); setDecision(r.decision); setStriker(""); setNon(""); setBowler(""); }} />
              <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => { setWinner(""); setDecision(""); setTossMode("manual"); }}>The toss was already done: enter the result by hand</button>
            </>
          )}
          {tossMode === "done" && (
            <div className="banner green"><b>{sides[Number(winner) - 1]} won the toss</b> and chose to {decision}. <button type="button" className="chip" style={{ marginLeft: 6 }} onClick={() => { setWinner(""); setDecision(""); setTossMode("coin"); }}>Toss again</button></div>
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
              <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => { setWinner(""); setDecision(""); setTossMode("coin"); }}>Use the coin instead</button>
            </>
          )}
          {winner && !decision && <p className="err">Choose what the toss winner decided.</p>}
          {!tossBat && (
            <>
              <label className="lb" htmlFor="st-f">Batting first</label>
              <select id="st-f" className="field" value={first} onChange={(e) => { setFirst(e.target.value as "" | "1" | "2"); setStriker(""); setNon(""); setBowler(""); }}><option value="">Choose</option><option value="1">{sides[0]}</option><option value="2">{sides[1]}</option></select>
            </>
          )}
        </>
      )}
      {mode === "innings" && battingSide && (
        <div className="banner mute">{sides[battingSide - 1]} bat{chase ? `. Target ${chase} from ${idx >= 2 ? 1 : m.overs} over${(idx >= 2 ? 1 : m.overs) === 1 ? "" : "s"}` : ""}.</div>
      )}
      {battingSide && (
        <>
          <b style={{ display: "block" }}>Striker (faces the first ball)</b>
          <div className="chips" role="group" aria-label="Striker">
            {batList.map((p) => <Chip key={p.id} on={striker === p.id} bad={striker === p.id && non === p.id} onClick={() => setStriker(p.id)}>{p.name}{p.number !== null ? ` (${p.number})` : ""}</Chip>)}
          </div>
          <b style={{ display: "block" }}>Non-striker</b>
          <div className="chips" role="group" aria-label="Non-striker">
            {batList.map((p) => <Chip key={p.id} on={non === p.id} bad={non === p.id && striker === p.id} onClick={() => setNon(p.id)}>{p.name}{p.number !== null ? ` (${p.number})` : ""}</Chip>)}
          </div>
          {striker && striker === non && <p className="err" role="alert">Striker and non-striker must be different players.</p>}
          <b style={{ display: "block" }}>First bowler ({sides[(bowlingSide ?? 2) - 1]})</b>
          <div className="chips" role="group" aria-label="First bowler">
            {bowlList.map((p) => <Chip key={p.id} on={bowler === p.id} onClick={() => setBowler(p.id)}>{p.name}{p.number !== null ? ` (${p.number})` : ""}</Chip>)}
          </div>
        </>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn gold" disabled={!battingSide || !striker || !non || !bowler || striker === non} onClick={submit}>{mode === "match" ? "Start scoring" : "Start the innings"}</button>
    </div>
  );
}
