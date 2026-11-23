"use client";
// Phase 5: the panels that slide up over the scoring pad (wicket, run out, more, change bowler and so on).
import { useState } from "react";
import { bowlerAllowance, describeBall, effectiveTarget, oversText, selectableBatters, selectableBowlers } from "@/lib/engine/engine";
import { type BallDismissal, type BallPayload, type InningsState, type MatchState, type RetireKind, type ScoreEventBody, type Side } from "@/lib/engine/types";
import { DISMISSALS, parsePattern, type BowlerLimit } from "@/lib/matchRules";
import { initials } from "@/lib/validation";
import { Scorecard } from "@/components/Live";

/** `then`: follow-up events (such as the next batter) that are added right after, only if the engine still accepts them. */
export type Add = (bodies: ScoreEventBody[], opts?: { reason?: string; then?: ScoreEventBody[] }) => boolean;
type Common = { m: MatchState; inn: InningsState; add: Add; close: () => void };

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-bg" aria-label="Close this panel" onClick={onClose} />
      <div className="sheet">
        <div className="grab" aria-hidden="true" />
        <div className="row space" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: "1.1rem" }}>{title}</h2>
          <button className="chip" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const nm = (m: MatchState, id: string | null | undefined) => (id ? m.players[id]?.name ?? "Player" : "—");
const label = (m: MatchState, id: string) => {
  const p = m.players[id];
  return p ? `${p.name}${p.number !== null ? ` (${p.number})` : p.kind === "guest" ? " (guest)" : ""}` : "Player";
};
const Err = ({ text }: { text?: string | null }) => (text ? <p className="err" role="alert">{text}</p> : null);

function Reason({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <label className="lb" htmlFor="reason">Reason (optional)</label>
      <input id="reason" className="field" value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} placeholder="For the match timeline" />
    </>
  );
}

function PlayerSelect({ id, labelText, m, ids, value, onChange, empty }: { id: string; labelText: string; m: MatchState; ids: string[]; value: string; onChange: (v: string) => void; empty?: string }) {
  return (
    <>
      <label className="lb" htmlFor={id}>{labelText}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {empty !== undefined && <option value="">{empty}</option>}
        {ids.map((p) => <option key={p} value={p}>{label(m, p)}</option>)}
      </select>
    </>
  );
}

const fielders = (m: MatchState, inn: InningsState) => Object.values(m.players).filter((p) => p.side === inn.bowling && !m.gone[p.id]).map((p) => p.id);
const batSide = (m: MatchState, inn: InningsState) => Object.values(m.players).filter((p) => p.side === inn.batting && !m.gone[p.id]).map((p) => p.id);

/* ---------- chips ---------- */
export function Chip({ on, onClick, children, disabled, bad, gone, red, label }: { on?: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; bad?: boolean; gone?: boolean; red?: boolean; label?: string }) {
  return (
    <button type="button" aria-label={label} className={`cb${bad ? " bad" : ""}${gone ? " gone" : ""}${red ? " red" : ""}`} aria-pressed={!!on} disabled={disabled} onClick={onClick}>{children}</button>
  );
}

/** Wide, no ball and byes are two taps: arm the button, then tap the runs (see the pad). */
export function ByeSheet({ add, close }: Common) {
  return (
    <Sheet title="Byes and leg-byes" onClose={close}>
      <b>Byes</b>
      <div className="two" style={{ margin: "8px 0 14px" }}>{[1, 2, 3, 4].map((n) => <button key={n} className="btn ghost" onClick={() => add([{ type: "ball", payload: { extra: "bye", runs: n } }]) && close()}>{n} bye{n === 1 ? "" : "s"}</button>)}</div>
      <b>Leg-byes</b>
      <div className="two" style={{ margin: "8px 0 0" }}>{[1, 2, 3, 4].map((n) => <button key={n} className="btn ghost" onClick={() => add([{ type: "ball", payload: { extra: "legbye", runs: n } }]) && close()}>{n} leg-bye{n === 1 ? "" : "s"}</button>)}</div>
    </Sheet>
  );
}

