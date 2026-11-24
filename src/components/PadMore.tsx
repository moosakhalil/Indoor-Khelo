// Phase E1: the grid inside the "More" sheet, grouped by purpose, with an icon and a label on every tile, a reason under every tile
// that is off, and the two risky ones (end the match, stop scoring) apart and not side by side. The labels are the ones the scorer
// already knew. Opening a sheet or making the pause / swap change is done by the functions the pad hands in.
import "./pp.css";
import type { ReactNode } from "react";
import { IcBook, IcBat, IcDoor, IcEdit, IcFlag, IcGauge, IcList, IcPause, IcPlay, IcPlus, IcShield, IcStop, IcSwap, IcTarget, IcTimer, IcUserPlus, IcUsers } from "@/components/PpIcons";
import { moreWhy } from "@/components/padInfo";
import type { InningsState, MatchState } from "@/lib/engine/types";

type Tile = { key: string; label: string; icon: ReactNode; off: boolean; why: string | null };

export type MoreProps = {
  m: MatchState;
  /** The innings that exists (may be finished) and the one being played (null between innings). */
  inn: InningsState | null;
  live: InningsState | null;
  lock: boolean;
  onOpen: (key: string) => void;
  onPause: () => void;
  onSwap: () => void;
};

export default function PadMoreMenu({ m, inn, live, lock, onOpen, onPause, onSwap }: MoreProps) {
  const why = moreWhy({ live: !!live, inn: !!inn, needBatter: !!live?.needBatter, needBowler: !!live?.needBowler, paused: m.paused, lock, target: live ? live.target : undefined });
  const t = (key: keyof typeof why, label: string, icon: ReactNode, extraOff = false): Tile => ({ key, label, icon, off: !!why[key] || extraOff, why: why[key] });
  const groups: { title: string; tiles: Tile[] }[] = [
    { title: "During play", tiles: [
      t("bye", "Byes and leg-byes", <IcPlus />),
      t("penalty", "Penalty runs", <IcFlag />),
      t("changebowler", "Change bowler", <IcSwap />),
    ] },
    { title: "Players", tiles: [
      t("retire", "Retire a player", <IcDoor />),
      t("late", "Add a late player or guest", <IcUserPlus />),
      t("crease", "Correct batters", <IcBat />),
      t("order", "Batting order", <IcList />),
      t("sub", "Substitute fielder", <IcShield />),
    ] },
    { title: "Match rules", tiles: [
      t("overs", "Change overs", <IcTimer />),
      t("players", "Players per side", <IcUsers />),
      t("limit", "Change bowler limit", <IcGauge />),
      t("target", "Revised target", <IcTarget />),
    ] },
    { title: "Fix and finish", tiles: [
      t("edit", "Edit an earlier ball", <IcEdit />),
      t("endinnings", "End the innings", <IcStop />),
    ] },
  ];
  const sub = m.paused ? "The match is paused: byes and leg-byes are off until you resume." : !live ? "No innings in progress: some items are off." : "Everything is available.";
  const Tile = ({ tile }: { tile: Tile }) => (
    <div className="pp-tilew">
      <button type="button" className="pp-tile" disabled={tile.off} aria-describedby={tile.off && tile.why ? `pp-why-${tile.key}` : undefined} onClick={() => onOpen(tile.key)}>
        <span className="pp-tile-ico" aria-hidden="true">{tile.icon}</span><span>{tile.label}</span>
      </button>
      {tile.off && tile.why && <small className="pp-why" id={`pp-why-${tile.key}`}>{tile.why}</small>}
    </div>
  );
  return (
    <div className="pp-more">
      <p className="pp-more-sub" role="status">{sub}</p>
      {groups.map((g, gi) => (
        <section key={g.title} className="pp-more-g" aria-label={g.title}>
          <h3 className="pp-more-h">{g.title}</h3>
          <div className="pp-tiles">
            {g.tiles.map((tile) => <Tile key={tile.key} tile={tile} />)}
            {gi === 0 && (
              <div className="pp-tilew">
                <button type="button" className="pp-tile" disabled={!inn} onClick={onPause}>
                  <span className="pp-tile-ico" aria-hidden="true">{m.paused ? <IcPlay /> : <IcPause />}</span><span>{m.paused ? "Resume the match" : "Pause the match"}</span>
                </button>
                {!inn && <small className="pp-why">No innings yet</small>}
              </div>
            )}
            {gi === 0 && (
              <div className="pp-tilew">
                <button type="button" className="pp-tile" disabled={!live || !live.nonStriker} onClick={onSwap}>
                  <span className="pp-tile-ico" aria-hidden="true"><IcSwap /></span><span>Swap striker and non-striker</span>
                </button>
                {(!live || !live.nonStriker) && <small className="pp-why">{!live ? "No innings in progress" : "Only one batter at the crease"}</small>}
              </div>
            )}
          </div>
        </section>
      ))}
      <section className="pp-more-g" aria-label="Help">
        <div className="pp-tiles">
          <div className="pp-tilew"><button type="button" className="pp-tile" onClick={() => onOpen("guide")}><span className="pp-tile-ico" aria-hidden="true"><IcBook /></span><span>How to score</span></button></div>
        </div>
      </section>
      <hr className="line" />
      <section className="pp-more-g pp-danger" aria-label="End the match">
        <button type="button" className="pp-end" disabled={!inn} onClick={() => onOpen("endmatch")}><span className="pp-tile-ico" aria-hidden="true"><IcStop /></span><span>End or abandon the match</span></button>
        {!inn && <small className="pp-why">No innings yet</small>}
        <p className="pp-more-note">This finishes the match and locks it.</p>
      </section>
      <section className="pp-more-g pp-stop" aria-label="Hand over scoring">
        <button type="button" className="pp-handover" onClick={() => onOpen("release")}><span className="pp-tile-ico" aria-hidden="true"><IcDoor /></span><span>Stop scoring (hand over)</span></button>
        <p className="pp-more-note">Someone else can then take over. The score so far is saved.</p>
      </section>
    </div>
  );
}
