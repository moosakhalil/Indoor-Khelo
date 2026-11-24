"use client";
// Phase 5: the panels that slide up over the scoring pad (wicket, run out, more, change bowler and so on).
// Phase E2 (UI redesign): same sheets, same exported names and props, same events handed to `add`; only the layout and wording changed.
import { useRef, useState } from "react";
import { bowlerAllowance, describeBall, effectiveTarget, oversText, selectableBatters, selectableBowlers } from "@/lib/engine/engine";
import { BOWLER_WICKETS, type BallDismissal, type BallPayload, type InningsState, type MatchState, type RetireKind, type ScoreEventBody, type Side } from "@/lib/engine/types";
import { DISMISSALS, parsePattern, type BowlerLimit } from "@/lib/matchRules";
import { Scorecard } from "@/components/Live";
import PsIcon from "@/components/PsIcons";
import Shirt from "@/components/Shirt";
import {
  Banner, CancelButton, Group, MainButton, Pick, PlayerFace, PlayerPicker, PlayerTile, PsHeading, PsSheet, Readback, Seg, SideChip, Stepper, Tile, UnitField,
} from "@/components/PsParts";
import TeamBadge from "@/components/TeamBadge";

/** `then`: follow-up events (such as the next batter) that are added right after, only if the engine still accepts them. */
export type Add = (bodies: ScoreEventBody[], opts?: { reason?: string; then?: ScoreEventBody[] }) => boolean;
type Common = { m: MatchState; inn: InningsState; add: Add; close: () => void };

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <PsSheet title={title} onClose={onClose}>{children}</PsSheet>;
}

const nm = (m: MatchState, id: string | null | undefined) => (id ? m.players[id]?.name ?? "Player" : "—");
const Err = ({ text }: { text?: string | null }) => (text ? <p className="ps-err" role="alert"><PsIcon name="alert" size={16} /><span>{text}</span></p> : null);

function Reason({ value, onChange, placeholder = "For the match timeline" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <>
      <label className="ps-lb" htmlFor="reason">Reason (optional)</label>
      <input id="reason" className="ps-field" value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </>
  );
}

const fielders = (m: MatchState, inn: InningsState) => Object.values(m.players).filter((p) => p.side === inn.bowling && !m.gone[p.id]).map((p) => p.id);
const batSide = (m: MatchState, inn: InningsState) => Object.values(m.players).filter((p) => p.side === inn.batting && !m.gone[p.id]).map((p) => p.id);
const first = (name: string) => name.split(" ")[0] ?? name;
const overBall = (m: MatchState, inn: InningsState) => `${Math.floor(inn.legalBalls / m.rules.ballsPerOver)}.${(inn.legalBalls % m.rules.ballsPerOver) + 1}`;

/* ---------- chips ---------- */
export function Chip({ on, onClick, children, disabled, bad, gone, red, label }: { on?: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; bad?: boolean; gone?: boolean; red?: boolean; label?: string }) {
  return (
    <button type="button" aria-label={label} className={`cb${bad ? " bad" : ""}${gone ? " gone" : ""}${red ? " red" : ""}`} aria-pressed={!!on} disabled={disabled} onClick={onClick}>{children}</button>
  );
}