/* ---------- out (wicket and run out share one sheet) ---------- */
const OUT_TYPES: { value: BallDismissal | "retired_out"; label: string }[] = [
  { value: "bowled", label: "Bowled" }, { value: "caught", label: "Caught" }, { value: "lbw", label: "LBW" },
  { value: "run_out", label: "Run Out" }, { value: "stumped", label: "Stumped" }, { value: "hit_wicket", label: "Hit Wicket" },
  { value: "retired_out", label: "Retired out" },
];

/** Who can come in next: every player of the batting side, with those out or at the crease faded and crossed. */
function BatterChips({ m, inn, value, onPick }: { m: MatchState; inn: InningsState; value: string; onPick: (id: string) => void }) {
  const can = new Map(selectableBatters(m, inn).map((c) => [c.player.id, c.returning]));
  const side = Object.values(m.players).filter((p) => p.side === inn.batting && !m.gone[p.id]);
  return (
    <div className="chips" role="group" aria-label="Next batter">
      {side.map((p) => {
        const ok = can.has(p.id);
        const line = inn.batters[p.id];
        const out = line?.status === "out";
        return (
          <Chip key={p.id} on={value === p.id} disabled={!ok} gone={out} onClick={() => onPick(p.id)}>
            {p.name}{can.get(p.id) ? " (returning)" : ""}{p.id === inn.striker || p.id === inn.nonStriker ? " · batting" : out ? " · out" : ""}
          </Chip>
        );
      })}
    </div>
  );
}

export function OutSheet({ m, inn, add, close, preset }: Common & { preset?: "run_out" }) {
  const [type, setType] = useState<string | null>(preset ?? null);
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
  const why = (v: string): string | null => {
    if (!m.rules.dismissals.includes(v)) return "Switched off for this match";
    if (inn.freeHit && v !== "run_out" && v !== "retired_out") return "Free hit: only Run Out";
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
  return (
    <Sheet title="How out?" onClose={close}>
      <div className="out-grid">
        {OUT_TYPES.filter((t) => t.value !== "retired_out" || m.rules.dismissals.includes("retired_out")).map((t) => {
          const blocked = why(t.value);
          return (
            <div key={t.value}>
              <button type="button" className={`cb red`} style={{ width: "100%", justifyContent: "center" }} aria-pressed={type === t.value} disabled={!!blocked} onClick={() => { setType(t.value); setFielder(""); }}>{t.label}</button>
              {blocked && <small className="muted" style={{ display: "block", textAlign: "center" }}>{blocked}</small>}
            </div>
          );
        })}
      </div>
      {inn.freeHit && <p className="muted small" style={{ margin: "8px 0 0" }}>Free hit: only a run out is possible on this ball.</p>}

      {type === "run_out" && (
        <>
          <b style={{ display: "block", marginTop: 14 }}>Who is out?</b>
          <div className="chips" role="group" aria-label="Who is out">
            {both.map((id) => <Chip key={id} on={out === id} onClick={() => setOut(id)}>{nm(m, id)}{id === inn.striker ? " (striker)" : " (non-striker)"}</Chip>)}
          </div>
          <b style={{ display: "block", marginTop: 10 }}>Runs completed before the run out</b>
          <div className="chips" role="group" aria-label="Runs completed">
            {[0, 1, 2, 3, 4].map((n) => <Chip key={n} on={runs === n} onClick={() => setRuns(n)}>{n}</Chip>)}
          </div>
          <b style={{ display: "block", marginTop: 10 }}>Was it on a wide or a no ball?</b>
          <div className="chips" role="group" aria-label="Wide or no ball">
            {([["", "Normal ball"], ["wide", "Wide"], ["noball", "No ball"]] as const).map(([v, t]) => <Chip key={v} on={kind === v} onClick={() => setKind(v)}>{t}</Chip>)}
          </div>
        </>
      )}

      {needsFielder && (
        <>
          <b style={{ display: "block", marginTop: 14 }}>{fielderText}</b>
          <div className="chips" role="group" aria-label="Fielder">
            {fielders(m, inn).map((id) => <Chip key={id} on={fielder === id} onClick={() => setFielder(id)}>{nm(m, id)}</Chip>)}
          </div>
          {tried && !fielder && <p className="err" role="alert">Pick the fielder.</p>}
        </>
      )}

      {type && candidates.length > 0 && (
        <>
          <b style={{ display: "block", marginTop: 14 }}>Next batter</b>
          <BatterChips m={m} inn={inn} value={next} onPick={setNext} />
          <div className="chips"><Chip on={next === "later"} onClick={() => setNext("later")}>Choose later</Chip></div>
          {type === "run_out" && next && next !== "later" && both.length === 2 && (
            <div className="chips" role="group" aria-label="Which end">
              <Chip on={end === ""} onClick={() => setEnd("")}>Suggested end</Chip>
              <Chip on={end === "striker"} onClick={() => setEnd("striker")}>Striker&rsquo;s end</Chip>
              <Chip on={end === "nonStriker"} onClick={() => setEnd("nonStriker")}>Non-striker&rsquo;s end</Chip>
            </div>
          )}
          {tried && !next && <p className="err" role="alert">Pick the next batter to continue.</p>}
        </>
      )}
      {payload && <p className="muted small" style={{ margin: "10px 0 0" }}>{describeBall(payload, m.rules)}. A run out is not the bowler&rsquo;s wicket.</p>}
      {tried && !type && <p className="err" role="alert">Choose how the batter is out.</p>}
      <button className="btn red" style={{ marginTop: 14, background: "var(--red)", color: "#fff", borderColor: "var(--red)" }} onClick={confirm}>Confirm OUT</button>
    </Sheet>
  );
}

/* ---------- people: next batter and bowler ---------- */
export function BatterSheet({ m, inn, add, close }: Common) {
  const free = inn.vacant ?? (inn.striker ? "nonStriker" : "striker");
  const [pick, setPick] = useState("");
  const [end, setEnd] = useState<"striker" | "nonStriker">(free);
  const stay = inn.striker ?? inn.nonStriker;
  return (
    <Sheet title="Next batter" onClose={close}>
      <p className="muted small" style={{ margin: "0 0 4px" }}>Anyone who is free can come in, not only the next in the order. Players who are out are crossed out.</p>
      <BatterChips m={m} inn={inn} value={pick} onPick={setPick} />
      {stay && (
        <>
          <b style={{ display: "block", marginTop: 10 }}>Takes the</b>
          <div className="chips" role="group" aria-label="Which end">
            <Chip on={end === "striker"} onClick={() => setEnd("striker")}>Striker&rsquo;s end</Chip>
            <Chip on={end === "nonStriker"} onClick={() => setEnd("nonStriker")}>Non-striker&rsquo;s end</Chip>
          </div>
        </>
      )}
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!pick} onClick={() => add([{ type: "batter_in", payload: { player: pick, end } }]) && close()}>Confirm</button>
    </Sheet>
  );
}

