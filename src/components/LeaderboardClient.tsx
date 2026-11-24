"use client";
// The two interactive pieces of the leaderboard: the list (top 10, then "Show the other N members") and the filters sheet.
import "./ld.css";
import Link from "next/link";
import { useState } from "react";
import { IconFilter } from "@/components/LdIcons";
import LdSheet from "@/components/LdSheet";
import Shirt from "@/components/Shirt";

export type BoardItem = {
  userId: string; name: string; number: number | null; line: string; rank: number | null; tied: boolean; ranked: boolean; note: string | null; valueText: string;
};

export const BOARD_TOP = 10;

/** Everyone is in the list. Only the first ten (and your own row) show until the member asks for the rest. */
export function BoardList({ communityId, rows, meId, hasData, label, top = BOARD_TOP }: { communityId: string; rows: BoardItem[]; meId: string; hasData: boolean; label: string; top?: number }) {
  const [all, setAll] = useState(false);
  const mineIdx = rows.findIndex((r) => r.userId === meId);
  const collapsed = !all && rows.length > top;
  const shown = collapsed ? rows.slice(0, top) : rows;
  const pinned = collapsed && mineIdx >= top ? rows[mineIdx]! : null;
  const rest = rows.length - top;
  const row = (r: BoardItem) => {
    const me = r.userId === meId;
    const rankText = hasData && r.rank !== null ? `${r.rank}${r.tied ? "=" : ""}` : "–";
    return (
      <li key={r.userId} className={`ld-row${me ? " me" : ""}${r.ranked ? "" : " dim"}`}>
        <b className="ld-rank" aria-label={r.rank !== null && hasData ? `Rank ${r.rank}${r.tied ? ", tied" : ""}` : "Not ranked"}>{rankText}</b>
        <Shirt number={r.number} size="small" />
        <span className="ld-who">
          <Link href={`/c/${communityId}/players/${r.userId}`} className="ld-name">
            <b>{r.name}</b>
          </Link>
          {me && <span className="ld-tag you">YOU</span>}
          {hasData && r.ranked && r.tied && <span className="ld-tag">TIED</span>}
          <small className="muted ld-sub">{!r.ranked && r.note ? r.note : r.line}</small>
        </span>
        <b className="ld-val">{r.valueText}</b>
      </li>
    );
  };
  return (
    <div>
      <ol className="ld-rows" aria-label={label}>
        {shown.map(row)}
        {pinned && <li className="ld-gap" aria-hidden="true">…</li>}
        {pinned && row(pinned)}
      </ol>
      {rows.length > top && (
        <button type="button" className="btn ghost small ld-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "Show only the top 10" : `Show the other ${rest} member${rest === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

export type FilterValues = { series: string | null; team: string | null; from: string | null; to: string | null };

/** Series, team, from and to in a sheet. Same field names and the same GET form as the old card at the bottom. */
export function FilterSheet({ communityId, stat, flip, series, teams, current }: {
  communityId: string; stat: string; flip: boolean; series: { id: string; name: string }[]; teams: { id: string; name: string }[]; current: FilterValues;
}) {
  const [open, setOpen] = useState(false);
  const count = [current.series, current.team, current.from || current.to].filter(Boolean).length;
  return (
    <>
      <button type="button" className="ld-chipbtn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <IconFilter size={16} /> Filters{count > 0 && <span className="ld-count" aria-label={`${count} filter${count === 1 ? "" : "s"} on`}>{count}</span>}
      </button>
      <LdSheet open={open} onClose={() => setOpen(false)} title="Filter the leaderboard" hint="Numbers are counted only from finished matches that match all filters.">
        <form method="get" action={`/c/${communityId}/leaderboard`} aria-label="Filter the leaderboard">
          <input type="hidden" name="stat" value={stat} />
          {flip && <input type="hidden" name="flip" value="1" />}
          {series.length > 0 && (
            <>
              <label className="lb" htmlFor="l-series">Series</label>
              <select id="l-series" name="series" className="field" defaultValue={current.series ?? ""}><option value="">All matches</option>{series.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            </>
          )}
          <label className="lb" htmlFor="l-team">Team</label>
          <select id="l-team" name="team" className="field" defaultValue={current.team ?? ""}><option value="">Any team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <div className="two">
            <div><label className="lb" htmlFor="l-from">From</label><input id="l-from" type="date" name="from" className="field" defaultValue={current.from ?? ""} /></div>
            <div><label className="lb" htmlFor="l-to">To</label><input id="l-to" type="date" name="to" className="field" defaultValue={current.to ?? ""} /></div>
          </div>
          <div className="two" style={{ marginTop: 16 }}>
            <Link href={`/c/${communityId}/leaderboard?stat=${stat}${flip ? "&flip=1" : ""}`} className="btn ghost small" style={{ width: "100%" }}>Clear filters</Link>
            <button className="btn gold small" style={{ width: "100%" }}>Apply</button>
          </div>
        </form>
      </LdSheet>
    </>
  );
}
