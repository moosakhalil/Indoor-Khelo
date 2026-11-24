"use client";
// Edit squad: tick the members who are in the team's permanent squad. Search, filters, select all, captain and vice-captain tags,
// the warning before saving, a change summary, a readiness tile and a Leave squad button on your own row.
// Saving sends exactly what the old page sent (one "member" value per ticked person) to the same server action.
import "./b4.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { setSquadAction } from "@/app/actions3";
import { IconCheck, IconSearch, IconWarn } from "@/components/B4Icons";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import { StepBar } from "@/components/TeamEditor";
import TeamBadge from "@/components/TeamBadge";
import { MIN_PLAYERS, squadChanges } from "@/lib/teamList";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

export type SquadPerson = { user_id: string; name: string; player_number: number | null; playing_role: string | null };

function SaveButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return <button className="btn gold" disabled={pending}>{pending ? "Saving…" : `Save squad (${count})`}</button>;
}

export default function SquadEditor({ communityId, teamId, teamName, captainId, viceId, members, initial, me, isNew, cancelHref }: {
  communityId: string; teamId: string; teamName: string; captainId: string | null; viceId: string | null;
  members: SquadPerson[]; initial: string[]; me: string; isNew: boolean; cancelHref: string;
}) {
  const snack = useSnackbar();
  const [picked, setPicked] = useState<string[]>(initial);
  const [view, setView] = useState<"all" | "in" | "out">("all");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const set = useMemo(() => new Set(picked), [picked]);
  const { added, removed } = squadChanges(initial, picked);
  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.name ?? "this player";

  const roles = useMemo(() => {
    const seen = new Set(members.map((m) => m.playing_role).filter((r): r is string => !!r));
    return PLAYING_ROLES.filter((r) => seen.has(r.value));
  }, [members]);

  const visible = members.filter((m) => {
    const s = query.trim().toLowerCase();
    if (s && !m.name.toLowerCase().includes(s)) return false;
    if (view === "in" && !set.has(m.user_id)) return false;
    if (view === "out" && set.has(m.user_id)) return false;
    if (role && m.playing_role !== role) return false;
    return true;
  });

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const selectAll = () => setPicked((p) => Array.from(new Set([...p, ...visible.map((m) => m.user_id)])));
  const clearVisible = () => { const drop = new Set(visible.map((m) => m.user_id)); setPicked((p) => p.filter((x) => !drop.has(x))); };

  const leave = () => {
    setPicked((p) => p.filter((x) => x !== me));
    const wasCaptain = me === captainId, wasVice = me === viceId;
    const roleNote = wasCaptain ? " You are no longer captain, because the captain role goes with the squad place." : wasVice ? " You are no longer vice-captain, because the role goes with the squad place." : "";
    snack.undoable({
      message: `You left the squad. Press Save squad to finish.${roleNote}`,
      commit: () => undefined,
      onUndo: () => setPicked((p) => (p.includes(me) ? p : [...p, me])),
    });
  };

  const lostCaptain = !!captainId && removed.includes(captainId);
  const lostVice = !!viceId && removed.includes(viceId);
  const ready = picked.length >= MIN_PLAYERS;
  const inCount = picked.length;

  return (
    <form action={setSquadAction} className="tm-squad">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="teamId" value={teamId} />
      {picked.map((id) => <input key={id} type="hidden" name="member" value={id} />)}

      <div className="tm-squad-main">
        {isNew && <StepBar step={2} total={2} title="Squad" />}
        {isNew && (
          <div className="banner green ml-banner" role="status"><IconCheck size={20} /><span><b>Team created.</b> Now choose its regular players.{captainId || viceId ? ` ${[captainId, viceId].filter(Boolean).map(nameOf).join(" and ")} ${captainId && viceId ? "are" : "is"} already in.` : ""}</span></div>
        )}
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>The permanent squad is the team&rsquo;s regular players. For each match you pick the actual lineup separately.</p>

        {(lostCaptain || lostVice) && (
          <div className="banner tm-orange" role="alert">
            <IconWarn size={20} />
            <span>
              {lostCaptain && <><b>{nameOf(captainId)} is the captain.</b> Taking the captain out of the squad also removes the captain role. </>}
              {lostVice && <><b>{nameOf(viceId)} is the vice-captain.</b> Taking the vice-captain out of the squad also removes that role. </>}
              You can pick a new one on the <Link href={`/c/${communityId}/teams/${teamId}/edit`} style={{ textDecoration: "underline" }}>edit team page</Link>.
            </span>
          </div>
        )}

        <div className="ml-search">
          <IconSearch />
          <input type="search" className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" aria-label="Search members" autoComplete="off" />
          {query && <button type="button" className="ml-clear" onClick={() => setQuery("")} aria-label="Clear what you typed">Clear</button>}
        </div>
        <div className="ml-chips" role="group" aria-label="Filter members">
          <button type="button" className={`ml-chip${view === "all" ? " on" : ""}`} aria-pressed={view === "all"} onClick={() => setView("all")}>All <span className="ml-n">{members.length}</span></button>
          <button type="button" className={`ml-chip${view === "in" ? " on" : ""}`} aria-pressed={view === "in"} onClick={() => setView("in")}>In squad <span className="ml-n">{inCount}</span></button>
          <button type="button" className={`ml-chip${view === "out" ? " on" : ""}`} aria-pressed={view === "out"} onClick={() => setView("out")}>Not in squad <span className="ml-n">{members.length - inCount}</span></button>
          {roles.map((r) => <button key={r.value} type="button" className={`ml-chip${role === r.value ? " on" : ""}`} aria-pressed={role === r.value} onClick={() => setRole(role === r.value ? "" : r.value)}>{r.label}</button>)}
        </div>

        <div className="row space tm-bulk">
          <small className="muted">{visible.length} member{visible.length === 1 ? "" : "s"}{query.trim() ? " match" : ""}</small>
          <span className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost small" onClick={selectAll}>Select all</button>
            <button type="button" className="btn ghost small" onClick={clearVisible}>Clear</button>
          </span>
        </div>

        {visible.length === 0 ? (
          <section className="ml-none" role="status">
            <span className="ml-empty-icon"><IconSearch size={26} /></span>
            <b>No member found</b>
            <p>No member fits the search or filters.</p>
            <button type="button" className="btn ghost small" onClick={() => { setQuery(""); setView("all"); setRole(""); }}>Show everyone</button>
          </section>
        ) : (
          <section className="card list tm-members" aria-label="Members">
            {visible.map((m) => {
              const on = set.has(m.user_id);
              const isCap = m.user_id === captainId, isVice = m.user_id === viceId, isMe = m.user_id === me;
              const roleName = labelOf(PLAYING_ROLES, m.playing_role);
              return (
                <div key={m.user_id} className={`item tm-member${on ? " on" : ""}`}>
                  <label className="tm-member-lab">
                    <input type="checkbox" checked={on} onChange={() => toggle(m.user_id)} aria-label={`${m.name}${isCap ? ", captain" : isVice ? ", vice-captain" : ""}`} style={{ width: 24, height: 24, accentColor: "var(--gold)" }} />
                    <Shirt number={m.player_number} size="small" />
                    <span className="t grow">
                      <b>{m.name}{isCap && <span className="tm-role" title="Captain">C</span>}{isVice && <span className="tm-role" title="Vice-captain">VC</span>}{isMe && <span className="tm-you">You</span>}</b>
                      <small>{[roleName, isCap ? "Captain: leaving the squad removes the role" : isVice ? "Vice-captain: leaving the squad removes the role" : null].filter(Boolean).join(" · ")}</small>
                    </span>
                    {on && <span className="tm-tick" aria-hidden="true">✓</span>}
                  </label>
                  {isMe && on && <button type="button" className="btn red small" onClick={leave}>Leave squad</button>}
                </div>
              );
            })}
          </section>
        )}
        <p className="muted small" style={{ margin: 0 }}>Taking the captain or vice-captain out of the squad also removes that role.</p>
      </div>

      <div className="tm-squad-aside">
        <section className="card tm-summary" aria-label="Team summary">
          <div className="row" style={{ gap: 12 }}>
            <TeamBadge name={teamName} size="md" />
            <span className="t grow"><b>{teamName}</b><small className="muted" style={{ display: "block" }}>{captainId ? `Captain ${nameOf(captainId)}` : "No captain yet"}{viceId ? ` · Vice ${nameOf(viceId)}` : ""}</small></span>
          </div>
          <div className="tm-tiles">
            <div className="statcell"><b>{inCount}</b><small className="muted">In squad</small></div>
            <div className={`statcell ${ready ? "tm-ready" : "tm-notready"}`}><b>{ready ? "Ready" : "Not yet"}</b><small className="muted">{ready ? "Can play a match" : `Needs ${MIN_PLAYERS}+ players`}</small></div>
          </div>
          {(added.length > 0 || removed.length > 0) && (
            <p className="tm-changes" role="status">
              {added.length > 0 && <span className="chip green">{added.length} added</span>}
              {removed.length > 0 && <span className="chip red">{removed.length} removed</span>}
            </p>
          )}
        </section>
        <div className="tm-actions tm-actions-two">
          <Link href={cancelHref} className="btn ghost">Cancel</Link>
          <SaveButton count={inCount} />
        </div>
      </div>
    </form>
  );
}