export function BowlerSheet({ m, inn, add, close, title }: Common & { title: string }) {
  const options = selectableBowlers(m, inn);
  const [msg, setMsg] = useState<string | null>(null);
  const mid = !inn.needBowler && inn.legalBalls % m.rules.ballsPerOver !== 0;
  const l = m.limit;
  const rule = [l.mode === "none" ? "No bowler limit" : l.mode === "max" ? `Maximum ${l.overs} over${l.overs === 1 ? "" : "s"} each` : `Pattern ${l.pattern.join("-")}`, m.rules.sameBowlerTwoInARow ? null : "no two overs in a row"].filter(Boolean).join(" · ");
  const anyOk = options.some((o) => o.ok && !(inn.bowler === o.player.id && !inn.needBowler));
  return (
    <Sheet title={title} onClose={close}>
      <p className="muted small" style={{ margin: "0 0 8px" }}>{rule}{mid ? ". This changes the bowler in the middle of an over; balls already bowled stay with the first bowler." : ""}</p>
      {!anyOk && <div className="banner red" role="alert" style={{ marginBottom: 8 }}>No bowler is allowed under the limit right now. The limit is locked; change it from More, then Change bowler limit.</div>}
      <div className="stack" style={{ gap: 8 }}>
        {options.map(({ player, ok, reason }) => {
          const b = inn.bowlers[player.id];
          const left = bowlerAllowance(m, inn, player.id);
          const now = inn.bowler === player.id && !inn.needBowler;
          const pill = now ? ["grey", "BOWLING NOW"] : !ok ? (reason?.includes("last over") ? ["orange", "BOWLED LAST OVER"] : ["red", "FINISHED OVERS"]) : left !== null ? ["green", `${left} LEFT`] : null;
          const usable = ok && !now;
          return (
            <button key={player.id} type="button" className="brow" aria-disabled={!usable} style={usable ? undefined : { opacity: 0.5 }}
              onClick={() => { if (!usable) { setMsg(now ? "That bowler is already bowling." : `${reason} Pick another bowler.`); return; } if (add([{ type: "bowler", payload: { player: player.id } }])) close(); }}>
              <span className="avatar" aria-hidden="true">{initials(player.name)}</span>
              <span className="grow"><b>{player.name}</b><small className="muted" style={{ display: "block" }}>{b ? `${oversText(b.legalBalls, m.rules.ballsPerOver)} ov · ${b.runs} runs · ${b.wickets} wkts` : "not bowled yet"}</small></span>
              {pill && <span className={`pill ${pill[0]}`}>{pill[1]}</span>}
            </button>
          );
        })}
      </div>
      {msg && <p className="err" role="alert">{msg}</p>}
    </Sheet>
  );
}

