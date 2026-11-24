"use client";
// Pick lineups (Phase C3). Everything the person picks stays on this screen until "Save lineups": the quick tool, the
// three-way controls and the counters all work on the same draft, so nothing is lost and the limit shows before saving.
// Adding a guest is the one thing that saves straight away (a guest is a new person, not a change to the list).
import "./lu.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addGuestAction, fillInAction, setLineupAction } from "@/app/actions4";
import { addGuestC3, removeGuestC3, saveLineupC3 } from "@/app/actionsC3";
import ConfirmDialog from "@/components/ConfirmDialog";
import LuIcon from "@/components/LuIcons";
import { InPanel } from "@/components/LuPanel";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import TeamBadge from "@/components/TeamBadge";
import { GUEST_NAME_MAX } from "@/lib/matchRules";
import {
  type Draft, type Filter, type PickGuest, type PickMember, type PickSide, type Row,
  buildRows, changeCount, changesOf, countsOf, fillWithIn, groupMembers, guestKey, memberKey, overLimit, plural, replyCounts,
  sameGuestName, sideOfKey, withSide,
} from "@/lib/lineupPick";
import { noticeFor } from "@/lib/notices";

const BACK = "history:back"; // not a web address, so it can never clash with a link
type Tone = "ok" | "gold" | "red" | "info";
type Note = { tone: Tone; text: string; sub?: string; link?: { href: string; label: string }; icon?: "check" | "alert" | "lock" | "info" };
const toneOf = (t: "green" | "red" | "mute"): Tone => (t === "green" ? "ok" : t === "red" ? "red" : "info");

function NoteBox({ note, onClose }: { note: Note; onClose?: () => void }) {
  const icon = note.icon ?? (note.tone === "ok" ? "check" : note.tone === "red" ? "alert" : "info");
  return (
    <div className={`lu-note ${note.tone}`} role={note.tone === "red" ? "alert" : "status"}>
      <LuIcon name={icon} />
      <div className="grow">
        {note.text}
        {note.sub && <small>{note.sub}</small>}
        {note.link && <> <Link href={note.link.href} className="lu-link">{note.link.label}</Link></>}
      </div>
      {onClose && <button type="button" className="lu-x" aria-label="Dismiss this message" onClick={onClose}><LuIcon name="x" /></button>}
    </div>
  );
}

function Meter({ n, max }: { n: number; max: number }) {
  const over = n > max;
  const pct = Math.min(100, max > 0 ? Math.round((n / max) * 100) : 0);
  return <div className={`lu-meter${over ? " over" : ""}`} role="presentation"><i style={{ width: `${pct}%` }} /></div>;
}

/** Out / side 1 / side 2. Real radio buttons, so the keyboard and screen readers work. */
function Pick({ id, who, value, sides, onPick }: { id: string; who: string; value: PickSide; sides: [string, string]; onPick: (s: PickSide) => void }) {
  const opts: PickSide[] = [0, 1, 2];
  return (
    <div className="lu-seg" role="radiogroup" aria-label={`${who}: which side`}>
      {opts.map((v) => {
        const label = v === 0 ? `${who}: not playing` : `${who}: play for ${sides[v - 1]}`;
        return (
          <label key={v} className={`lu-opt s${v}${value === v ? " on" : ""}`}>
            <input type="radio" className="lu-sr" name={`side-${id}`} value={v} checked={value === v} aria-label={label} onChange={() => onPick(v)} />
            {value === v && <LuIcon name="check" size={16} />}
            {v === 0 ? <span>Out</span> : <><TeamBadge name={sides[v - 1]!} size="sm" /><span className="lu-tn">{sides[v - 1]}</span></>}
          </label>
        );
      })}
    </div>
  );
}

