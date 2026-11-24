"use client";
// Phase 5: the scoring pad. It works from the saved events on the phone, so it keeps working with no signal:
// every tap is checked by the engine, saved on the phone first, then sent to the server in order.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lockAction, lockStatus } from "@/app/actions5";
import "./pp.css";
import PadBoard from "@/components/PadBoard";
import PadKeypad from "@/components/PadKeypad";
import PadMoreMenu from "@/components/PadMore";
import { PadNotices, PadStatusBar } from "@/components/PadStatus";
import { IcAlert, IcCard, IcCheck, IcClock, IcHistory, IcRefresh, IcZap } from "@/components/PpIcons";
import { lastActionText, outNote, overNote, WORDS } from "@/components/padInfo";
import { StartPanel } from "@/components/PadStart";
import {
  BatterSheet, BowlerSheet, ByeSheet, CreaseSheet, EditSheet, EndInningsSheet, EndMatchSheet, GuideSheet, LateSheet, LimitSheet, OrderSheet,
  OutSheet, OversSheet, PenaltySheet, PlayersSheet, RetireSheet, ScorecardSheet, Sheet, SubSheet, TargetSheet, type Add,
} from "@/components/PadSheets";
import { buildState, currentInnings, describeBall, effectiveEvents, activeInnings } from "@/lib/engine/engine";
import type { MatchState, ScoreEvent, ScoreEventBody, Side, StartPayload } from "@/lib/engine/types";
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
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "mute" | "warn"; text: string; long?: boolean; sub?: string } | null>(null);
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
      if (r.kind === "error") { setMsg({ tone: "mute", text: r.message, sub: "Retrying every few seconds." }); return; }
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
      // read-back for the toast only ("Four runs" and, under it, "Hamza Khan 28 (15)"): reads the state, changes nothing
      const evId = made[made.length - 1]!.id;
      const innOf = after.state.innings.find((i) => i.balls.some((b) => b.eventId === evId));
      const rec = innOf?.balls.find((b) => b.eventId === evId);
      const line = rec && innOf ? innOf.batters[rec.striker] : undefined;
      const sub = rec && line ? `${after.state.players[rec.striker]?.name ?? "Batter"} ${line.runs} (${line.balls})` : undefined;
      setMsg({ tone: freeHitNext ? "warn" : "green", text: freeHitNext ? "No ball: the next ball is a Free Hit." : describeBall(lastBody.payload, after.state.rules), sub });
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
  const undo = () => { setArmed(null); add([{ type: "undo", payload: {} }]); };
  const undoSentence = canUndo ? lastActionText(m, lastEff) : null;

  // which balls on the board are only on this phone (a clock) or were refused by the server (an alert)
  const pendingIds = new Set(pending.filter((p) => p.status === "pending").map((p) => p.id));
  const heldIds = new Set(held.map((p) => p.id));
  const formMode = !m.started || m.phase === "need_innings";
  const sides = m.started ? m.sides : start.base.sides;
  const subtitle = live ? `Over ${Math.floor(live.legalBalls / m.rules.ballsPerOver) + 1} of ${live.maxOvers}` : m.started ? (m.phase === "finished" || m.phase === "abandoned" || m.phase === "result" ? "Match over" : m.phase === "level_prompt" ? "Scores level" : "Between innings") : `${start.base.overs} overs`;
  // a panel is open over the pad: the message moves to the top so it never covers the panel's buttons
  const sheetOpen = sheet !== null || (!!live && promptOpen && (needBatter || needBowler));
  const reportHref = `/c/${communityId}/matches/${matchId}/report`;
  const dropCount = held.length ? pending.filter((p) => p.seq >= Math.min(...held.map((h) => h.seq))).length : 0;
  const undoWide = (label: string) => (
    <div className="pp-undo-wide">
      <button type="button" className="btn ghost pp-big" onClick={() => add([{ type: "undo", payload: {} }])}><span className="pp-btn-ico" aria-hidden="true"><IcHistory size={18} /></span>{label}</button>
      {undoSentence && <small className="muted">Takes back: {undoSentence}</small>}
    </div>
  );

  return (
    <main className={`pad-page pp-page${flash ? ` flash-${flash}` : ""}`}>
      <div className="pp-cq">
      <div className={`pp-frame${formMode ? " form" : ""}`}>
        <header className="pp-top">
          <Link href={props.matchHref} className="pp-back" aria-label="Leave the scoring screen (it keeps its place)"><span aria-hidden="true">‹</span></Link>
          <div className="pp-title">
            <b>{sides[0]} v {sides[1]}</b>
            <small className="muted">{subtitle}</small>
          </div>
          <button type="button" className="pp-hbtn" disabled={!inn} onClick={() => { setEditBall(undefined); setSheet("edit"); }}><IcHistory size={20} /><span>History</span></button>
          <button type="button" className="pp-hbtn" onClick={() => setSheet("scorecard")}><IcCard size={20} /><span>Scorecard</span></button>
          <button type="button" className="pp-hbtn pp-help" aria-label="Open the guide: how to score" onClick={() => setSheet("guide")}><span aria-hidden="true">?</span></button>
        </header>
        <PadStatusBar signin={signin} online={online} syncing={syncing} waiting={waiting} failed={saveFailed} scorerName={props.scorerName} onSend={() => void flush()} />

        <div className="pp-scroll">
          <PadNotices
            saveFailed={saveFailed} storageLow={!!storage?.low} notPromised={!!storage && !storage.persisted && waiting > 0 && !online} signin={signin}
            heldCount={held.length} lockLost={lockLost} requester={requester} waiting={waiting} otherDevice={otherDevice}
            onFix={() => setSheet("trouble")} onSee={() => router.refresh()}
            onHandOver={async () => { await lockAction(communityId, matchId, "accept", deviceId()); setRequester(null); setLockLost(true); }}
            onNotNow={async () => { await lockAction(communityId, matchId, "decline", deviceId()); setRequester(null); }}
            onMove={async () => { await lockAction(communityId, matchId, "take", deviceId()); setOtherDevice(false); router.refresh(); }}
          />
          <PadBoard m={m} pendingIds={pendingIds} heldIds={heldIds} pre={{ sides: start.base.sides, overs: start.base.overs, playersPerSide: start.base.playersPerSide }} onBall={live ? (id) => { setEditBall(id); setSheet("edit"); } : undefined} />
        </div>

        <div className="pp-dockw">
          <div className="pp-dock">
            {!m.started ? (
              <StartPanel mode="match" m={m} start={start} add={add} />
            ) : m.phase === "need_innings" ? (
              <StartPanel mode="innings" m={m} start={start} add={add} />
            ) : m.phase === "level_prompt" ? (
              <div className="pp-panel">
                <div className="pp-card gold"><b>The scores are level.</b><span>Play a super over?</span></div>
                <div className="pp-two">
                  <button type="button" className="btn gold pp-big" onClick={() => add([{ type: "super_over_decision", payload: { play: true } }])}>Yes, play a super over</button>
                  <button type="button" className="btn ghost pp-big" onClick={() => add([{ type: "super_over_decision", payload: { play: false } }])}>No, call it a tie</button>
                </div>
                {canUndo && undoWide("Undo the last ball")}
              </div>
            ) : m.phase === "result" ? (
              <div className="pp-panel">
                <button type="button" className="btn gold pp-big" onClick={() => add([{ type: "finish", payload: {} }])}>Finish match: {m.result?.text}</button>
                <p className="pp-card gold"><span>Finishing locks the scorecard. Player of the Match is worked out automatically from points (runs, wickets, catches and the winning side) and shown on the match report.</span></p>
                {canUndo && undoWide("Undo the last action")}
              </div>
            ) : m.phase === "finished" || m.phase === "abandoned" ? (
              <div className="pp-panel">
                <div className="pp-card green"><span className="pp-card-ico" aria-hidden="true"><IcCheck size={22} /></span><div><b>{m.result?.text ?? "Match finished"}</b><span>The scorecard is locked. Corrections are made from the match page.</span></div></div>
                {waiting === 0 ? <Link href={reportHref} className="btn gold pp-big">Open the match report</Link> : <p className="pp-card info"><span>The report opens once every ball has been sent.</span></p>}
                <Link href={props.matchHref} className="btn ghost pp-big">Back to the match</Link>
              </div>
            ) : needBatter && live ? (
              <div className="pp-panel">
                <p className="pp-card gold"><span>{outNote(m, live)}</span></p>
                <button type="button" className="btn gold pp-big" onClick={() => { setHiddenAt(-1); setSheet("batter"); }}>Choose the next batter</button>
                {canUndo && undoWide("Undo the last ball")}
              </div>
            ) : needBowler && live ? (
              <div className="pp-panel">
                <p className="pp-card gold"><span>{overNote(m, live)}</span></p>
                <button type="button" className="btn gold pp-big" onClick={() => { setHiddenAt(-1); setSheet("bowler"); }}>Choose the bowler for over {Math.floor(live.legalBalls / m.rules.ballsPerOver) + 1}</button>
                {canUndo && undoWide("Undo the last ball")}
              </div>
            ) : (
              <>
                {m.paused && (
                  <div className="pp-paused-bar">
                    <p className="pp-card gold"><span>The match is paused, so the scoring keys are locked until you resume.</span></p>
                    <button type="button" className="btn gold pp-big" onClick={() => add([{ type: "resume", payload: {} }])}>Match paused. Resume</button>
                  </div>
                )}
                {armed && (
                  <div className="pp-armed" role="status">
                    <div className="pp-armed-row">
                      <span className="grow">{armed === "wide" ? "Wide: now tap the extra runs that were run" : "No Ball: now tap the runs off the bat"}</span>
                      {armed === "wide" && <button type="button" className="pp-chipbtn" onClick={() => { if (add([{ type: "ball", payload: { extra: "wide", runs: 0 } }])) setArmed(null); }}>Just the wide</button>}
                      <button type="button" className="pp-chipbtn" onClick={() => setArmed(null)}>Cancel</button>
                    </div>
                    <small>
                      {armed === "wide"
                        ? `A wide is ${m.rules.wideRuns} run${m.rules.wideRuns === 1 ? "" : "s"} by itself. Tap any extra runs that were run, or Just the wide.`
                        : `${m.rules.freeHit ? "The next ball will be a Free Hit. " : ""}Tap the runs off the bat. WICKET and RUN OUT are off for now: to record a run out on a no ball, cancel and use RUN OUT (it asks whether it was a no ball).`}
                    </small>
                  </div>
                )}
                <PadKeypad
                  blocked={blocked} undoOff={!canUndo || lockLost || otherDevice}
                  undoNote={lockLost || otherDevice ? "Scoring is not on this phone" : undoSentence ? `Last: ${undoSentence}` : "Nothing to undo yet"}
                  armed={armed} freeHit={!!live?.freeHit}
                  onRun={run} onUndo={undo} onArm={toggleArm}
                  onOut={(preset) => { setOutPreset(preset); setSheet("out"); }}
                  onMore={() => setSheet("more")}
                />
              </>
            )}
          </div>
          {msg && (
            <div className={`pp-toast ${msg.tone}${sheetOpen ? " top" : ""}`} role="status" aria-live="polite">
              <span className="pp-toast-ico" aria-hidden="true">{msg.tone === "red" ? <IcAlert size={18} /> : msg.tone === "warn" ? <IcZap size={18} /> : msg.tone === "mute" ? <IcRefresh size={18} /> : <IcCheck size={18} />}</span>
              <span className="pp-toast-body">
                {msg.tone === "red" && <b className="pp-toast-h">Not saved</b>}
                <span className="pp-toast-text">{msg.text}</span>
                {msg.sub && <small>{msg.sub}</small>}
              </span>
            </div>
          )}
        </div>
      </div>
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
          <p className="muted small" style={{ margin: "0 0 4px" }}>These balls are still safe on this phone. Nothing is thrown away until you choose to.</p>
          <p className="muted small" style={{ margin: "0 0 10px" }}>Balls are sent in order, so every ball after a refused one is held too.</p>
          <ul className="pp-held">
            {held.map((h) => (
              <li key={h.id}>
                <span className="pp-held-ico" aria-hidden="true"><IcAlert size={18} /></span>
                <div><b>{h.event.type === "ball" ? describeBall(h.event.payload, m.rules) : h.event.type.replace("_", " ")}</b><small className="muted">{h.reason}</small></div>
              </li>
            ))}
          </ul>
          <div className="stack" style={{ marginTop: 12 }}>
            <button type="button" className="btn gold pp-big" onClick={() => { commit(store.current.confirmed, store.current.pending.map((p) => (p.status !== "pending" ? { ...p, status: "pending", reason: null } : p))); void Promise.all(held.map((h) => putOutbox({ ...h, status: "pending", reason: null }))).then(flush); close(); }}>Try sending them again</button>
            <p className="pp-warn small" style={{ margin: 0 }}>Discarding cannot be undone. The balls are removed from this phone.</p>
            <button type="button" className="btn red pp-big" onClick={async () => {
              const from = Math.min(...held.map((h) => h.seq));
              const drop = store.current.pending.filter((p) => p.seq >= from);
              await removeOutbox(drop.map((p) => p.id));
              commit(store.current.confirmed, store.current.pending.filter((p) => p.seq < from));
              close();
              startTransition(() => router.refresh());
            }}>Discard {dropCount} ball{dropCount === 1 ? "" : "s"}</button>
          </div>
        </Sheet>
      )}
      {sheet === "release" && (
        <Sheet title="Stop scoring?" onClose={close}>
          {waiting > 0
            ? <div className="pp-note info" role="alert"><span className="pp-note-ico"><IcClock /></span><div><b>Saved only on this phone.</b> {waiting} ball{waiting === 1 ? " is" : "s are"} still waiting to sync. Get a signal first, so nothing is lost.</div></div>
            : <div className="pp-note ok"><span className="pp-note-ico"><IcCheck /></span><div><b>All changes are saved.</b> Someone else can then take over scoring. The score so far is saved.</div></div>}
          <button type="button" className="btn gold pp-big" style={{ marginTop: 12 }} disabled={waiting > 0} onClick={async () => { await lockAction(communityId, matchId, "release", deviceId()); router.push(props.matchHref); router.refresh(); }}>Stop scoring and hand over</button>
        </Sheet>
      )}
      {sheet === "more" && (
        <Sheet title="More" onClose={close}>
          <PadMoreMenu
            m={m} inn={inn} live={live} lock={lockLost || otherDevice}
            onOpen={(k) => setSheet(k as Sheet_)}
            onPause={() => { close(); if (m.paused) add([{ type: "resume", payload: {} }]); else add([{ type: "pause", payload: {} }]); }}
            onSwap={() => { close(); add([{ type: "swap_strike", payload: {} }]); }}
          />
        </Sheet>
      )}
    </main>
  );
}