/* ---------- changes during play ---------- */
export function PenaltySheet({ add, close }: Common) {
  const [n, setN] = useState("5");
  const [reason, setReason] = useState("");
  const v = Number(n);
  const bad = !Number.isInteger(v) || v < 1 || v > 20;
  return (
    <Sheet title="Penalty runs" onClose={close}>
      <label className="lb" htmlFor="pen" style={{ marginTop: 0 }}>Runs added to the batting side (1 to 20)</label>
      <input id="pen" className="field" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
      <Err text={bad ? "Type a whole number from 1 to 20." : null} />
      <Reason value={reason} onChange={setReason} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={bad} onClick={() => add([{ type: "penalty", payload: { runs: v } }], { reason }) && close()}>Add penalty runs</button>
    </Sheet>
  );
}

export function RetireSheet({ m, inn, add, close }: Common) {
  const sides: Side[] = [1, 2];
  const [player, setPlayer] = useState(inn.striker ?? "");
  const [kind, setKind] = useState<RetireKind>("retired_hurt");
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const all = Object.values(m.players).filter((p) => !m.gone[p.id]).map((p) => p.id);
  const mate = player ? Object.values(m.players).filter((p) => p.side === m.players[player]?.side && p.id !== player && !m.gone[p.id]).map((p) => p.id) : [];
  return (
    <Sheet title="Retire a player" onClose={close}>
      <PlayerSelect id="rt-p" labelText="Player" m={m} ids={all} value={player} onChange={setPlayer} />
      <label className="lb" htmlFor="rt-k">What happened?</label>
      <select id="rt-k" className="field" value={kind} onChange={(e) => setKind(e.target.value as RetireKind)}>
        <option value="retired_hurt">Retired hurt (can come back later)</option>
        <option value="retired_out">Retired out (counts as a wicket)</option>
        <option value="absent">Absent (not playing any more)</option>
        <option value="replaced">Replaced by someone else</option>
      </select>
      {kind === "replaced" && <PlayerSelect id="rt-b" labelText="Replaced by (optional)" m={m} ids={mate} value={by} onChange={setBy} empty="Nobody yet" />}
      <p className="muted small" style={{ margin: "8px 0 0" }}>Retired hurt and retired out are for a batter at the crease. Absent and replaced are for anyone not batting or bowling right now. {sides.length ? "" : ""}</p>
      <Reason value={reason} onChange={setReason} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!player} onClick={() => add([{ type: "retire", payload: { player, kind, replacedBy: kind === "replaced" ? by || null : null } }], { reason }) && close()}>Confirm</button>
    </Sheet>
  );
}

