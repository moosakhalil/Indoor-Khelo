"use client";
// A new match with no signal: two match-only team names, players picked from the roster kept on this phone, overs, and go.
// Everything is saved on the phone first. The match is created on the server when the signal returns.
// UI redesign (Phase C4): same fields, same rules and the same saving as before. Only the layout and the live hints are new.
import "./qm.css";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconCheck, IconInfo, IconSearch, IconSignalOff, IconUser, IconUsers, IconWarn } from "@/components/B4Icons";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import TeamBadge from "@/components/TeamBadge";
import { GUEST_NAME_MAX, OVERS_PRESETS, PLAYERS_DEFAULT, PLAYERS_MAX, PLAYERS_MIN, SIDE_NAME_MAX } from "@/lib/matchRules";
import { readRoster, saveNewMatch, saveRoster, sendNewMatch, type NewMatchItem } from "@/lib/outbox";
import { meterPercent, meterState, rosterAgeDays, isStaleRoster } from "@/lib/quickMatchUi";
import { validateQuickMatch, type QuickPlayer, type Roster } from "@/lib/quickMatchRules";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOk = (s: string) => UUID.test(s);
const fakeId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Side = 0 | 1 | 2;
type Guest = { id: string; name: string; side: 1 | 2 };

const Err = ({ text }: { text?: string }) => (text ? <p className="qm-err" role="alert"><IconWarn size={16} /><span>{text}</span></p> : null);

/** The snackbar is in the root layout. If a screen is ever shown without it, Remove still works, it just has no Undo. */
function useOptionalSnackbar() {
  try { return useSnackbar(); } catch { return null; }
}

function Meter({ name, n, max, compact }: { name: string; n: number; max: number | null; compact?: boolean }) {
  const state = meterState(n, max);
  const over = max !== null && n > max;
  return (
    <div className={`qm-meter ${state}${compact ? " compact" : ""}`} role="img" aria-label={`${name}: ${n} of ${max ?? "?"} players${state === "full" ? ", full" : over ? ", too many" : ""}`}>
      <div className="qm-meter-top" aria-hidden="true">
        <span className="qm-ico"><TeamBadge name={name} size="sm" /></span>
        <b className="qm-meter-name">{name}</b>
        {state === "full" && <span className="qm-tag ok"><IconCheck size={14} />Full</span>}
        {over && <span className="qm-tag bad"><IconWarn size={14} />Over by {n - (max as number)}</span>}
        <span className="qm-meter-n">{n} / {max ?? "?"}</span>
      </div>
      <div className="qm-meter-bar" aria-hidden="true"><i style={{ width: `${meterPercent(n, max)}%` }} /></div>
    </div>
  );
}