/** Byes and leg-byes: choose the kind and the runs, read what will be recorded, then add it. */
export function ByeSheet({ m, inn, add, close }: Common) {
  const [kind, setKind] = useState<"bye" | "legbye">("bye");
  const [n, setN] = useState(1);
  const word = kind === "bye" ? `bye${n === 1 ? "" : "s"}` : `leg-bye${n === 1 ? "" : "s"}`;
  const counts = kind === "bye" ? m.rules.byesCountAsBalls : m.rules.legByesCountAsBalls;
  const crossed = n % 2 === 1;
  const overEnds = counts && (inn.legalBalls + 1) % m.rules.ballsPerOver === 0;
  const strike = crossed ? "strike changes (odd runs)" : "strike does not change (even runs)";
  return (
    <PsSheet title="Byes and leg-byes" subtitle="Not off the bat, not charged to the bowler" onClose={close}
      foot={<>
        <MainButton ready label={`Add ${n} ${word}`} missing="" onClick={() => { if (add([{ type: "ball", payload: { extra: kind, runs: n } }])) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <Seg label="Kind" value={kind} onChange={(v) => setKind(v as "bye" | "legbye")} options={[{ value: "bye", label: "Byes" }, { value: "legbye", label: "Leg-byes" }]} />
      <PsHeading>Runs run</PsHeading>
      <Group label="Runs run" cols={5}>
        {[1, 2, 3, 4, 5].map((r) => <Pick key={r} on={n === r} onClick={() => setN(r)}>{r}</Pick>)}
      </Group>
      <Readback>
        <b>Records: {n} {word}.</b> {counts ? "The ball counts." : "The ball does not count."} {nm(m, inn.striker)} faces it; {strike}.{overEnds ? " The over ends after this ball." : ""}
      </Readback>
    </PsSheet>
  );
}

/* ---------- out (wicket and run out share one sheet) ---------- */
const OUT_TYPES: { value: BallDismissal | "retired_out"; label: string; sub: string }[] = [
  { value: "bowled", label: "Bowled", sub: "Stumps hit" }, { value: "caught", label: "Caught", sub: "Fielder catches" }, { value: "lbw", label: "LBW", sub: "Leg before" },
  { value: "run_out", label: "Run Out", sub: "Either batter" }, { value: "stumped", label: "Stumped", sub: "Keeper" }, { value: "hit_wicket", label: "Hit Wicket", sub: "Batter hits stumps" },
  { value: "retired_out", label: "Retired out", sub: "Counts as out" },
];

/** Why a player cannot come in (or that they can), in one word. */
function batterNote(m: MatchState, inn: InningsState, id: string, can: Map<string, boolean>): string {
  if (id === inn.striker || id === inn.nonStriker) return "At crease";
  const line = inn.batters[id];
  if (line?.status === "out") return "Out";
  if (can.get(id)) return "Returning";
  if (can.has(id)) return "Yet to bat";
  if (line?.status === "retired_hurt") return "Retired hurt";
  return "Cannot bat now";
}

/** Who can come in next: every player of the batting side, with the ones who cannot come in named and crossed out. */
function BatterPicker({ m, inn, value, onPick, bad }: { m: MatchState; inn: InningsState; value: string; onPick: (id: string) => void; bad?: boolean }) {
  const can = new Map(selectableBatters(m, inn).map((c) => [c.player.id, c.returning]));
  const side = batSide(m, inn);
  return (
    <PlayerPicker m={m} ids={side} value={value} onChange={onPick} group="Next batter" bad={bad}
      off={(p) => !can.has(p.id)} gone={(p) => inn.batters[p.id]?.status === "out"} note={(p) => batterNote(m, inn, p.id, can)} />
  );
}

export function OutSheet({ m, inn, add, close, preset }: Common & { preset?: "run_out" }) {
  const [type, setType] = useState<string | null>(preset ?? (inn.freeHit && m.rules.dismissals.includes("run_out") ? "run_out" : null));
  const [out, setOut] = useState(inn.striker ?? "");
  const [runs, setRuns] = useState(0);
  const [kind, setKind] = useState<"" | "wide" | "noball">("");
  const [fielder, setFielder] = useState("");
  const [next, setNext] = useState("");
  const [end, setEnd] = useState<"" | "striker" | "nonStriker">("");
  const [tried, setTried] = useState(false);
  const candidates = selectableBatters(m, inn);
  const needsFielder = type === "caught" || type === "stumped" || type === "run_out";
  const both = [inn.striker, inn.nonStriker].filter(Boolean) as string[];
  const why = (v: string): "off" | "freehit" | null => {
    if (!m.rules.dismissals.includes(v)) return "off";
    if (inn.freeHit && v !== "run_out" && v !== "retired_out") return "freehit";
    return null;
  };
  const fielderText = type === "caught" ? "Who took the catch? (can be the bowler)" : type === "stumped" ? "Wicket-keeper" : "Fielder who ran the batter out";
  const errors: string[] = [];
  if (!type) errors.push("Choose how the batter is out.");
  if (needsFielder && !fielder) errors.push("Pick the fielder.");
  if (type && candidates.length > 0 && !next) errors.push("Pick the next batter to continue (or choose later).");
  const payload: BallPayload | null = type && type !== "retired_out"
    ? { runs: type === "run_out" ? runs : 0, extra: type === "run_out" ? (kind || null) : null, wicket: { type: type as BallDismissal, out: type === "run_out" ? out : null, fielder: needsFielder ? fielder : null } }
    : null;
  const confirm = () => {
    setTried(true);
    if (errors.length) return;
    const then: ScoreEventBody[] = next && next !== "later" ? [{ type: "batter_in", payload: { player: next, end: end || null } }] : [];
    const ok = type === "retired_out"
      ? inn.striker && add([{ type: "retire", payload: { player: inn.striker, kind: "retired_out" } }], { then })
      : payload && add([{ type: "ball", payload }], { then });
    if (ok) close();
  };

  // what will be recorded, in words
  const bowlerName = nm(m, inn.bowler);
  const outId = type === "run_out" ? out : inn.striker;
  const outName = nm(m, outId);
  const fName = fielder ? nm(m, fielder) : "…";
  const how = type === "bowled" ? `b ${bowlerName}` : type === "caught" ? `c ${fName} b ${bowlerName}` : type === "lbw" ? `lbw b ${bowlerName}` : type === "stumped" ? `st ${fName} b ${bowlerName}`
    : type === "hit_wicket" ? `hit wicket b ${bowlerName}` : type === "run_out" ? `run out (${fName})` : type === "retired_out" ? "retired out (counts as a wicket)" : "";
  const penalty = type === "run_out" ? (kind === "wide" ? m.rules.wideRuns : kind === "noball" ? m.rules.noBallRuns : 0) : 0;
  const addRuns = type === "run_out" ? runs + penalty : 0;
  const bowlerCredit = type !== null && BOWLER_WICKETS.includes(type);
  const left = both.length - 1;
  const lastWicket = !!type && candidates.length === 0 && (m.rules.lastBatterAlone ? left <= 0 : left <= 1);
  const step3 = candidates.length > 0;
  const total = 1 + (needsFielder ? 1 : 0) + (step3 ? 1 : 0);
  const done = (type ? 1 : 0) + (needsFielder && fielder ? 1 : 0) + (step3 && next ? 1 : 0);
  const missing = !type ? "Choose how the batter is out" : needsFielder && !fielder ? "Pick the fielder to continue" : "Pick the next batter to continue";
  const freeHitOnly = inn.freeHit;
  return (
    <PsSheet title="How out?" subtitle={`${bowlerName} to ${nm(m, inn.striker)} · over ${overBall(m, inn)}`} onClose={close}
      progress={{ done, total, label: "Wicket steps done" }}
      foot={<>
        <MainButton ready={!errors.length} soft tone="red" label="Confirm OUT" missing={missing} onClick={confirm} />
        <CancelButton onClick={close} />
      </>}>
      <PsHeading>{`How was ${nm(m, inn.striker)} out?`}</PsHeading>
      {freeHitOnly && <Banner tone="warn" icon="alert">Free hit: only a run out is possible on this ball.</Banner>}
      <Group label="How out" cols={3}>
        {OUT_TYPES.filter((t) => t.value !== "retired_out" || m.rules.dismissals.includes("retired_out")).map((t) => {
          const blocked = why(t.value);
          return (
            <Tile key={t.value} tone="red" on={type === t.value} disabled={!!blocked} title={t.label}
              sub={blocked === "off" ? "Switched off for this match" : t.sub} bad={tried && !type}
              onClick={() => { setType(t.value); setFielder(""); }} />
          );
        })}
      </Group>
      {OUT_TYPES.some((t) => why(t.value) === "off") && <p className="ps-note">A kind that is switched off can be turned on in the match rules.</p>}
      {tried && !type && <Err text="Choose how the batter is out." />}

      {type === "run_out" && (
        <>
          <PsHeading>Who is out?</PsHeading>
          <Group label="Who is out" cols={2}>
            {both.map((id) => <PlayerTile key={id} p={m.players[id]!} on={out === id} onClick={() => setOut(id)} note={id === inn.striker ? "Striker" : "Non-striker"} />)}
          </Group>
          <PsHeading>Runs completed before the run out</PsHeading>
          <Group label="Runs completed" cols={5}>
            {[0, 1, 2, 3, 4].map((n) => <Pick key={n} on={runs === n} onClick={() => setRuns(n)}>{n}</Pick>)}
          </Group>
          <PsHeading>On a wide or a no ball?</PsHeading>
          <Group label="Wide or no ball" cols={3}>
            {([["", "Normal"], ["wide", "Wide"], ["noball", "No ball"]] as const).map(([v, t]) => <Pick key={v} on={kind === v} onClick={() => setKind(v)}>{t}</Pick>)}
          </Group>
        </>
      )}

      {needsFielder && (
        <>
          <PsHeading>{fielderText}</PsHeading>
          <PlayerPicker m={m} ids={fielders(m, inn)} value={fielder} onChange={setFielder} group="Fielder" bad={tried && !fielder}
            note={(p) => (p.id === inn.bowler ? "Bowler" : p.kind === "guest" ? "Guest" : undefined)} />
          {tried && !fielder && <Err text="Pick the fielder." />}
        </>
      )}

      {type && candidates.length > 0 && (
        <>
          <PsHeading>Who comes in?</PsHeading>
          <BatterPicker m={m} inn={inn} value={next} onPick={setNext} bad={tried && !next} />
          <div className="ps-grid" style={{ marginTop: 8 }}><Tile full on={next === "later"} onClick={() => setNext("later")} title="Choose later" /></div>
          {type === "run_out" && next && next !== "later" && both.length === 2 && (
            <>
              <PsHeading>Which end</PsHeading>
              <Group label="Which end" cols={3}>
                <Tile on={end === ""} onClick={() => setEnd("")} title="Suggested end" />
                <Tile on={end === "striker"} onClick={() => setEnd("striker")} title="Striker end" />
                <Tile on={end === "nonStriker"} onClick={() => setEnd("nonStriker")} title="Non-striker end" />
              </Group>
            </>
          )}
          {tried && !next && <Err text="Pick the next batter to continue." />}
        </>
      )}

      {lastWicket && <Banner tone="warn" icon="info" title="Last wicket">There is nobody left to bat, so the innings ends after this wicket.</Banner>}
      {type && (
        <Readback tone="red">
          <b>Out: {outName} {how}</b><br />
          {type === "run_out"
            ? <>Score becomes {inn.runs + addRuns}/{inn.wickets + 1}{runs ? ` (${runs} run${runs === 1 ? "" : "s"} completed)` : ""}. A run out is not the bowler&rsquo;s wicket.</>
            : type === "retired_out"
              ? <>Score stays {inn.runs}/{inn.wickets + 1}. No wicket for the bowler.</>
              : <>Score becomes {inn.runs}/{inn.wickets + 1}.{bowlerCredit ? ` Wicket to ${bowlerName}.` : ""}</>}
          {payload && type === "run_out" && (runs > 0 || kind) ? <><br /><span className="muted">{describeBall(payload, m.rules)}</span></> : null}
        </Readback>
      )}
    </PsSheet>
  );
}

/* ---------- people: next batter and bowler ---------- */
export function BatterSheet({ m, inn, add, close }: Common) {
  const free = inn.vacant ?? (inn.striker ? "nonStriker" : "striker");
  const [pick, setPick] = useState("");
  const [end, setEnd] = useState<"striker" | "nonStriker">(free);
  const stay = inn.striker ?? inn.nonStriker;
  const lastBall = inn.balls[inn.balls.length - 1];
  const lastOut = inn.fow[inn.fow.length - 1];
  const hurt = Object.values(inn.batters).some((b) => b.status === "retired_hurt");
  const sub = inn.needBatter && lastOut && lastBall?.wicket && lastBall.out === lastOut.player && inn.batters[lastOut.player]?.status === "out" && !hurt
    ? `${nm(m, lastOut.player)} is out · ${inn.runs}/${inn.wickets} after ${oversText(inn.legalBalls, m.rules.ballsPerOver)} overs`
    : `${inn.runs}/${inn.wickets} after ${oversText(inn.legalBalls, m.rules.ballsPerOver)} overs`;
  const who = pick ? nm(m, pick) : "";
  return (
    <PsSheet title="Next batter" subtitle={sub} onClose={close}
      foot={<MainButton ready={!!pick} label={`Confirm: ${who} to bat at the ${end === "striker" ? "striker's" : "non-striker's"} end`} missing="Pick who comes in"
        onClick={() => { if (add([{ type: "batter_in", payload: { player: pick, end } }])) close(); }} />}>
      <BatterPicker m={m} inn={inn} value={pick} onPick={setPick} />
      {stay && (
        <>
          <PsHeading>Takes the</PsHeading>
          <Group label="Which end" cols={2}>
            <Tile on={end === "striker"} onClick={() => setEnd("striker")} title="Striker end" sub={free === "striker" ? "Empty end" : undefined} />
            <Tile on={end === "nonStriker"} onClick={() => setEnd("nonStriker")} title="Non-striker end" sub={free === "nonStriker" ? "Empty end" : undefined} />
          </Group>
        </>
      )}
      <p className="ps-note">Anyone who is free can come in, not only the next in the order. Players who are out are crossed out.</p>
    </PsSheet>
  );
}

export function BowlerSheet({ m, inn, add, close, title }: Common & { title: string }) {
  const options = selectableBowlers(m, inn);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"pick" | "limit">("pick");
  const bpo = m.rules.ballsPerOver;
  const mid = !inn.needBowler && inn.legalBalls % bpo !== 0;
  const l = m.limit;
  const rule = [l.mode === "none" ? "No bowler limit" : l.mode === "max" ? `Maximum ${l.overs} over${l.overs === 1 ? "" : "s"} each` : `Pattern ${l.pattern.join("-")}`, m.rules.sameBowlerTwoInARow ? null : "no two overs in a row"].filter(Boolean).join(" · ");
  const anyOk = options.some((o) => o.ok && !(inn.bowler === o.player.id && !inn.needBowler));
  if (view === "limit") return <LimitSheet m={m} inn={inn} add={add} close={close} />;
  return (
    <PsSheet title={title} onClose={close}>
      <Banner icon="info">{rule}</Banner>
      {mid && <Banner tone="warn" icon="alert">This changes the bowler in the middle of an over; balls already bowled stay with the first bowler.</Banner>}
      {!anyOk && (
        <>
          <Banner tone="red" icon="alert" role="alert" title="No bowler is allowed under the limit right now">The limit is locked on the bowling screen. You can change it here.</Banner>
          <button type="button" className="ps-link" style={{ width: "100%", marginBottom: 8 }} onClick={() => setView("limit")}>Change the bowler limit</button>
        </>
      )}
      <div role="group" aria-label="Bowlers">
        {options.map(({ player, ok, reason }) => {
          const b = inn.bowlers[player.id];
          const left = bowlerAllowance(m, inn, player.id);
          const now = inn.bowler === player.id && !inn.needBowler;
          const lastOver = !!reason?.includes("last over");
          const usedOvers = b ? Math.ceil(b.legalBalls / bpo) : 0;
          const badge: [string, string] | null = now ? ["grey", "BOWLING NOW"]
            : !ok ? (lastOver ? ["orange", "BOWLED LAST OVER"] : l.mode === "max" ? ["red", `USED ${usedOvers} OF ${l.overs}`] : ["red", "FINISHED OVERS"])
            : left !== null ? ["green", `${left} OVER${left === 1 ? "" : "S"} LEFT`] : null;
          const usable = ok && !now;
          const why = reason ? reason.replace(new RegExp(`^${player.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`), "").replace(/^./, (c) => c.toUpperCase()) : null;
          return (
            <button key={player.id} type="button" className={`ps-bow${usable ? "" : " blocked"}${now ? " now" : ""}`} aria-disabled={!usable}
              onClick={() => { if (!usable) { setMsg(now ? "That bowler is already bowling." : `${reason} Pick another bowler.`); return; } if (add([{ type: "bowler", payload: { player: player.id } }])) close(); }}>
              <PlayerFace p={player} size="normal" />
              <span className="ps-bow-x">
                <span className="ps-bow-n">{player.name}</span>
                <span className="ps-bow-s">{b ? `${oversText(b.legalBalls, bpo)} ov · ${b.runs} runs · ${b.wickets} wkts` : "not bowled yet"}</span>
                {why && !now ? <span className="ps-bow-r">{why}</span> : null}
              </span>
              {badge && <span className={`ps-badge ${badge[0]}`}>{badge[1]}</span>}
            </button>
          );
        })}
      </div>
      <Err text={msg} />
    </PsSheet>
  );
}

/* ---------- changes during play ---------- */
export function PenaltySheet({ inn, add, close }: Common) {
  const [n, setN] = useState("5");
  const [reason, setReason] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const v = Number(n);
  const bad = !Number.isInteger(v) || v < 1 || v > 20;
  const quick = [1, 2, 5, 10];
  return (
    <PsSheet title="Penalty runs" subtitle="Added to the batting side. Not a ball." onClose={close}
      foot={<>
        <MainButton ready={!bad} label={`Add ${v} penalty run${v === 1 ? "" : "s"}`} missing="Fix the number to continue" onClick={() => { if (add([{ type: "penalty", payload: { runs: v } }], { reason })) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <PsHeading>Quick values</PsHeading>
      <Group label="Quick values" cols={5}>
        {quick.map((q) => <Pick key={q} on={n === String(q)} onClick={() => setN(String(q))}>{q}</Pick>)}
        <Pick on={!quick.includes(v) || n !== String(v)} onClick={() => box.current?.focus()}>Other</Pick>
      </Group>
      <label className="ps-lb" htmlFor="pen">Runs added to the batting side (1 to 20)</label>
      <input id="pen" ref={box} className={`ps-field${bad ? " bad" : ""}`} inputMode="numeric" aria-invalid={bad || undefined} value={n} onChange={(e) => setN(e.target.value)} />
      <Err text={bad ? "Type a whole number from 1 to 20." : null} />
      <Reason value={reason} onChange={setReason} />
      {!bad && <Readback><b>{inn.runs}/{inn.wickets} becomes {inn.runs + v}/{inn.wickets}.</b> Penalty runs are not a ball.</Readback>}
    </PsSheet>
  );
}

const RETIRE_KINDS: { value: RetireKind; label: string; sub: string }[] = [
  { value: "retired_hurt", label: "Retired hurt", sub: "Can come back" }, { value: "retired_out", label: "Retired out", sub: "Counts as a wicket" },
  { value: "absent", label: "Absent", sub: "Not playing any more" }, { value: "replaced", label: "Replaced", sub: "By someone else" },
];

export function RetireSheet({ m, inn, add, close }: Common) {
  const [player, setPlayer] = useState(inn.striker ?? "");
  const [kind, setKind] = useState<RetireKind>("retired_hurt");
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const all = Object.values(m.players).filter((p) => !m.gone[p.id]).map((p) => p.id);
  const mate = player ? Object.values(m.players).filter((p) => p.side === m.players[player]?.side && p.id !== player && !m.gone[p.id]).map((p) => p.id) : [];
  const where = (id: string) => (id === inn.striker || id === inn.nonStriker ? "Batting" : id === inn.bowler ? "Bowling" : inn.batters[id]?.status === "out" ? "Out" : m.players[id]?.kind === "guest" ? "Guest" : undefined);
  const name = player ? nm(m, player) : "";
  const line = player ? inn.batters[player] : undefined;
  const score = line ? `${line.runs} (${line.balls})` : null;
  const effect = kind === "retired_hurt" ? `${name} leaves the crease${score ? `, ${score} is kept,` : ""} and can be chosen again later.`
    : kind === "retired_out" ? `${name} is out and it counts as a wicket${score ? `. ${score} is kept` : ""}. No wicket for the bowler.`
    : kind === "absent" ? `${name} is not playing any more and cannot be chosen again.`
    : `${name} is replaced${by ? ` by ${nm(m, by)}` : ""} and cannot be chosen again.`;
  const done = kind === "retired_hurt" ? "retired hurt" : kind === "retired_out" ? "retired out" : kind === "absent" ? "absent" : "replaced";
  return (
    <PsSheet title="Retire a player" onClose={close}
      foot={<>
        <MainButton ready={!!player} label={`Confirm: ${name} ${done}`} missing="Pick a player"
          onClick={() => { if (add([{ type: "retire", payload: { player, kind, replacedBy: kind === "replaced" ? by || null : null } }], { reason })) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <PsHeading>Player</PsHeading>
      {([1, 2] as Side[]).map((s) => (
        <div key={s}>
          <p className="ps-note" style={{ margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 8 }}><span aria-hidden="true"><TeamBadge name={m.sides[s - 1]} size="sm" /></span><b>{m.sides[s - 1]}</b></p>
          <PlayerPicker m={m} ids={all.filter((id) => m.players[id]?.side === s)} value={player} onChange={(id) => { setPlayer(id); setBy(""); }} group={`Player, ${m.sides[s - 1]}`} note={(p) => where(p.id)} />
        </div>
      ))}
      <PsHeading>What happened?</PsHeading>
      <Group label="What happened" cols={2}>
        {RETIRE_KINDS.map((k) => <Tile key={k.value} on={kind === k.value} onClick={() => setKind(k.value)} title={k.label} sub={k.sub} />)}
      </Group>
      {kind === "replaced" && (
        <>
          <PsHeading>Replaced by (optional)</PsHeading>
          <PlayerPicker m={m} ids={mate} value={by} onChange={setBy} group="Replaced by" none={{ label: "Nobody yet" }} />
        </>
      )}
      <p className="ps-note">Retired hurt and retired out are for a batter at the crease. Absent and replaced are for anyone not batting or bowling right now.</p>
      <Reason value={reason} onChange={setReason} />
      {player && <Readback>{effect}</Readback>}
    </PsSheet>
  );
}

export function OversSheet({ m, inn, add, close }: Common) {
  const bpo = m.rules.ballsPerOver;
  const [overs, setOvers] = useState(String(inn.maxOvers));
  const [scope, setScope] = useState<"innings" | "remaining">("innings");
  const [reason, setReason] = useState("");
  const v = Number(overs);
  const min = Math.ceil(inn.legalBalls / bpo);
  const lowest = Math.max(1, min);
  const bad = !Number.isInteger(v) || v < lowest || v > 50 ? `Overs must be a whole number from ${lowest} to 50. ${oversText(inn.legalBalls, bpo)} overs are already bowled.` : null;
  const tgt = effectiveTarget(inn);
  return (
    <PsSheet title="Change the overs" onClose={close}
      foot={<>
        <MainButton ready={!bad} label="Change overs" missing="Fix the overs to continue" onClick={() => { if (add([{ type: "overs_change", payload: { overs: v, scope } }], { reason })) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <Banner icon="info">{inn.legalBalls > 0 ? `Overs already bowled (${oversText(inn.legalBalls, bpo)}) are kept.` : "No overs are bowled yet."} {tgt !== null ? `The target stays at ${tgt} unless you enter a revised target (More, then Revised target).` : "The target stays where it is."}</Banner>
      <PsHeading>New overs per innings</PsHeading>
      <Stepper id="ov-n" label="New overs per innings" value={overs} onChange={setOvers} min={lowest} max={50} unit="overs" invalid={!!bad} lessLabel="Fewer overs" moreLabel="More overs" />
      <p className="ps-note">{inn.legalBalls > 0 ? `Minimum ${lowest} because ${oversText(inn.legalBalls, bpo)} overs are bowled.` : "Minimum 1."}</p>
      <Err text={bad} />
      <PsHeading>Applies to</PsHeading>
      <Seg label="Applies to" value={scope} onChange={(s) => setScope(s as "innings" | "remaining")} options={[{ value: "innings", label: "This innings only" }, { value: "remaining", label: "All remaining innings" }]} />
      <p className="ps-note">If the bowler limit is a pattern, check it still adds up (More, then Change bowler limit).</p>
      <Reason value={reason} onChange={setReason} placeholder="For the match timeline, e.g. rain" />
      {!bad && <Readback><b>Change to {v} over{v === 1 ? "" : "s"} for {scope === "innings" ? "this innings" : "all remaining innings"}.</b></Readback>}
    </PsSheet>
  );
}

export function PlayersSheet({ m, add, close }: Common) {
  const [n, setN] = useState(String(m.playersPerSide));
  const [reason, setReason] = useState("");
  const v = Number(n);
  const bad = !Number.isInteger(v) || v < 2 || v > 11 ? "Players per side must be a whole number from 2 to 11." : null;
  const wickets = m.rules.lastBatterAlone ? v : v - 1;
  return (
    <PsSheet title="Players per side" onClose={close}
      foot={<>
        <MainButton ready={!bad} label={`Save: ${v} players a side`} missing="Fix the number to continue" onClick={() => { if (add([{ type: "players_change", payload: { playersPerSide: v } }], { reason })) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <PsHeading>{`Players per side (now ${m.playersPerSide})`}</PsHeading>
      <Stepper id="pp" label={`Players per side (now ${m.playersPerSide})`} value={n} onChange={setN} min={2} max={11} unit="players" invalid={!!bad} lessLabel="Fewer players" moreLabel="More players" />
      <Err text={bad} />
      <p className="ps-note">This decides when an innings ends: with the last batter allowed to bat alone, every player must be out.</p>
      <Reason value={reason} onChange={setReason} />
      {!bad && <Readback><b>An innings ends when {wickets} wickets have fallen.</b> {m.sides[0]} and {m.sides[1]} are both set to {v} players.</Readback>}
    </PsSheet>
  );
}

const LIMIT_OPTIONS = [
  { value: "none", title: "No limit", text: "Any bowler can bowl as many overs as they like." },
  { value: "max", title: "Maximum overs per bowler", text: "Every bowler gets the same number of overs." },
  { value: "pattern", title: "Pattern, for example 2-1-1", text: "Each number is one bowler's overs, for example 2-1-1 for three bowlers." },
] as const;

export function LimitSheet({ m, add, close }: Common) {
  const cur = m.limit;
  const [mode, setMode] = useState<BowlerLimit["mode"]>(cur.mode);
  const [max, setMax] = useState(cur.mode === "max" ? String(cur.overs) : "");
  const [pat, setPat] = useState(cur.mode === "pattern" ? cur.pattern.join("-") : "");
  const [reason, setReason] = useState("");
  let limit: BowlerLimit | null = { mode: "none" };
  let err: string | null = null;
  if (mode === "max") {
    const v = Number(max);
    if (!Number.isInteger(v) || v < 1 || v > 50) err = "Type how many overs each bowler may bowl (1 to 50).";
    else limit = { mode: "max", overs: v };
  } else if (mode === "pattern") {
    const p = parsePattern(pat);
    if (!p.ok) err = p.error; else limit = { mode: "pattern", pattern: p.pattern };
  }
  const text = limit.mode === "none" ? "no limit" : limit.mode === "max" ? `${limit.overs} over${limit.overs === 1 ? "" : "s"} each` : `pattern ${limit.pattern.join("-")}`;
  const touched = (mode === "max" && max !== "") || (mode === "pattern" && pat !== "");
  const showErr = err && (touched || mode === cur.mode);
  return (
    <PsSheet title="Change the bowler limit" onClose={close}
      foot={<>
        <MainButton ready={!err && !!limit} label={`Set limit: ${text}`} missing={mode === "pattern" ? "Fix the pattern to continue" : "Fix the number to continue"}
          onClick={() => { if (limit && add([{ type: "limit_change", payload: { limit } }], { reason })) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <Banner icon="lock">The limit is locked on the bowling screen. This is the only way to change it, and it is written on the match timeline.</Banner>
      <div role="radiogroup" aria-label="Limit">
        {LIMIT_OPTIONS.map((o) => (
          <label key={o.value} className="ps-card">
            <input type="radio" name="limit" checked={mode === o.value} onChange={() => setMode(o.value)} />
            <span className="ps-card-r" aria-hidden="true" />
            <span className="ps-card-t"><b>{o.title}</b><small>{o.text}</small></span>
          </label>
        ))}
      </div>
      {mode === "max" && <UnitField label="Maximum overs" value={max} onChange={setMax} unit="overs" placeholder="2" invalid={!!showErr} />}
      {mode === "pattern" && <UnitField label="Over pattern" value={pat} onChange={setPat} placeholder="2-1-1" inputMode="text" invalid={!!showErr} />}
      <Err text={showErr ? err : null} />
      <Reason value={reason} onChange={setReason} />
    </PsSheet>
  );
}

export function LateSheet({ m, inn, add, close, members, newId }: Common & { members: { userId: string; name: string; number: number | null }[]; newId: () => string }) {
  const [tab, setTab] = useState<"member" | "guest">(members.length ? "member" : "guest");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [side, setSide] = useState<Side>(1);
  const [view, setView] = useState<"add" | "players">("add");
  if (view === "players") return <PlayersSheet m={m} inn={inn} add={add} close={close} />;
  const trimmed = name.trim();
  const guestErr = tab === "guest" && !trimmed ? "Type the guest's name." : null;
  const dup = tab === "guest" && trimmed && Object.values(m.players).some((p) => p.kind === "guest" && p.name.trim().toLowerCase() === trimmed.toLowerCase()) ? "A guest with that name is already in this match." : null;
  const mem = members.find((x) => x.userId === userId);
  const shown = members.filter((x) => x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const full = Object.values(m.players).filter((p) => p.side === side && !m.gone[p.id]).length >= m.playersPerSide;
  const ready = tab === "member" ? !!mem : !guestErr && !dup;
  const sideName = m.sides[side - 1]!;
  return (
    <PsSheet title="Add a late player" onClose={close}
      foot={<>
        <MainButton ready={ready} label={`Add ${tab === "member" ? mem?.name ?? "" : trimmed} to ${sideName}`} missing={tab === "member" ? "Choose a member" : dup ? "Use a different name" : "Type the guest name"}
          onClick={() => {
            const found = members.find((x) => x.userId === userId);
            const player = tab === "member" && found
              ? { id: newId(), side, name: found.name, number: found.number, kind: "member" as const, userId: found.userId }
              : { id: newId(), side, name: trimmed, number: null, kind: "guest" as const, userId: null };
            if (add([{ type: "player_added", payload: { player } }])) close();
          }} />
        <CancelButton onClick={close} />
      </>}>
      <Seg label="Who is joining" value={tab} onChange={(v) => setTab(v as "member" | "guest")} options={[{ value: "member", label: "A community member" }, { value: "guest", label: "A guest (name only)" }]} />
      {tab === "member" ? (
        members.length === 0 ? (
          <div className="ps-empty">
            <svg viewBox="0 0 96 96" fill="none" aria-hidden="true"><circle cx="48" cy="48" r="40" fill="var(--card2)" /><circle cx="48" cy="38" r="12" stroke="var(--mute)" strokeWidth="3" /><path d="M24 74c3-13 13-19 24-19s21 6 24 19" stroke="var(--mute)" strokeWidth="3" strokeLinecap="round" /><path d="m36 50 24 24" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" /></svg>
            <p>Everyone in the community is already in this match.</p>
            <div className="ps-empty-acts">
              <button type="button" className="ps-link" onClick={() => setTab("guest")}>Add a guest instead</button>
              <button type="button" className="ps-link" onClick={() => setView("players")}>Raise players per side</button>
            </div>
          </div>
        ) : (
          <>
            <PsHeading>Member</PsHeading>
            <div className="ps-find"><PsIcon name="search" size={18} /><input className="ps-field" aria-label="Find a member" placeholder="Find a member" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="ps-list" role="group" aria-label="Member">
              {shown.map((x) => (
                <button key={x.userId} type="button" className="ps-row" aria-pressed={userId === x.userId} onClick={() => setUserId(x.userId)}>
                  <span className="ps-face" aria-hidden="true"><Shirt number={x.number} size="normal" /></span>
                  <span className="ps-row-x"><span className="ps-row-n">{x.name}</span><small className="ps-tile-s">{x.number !== null ? `#${x.number}` : "No number"}</small></span>
                  <span className="ps-row-r" aria-hidden="true" />
                </button>
              ))}
              {shown.length === 0 && <p className="ps-note">Nobody matches that name.</p>}
            </div>
          </>
        )
      ) : (
        <>
          <label className="ps-lb" htmlFor="lt-g" style={{ marginTop: 0 }}>Guest&rsquo;s name</label>
          <input id="lt-g" className={`ps-field${dup ? " bad" : ""}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <Err text={dup ?? (guestErr && name.length ? guestErr : null)} />
          <p className="ps-note" style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="ps-face" aria-hidden="true"><Shirt number={null} size="small" /></span><span>A guest is a name only: no player number and no profile.</span></p>
        </>
      )}
      <PsHeading>Joins</PsHeading>
      <Group label="Joins" cols={2}>
        {([1, 2] as Side[]).map((s) => <SideChip key={s} name={m.sides[s - 1]!} on={side === s} onClick={() => setSide(s)} />)}
      </Group>
      {full && <Banner tone="warn" icon="alert">{sideName} already has {m.playersPerSide} players. Raise players per side first (More, then Players per side).</Banner>}
      <p className="ps-note">They can be chosen as the next batter straight away. A guest has no player number. If a side is full, raise players per side first.</p>
    </PsSheet>
  );
}

export function CreaseSheet({ m, inn, add, close }: Common) {
  const ids = batSide(m, inn).filter((id) => !inn.batters[id] || inn.batters[id]!.status === "batting");
  const [s, setS] = useState(inn.striker ?? "");
  const [n, setN] = useState(inn.nonStriker ?? "");
  const ready = !!s && s !== n;
  return (
    <PsSheet title="Correct the batters" onClose={close}
      foot={<>
        <MainButton ready={ready} label={`Save: ${nm(m, s)} on strike, ${n ? `${nm(m, n)} at the other end` : "batting alone"}`} missing={!s ? "Pick the striker" : "Pick two different batters"}
          onClick={() => { if (add([{ type: "set_crease", payload: { striker: s, nonStriker: n || null } }])) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <Banner tone="warn" icon="info">Use this if the wrong batters were chosen. A batter who has already faced a ball cannot be swapped out: use Retire instead.</Banner>
      <PsHeading>Striker (on strike)</PsHeading>
      <PlayerPicker m={m} ids={ids} value={s} onChange={setS} group="Striker" />
      <PsHeading>Non-striker</PsHeading>
      <PlayerPicker m={m} ids={ids} value={n} onChange={setN} group="Non-striker" none={m.rules.lastBatterAlone ? { label: "Nobody (batting alone)" } : undefined} bad={!!s && s === n} />
      {s && s === n && <Err text="The two batters must be different people." />}
    </PsSheet>
  );
}

export function OrderSheet({ m, inn, add, close }: Common) {
  const options = selectableBatters(m, inn).map((c) => c.player.id);
  const [a, setA] = useState(inn.battingOrderHint[0] ?? "");
  const [b, setB] = useState(inn.battingOrderHint[1] ?? "");
  const [c3, setC] = useState(inn.battingOrderHint[2] ?? "");
  const order = [a, b, c3].filter(Boolean);
  const dup = new Set(order).size !== order.length;
  const twice = (v: string) => !!v && order.filter((x) => x === v).length > 1;
  const slots: [string, string, (v: string) => void, string][] = [["Next", a, setA, "1"], ["After that", b, setB, "2"], ["Then", c3, setC, "3"]];
  return (
    <PsSheet title="Batting order" onClose={close}
      foot={<>
        <MainButton ready={!dup} label={order.length ? `Save order: ${order.map((id) => first(nm(m, id))).join(", ")}` : "Save order: no preference"} missing="Fix the duplicate to save"
          onClick={() => { if (add([{ type: "batting_order", payload: { order } }])) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <Banner icon="info">Choose who comes in next. This is only a suggestion: when a wicket falls you can still pick anyone. A late player can be declared as the next batter here.</Banner>
      {slots.map(([t, v, set, num]) => (
        <div key={t}>
          <PsHeading>{`${num}. ${t}`}</PsHeading>
          <PlayerPicker m={m} ids={options} value={v} onChange={set} group={t} none={{ label: "No preference" }} bad={twice(v)} />
        </div>
      ))}
      <Err text={dup ? "Each person can be listed once." : null} />
    </PsSheet>
  );
}

export function SubSheet({ m, add, close }: Common) {
  const [side, setSide] = useState<Side>(2);
  const [name, setName] = useState("");
  const t = name.trim();
  return (
    <PsSheet title="Substitute fielder" subtitle="Only noted on the timeline" onClose={close}
      foot={<>
        <MainButton ready={!!t} label={`Note: ${t} fielding for ${m.sides[side - 1]}`} missing="Type the substitute's name" onClick={() => { if (add([{ type: "substitute", payload: { side, name: t } }])) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <label className="ps-lb" htmlFor="sb-n" style={{ marginTop: 0 }}>Substitute&rsquo;s name</label>
      <input id="sb-n" className="ps-field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <PsHeading>Fielding for</PsHeading>
      <Group label="Fielding for" cols={2}>
        {([1, 2] as Side[]).map((s) => <SideChip key={s} name={m.sides[s - 1]!} on={side === s} onClick={() => setSide(s)} />)}
      </Group>
      <p className="ps-note">A substitute fielder gets no batting or bowling credit. It is only noted on the timeline.</p>
    </PsSheet>
  );
}

export function TargetSheet({ inn, add, close }: Common) {
  const [t, setT] = useState(inn.manualTarget !== null ? String(inn.manualTarget) : "");
  const v = Number(t);
  const bad = t !== "" && (!Number.isInteger(v) || v < 1 || v > 999) ? "Type a whole number from 1 to 999." : null;
  return (
    <PsSheet title="Revised target" onClose={close}
      foot={<>
        <MainButton ready={!bad} label={t === "" ? "Use the original target" : `Save target: ${v}`} missing="Fix the target to continue" onClick={() => { if (add([{ type: "target_manual", payload: { target: t === "" ? null : v } }])) close(); }} />
        <CancelButton onClick={close} />
      </>}>
      <Banner icon="info">The target normally stays where it is, even when overs are cut. Enter a revised target only if you have agreed one.</Banner>
      <PsHeading>Revised target</PsHeading>
      <UnitField label="Revised target" value={t} onChange={setT} unit="runs" placeholder={String(inn.target ?? "")} invalid={!!bad} />
      <Err text={bad} />
      {(inn.manualTarget !== null || t !== "") && inn.target !== null && (
        <button type="button" className="ps-link" style={{ marginTop: 10 }} onClick={() => setT("")}>Use the original target ({inn.target})</button>
      )}
    </PsSheet>
  );
}

export function EndInningsSheet({ m, inn, add, close }: Common) {
  const [reason, setReason] = useState("");
  const name = m.sides[inn.batting - 1]!;
  const other = m.sides[inn.bowling - 1]!;
  const then = !inn.superOver && inn.index === 0 ? `${other} then chase ${inn.runs + 1}.` : "The result is worked out from the scores.";
  return (
    <PsSheet title="End the innings now?" onClose={close}
      foot={<>
        <MainButton ready tone="red" label="Yes, end the innings" missing="" onClick={() => { if (add([{ type: "innings_end", payload: {} }], { reason })) close(); }} />
        <CancelButton onClick={close}>Keep batting</CancelButton>
      </>}>
      <div className="ps-ballcard" style={{ marginTop: 6 }}>
        <span aria-hidden="true"><TeamBadge name={name} size="md" /></span>
        <p><b>{name}</b> finish on <b style={{ fontFamily: "var(--font-num)", fontSize: "1.1rem" }}>{inn.runs}/{inn.wickets}</b></p>
      </div>
      <Readback>This is a declaration or an early finish; it can be undone straight afterwards. <b>{then}</b></Readback>
      <Reason value={reason} onChange={setReason} />
    </PsSheet>
  );
}

type Outcome = "abandon" | "win1" | "win2" | "none";
export function EndMatchSheet({ m, add, close }: Common) {
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("abandon");
  const [typed, setTyped] = useState("");
  const options: { value: Outcome; title: string; text: string; red?: boolean }[] = [
    { value: "abandon", title: "Abandon the match", text: "Not counted as a win, a loss or an appearance.", red: true },
    { value: "win1", title: `Result: ${m.sides[0]} won`, text: "Counted in both teams' records." },
    { value: "win2", title: `Result: ${m.sides[1]} won`, text: "Counted in both teams' records." },
    { value: "none", title: "No result", text: "The match ends with no winner." },
  ];
  const ready = outcome !== "abandon" || typed.trim().toUpperCase() === "ABANDON";
  const go = () => {
    const payload = outcome === "abandon" ? { kind: "abandoned" as const } : outcome === "win1" ? { kind: "result" as const, winner: 1 as Side } : outcome === "win2" ? { kind: "result" as const, winner: 2 as Side } : { kind: "result" as const, winner: null };
    if (add([{ type: "match_end", payload }], { reason })) close();
  };
  const chosen = options.find((o) => o.value === outcome)!;
  return (
    <PsSheet title="End the match early" onClose={close}
      foot={<>
        <MainButton ready={ready} tone="red" label={outcome === "abandon" ? "Abandon the match" : `Finish: ${chosen.title.replace(/^Result: /, "")}`} missing="Type ABANDON to continue" onClick={go} />
        <CancelButton onClick={close}>Keep scoring</CancelButton>
      </>}>
      <Banner tone="red" icon="alert" title="This finishes the match and locks it.">It cannot be undone here. Abandoned matches are not counted as a win, a loss or an appearance.</Banner>
      <PsHeading>Choose the outcome</PsHeading>
      <div role="radiogroup" aria-label="Outcome">
        {options.map((o) => (
          <label key={o.value} className={`ps-card${o.red ? " red" : ""}`}>
            <input type="radio" name="outcome" checked={outcome === o.value} onChange={() => setOutcome(o.value)} />
            <span className="ps-card-r" aria-hidden="true" />
            <span className="ps-card-t"><b>{o.title}</b><small>{o.text}</small></span>
          </label>
        ))}
      </div>
      {outcome === "abandon" && (
        <>
          <label className="ps-lb" htmlFor="am-t">Type ABANDON to confirm</label>
          <input id="am-t" className="ps-field" value={typed} autoCapitalize="characters" autoComplete="off" onChange={(e) => setTyped(e.target.value)} placeholder="ABANDON" />
        </>
      )}
      <Reason value={reason} onChange={setReason} placeholder="e.g. rain, ground closed" />
    </PsSheet>
  );
}

/* ---------- editing an earlier ball ---------- */
export function EditSheet({ m, inn, add, close, initial }: Common & { initial?: string }) {
  const [innIdx, setInnIdx] = useState(inn.index);
  const [pick, setPick] = useState<string | null>(initial ?? null);
  const chosen = m.innings[innIdx];
  const ball = chosen?.balls.find((b) => b.eventId === pick);
  if (pick && ball && chosen) return <EditBall m={m} innIdx={innIdx} eventId={pick} add={add} close={close} back={() => setPick(null)} />;
  return (
    <PsSheet title="Edit an earlier ball" onClose={close}>
      {m.innings.length > 1 && (
        <Seg label="Innings" value={String(innIdx)} onChange={(v) => setInnIdx(Number(v))} options={m.innings.map((i) => ({ value: String(i.index), label: i.superOver ? "Super over" : `Innings ${i.index + 1}` }))} />
      )}
      <p className="ps-note" style={{ marginBottom: 10 }}>Tap a ball to change it. Everything after it is worked out again, and the change is written on the timeline. An edit that would break the balls after it is refused.</p>
      <div className="ps-balls">
        {(chosen?.balls ?? []).slice().reverse().map((b) => (
          <button key={b.eventId} type="button" className="ps-ballrow" onClick={() => setPick(b.eventId)}>
            <span className="ball" style={{ flex: "0 0 auto" }}>{b.label}</span>
            <small>{b.text}</small>
            <PsIcon name="edit" size={18} />
            <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Edit this ball</span>
          </button>
        ))}
        {(chosen?.balls ?? []).length === 0 && <p className="ps-note">No balls have been bowled in this innings yet.</p>}
      </div>
    </PsSheet>
  );
}

/** The short label of a ball, as on the over strip. */
function shortLabel(p: BallPayload): string {
  const r = p.runs ?? 0;
  if (p.wicket) {
    const base = p.wicket.type === "run_out" ? `RO${r ? r : ""}` : "W";
    return p.extra === "wide" ? `Wd+${base}` : p.extra === "noball" ? `Nb+${base}` : base;
  }
  switch (p.extra) {
    case "wide": return r ? `Wd+${r}` : "Wd";
    case "noball": return r ? `Nb+${r}` : "Nb";
    case "bye": return `B${r}`;
    case "legbye": return `Lb${r}`;
    default: return String(r);
  }
}

const KINDS = [["", "Normal"], ["wide", "Wide"], ["noball", "No ball"], ["bye", "Bye"], ["legbye", "Leg-bye"]] as const;

function EditBall({ m, innIdx, eventId, add, close, back }: { m: MatchState; innIdx: number; eventId: string; add: Add; close: () => void; back: () => void }) {
  const inn = m.innings[innIdx]!;
  const rec = inn.balls.find((b) => b.eventId === eventId)!;
  const [extra, setExtra] = useState<string>("");
  const [runs, setRuns] = useState("0");
  const [wk, setWk] = useState<string>("");
  const [out, setOut] = useState("");
  const [fielder, setFielder] = useState("");
  const [reason, setReason] = useState("");
  const side = Object.values(m.players).filter((p) => p.side === inn.bowling && !m.gone[p.id]).map((p) => p.id);
  const bat = Object.values(m.players).filter((p) => p.side === inn.batting).map((p) => p.id);
  const r = Number(runs);
  const bad = !Number.isInteger(r) || r < 0 || r > 12 ? "Runs must be from 0 to 12." : null;
  const patch: BallPayload = {
    runs: r, extra: (extra || null) as BallPayload["extra"],
    wicket: wk ? { type: wk as BallDismissal, out: wk === "run_out" ? out || m.innings[innIdx]!.balls.find((b) => b.eventId === eventId)?.striker || null : null, fielder: fielder || null } : null,
  };
  const needsF = wk === "caught" || wk === "stumped" || wk === "run_out";
  const was: BallPayload = { runs: rec.runs, extra: rec.extra, wicket: rec.wicketType && rec.wicketType !== "retired_out" ? { type: rec.wicketType, out: rec.out, fielder: rec.fielder } : null };
  const newTeam = r + (extra === "wide" ? m.rules.wideRuns : extra === "noball" ? m.rules.noBallRuns : 0);
  const diff = newTeam - rec.teamRuns;
  const ready = !bad && !(needsF && !fielder);
  const wasL = shortLabel(was);
  const nowL = shortLabel(patch);
  return (
    <PsSheet title="Edit this ball" onClose={close}
      foot={<>
        <MainButton ready={ready} label={`Save the edit: ${wasL} becomes ${nowL}`} missing={bad ? "Fix the runs to continue" : "Pick the fielder to continue"}
          onClick={() => { if (add([{ type: "edit", payload: { target: eventId, patch } }], { reason })) close(); }} />
        <CancelButton onClick={back}>Back to the ball list</CancelButton>
      </>}>
      <div className="ps-ballcard">
        <span className="ball" style={{ flex: "0 0 auto" }}>{rec.label}</span>
        <p>{rec.text}</p>
      </div>
      <p className="ps-note" style={{ marginTop: 0 }}>Set the ball again as it should have been:</p>
      <PsHeading>Kind of ball</PsHeading>
      <Group label="Kind of ball" cols={3}>
        {KINDS.map(([v, t]) => <Pick key={v} on={extra === v} onClick={() => setExtra(v)}>{t}</Pick>)}
      </Group>
      <PsHeading>Runs</PsHeading>
      <Group label="Quick runs" cols={4}>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => <Pick key={n} on={runs === String(n)} onClick={() => setRuns(String(n))}>{n}</Pick>)}
      </Group>
      <label className="ps-lb" htmlFor="eb-r">Runs (off the bat, byes, or extra runs run)</label>
      <input id="eb-r" className={`ps-field${bad ? " bad" : ""}`} inputMode="numeric" value={runs} onChange={(e) => setRuns(e.target.value)} />
      <Err text={bad} />
      <PsHeading>Wicket</PsHeading>
      <Group label="Wicket" cols={3}>
        <Pick on={wk === ""} onClick={() => { setWk(""); setFielder(""); }}>No wicket</Pick>
        {DISMISSALS.filter((d) => d.value !== "retired_out").map((d) => <Pick key={d.value} tone="red" on={wk === d.value} onClick={() => setWk(d.value)}>{d.label}</Pick>)}
      </Group>
      {wk === "run_out" && (
        <>
          <PsHeading>Batter out</PsHeading>
          <PlayerPicker m={m} ids={bat} value={out} onChange={setOut} group="Batter out" none={{ label: "The striker" }} />
        </>
      )}
      {needsF && (
        <>
          <PsHeading>Fielder (required)</PsHeading>
          <PlayerPicker m={m} ids={side} value={fielder} onChange={setFielder} group="Fielder (required)" bad={!fielder} />
          {!fielder && <Err text="Pick the fielder." />}
        </>
      )}
      <Reason value={reason} onChange={setReason} />
      <Readback tone="gold"><b>Was {wasL} · will be {nowL}.</b> {describeBall(was, m.rules)} becomes {describeBall(patch, m.rules).toLowerCase()}. {diff === 0 ? "The team score does not change." : `The team score changes by ${diff > 0 ? "+" : ""}${diff}.`}</Readback>
    </PsSheet>
  );
}

/* ---------- the guide ---------- */
const GUIDE = [
  ["Tap a number", "0 to 6 records the ball in one tap. Odd runs change the strike by themselves, and the over ends after six balls."],
  ["Wide, no ball, wicket, run out", "These four open a short panel for the details. A wide or no ball is not counted as a ball and is bowled again. After a no ball, the next ball is a free hit."],
  ["Undo is always there", "UNDO takes back the last thing you did, and tells you what it undid. You can undo several times."],
  ["More has everything else", "Byes, leg-byes, penalty runs, changing the bowler, overs or players, a late player, a guest, and ending the innings are all under More."],
  ["No signal? Keep going", "Every ball is saved on your phone first and sent when the connection is back. The bar at the top says how many are waiting."],
] as const;

export function GuideSheet({ close }: { close: () => void }) {
  const [i, setI] = useState(0);
  const [t, body] = GUIDE[i]!;
  return (
    <PsSheet title={`How to score (${i + 1} of ${GUIDE.length})`} onClose={close}
      foot={<>
        {i < GUIDE.length - 1 ? <MainButton ready plain label="Next" missing="" onClick={() => setI(i + 1)} /> : <MainButton ready plain label="Start scoring" missing="" onClick={close} />}
        <CancelButton onClick={close}>Skip the guide</CancelButton>
      </>}>
      <div className="ps-dots" aria-hidden="true">{GUIDE.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
      <b className="ps-guide-t">{t}</b>
      <p className="ps-guide-p">{body}</p>
      <p className="ps-note">You can open this guide again with the ? button.</p>
    </PsSheet>
  );
}

export function ScorecardSheet({ m, close }: { m: MatchState; close: () => void }) {
  return (
    <PsSheet title="Full scorecard" onClose={close}>
      <Scorecard m={m} />
    </PsSheet>
  );
}