export function OversSheet({ m, inn, add, close }: Common) {
  const bpo = m.rules.ballsPerOver;
  const [overs, setOvers] = useState(String(inn.maxOvers));
  const [scope, setScope] = useState<"innings" | "remaining">("innings");
  const [reason, setReason] = useState("");
  const v = Number(overs);
  const min = Math.ceil(inn.legalBalls / bpo);
  const bad = !Number.isInteger(v) || v < Math.max(1, min) || v > 50 ? `Overs must be a whole number from ${Math.max(1, min)} to 50. ${oversText(inn.legalBalls, bpo)} overs are already bowled.` : null;
  return (
    <Sheet title="Change the overs" onClose={close}>
      <p className="muted small" style={{ margin: "0 0 8px" }}>Overs already bowled are kept. The target stays where it is{effectiveTarget(inn) !== null ? " (you can enter a revised target from More)" : ""}.</p>
      <label className="lb" htmlFor="ov-n" style={{ marginTop: 0 }}>New overs per innings</label>
      <input id="ov-n" className="field" inputMode="numeric" value={overs} onChange={(e) => setOvers(e.target.value)} />
      <Err text={bad} />
      <div className="row wrap" style={{ margin: "10px 0" }}>
        <button className={`chip${scope === "innings" ? " gold" : ""}`} aria-pressed={scope === "innings"} onClick={() => setScope("innings")}>This innings only</button>
        <button className={`chip${scope === "remaining" ? " gold" : ""}`} aria-pressed={scope === "remaining"} onClick={() => setScope("remaining")}>All remaining innings</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>If the bowler limit is a pattern, check it still adds up (More, then Change bowler limit).</p>
      <Reason value={reason} onChange={setReason} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!!bad} onClick={() => add([{ type: "overs_change", payload: { overs: v, scope } }], { reason }) && close()}>Change overs</button>
    </Sheet>
  );
}

export function PlayersSheet({ m, add, close }: Common) {
  const [n, setN] = useState(String(m.playersPerSide));
  const [reason, setReason] = useState("");
  const v = Number(n);
  const bad = !Number.isInteger(v) || v < 2 || v > 11 ? "Players per side must be a whole number from 2 to 11." : null;
  return (
    <Sheet title="Players per side" onClose={close}>
      <label className="lb" htmlFor="pp" style={{ marginTop: 0 }}>Players per side (now {m.playersPerSide})</label>
      <input id="pp" className="field" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
      <Err text={bad} />
      <p className="muted small" style={{ margin: "8px 0 0" }}>This decides when an innings ends: with the last batter allowed to bat alone, every player must be out.</p>
      <Reason value={reason} onChange={setReason} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!!bad} onClick={() => add([{ type: "players_change", payload: { playersPerSide: v } }], { reason }) && close()}>Save</button>
    </Sheet>
  );
}

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
  return (
    <Sheet title="Change the bowler limit" onClose={close}>
      <p className="muted small" style={{ margin: "0 0 8px" }}>The limit is locked on the bowling screen. This is the only way to change it, and it is written on the match timeline.</p>
      {([["none", "No limit"], ["max", "Maximum overs per bowler"], ["pattern", "Pattern, for example 2-1-1"]] as const).map(([v, t]) => (
        <label key={v} className="check" style={{ margin: "8px 0" }}><input type="radio" name="limit" checked={mode === v} onChange={() => setMode(v)} /><span>{t}</span></label>
      ))}
      {mode === "max" && <input className="field" inputMode="numeric" aria-label="Maximum overs" value={max} onChange={(e) => setMax(e.target.value)} placeholder="2" />}
      {mode === "pattern" && <input className="field" aria-label="Over pattern" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="2-1-1" />}
      <Err text={err} />
      <Reason value={reason} onChange={setReason} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!!err || !limit} onClick={() => limit && add([{ type: "limit_change", payload: { limit } }], { reason }) && close()}>Change limit</button>
    </Sheet>
  );
}