function Roster({ sides, max, counts, members, guests, rows, draft, unsaved, over, editHref, saving, variant }: {
  sides: [string, string]; max: number; counts: [number, number]; members: PickMember[]; guests: PickGuest[]; rows: Row[]; draft: Draft;
  unsaved: number; over: 0 | 1 | 2; editHref: string; saving: boolean; variant: "inline" | "panel";
}) {
  const on = (side: 1 | 2) => {
    const list: { key: string; name: string; number: number | null; guest: boolean }[] = [];
    for (const m of [...members].sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name))) {
      if (sideOfKey(rows, memberKey(m.id), draft) === side) list.push({ key: m.id, name: m.name, number: m.number, guest: false });
    }
    for (const g of guests) {
      if (g.userId && members.some((m) => m.id === g.userId)) continue; // already listed as that member
      if (sideOfKey(rows, guestKey(g.id), draft) === side) list.push({ key: `g${g.id}`, name: g.name, number: null, guest: true });
    }
    return list;
  };
  return (
    <section className={`card ${variant === "panel" ? "lu-roster-panel" : "lu-roster-inline"}`} aria-label="Lineups picked so far">
      <h2 style={{ fontSize: "1rem" }}>Lineups</h2>
      {([1, 2] as const).map((side) => {
        const list = on(side);
        const n = counts[side - 1];
        return (
          <div key={side} className="lu-roster-side">
            <div className="lu-side">
              <TeamBadge name={sides[side - 1]} size="sm" />
              <b>{sides[side - 1]}</b>
              <span className={`lu-count${n > max ? " over" : ""}`}>{n} / {max}</span>
              <Meter n={n} max={max} />
            </div>
            {list.length === 0 ? <p className="lu-empty">No players picked yet.</p> : (
              <ul className="lu-picked">
                {list.map((p) => (
                  <li key={p.key}>
                    <Shirt number={p.number} size="small" label={p.guest ? "Guest, no player number" : undefined} />
                    <span>{p.name}{p.guest && <small> (guest)</small>}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {variant === "panel" && over !== 0 && (
        <NoteBox note={{ tone: "red", text: noticeFor("too_many", { side: sides[over - 1], max: String(max) })!.text, link: { href: editHref, label: "Open Edit match" } }} />
      )}
      {variant === "panel" && unsaved > 0 && <NoteBox note={{ tone: "gold", text: `${unsaved} ${plural(unsaved, "change", "changes")} not saved yet.` }} />}
      <button type="submit" form="lu-form" className="btn gold" disabled={over !== 0 || saving}>{saving ? "Saving…" : "Save lineups"}</button>
      <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>A player can be on one side per match. The permanent squads are never changed by a lineup.</p>
    </section>
  );
}

export default function LineupPicker({ communityId, matchId, sides, max, members, guests, fixed, notice, editHref }: {
  communityId: string; matchId: string; sides: [string, string]; max: number;
  members: PickMember[]; guests: PickGuest[]; fixed: [number, number];
  /** A message the address carried (for example after an old link). */
  notice: { tone: "green" | "red" | "mute"; text: string } | null;
  editHref: string;
}) {
  const router = useRouter();
  const snack = useSnackbar();
  const [draft, setDraft] = useState<Draft>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [banner, setBanner] = useState<Note | null>(notice ? { tone: toneOf(notice.tone), text: notice.text } : null);
  const [saveErr, setSaveErr] = useState<Note | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestErr, setGuestErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  // A web address (a link inside the app) or BACK (the browser Back button).
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [adding, startAdd] = useTransition();

  const rows = useMemo(() => buildRows(members, guests), [members, guests]);
  const counts = countsOf(rows, draft, fixed);
  const unsaved = changeCount(rows, draft);
  const over = overLimit(counts, max);
  const reply = useMemo(() => replyCounts(members), [members]);
  const groups = useMemo(() => groupMembers(members, filter, q), [members, filter, q]);

  const pick = (key: string, side: PickSide) => { setDraft((d) => withSide(rows, d, key, side)); setSaveErr(null); };

  /* ---- unsaved changes: closing the tab, and leaving through any link of the app ---- */
  const dirty = useRef(false);
  const guardPushed = useRef(false);
  useEffect(() => {
    dirty.current = unsaved > 0 && !saving;
    // Browser Back: while there are unsaved changes, one extra history entry sits in front of this page, so Back lands on this same page
    // and the popstate handler below can ask first. The current history state is copied so Next.js still recognises the entry.
    if (dirty.current && !guardPushed.current) {
      guardPushed.current = true;
      try { window.history.pushState({ ...(window.history.state ?? {}), luGuard: true }, "", window.location.href); } catch { /* no history access: the tab-close and link guards still work */ }
    }
  }, [unsaved, saving]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    const onClick = (e: MouseEvent) => {
      if (!dirty.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    const onPop = () => {
      if (!dirty.current) return;
      // Back was pressed: stay on this page (put the guard entry back) and ask.
      try { window.history.pushState({ ...(window.history.state ?? {}), luGuard: true }, "", window.location.href); } catch { /* ignore */ }
      setLeaveTo(BACK);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", onPop); document.removeEventListener("click", onClick, true); };
  }, []);

  /* ---- quick tool: fills the list on screen, saves nothing ---- */
  const fill = (side: 1 | 2) => {
    const r = fillWithIn(members, rows, draft, side, max, fixed);
    setDraft(r.draft);
    setSaveErr(null);
    const n = noticeFor("filled", { n: String(r.added), skip: String(r.skipped) })!;
    if (r.skipped > 0) {
      setBanner({ tone: "gold", text: `Added ${r.added} ${plural(r.added, "player", "players")} who replied “I’m in”.`, sub: `${r.skipped} more did not fit: this side is full.`, icon: "info" });
    } else {
      setBanner(null);
      snack.show({ message: n.text, tone: r.added > 0 ? "success" : "info" });
    }
  };

  /* ---- guests ---- */
  const addGuest = (side: 1 | 2) => {
    const name = guestName.trim();
    if (!name || name.length > GUEST_NAME_MAX) { setGuestErr(noticeFor("guest_name")!.text); return; }
    if (guests.some((g) => sameGuestName(g.name, name))) { setGuestErr(noticeFor("duplicate_guest")!.text); return; }
    if (counts[side - 1]! >= max) { setGuestErr(noticeFor("too_many", { side: sides[side - 1], max: String(max) })!.text); return; }
    setGuestErr(null);
    startAdd(async () => {
      const r = await addGuestC3(communityId, matchId, side, name);
      if (r.ok) {
        setGuestName("");
        setSheet(false);
        setBanner(null);
        const entry = r.guestId;
        snack.undoable({
          message: noticeFor("guest_added")!.text,
          commit: () => {},
          onUndo: () => { if (entry) void removeGuestC3(communityId, matchId, entry).then(() => router.refresh()); },
        });
      } else if (r.field === "guest") setGuestErr(r.text);
      else { setSheet(false); setBanner({ tone: "red", text: r.text, icon: r.code === "locked" || r.code === "forbidden" ? "lock" : "alert", link: r.code === "too_many" ? { href: editHref, label: "Open Edit match" } : undefined }); }
    });
  };

  /* ---- save ---- */
  const changes = changesOf(rows, draft);
  const save = () => {
    if (over !== 0) return;
    startSave(async () => {
      const r = await saveLineupC3(communityId, matchId, Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, String(v)])));
      if (r && !r.ok) setSaveErr({ tone: "red", text: r.text, icon: r.code === "locked" || r.code === "forbidden" ? "lock" : "alert", link: r.code === "too_many" ? { href: editHref, label: "Open Edit match" } : undefined });
    });
  };

  const hidden = Object.entries(changes);
  const guestFieldLabel = "Add a guest (a name is enough)";
  const overNote: Note | null = over !== 0 ? { tone: "red", text: noticeFor("too_many", { side: sides[over - 1], max: String(max) })!.text, link: { href: editHref, label: "Open Edit match" } } : null;
  const none = groups.length === 0;

  return (
    <div className="stack">
      {banner && <NoteBox note={banner} onClose={() => setBanner(null)} />}
      {saveErr && <NoteBox note={saveErr} />}

      <section className="card" aria-label="Lineup counts">
        <span className="lu-h">Lineups</span>
        {([1, 2] as const).map((side) => (
          <div key={side} className="lu-side">
            <TeamBadge name={sides[side - 1]} size="sm" />
            <b>{sides[side - 1]}</b>
            <span className={`lu-count${counts[side - 1]! > max ? " over" : ""}`} aria-label={`${sides[side - 1]}: ${counts[side - 1]} of ${max}`}>{counts[side - 1]} / {max}</span>
            <Meter n={counts[side - 1]!} max={max} />
          </div>
        ))}
        <p className="muted small lu-explain">A player can be on one side per match. Replies only order the list: anyone can be picked, even someone who said “Can’t make it”.</p>
        {overNote && <div style={{ marginTop: 10 }}><NoteBox note={overNote} /></div>}
      </section>

      <section className="card">
        <h2 style={{ fontSize: "1rem" }}>Quick tools</h2>
        <div className="lu-tools" style={{ marginTop: 10 }}>
          {([1, 2] as const).map((side) => (
            <form key={side} action={fillInAction}>
              <input type="hidden" name="communityId" value={communityId} />
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="side" value={side} />
              <button type="submit" className="lu-tool" onClick={(e) => { e.preventDefault(); fill(side); }}>
                <LuIcon name="check" /><span>Add everyone who is in to {sides[side - 1]}</span>
              </button>
            </form>
          ))}
        </div>
        <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>These fill the list below. Nothing is saved until you press Save lineups.</p>

        <form action={addGuestAction} style={{ marginTop: 14 }} onSubmit={(e) => e.preventDefault()}>
          <input type="hidden" name="communityId" value={communityId} />
          <input type="hidden" name="matchId" value={matchId} />
          <label className="lb" htmlFor="lu-guest" style={{ marginTop: 0 }}>{guestFieldLabel}</label>
          <div className="lu-guestbox">
            <LuIcon name="userplus" />
            <input id="lu-guest" name="guestName" className={`field${guestName ? " typing" : ""}${guestErr ? " bad" : ""}`} maxLength={GUEST_NAME_MAX} autoComplete="off" placeholder="Guest’s name"
              value={guestName} aria-invalid={!!guestErr} aria-describedby={guestErr ? "lu-guest-err" : undefined}
              onChange={(e) => { setGuestName(e.target.value); setGuestErr(null); }} />
          </div>
          {guestErr && <p id="lu-guest-err" className="lu-err" role="alert"><LuIcon name="alert" size={16} /><span>{guestErr}</span></p>}
          <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>A guest has no account and no player number. Their figures stay on this match’s scorecard.</p>
          <div className="two" style={{ marginTop: 10 }}>
            {([1, 2] as const).map((side) => (
              <button key={side} type="submit" name="side" value={side} className="lu-addto" disabled={!guestName.trim() || adding} onClick={(e) => { e.preventDefault(); addGuest(side); }}>
                <span aria-hidden="true"><TeamBadge name={sides[side - 1]} size="sm" /></span><span>Add to {sides[side - 1]}</span>
              </button>
            ))}
          </div>
        </form>
      </section>

      <div className="lu-search">
        <LuIcon name="search" />
        <input type="search" className="field" placeholder="Search members" aria-label="Search members" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        {q && <button type="button" className="lu-clear" onClick={() => setQ("")} aria-label="Clear the search">Clear</button>}
      </div>
      <div className="lu-chips" role="group" aria-label="Show members by reply">
        {([["all", "All", reply.all], ["in", "In", reply.in], ["none", "No reply", reply.none], ["out", "Can’t make it", reply.out]] as const).map(([f, label, n]) => (
          <button key={f} type="button" className={`lu-chip${filter === f ? " on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "in" && <LuIcon name="check" size={16} />}{label} {n}
          </button>
        ))}
      </div>

      {none && <p className="lu-none">{members.length === 0 ? "No members yet." : "No members match."}</p>}
      {groups.map((g) => (
        <section key={g.id} className="lu-group" aria-label={g.title}>
          <h2 className="lu-h">{g.title}<span className="lu-n">{g.items.length}</span></h2>
          <ul className="lu-list">
            {g.items.map((m) => {
              const key = memberKey(m.id);
              return (
                <li key={m.id} className="lu-row">
                  <div className="lu-who">
                    <Shirt number={m.number} size="normal" />
                    <span className="lu-name"><b>{m.name}</b>{m.role && <small>{m.role}</small>}</span>
                    <span className={`lu-reply ${m.answer ?? "none"}`}>
                      {m.answer === "in" && <LuIcon name="check" size={14} />}{m.answer === "out" && <LuIcon name="x" size={14} />}
                      {m.answer === "in" ? "In" : m.answer === "out" ? "Can’t make it" : "No reply"}
                    </span>
                  </div>
                  <Pick id={key} who={m.name} value={sideOfKey(rows, key, draft)} sides={sides} onPick={(s) => pick(key, s)} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="lu-group" aria-label="Guests in this match">
        <div className="lu-guesthead">
          <h2 className="lu-h">Guests in this match<span className="lu-n">{guests.length}</span></h2>
          <button type="button" className="lu-addguest" onClick={() => { setGuestErr(null); setSheet(true); }}><LuIcon name="plus" size={16} />Add a guest</button>
        </div>
        {guests.length > 0 ? (
          <ul className="lu-list">
            {guests.map((g) => {
              const key = guestKey(g.id);
              return (
                <li key={g.id} className="lu-row">
                  <div className="lu-who">
                    <Shirt number={null} size="normal" label="Guest, no player number" />
                    <span className="lu-name"><b>{g.name}</b><small>{g.kind === "linked" ? `Guest, linked to a member${g.linkedBy ? ` by ${g.linkedBy}` : ""}` : "Guest, no player number"}</small></span>
                    <span className="lu-reply">Guest</span>
                  </div>
                  <Pick id={key} who={g.name} value={sideOfKey(rows, key, draft)} sides={sides} onPick={(s) => pick(key, s)} />
                </li>
              );
            })}
          </ul>
        ) : <p className="lu-none">No guests yet. A guest is someone without an account.</p>}
        <p className="muted small" style={{ margin: "0 2px" }}>A guest can be linked to a member from the match page; their figures then count toward that member.</p>
      </section>

      <Roster sides={sides} max={max} counts={counts} members={members} guests={guests} rows={rows} draft={draft} unsaved={unsaved} over={over} editHref={editHref} saving={saving} variant="inline" />
      <InPanel>
        <Roster sides={sides} max={max} counts={counts} members={members} guests={guests} rows={rows} draft={draft} unsaved={unsaved} over={over} editHref={editHref} saving={saving} variant="panel" />
      </InPanel>

      <div className="lu-bar">
        {unsaved > 0 && <NoteBox note={{ tone: "gold", text: `${unsaved} ${plural(unsaved, "change", "changes")} not saved yet.` }} />}
        <div className="lu-bar-row">
          <span className="lu-mini">
            <TeamBadge name={sides[0]} size="sm" /><span className={counts[0] > max ? "over" : ""}>{counts[0]}/{max}</span>
            <TeamBadge name={sides[1]} size="sm" /><span className={counts[1] > max ? "over" : ""}>{counts[1]}/{max}</span>
          </span>
          <button type="submit" form="lu-form" className="btn gold" disabled={over !== 0 || saving}>{saving ? "Saving…" : "Save lineups"}</button>
        </div>
      </div>

      <form id="lu-form" action={setLineupAction} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="matchId" value={matchId} />
        {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      </form>

      {sheet && (
        <GuestSheet sides={sides} max={max} counts={counts} name={guestName} setName={(v) => { setGuestName(v); setGuestErr(null); }} err={guestErr} busy={adding}
          onAdd={addGuest} onClose={() => { setSheet(false); setGuestErr(null); }} />
      )}

      <ConfirmDialog
        open={leaveTo !== null}
        title="Leave without saving?"
        body={`You have ${unsaved} ${plural(unsaved, "change", "changes")} that ${plural(unsaved, "is", "are")} not saved yet. If you leave now they are lost.`}
        confirmLabel={leaveTo === BACK ? "Leave" : "Discard and leave"}
        cancelLabel="Keep editing"
        danger
        onConfirm={() => { const to = leaveTo; dirty.current = false; setLeaveTo(null); if (to === BACK) window.history.go(-2); else if (to) router.push(to); }}
        onClose={() => setLeaveTo(null)}
      />
    </div>
  );
}

/** Bottom sheet on a phone, a centred box on a wider screen: the guest's name and the side. */
function GuestSheet({ sides, max, counts, name, setName, err, busy, onAdd, onClose }: {
  sides: [string, string]; max: number; counts: [number, number]; name: string; setName: (v: string) => void; err: string | null; busy: boolean;
  onAdd: (side: 1 | 2) => void; onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector("input")?.focus();
    return () => before?.focus?.();
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const f = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input") ?? []);
    if (!f.length) return;
    const first = f[0]!;
    const last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="lu-sheet-wrap" onKeyDown={onKey}>
      <div className="lu-sheet-bg" onClick={() => { if (!name.trim()) onClose(); }} aria-hidden="true" />
      <div className="lu-sheet" ref={box} role="dialog" aria-modal="true" aria-labelledby="lu-sheet-t">
        <span className="lu-grip" aria-hidden="true" />
        <div className="row space"><h2 id="lu-sheet-t">Add a guest</h2><button type="button" className="lu-x" aria-label="Close" onClick={onClose}><LuIcon name="x" /></button></div>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>A name is enough. A guest has no account and no player number. Their figures stay on this match’s scorecard. A guest is added straight away.</p>
        <label className="lb" htmlFor="lu-sheet-name" style={{ marginTop: 4 }}>Guest’s name</label>
        <div className="lu-guestbox">
          <LuIcon name="userplus" />
          <input id="lu-sheet-name" className={`field${name ? " typing" : ""}${err ? " bad" : ""}`} maxLength={GUEST_NAME_MAX} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)}
            aria-invalid={!!err} aria-describedby={err ? "lu-sheet-err" : undefined} style={{ paddingRight: 64 }} />
          <span className="lu-count-in" aria-hidden="true">{name.length}/{GUEST_NAME_MAX}</span>
        </div>
        {err && <p id="lu-sheet-err" className="lu-err" role="alert"><LuIcon name="alert" size={16} /><span>{err}</span></p>}
        <span className="lb" style={{ margin: "6px 0 0" }}>Which side?</span>
        {([1, 2] as const).map((side) => (
          <button key={side} type="button" className="lu-sidebtn" disabled={!name.trim() || busy} onClick={() => onAdd(side)} aria-label={`Add to ${sides[side - 1]}${counts[side - 1]! >= max ? " (side is full)" : ""}`}>
            <span aria-hidden="true"><TeamBadge name={sides[side - 1]} size="sm" /></span><span>{sides[side - 1]}</span><span className="muted small">{counts[side - 1]}/{max}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
