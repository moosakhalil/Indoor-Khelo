"use client";
// A new match with no signal: two match-only team names, players picked from the roster kept on this phone, overs, and go.
// Everything is saved on the phone first. The match is created on the server when the signal returns.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/PadSheets";
import { OVERS_PRESETS, PLAYERS_DEFAULT, PLAYERS_MAX, PLAYERS_MIN } from "@/lib/matchRules";
import { readRoster, saveNewMatch, saveRoster, sendNewMatch, type NewMatchItem } from "@/lib/outbox";
import { validateQuickMatch, type QuickPlayer, type Roster } from "@/lib/quickMatchRules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOk = (s: string) => UUID.test(s);
type Side = 0 | 1 | 2;
const clip: React.CSSProperties = { maxWidth: "9ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "bottom" };
const Err = ({ text }: { text?: string }) => (text ? <p className="err" role="alert">{text}</p> : null);

export default function QuickMatchForm({ communityId, fallback }: { communityId: string; fallback: Omit<Roster, "savedAt"> | null }) {
  const router = useRouter();
  const [roster, setRoster] = useState<Roster | null>(fallback ? { ...fallback, savedAt: Date.now() } : null);
  const [nameA, setNameA] = useState("Team 1");
  const [nameB, setNameB] = useState("Team 2");
  const [preset, setPreset] = useState("6");
  const [custom, setCustom] = useState("");
  const [pps, setPps] = useState(String(PLAYERS_DEFAULT));
  const [assign, setAssign] = useState<Record<string, Side>>({});
  const [guests, setGuests] = useState<{ id: string; name: string; side: 1 | 2 }[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestErr, setGuestErr] = useState<string | null>(null);
  const [squad, setSquad] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

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
  const count = (s: 1 | 2) => Object.values(assign).filter((v) => v === s).length + guests.filter((g) => g.side === s).length;
  const names: [string, string] = [nameA.trim() || "Team 1", nameB.trim() || "Team 2"];
  const members = useMemo(() => roster?.members ?? [], [roster]);

  const setSide = (id: string, side: Side) => setAssign((a) => ({ ...a, [id]: side }));
  const addSquad = (side: 1 | 2) => {
    const t = roster?.teams.find((x) => x.id === squad);
    if (!t) return;
    setAssign((a) => {
      const next = { ...a };
      let room = (Number.isInteger(ppsN) ? ppsN : PLAYERS_DEFAULT) - (Object.values(next).filter((v) => v === side).length + guests.filter((g) => g.side === side).length);
      for (const uid of t.squad) {
        if (room <= 0) break;
        if (members.some((m) => m.id === uid) && !next[uid]) { next[uid] = side; room--; }
      }
      return next;
    });
  };
  const addGuest = (side: 1 | 2) => {
    const n = guestName.trim();
    if (!n) { setGuestErr("Type the guest's name."); return; }
    if (n.length > 60) { setGuestErr("A guest name can be at most 60 characters."); return; }
    if (guests.some((g) => g.name.toLowerCase() === n.toLowerCase())) { setGuestErr("A guest with that name is already added."); return; }
    setGuests((g) => [...g, { id: crypto.randomUUID(), name: n, side }]);
    setGuestName(""); setGuestErr(null);
  };

  async function start() {
    const matchId = crypto.randomUUID();
    const players: QuickPlayer[] = [
      ...members.filter((m) => assign[m.id] === 1 || assign[m.id] === 2).map((m) => ({ id: crypto.randomUUID(), side: assign[m.id] as 1 | 2, userId: m.id, guestName: null })),
      ...guests.map((g) => ({ id: g.id, side: g.side, userId: null, guestName: g.name })),
    ];
    const wire = {
      id: matchId,
      sides: [{ id: crypto.randomUUID(), name: nameA }, { id: crypto.randomUUID(), name: nameB }],
      overs: Number(oversText), playersPerSide: Number(pps), players,
    };
    // The same checks the server makes. Nothing is saved until they pass.
    const v = validateQuickMatch(wire, uuidOk);
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors({}); setBusy(true);
    const nameOf: NewMatchItem["names"] = {};
    for (const p of players) {
      const m = p.userId ? members.find((x) => x.id === p.userId) : null;
      nameOf[p.id] = { name: p.userId ? m?.name ?? "Player" : p.guestName!, number: m?.number ?? null };
    }
    const item: NewMatchItem = { id: matchId, communityId, createdAt: Date.now(), status: "pending", reason: null, match: { ...wire, sides: v.value.sides, players: v.value.players } as NewMatchItem["match"], names: nameOf };
    if (!(await saveNewMatch(item))) {
      setErrors({ general: "This phone could not save the match. Free some space and try again." });
      setBusy(false);
      return;
    }
    void sendNewMatch(item).then(async (r) => {
      if (r.kind === "created" || r.kind === "duplicate") await saveNewMatch({ ...item, status: "synced" });
      else if (r.kind === "refused") await saveNewMatch({ ...item, status: "refused", reason: r.message });
    });
    router.push(`/c/${communityId}/matches/quick/score?m=${matchId}`);
  }

  return (
    <div className="stack">
      <div className="banner mute">
        This works with no signal. The match is saved on this phone and created on the server when you are back online.
        {roster ? ` Players last updated ${new Date(roster.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.` : ""}
      </div>
      {!roster && <div className="banner red" role="alert">No players are saved on this phone yet. Open Home once while you have signal, then try again.</div>}
      <Err text={errors.general} />

      <section className="card">
        <b>Teams (for this match only)</b>
        <label className="lb" htmlFor="q-a">Team 1</label>
        <input id="q-a" className={`field${errors.sideA ? " bad" : ""}`} value={nameA} onChange={(e) => setNameA(e.target.value)} maxLength={40} autoComplete="off" />
        <Err text={errors.sideA} />
        <label className="lb" htmlFor="q-b">Team 2</label>
        <input id="q-b" className={`field${errors.sideB ? " bad" : ""}`} value={nameB} onChange={(e) => setNameB(e.target.value)} maxLength={40} autoComplete="off" />
        <Err text={errors.sideB} />
      </section>

      <section className="card">
        <label className="lb" htmlFor="q-overs" style={{ marginTop: 0 }}>Overs per innings</label>
        <div className="two">
          <select id="q-overs" className={`field${errors.overs ? " bad" : ""}`} value={preset} onChange={(e) => setPreset(e.target.value)}>
            {OVERS_PRESETS.map((o) => <option key={o} value={o}>{o} overs</option>)}<option value="custom">Custom</option>
          </select>
          <input className="field" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom overs" aria-label="Custom overs, used only when Custom is chosen" maxLength={2} />
        </div>
        <Err text={errors.overs} />
        <label className="lb" htmlFor="q-pps">Players per side ({PLAYERS_MIN} to {PLAYERS_MAX})</label>
        <input id="q-pps" className={`field${errors.playersPerSide ? " bad" : ""}`} inputMode="numeric" value={pps} onChange={(e) => setPps(e.target.value)} maxLength={2} />
        <Err text={errors.playersPerSide} />
        <p className="muted small" style={{ margin: "8px 0 0" }}>The traditional rules are used. You can change overs and players during the match.</p>
      </section>

      <section className="card">
        <b>Pick the players</b>
        <p className="muted small" style={{ margin: "4px 0 8px" }}>{names[0]}: {count(1)} of {Number.isInteger(ppsN) ? ppsN : "?"} · {names[1]}: {count(2)} of {Number.isInteger(ppsN) ? ppsN : "?"}</p>
        {(roster?.teams.length ?? 0) > 0 && (
          <div className="row wrap" style={{ marginBottom: 8 }}>
            <select className="field" style={{ flex: 1, minHeight: 44 }} value={squad} onChange={(e) => setSquad(e.target.value)} aria-label="Fill a side from a team's squad">
              <option value="">Fill from a team squad…</option>
              {roster!.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" className="chip" disabled={!squad} onClick={() => addSquad(1)}>to {names[0]}</button>
            <button type="button" className="chip" disabled={!squad} onClick={() => addSquad(2)}>to {names[1]}</button>
          </div>
        )}
        <div className="list">
          {members.map((m) => (
            <div key={m.id} className="item" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <span className="t grow" style={{ minWidth: 110 }}><b>{m.name}</b><small>{m.number !== null ? `#${m.number}` : "no number"}</small></span>
              <span className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label={`${m.name}: which side`}>
                {([[0, "Out"], [1, names[0]], [2, names[1]]] as [Side, string][]).map(([v, label]) => (
                  <Chip key={v} on={(assign[m.id] ?? 0) === v} onClick={() => setSide(m.id, v)} label={v === 0 ? `${m.name}: not playing` : `${m.name}: ${label}`}><span style={clip}>{label}</span></Chip>
                ))}
              </span>
            </div>
          ))}
          {members.length === 0 && <div className="item muted">No players saved on this phone yet.</div>}
        </div>
        <Err text={errors.players_1} />
        <Err text={errors.players_2} />
        <Err text={errors.players} />
      </section>

      <section className="card">
        <label className="lb" htmlFor="q-guest" style={{ marginTop: 0 }}>Add a guest (a name is enough)</label>
        <input id="q-guest" className="field" value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={60} autoComplete="off" placeholder="Guest's name" />
        <div className="two" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost small" style={{ width: "100%" }} onClick={() => addGuest(1)}>Add to {names[0]}</button>
          <button type="button" className="btn ghost small" style={{ width: "100%" }} onClick={() => addGuest(2)}>Add to {names[1]}</button>
        </div>
        <Err text={guestErr ?? undefined} />
        {guests.length > 0 && (
          <div className="list" style={{ marginTop: 8 }}>
            {guests.map((g) => (
              <div key={g.id} className="item space"><span><b>{g.name}</b> <small className="muted">guest · {names[g.side - 1]}</small></span>
                <button type="button" className="chip" onClick={() => setGuests((x) => x.filter((y) => y.id !== g.id))}>Remove</button></div>
            ))}
          </div>
        )}
      </section>

      <button className="btn gold" disabled={busy || !roster} onClick={() => void start()}>{busy ? "Saving…" : "Start scoring"}</button>
    </div>
  );
}