export function LateSheet({ m, add, close, members, newId }: Common & { members: { userId: string; name: string; number: number | null }[]; newId: () => string }) {
  const [tab, setTab] = useState<"member" | "guest">(members.length ? "member" : "guest");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [side, setSide] = useState<Side>(1);
  const guestErr = tab === "guest" && !name.trim() ? "Type the guest's name." : null;
  return (
    <Sheet title="Add a late player" onClose={close}>
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <button className={`chip${tab === "member" ? " gold" : ""}`} onClick={() => setTab("member")}>A community member</button>
        <button className={`chip${tab === "guest" ? " gold" : ""}`} onClick={() => setTab("guest")}>A guest (name only)</button>
      </div>
      {tab === "member" ? (
        <>
          <label className="lb" htmlFor="lt-m" style={{ marginTop: 0 }}>Member</label>
          <select id="lt-m" className="field" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Choose a member</option>
            {members.map((p) => <option key={p.userId} value={p.userId}>{p.name} ({p.number ?? "–"})</option>)}
          </select>
          {members.length === 0 && <p className="muted small">Everyone in the community is already in this match.</p>}
        </>
      ) : (
        <>
          <label className="lb" htmlFor="lt-g" style={{ marginTop: 0 }}>Guest&rsquo;s name</label>
          <input id="lt-g" className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <Err text={guestErr && name.length ? guestErr : null} />
        </>
      )}
      <div className="row wrap" style={{ margin: "12px 0" }}>
        <span className="muted small">Joins</span>
        {([1, 2] as Side[]).map((s) => <button key={s} className={`chip${side === s ? " gold" : ""}`} aria-pressed={side === s} onClick={() => setSide(s)}>{m.sides[s - 1]}</button>)}
      </div>
      <p className="muted small" style={{ margin: 0 }}>They can be chosen as the next batter straight away. A guest has no player number. If a side is full, raise players per side first.</p>
      <button className="btn gold" style={{ marginTop: 12 }}
        disabled={tab === "member" ? !userId : !!guestErr}
        onClick={() => {
          const mem = members.find((x) => x.userId === userId);
          const player = tab === "member" && mem
            ? { id: newId(), side, name: mem.name, number: mem.number, kind: "member" as const, userId: mem.userId }
            : { id: newId(), side, name: name.trim(), number: null, kind: "guest" as const, userId: null };
          if (add([{ type: "player_added", payload: { player } }])) close();
        }}>Add to {m.sides[side - 1]}</button>
    </Sheet>
  );
}

export function CreaseSheet({ m, inn, add, close }: Common) {
  const ids = batSide(m, inn).filter((id) => !inn.batters[id] || inn.batters[id]!.status === "batting");
  const [s, setS] = useState(inn.striker ?? "");
  const [n, setN] = useState(inn.nonStriker ?? "");
  return (
    <Sheet title="Correct the batters" onClose={close}>
      <p className="muted small" style={{ margin: "0 0 8px" }}>Use this if the wrong batters were chosen. A batter who has already faced a ball cannot be swapped out: use Retire instead.</p>
      <PlayerSelect id="cr-s" labelText="Striker" m={m} ids={ids} value={s} onChange={setS} />
      <PlayerSelect id="cr-n" labelText="Non-striker" m={m} ids={ids} value={n} onChange={setN} empty={m.rules.lastBatterAlone ? "Nobody (batting alone)" : undefined} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!s || s === n} onClick={() => add([{ type: "set_crease", payload: { striker: s, nonStriker: n || null } }]) && close()}>Save</button>
    </Sheet>
  );
}

export function OrderSheet({ m, inn, add, close }: Common) {
  const options = selectableBatters(m, inn).map((c) => c.player.id);
  const [a, setA] = useState(inn.battingOrderHint[0] ?? "");
  const [b, setB] = useState(inn.battingOrderHint[1] ?? "");
  const [c3, setC] = useState(inn.battingOrderHint[2] ?? "");
  const order = [a, b, c3].filter(Boolean);
  const dup = new Set(order).size !== order.length;
  return (
    <Sheet title="Batting order" onClose={close}>
      <p className="muted small" style={{ margin: "0 0 8px" }}>Choose who comes in next. This is only a suggestion: when a wicket falls you can still pick anyone. A late player can be declared as the next batter here.</p>
      <PlayerSelect id="bo-a" labelText="Next" m={m} ids={options} value={a} onChange={setA} empty="No preference" />
      <PlayerSelect id="bo-b" labelText="After that" m={m} ids={options} value={b} onChange={setB} empty="No preference" />
      <PlayerSelect id="bo-c" labelText="Then" m={m} ids={options} value={c3} onChange={setC} empty="No preference" />
      <Err text={dup ? "Each person can be listed once." : null} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={dup} onClick={() => add([{ type: "batting_order", payload: { order } }]) && close()}>Save order</button>
    </Sheet>
  );
}

