"use client";
// Phase D3: the few parts of the match report that need to react to a tap: the tab bar (scrolls the open tab into view),
// the ball-by-ball list (open an over, filter), the "How the app chose" sheet and the public link switch.
// Everything else on the report is drawn on the server.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import CopyButton from "@/components/CopyButton";
import RpIcon from "@/components/RpIcons";
import TeamBadge from "@/components/TeamBadge";
import "./rp.css";

/* ---------- tab bar ---------- */
export function ReportTabs({ tabs, active, base }: { tabs: readonly (readonly [string, string])[]; active: string; base: string }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && bar.current && typeof el.scrollIntoView === "function") {
      // only move the bar sideways, never the page
      const b = bar.current;
      b.scrollLeft = Math.max(0, el.offsetLeft - (b.clientWidth - el.offsetWidth) / 2);
    }
  }, [active]);
  return (
    <nav ref={bar} className="rp-tabs" aria-label="Report sections">
      {tabs.map(([k, label]) => (
        <Link key={k} href={`${base}?tab=${k}`} scroll={false} className={`rp-tab${active === k ? " on" : ""}`} aria-current={active === k ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

/* ---------- ball by ball ---------- */
export type BallRow = {
  id: string; label: string; text: string; over: number; ball: number;
  kind: "wicket" | "six" | "four" | "extra" | "dot" | "run";
  boundary: boolean; extra: boolean; wicket: boolean;
};
export type OverGroup = { key: string; number: number; bowler: string; runs: number; wickets: number; balls: BallRow[] };
export type InningsGroup = { key: string; label: string; team: string; score: string; overs: OverGroup[] };

const FILTERS = [["all", "All balls"], ["wickets", "Wickets"], ["boundaries", "Fours and sixes"], ["extras", "Extras"]] as const;
type Filter = (typeof FILTERS)[number][0];
const pass = (f: Filter, b: BallRow) => f === "all" || (f === "wickets" && b.wicket) || (f === "boundaries" && b.boundary) || (f === "extras" && b.extra);
const EMPTY: Record<Filter, string> = { all: "No balls bowled.", wickets: "No wickets fell.", boundaries: "No fours or sixes.", extras: "No extras." };

export function BallBubble({ b, dim }: { b: Pick<BallRow, "label" | "kind">; dim?: boolean }) {
  return <span className={`rp-ball ${b.kind}${dim ? " dim" : ""}`}>{b.label}</span>;
}

export function BallsView({ innings, communityId, matchId }: { innings: InningsGroup[]; communityId: string | null; matchId: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const first = innings[0]?.overs[0]?.key;
  const [open, setOpen] = useState<Record<string, boolean>>(first ? { [first]: true } : {});
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  return (
    <div className="rp-balls">
      <div className="rp-filters" role="group" aria-label="Show">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`rp-filter${filter === k ? " on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      <div className="rp-innings-cols">
        {innings.map((inn) => {
          const shown = inn.overs.filter((o) => filter === "all" || o.balls.some((b) => pass(filter, b)));
          return (
            <section key={inn.key} className="rp-card rp-inn-balls">
              <div className="rp-inn-head">
                <TeamBadge name={inn.team} size="md" />
                <div className="rp-inn-title"><small>{inn.label}</small><b>{inn.team}</b></div>
                <b className="rp-inn-score">{inn.score}</b>
              </div>
              {inn.overs.length === 0 && <p className="muted small rp-empty-line">No balls bowled.</p>}
              {inn.overs.length > 0 && shown.length === 0 && <p className="muted small rp-empty-line">{EMPTY[filter]}</p>}
              <ul className="rp-overs">
                {shown.map((o) => {
                  const isOpen = filter !== "all" || !!open[o.key];
                  const list = o.balls.filter((b) => pass(filter, b));
                  return (
                    <li key={o.key} className={`rp-over${isOpen ? " open" : ""}`}>
                      <button type="button" className="rp-over-head" aria-expanded={isOpen} aria-controls={`${o.key}-list`} onClick={() => toggle(o.key)} disabled={filter !== "all"}>
                        <span className="rp-over-no"><span className="rp-sr">Over </span>{o.number}</span>
                        <span className="rp-over-who">
                          <b>{o.bowler}</b>
                          <small className="muted">{o.runs} run{o.runs === 1 ? "" : "s"}{o.wickets > 0 && <b className="rp-wk"> · {o.wickets} wkt{o.wickets === 1 ? "" : "s"}</b>}</small>
                        </span>
                        <span className="rp-over-balls" aria-hidden="true">{o.balls.map((b) => <BallBubble key={b.id} b={b} dim={!pass(filter, b)} />)}</span>
                        {filter === "all" && <RpIcon name="chevron" size={18} className="rp-chev" />}
                      </button>
                      <ul id={`${o.key}-list`} className="rp-over-list" hidden={!isOpen}>
                        {list.map((b) => (
                          <li key={b.id} className="rp-ball-row">
                            <BallBubble b={b} />
                            <span className="rp-ball-text">{b.text}</span>
                            {communityId && (
                              <Link href={`/c/${communityId}/matches/${matchId}/correct?ball=${b.id}`} className="rp-pencil" aria-label={`Correct ball ${b.over}.${b.ball}`}>
                                <RpIcon name="pencil" size={18} />
                                <span className="rp-pencil-word">Correct</span>
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- the "How the app chose" sheet ---------- */
export function PomSheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const back = opener.current;
    return () => { document.body.style.overflow = before; back?.focus(); };
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    if (e.key === "Tab") { e.preventDefault(); closeBtn.current?.focus(); }   // the sheet has one control: keep focus on it
  };
  return (
    <>
      <button ref={opener} type="button" className="rp-how" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <RpIcon name="info" size={16} /> How the app chose
      </button>
      <div className="rp-sheet-back" hidden={!open} onClick={() => setOpen(false)} />
      <div className="rp-sheet" role="dialog" aria-modal="true" aria-labelledby={id} hidden={!open} onKeyDown={onKey}>
        <div className="rp-grip" aria-hidden="true" />
        <h2 id={id} className="rp-sheet-h">How the app chose</h2>
        <div className="rp-sheet-body">{children}</div>
        <button ref={closeBtn} type="button" className="btn ghost rp-sheet-close" onClick={() => setOpen(false)}>Close</button>
      </div>
    </>
  );
}

/* ---------- the public link switch ---------- */
export function ShareSwitch({ communityId, matchId, memberLink, publicLink, idSuffix = "", action }: { communityId: string; matchId: string; memberLink: string; publicLink: string | null; idSuffix?: string; action: (fd: FormData) => void | Promise<void> }) {
  const on = !!publicLink;
  const form = useRef<HTMLFormElement>(null);
  const [ask, setAsk] = useState(false);
  const boxId = `rp-link${idSuffix}`;
  const link = publicLink ?? memberLink;
  return (
    <section className="rp-card rp-share" id={`share${idSuffix}`}>
      <div className="rp-card-head">
        <b><RpIcon name="link" size={18} /> Share this report</b>
        {on ? <span className="rp-badge green"><RpIcon name="eye" size={14} /> Public</span> : <span className="rp-badge"><RpIcon name="link" size={14} /> Members only</span>}
      </div>
      <form ref={form} action={action}>
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="on" value={on ? "0" : "1"} />
        <div className="rp-switch-row">
          <div className="grow">
            <b id={`rp-sw-l${idSuffix}`}>Public link</b>
            <p className="muted small" style={{ margin: "2px 0 0" }}>
              {on
                ? "Public link: anyone who has it can read this match without signing in. Nothing else in the community is reachable from it."
                : "The link below opens only for signed-in members of this community. To let anyone read it, for example in a WhatsApp group, turn on the public link."}
            </p>
          </div>
          {on ? (
            <button type="button" role="switch" aria-checked="true" aria-labelledby={`rp-sw-l${idSuffix}`} className="rp-switch on" onClick={() => setAsk(true)}><span className="rp-knob" /></button>
          ) : (
            <button type="submit" role="switch" aria-checked="false" aria-labelledby={`rp-sw-l${idSuffix}`} className="rp-switch"><span className="rp-knob" /></button>
          )}
        </div>
      </form>
      <div className="rp-linkrow">
        <span id={boxId} className="rp-linkbox mono">{link}</span>
        <CopyButton text={link} targetId={boxId} />
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>
        {on
          ? "It shows the scorecard and ball-by-ball record with player names. You can stop sharing at any time; the link then stops working."
          : "A public link shows the scorecard and ball-by-ball record with player names. You can stop sharing at any time."}
      </p>
      {on && <p className="rp-note"><RpIcon name="info" size={16} /> <span>Switching the public link off asks first, and the old link stops working straight away.</span></p>}
      <ConfirmDialog
        open={ask}
        title="Stop sharing?"
        body="The public link stops working straight away. Anyone who has it will see that the link is not active. If you turn sharing on again later, you get a new link."
        confirmLabel="Stop sharing"
        danger
        onConfirm={() => { setAsk(false); form.current?.requestSubmit(); }}
        onClose={() => setAsk(false)}
      />
    </section>
  );
}