export default function QuickMatchForm({ communityId, fallback }: { communityId: string; fallback: Omit<Roster, "savedAt"> | null }) {
  const router = useRouter();
  const snack = useOptionalSnackbar();
  const [roster, setRoster] = useState<Roster | null>(fallback ? { ...fallback, savedAt: Date.now() } : null);
  const [nameA, setNameA] = useState("Team 1");
  const [nameB, setNameB] = useState("Team 2");
  const [preset, setPreset] = useState("6");
  const [custom, setCustom] = useState("");
  const [pps, setPps] = useState(String(PLAYERS_DEFAULT));
  const [assign, setAssign] = useState<Record<string, Side>>({});
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestErr, setGuestErr] = useState<string | null>(null);
  const [chooser, setChooser] = useState<string | null>(null);     // a squad waiting for "which side?"
  const [squadMsg, setSquadMsg] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [submitted, setSubmitted] = useState(false);               // after the first press of Start scoring, problems are shown live
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);            // set after the first paint, so server and phone draw the same first screen

  useEffect(() => { setNow(Date.now()); }, []);

  // Prefer what this phone already kept; if the page came from the server and nothing was kept yet, keep it now.
  useEffect(() => {
    let alive = true;
    void readRoster(communityId).then((r) => {
      if (!alive) return;
      if (r) setRoster(r);
      else if (fallback) void saveRoster({ ...fallback, savedAt: Date.now() });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const oversText = preset === "custom" ? custom : preset;
  const ppsN = Number(pps);
  const ppsOk = pps.trim() !== "" && Number.isInteger(ppsN) && ppsN >= PLAYERS_MIN && ppsN <= PLAYERS_MAX;
  const max: number | null = ppsOk ? ppsN : null;
  const count = (s: 1 | 2) => Object.values(assign).filter((v) => v === s).length + guests.filter((g) => g.side === s).length;
  const names: [string, string] = [nameA.trim() || "Team 1", nameB.trim() || "Team 2"];
  const members = useMemo(() => roster?.members ?? [], [roster]);

  /** What goes to the rules: the same shape as what is saved. `real` makes fresh ids (when saving); otherwise fixed ones (for live hints). */
  function wire(real: boolean) {
    let k = 100;
    const id = (): string => (real ? crypto.randomUUID() : fakeId(k++));
    const players: QuickPlayer[] = [
      ...members.filter((m) => assign[m.id] === 1 || assign[m.id] === 2).map((m) => ({ id: id(), side: assign[m.id] as 1 | 2, userId: m.id, guestName: null })),
      ...guests.map((g) => ({ id: g.id, side: g.side, userId: null, guestName: g.name })),
    ];
    return {
      id: real ? crypto.randomUUID() : fakeId(1),
      sides: [{ id: real ? crypto.randomUUID() : fakeId(2), name: nameA }, { id: real ? crypto.randomUUID() : fakeId(3), name: nameB }] as [{ id: string; name: string }, { id: string; name: string }],
      overs: Number(oversText), playersPerSide: Number(pps), players,
    };
  }

  const live = useMemo<Record<string, string>>(() => {
    const v = validateQuickMatch(wire(false), uuidOk);
    return v.ok ? {} : v.errors;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameA, nameB, oversText, pps, assign, guests, members]);

  // Problems are shown as soon as they can be seen (too many players, a name that is too long), and all of them once Start scoring was pressed.
  const tooLong = (s: string) => s.trim().length > SIDE_NAME_MAX;
  const sideErr = (key: "sideA" | "sideB", typed: string) => (submitted ? live[key] : tooLong(typed) ? `A team name can be at most ${SIDE_NAME_MAX} characters.` : undefined);
  const oversErr = submitted || custom.trim() !== "" ? live.overs : undefined;
  const ppsErr = submitted || pps.trim() !== "" ? live.playersPerSide : undefined;
  const lineErr = (s: 1 | 2) => (submitted || (max !== null && count(s) > max) ? live[`players_${s}`] : undefined);
  const problems = submitted ? Object.keys(live).length : 0;

  const setSide = (id: string, side: Side) => setAssign((a) => ({ ...a, [id]: side }));
  const stepPps = (d: 1 | -1) => setPps(String(Math.max(PLAYERS_MIN, Math.min(PLAYERS_MAX, (ppsOk ? ppsN : PLAYERS_DEFAULT) + d))));

  const addSquad = (teamId: string, side: 1 | 2) => {
    const t = roster?.teams.find((x) => x.id === teamId);
    setChooser(null);
    if (!t) return;
    const next = { ...assign };
    let room = (Number.isInteger(ppsN) ? ppsN : PLAYERS_DEFAULT) - count(side);
    let added = 0;
    for (const uid of t.squad) {
      if (room <= 0) break;
      if (members.some((m) => m.id === uid) && !next[uid]) { next[uid] = side; room--; added++; }
    }
    setAssign(next);
    setSquadMsg(added > 0
      ? `${t.name}: ${added} player${added === 1 ? "" : "s"} added to ${names[side - 1]}.${room <= 0 ? " The side is full." : ""}`
      : room <= 0 ? `${names[side - 1]} is already full.` : `${t.name}: nobody new to add (they are already picked, or not on this phone's list).`);
  };
  const tapSquad = (teamId: string, teamName: string) => {
    // a side with the same name as the squad's team gets it straight away; otherwise ask which side
    const lower = teamName.trim().toLowerCase();
    const hit = names.findIndex((n) => n.toLowerCase() === lower);
    if (hit >= 0) addSquad(teamId, (hit + 1) as 1 | 2);
    else setChooser((c) => (c === teamId ? null : teamId));
  };

  const addGuest = (side: 1 | 2) => {
    const n = guestName.trim();
    if (!n) { setGuestErr("Type the guest's name."); return; }
    if (n.length > GUEST_NAME_MAX) { setGuestErr(`A guest name can be at most ${GUEST_NAME_MAX} characters.`); return; }
    if (guests.some((g) => g.name.toLowerCase() === n.toLowerCase())) { setGuestErr("A guest with that name is already added."); return; }
    setGuests((g) => [...g, { id: crypto.randomUUID(), name: n, side }]);
    setGuestName(""); setGuestErr(null);
  };
  const removeGuest = (g: Guest, index: number) => {
    setGuests((x) => x.filter((y) => y.id !== g.id));
    snack?.undoable({
      message: `${g.name} removed.`,
      commit: () => undefined,                                    // nothing to finish: Remove only changes this screen
      onUndo: () => setGuests((x) => (x.some((y) => y.id === g.id || y.name.toLowerCase() === g.name.toLowerCase()) ? x : [...x.slice(0, index), g, ...x.slice(index)])),
    });
  };

  async function start() {
    const w = wire(true);
    const players = w.players;
    // The same checks the server makes. Nothing is saved until they pass.
    const v = validateQuickMatch(w, uuidOk);
    setSubmitted(true);
    if (!v.ok) { setSaveError(null); return; }
    setSaveError(null); setBusy(true);
    const nameOf: NewMatchItem["names"] = {};
    for (const p of players) {
      const m = p.userId ? members.find((x) => x.id === p.userId) : null;
      nameOf[p.id] = { name: p.userId ? m?.name ?? "Player" : p.guestName!, number: m?.number ?? null };
    }
    const item: NewMatchItem = { id: w.id, communityId, createdAt: Date.now(), status: "pending", reason: null, match: { ...w, sides: v.value.sides, players: v.value.players } as NewMatchItem["match"], names: nameOf };
    if (!(await saveNewMatch(item))) {
      setSaveError("This phone could not save the match.");
      setBusy(false);
      return;
    }
    void sendNewMatch(item).then(async (r) => {
      if (r.kind === "created" || r.kind === "duplicate") await saveNewMatch({ ...item, status: "synced" });
      else if (r.kind === "refused") await saveNewMatch({ ...item, status: "refused", reason: r.message });
    });
    router.push(`/c/${communityId}/matches/quick/score?m=${w.id}`);
  }

  const q = find.trim().toLowerCase();
  const shown = members.filter((m) => (!onlyPicked || (assign[m.id] ?? 0) !== 0) && (!q || m.name.toLowerCase().includes(q) || (m.number !== null && `#${m.number}`.includes(q.replace(/^#?/, "#")))));
  const stale = roster && now !== null && isStaleRoster(roster.savedAt, now);
  const guestLen = guestName.trim().length;
  const guestOver = guestLen > GUEST_NAME_MAX;
  const nameBox = (key: "sideA" | "sideB", id: string, label: string, value: string, set: (v: string) => void, fallbackName: string) => {
    const err = sideErr(key, value);
    const len = value.trim().length;
    return (
      <>
        <label className="lb" htmlFor={id}>{label}</label>
        <div className={`qm-namebox${err ? " bad" : ""}`}>
          <span className="qm-ico" aria-hidden="true"><TeamBadge name={value.trim() || fallbackName} size="sm" /></span>
          <input id={id} className="qm-bare" value={value} onChange={(e) => set(e.target.value)} autoComplete="off" aria-invalid={!!err} />
          <span className={`qm-count${len > SIDE_NAME_MAX ? " bad" : ""}`} aria-hidden="true">{len}/{SIDE_NAME_MAX}</span>
        </div>
        <Err text={err} />
      </>
    );
  };

  const startNote = !roster ? "Start scoring stays off until the players are saved on this phone." : "Saved on this phone first. It is created on the server when you are back online.";

  return (
    <div className="qm-layout">
      <div className="qm-main">
        <div className="qm-note" role="note">
          <span className="qm-note-ico"><IconSignalOff size={20} /></span>
          <div>
            <b>Works with no signal</b>
            <p>The match is saved on this phone and created on the server when you are back online.{now !== null && roster ? ` Players last updated ${new Date(roster.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.` : ""}</p>
          </div>
        </div>
        {!roster && (
          <div className="qm-alert" role="alert">
            <span className="qm-note-ico"><IconWarn size={20} /></span>
            <div><b>No players are saved on this phone yet.</b><p>Open Home once while you have signal, then try again.</p></div>
          </div>
        )}
        {stale && roster && now !== null && (
          <div className="qm-stale" role="status">
            <span className="qm-note-ico"><IconInfo size={20} /></span>
            <div><b>Players saved {rosterAgeDays(roster.savedAt, now)} days ago</b><p>New members since then will be missing. Open Home with signal to refresh.</p></div>
          </div>
        )}

        <section className="qm-sec" aria-labelledby="qm-h1">
          <h2 id="qm-h1"><i>1</i>Teams for this match only</h2>
          {nameBox("sideA", "q-a", "Team 1", nameA, setNameA, "Team 1")}
          {nameBox("sideB", "q-b", "Team 2", nameB, setNameB, "Team 2")}
        </section>

        <section className="qm-sec" aria-labelledby="qm-h2">
          <h2 id="qm-h2"><i>2</i>Format</h2>
          <span className="lb" id="q-overs-l">Overs per innings</span>
          <div className="qm-overs" role="group" aria-labelledby="q-overs-l">
            {OVERS_PRESETS.map((o) => (
              <button key={o} type="button" className="qm-round" aria-pressed={preset === String(o)} aria-label={`${o} overs`} onClick={() => setPreset(String(o))}>{o}</button>
            ))}
            <button type="button" className="qm-round wide" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>Custom</button>
          </div>
          {preset === "custom" && (
            <input className={`field qm-custom${oversErr ? " bad" : ""}`} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Number of overs" aria-label="Custom overs" maxLength={2} aria-invalid={!!oversErr} />
          )}
          <Err text={oversErr} />
          <label className="lb" htmlFor="q-pps">Players per side ({PLAYERS_MIN} to {PLAYERS_MAX})</label>
          <div className="qm-step">
            <button type="button" className="qm-stepbtn" aria-label="Fewer players per side" onClick={() => stepPps(-1)} disabled={ppsOk && ppsN <= PLAYERS_MIN}>−</button>
            <input id="q-pps" className={`field qm-stepin${ppsErr ? " bad" : ""}`} inputMode="numeric" value={pps} onChange={(e) => setPps(e.target.value)} maxLength={2} aria-invalid={!!ppsErr} />
            <button type="button" className="qm-stepbtn" aria-label="More players per side" onClick={() => stepPps(1)} disabled={ppsOk && ppsN >= PLAYERS_MAX}>+</button>
            <span className="muted small">players</span>
          </div>
          <Err text={ppsErr} />
          <p className="muted small qm-hint">The traditional rules are used. You can change overs and players during the match.</p>
        </section>

        <section className="qm-sec" aria-labelledby="qm-h3">
          <h2 id="qm-h3"><i>3</i>Pick the players</h2>
          <div className="qm-meters">
            <Meter name={names[0]} n={count(1)} max={max} />
            <Meter name={names[1]} n={count(2)} max={max} />
          </div>
          <Err text={lineErr(1)} />
          <Err text={lineErr(2)} />
          {(roster?.teams.length ?? 0) > 0 && (
            <div className="qm-squads">
              <span className="qm-squads-h"><IconUsers size={16} />Fill from a squad:</span>
              <div className="qm-chips">
                {roster!.teams.map((t) => (
                  <button key={t.id} type="button" className="qm-chip" aria-pressed={chooser === t.id} onClick={() => tapSquad(t.id, t.name)}>{t.name}</button>
                ))}
              </div>
              {chooser && (() => {
                const t = roster!.teams.find((x) => x.id === chooser);
                return t ? (
                  <div className="qm-choose" role="group" aria-label={`Which side gets ${t.name}`}>
                    <span className="small">Add {t.name} to:</span>
                    <button type="button" className="btn ghost small" onClick={() => addSquad(t.id, 1)}>{names[0]}</button>
                    <button type="button" className="btn ghost small" onClick={() => addSquad(t.id, 2)}>{names[1]}</button>
                    <button type="button" className="btn ghost small" onClick={() => setChooser(null)}>Cancel</button>
                  </div>
                ) : null;
              })()}
              {squadMsg && <p className="muted small qm-squadmsg" role="status">{squadMsg}</p>}
            </div>
          )}
          {members.length > 6 && (
            <div className="qm-find">
              <div className="qm-search">
                <IconSearch size={18} />
                <input type="search" className="field" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a player" aria-label="Find a player" autoComplete="off" />
              </div>
              <button type="button" className="qm-chip" aria-pressed={onlyPicked} onClick={() => setOnlyPicked((v) => !v)}>Picked only</button>
            </div>
          )}
          {members.length === 0 ? (
            <div className="qm-empty">
              <span className="qm-empty-ico"><IconSignalOff size={28} /></span>
              <b>No players saved on this phone yet.</b>
              <p>Open Home once while you have signal. You can still add guests below.</p>
            </div>
          ) : (
            <ul className="qm-players">
              {shown.map((m) => {
                const side = (assign[m.id] ?? 0) as Side;
                return (
                  <li key={m.id} className={`qm-player${side ? " on" : ""}`}>
                    <div className="qm-player-top">
                      <Shirt number={m.number} size="normal" />
                      <span className="t"><b>{m.name}</b><small className="muted">{labelOf(PLAYING_ROLES, m.role) || "Player"}</small></span>
                    </div>
                    <div className="qm-seg" role="group" aria-label={`${m.name}: which side`}>
                      <button type="button" className="qm-out" aria-pressed={side === 0} aria-label={`${m.name}: not playing`} onClick={() => setSide(m.id, 0)}>Out</button>
                      {([1, 2] as const).map((s) => (
                        <button key={s} type="button" className="qm-side" aria-pressed={side === s} aria-label={`${m.name}: ${names[s - 1]}`} title={names[s - 1]} onClick={() => setSide(m.id, s)}>
                          {side === s && <IconCheck size={16} />}<TeamBadge name={names[s - 1]} size="sm" />
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
              {shown.length === 0 && (
                <li className="qm-none">
                  <p className="muted small">{onlyPicked && !q ? "Nobody is picked yet." : "No player matches that."}</p>
                  <button type="button" className="qm-chip" onClick={() => { setFind(""); setOnlyPicked(false); }}>Show everyone</button>
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="qm-sec" aria-labelledby="qm-h4">
          <h2 id="qm-h4"><i>4</i>Guests</h2>
          <label className="lb" htmlFor="q-guest">Add a guest (a name is enough)</label>
          <div className={`qm-namebox${guestErr || guestOver ? " bad" : ""}`}>
            <span className="qm-ico muted" aria-hidden="true"><IconUser size={18} /></span>
            <input id="q-guest" className="qm-bare" value={guestName} onChange={(e) => { setGuestName(e.target.value); setGuestErr(null); }} autoComplete="off" placeholder="Guest's name" aria-invalid={!!(guestErr || guestOver)} />
            {guestLen > 0 && <span className={`qm-count${guestOver ? " bad" : ""}`} aria-hidden="true">{guestLen}/{GUEST_NAME_MAX}</span>}
          </div>
          <Err text={guestErr ?? (guestOver ? `A guest name can be at most ${GUEST_NAME_MAX} characters.` : undefined)} />
          <div className="two qm-guestbtns">
            <button type="button" className="btn ghost small" style={{ width: "100%" }} onClick={() => addGuest(1)}>Add to {names[0]}</button>
            <button type="button" className="btn ghost small" style={{ width: "100%" }} onClick={() => addGuest(2)}>Add to {names[1]}</button>
          </div>
          {guests.length > 0 && (
            <ul className="qm-guests">
              {guests.map((g, i) => (
                <li key={g.id} className="qm-guest">
                  <Shirt number={null} size="small" />
                  <span className="t grow"><b>{g.name}</b><small className="muted">guest · {names[g.side - 1]}</small></span>
                  <button type="button" className="chip" aria-label={`Remove ${g.name}`} onClick={() => removeGuest(g, i)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="qm-sum" aria-label="Match summary">
        <div className="qm-sum-card" aria-hidden="true">
          <span className="qm-sum-h">Match</span>
          <div className="qm-sum-vs"><TeamBadge name={names[0]} size="md" /><span>v</span><TeamBadge name={names[1]} size="md" /></div>
          <b className="qm-sum-names">{names[0]} v {names[1]}</b>
          <small className="muted">{oversText || "?"} overs · {max ?? "?"} a side</small>
          <Meter name={names[0]} n={count(1)} max={max} compact />
          <Meter name={names[1]} n={count(2)} max={max} compact />
        </div>
        {saveError && (
          <div className="qm-alert" role="alert">
            <span className="qm-note-ico"><IconWarn size={20} /></span>
            <div><b>{saveError}</b><p>Free some space and try again. Nothing was started.</p></div>
          </div>
        )}
        {problems > 0 && !saveError && <p className="qm-err" role="status"><IconWarn size={16} /><span>Fix the items marked above, then start.</span></p>}
        <button className="btn gold" disabled={busy || !roster} onClick={() => void start()}>{busy ? "Saving…" : "Start scoring"}</button>
        <p className="muted small qm-startnote">{startNote}</p>
      </aside>
    </div>
  );
}