export function SubSheet({ m, add, close }: Common) {
  const [side, setSide] = useState<Side>(2);
  const [name, setName] = useState("");
  return (
    <Sheet title="Substitute fielder" onClose={close}>
      <label className="lb" htmlFor="sb-n" style={{ marginTop: 0 }}>Substitute&rsquo;s name</label>
      <input id="sb-n" className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <div className="row wrap" style={{ margin: "12px 0" }}>
        <span className="muted small">Fielding for</span>
        {([1, 2] as Side[]).map((s) => <button key={s} className={`chip${side === s ? " gold" : ""}`} aria-pressed={side === s} onClick={() => setSide(s)}>{m.sides[s - 1]}</button>)}
      </div>
      <p className="muted small" style={{ margin: 0 }}>A substitute fielder gets no batting or bowling credit. It is only noted on the timeline.</p>
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={() => add([{ type: "substitute", payload: { side, name: name.trim() } }]) && close()}>Note the substitute</button>
    </Sheet>
  );
}

export function TargetSheet({ inn, add, close }: Common) {
  const [t, setT] = useState(inn.manualTarget !== null ? String(inn.manualTarget) : "");
  const v = Number(t);
  const bad = t !== "" && (!Number.isInteger(v) || v < 1 || v > 999) ? "Type a whole number from 1 to 999." : null;
  return (
    <Sheet title="Revised target" onClose={close}>
      <p className="muted small" style={{ margin: "0 0 8px" }}>The target normally stays where it is, even when overs are cut. Enter a revised target only if you have agreed one. Leave empty to go back to the original ({inn.target ?? "none"}).</p>
      <input className="field" inputMode="numeric" aria-label="Revised target" value={t} onChange={(e) => setT(e.target.value)} placeholder={String(inn.target ?? "")} />
      <Err text={bad} />
      <button className="btn gold" style={{ marginTop: 12 }} disabled={!!bad} onClick={() => add([{ type: "target_manual", payload: { target: t === "" ? null : v } }]) && close()}>Save target</button>
    </Sheet>
  );
}

export function EndInningsSheet({ m, inn, add, close }: Common) {
  const [reason, setReason] = useState("");
  return (
    <Sheet title="End the innings now?" onClose={close}>
      <p style={{ margin: "0 0 8px" }}>{m.sides[inn.batting - 1]} finish on <b>{inn.runs}/{inn.wickets}</b>. This is a declaration or an early finish; it can be undone straight afterwards.</p>
      <Reason value={reason} onChange={setReason} />
      <button className="btn red" style={{ marginTop: 12 }} onClick={() => add([{ type: "innings_end", payload: {} }], { reason }) && close()}>Yes, end the innings</button>
    </Sheet>
  );
}

export function EndMatchSheet({ m, add, close }: Common) {
  const [reason, setReason] = useState("");
  return (
    <Sheet title="End the match early" onClose={close}>
      <p className="muted small" style={{ margin: "0 0 10px" }}>This finishes the match and locks it. It cannot be undone here. Abandoned matches are not counted as a win, a loss or an appearance.</p>
      <Reason value={reason} onChange={setReason} />
      <div className="stack" style={{ marginTop: 12 }}>
        <button className="btn red" onClick={() => add([{ type: "match_end", payload: { kind: "abandoned" } }], { reason }) && close()}>Abandon the match</button>
        <button className="btn ghost" onClick={() => add([{ type: "match_end", payload: { kind: "result", winner: 1 } }], { reason }) && close()}>Result: {m.sides[0]} won</button>
        <button className="btn ghost" onClick={() => add([{ type: "match_end", payload: { kind: "result", winner: 2 } }], { reason }) && close()}>Result: {m.sides[1]} won</button>
        <button className="btn ghost" onClick={() => add([{ type: "match_end", payload: { kind: "result", winner: null } }], { reason }) && close()}>No result</button>
      </div>
    </Sheet>
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
    <Sheet title="Edit an earlier ball" onClose={close}>
      {m.innings.length > 1 && (
        <div className="row wrap" style={{ marginBottom: 8 }}>
          {m.innings.map((i) => <button key={i.index} className={`chip${innIdx === i.index ? " gold" : ""}`} onClick={() => setInnIdx(i.index)}>{i.superOver ? "Super over" : `Innings ${i.index + 1}`}</button>)}
        </div>
      )}
      <p className="muted small" style={{ margin: "0 0 8px" }}>Tap a ball to change it. Everything after it is worked out again, and the change is written on the timeline. An edit that would break the balls after it is refused.</p>
      <div className="stack" style={{ maxHeight: "50dvh", overflowY: "auto" }}>
        {(chosen?.balls ?? []).slice().reverse().map((b) => (
          <button key={b.eventId} className="btn ghost" style={{ justifyContent: "flex-start", textAlign: "left", minHeight: 48 }} onClick={() => setPick(b.eventId)}>
            <span className="ball" style={{ flex: "0 0 auto" }}>{b.label}</span> <small>{b.text}</small>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

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
  return (
    <Sheet title="Edit this ball" onClose={close}>
      <p className="small" style={{ margin: "0 0 8px" }}>{rec.text}</p>
      <p className="muted small" style={{ margin: "0 0 8px" }}>Set the ball again as it should have been:</p>
      <label className="lb" htmlFor="eb-x" style={{ marginTop: 0 }}>Kind of ball</label>
      <select id="eb-x" className="field" value={extra} onChange={(e) => setExtra(e.target.value)}>
        <option value="">Normal ball</option><option value="wide">Wide</option><option value="noball">No ball</option><option value="bye">Bye</option><option value="legbye">Leg-bye</option>
      </select>
      <label className="lb" htmlFor="eb-r">Runs (off the bat, byes, or extra runs run)</label>
      <input id="eb-r" className="field" inputMode="numeric" value={runs} onChange={(e) => setRuns(e.target.value)} />
      <Err text={bad} />
      <label className="lb" htmlFor="eb-w">Wicket</label>
      <select id="eb-w" className="field" value={wk} onChange={(e) => setWk(e.target.value)}>
        <option value="">No wicket</option>
        {DISMISSALS.filter((d) => d.value !== "retired_out").map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
      {wk === "run_out" && <PlayerSelect id="eb-o" labelText="Batter out" m={m} ids={bat} value={out} onChange={setOut} empty="The striker" />}
      {(wk === "caught" || wk === "stumped" || wk === "run_out") && <PlayerSelect id="eb-f" labelText="Fielder (required)" m={m} ids={side} value={fielder} onChange={setFielder} empty="Choose a fielder" />}
      <Reason value={reason} onChange={setReason} />
      <div className="two" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={back}>Back</button>
        <button className="btn gold" disabled={!!bad || ((wk === "caught" || wk === "stumped" || wk === "run_out") && !fielder)} onClick={() => add([{ type: "edit", payload: { target: eventId, patch } }], { reason }) && close()}>Save the edit</button>
      </div>
    </Sheet>
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
    <Sheet title={`How to score (${i + 1} of ${GUIDE.length})`} onClose={close}>
      <b style={{ fontSize: "1.05rem" }}>{t}</b>
      <p style={{ margin: "8px 0 14px", lineHeight: 1.5 }}>{body}</p>
      <div className="two">
        <button className="btn ghost" onClick={close}>Skip the guide</button>
        {i < GUIDE.length - 1 ? <button className="btn gold" onClick={() => setI(i + 1)}>Next</button> : <button className="btn gold" onClick={close}>Start scoring</button>}
      </div>
      <p className="muted small" style={{ margin: "10px 0 0" }}>You can open this guide again with the ? button.</p>
    </Sheet>
  );
}

export function ScorecardSheet({ m, close }: { m: MatchState; close: () => void }) {
  return (
    <Sheet title="Full scorecard" onClose={close}>
      <div style={{ maxHeight: "70dvh", overflowY: "auto" }}><Scorecard m={m} /></div>
    </Sheet>
  );
}
