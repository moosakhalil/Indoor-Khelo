// Phase F1: pieces shared by the Series screens (badges with your-team ring, state chips, the series header, the points table).
// No hooks in here, so the same parts work on server pages and inside client components.
import "./sr.css";
import { IconTrophy } from "@/components/SrIcons";
import TeamBadge from "@/components/TeamBadge";
import { STATUS_LABEL, type MatchStatus } from "@/lib/matchRules";
import { FORMAT_TEXT, type Status } from "@/lib/series";
import { matchesText, progress, scoreWord, teamsText, type CardSide, type SeriesState } from "@/lib/seriesView";

const TONE: Record<string, string> = { draft: "", scheduled: "gold", live: "green", paused: "gold", completed: "green", postponed: "", cancelled: "red", abandoned: "red" };

export function MatchStatusChip({ status }: { status: string }) {
  return <span className={`chip sr-mchip ${TONE[status] ?? ""}`}>{STATUS_LABEL[status as MatchStatus] ?? status}</span>;
}

/** A team badge, with the gold ring when it is one of your teams. The ring also has words in the label. */
export function SideBadge({ name, mine, size = "md" }: { name: string; mine?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={mine ? "sr-mine" : undefined}>
      <TeamBadge name={name} size={size} label={mine ? `Team ${name}, your team` : undefined} />
    </span>
  );
}

export function OpenChip({ open }: { open: boolean }) {
  return <span className={`chip sr-chip ${open ? "green" : ""}`}>{open ? "Open" : "Closed"}</span>;
}

export function StatePill({ state }: { state: SeriesState }) {
  return (
    <span className={`sr-state ${state.tone}`}>
      {state.kind === "won" && <IconTrophy size={13} />}
      {state.label}
    </span>
  );
}

export function ProgressMarks({ format, bestOf, counted }: { format: "open" | "best_of"; bestOf: number | null; counted: number }) {
  const p = progress(format, bestOf, counted);
  return (
    <div className="sr-progress">
      {p.total !== null && (
        <div className="sr-marks" aria-hidden="true">
          {Array.from({ length: p.total }, (_, i) => <span key={i} className={i < p.filled ? "on" : undefined} />)}
        </div>
      )}
      <small>{p.text}</small>
    </div>
  );
}

export type HeroData = {
  open: boolean; sides: CardSide[]; wins: [number, number] | null; counted: number; format: "open" | "best_of"; bestOf: number | null;
  status: Status; state: SeriesState; matchCount: number; abandoned: number; dates: string | null;
};

/** The series header: both badges, the series score, the state in words, the format and the progress marks. */
export function SeriesHero({ d }: { d: HeroData }) {
  const won = d.state.kind === "won";
  const two = d.sides.length === 2 && d.wins;
  const lead = two && d.wins![0] !== d.wins![1] ? (d.wins![0] > d.wins![1] ? 0 : 1) : -1;
  const textTone = d.status.drawn ? "orange" : won ? "gold" : "";
  return (
    <section className={`sr-hero${won ? " won" : ""}`} aria-label="Series score">
      <div className="sr-hero-top">
        <OpenChip open={d.open} />
        <StatePill state={d.state} />
        <small className="sr-hero-fmt">{d.format === "best_of" && d.bestOf ? `Best of ${d.bestOf}` : "Open-ended"}</small>
      </div>
      {two ? (
        <div className="sr-vs">
          <div className="sr-team"><SideBadge name={d.sides[0]!.name} mine={d.sides[0]!.mine} size="lg" /><span>{d.sides[0]!.name}</span></div>
          <div className="sr-big" aria-label={`Series score ${d.wins![0]} to ${d.wins![1]}`}>
            <b className={lead === 0 ? "lead" : undefined}>{d.wins![0]}</b><i aria-hidden="true">–</i><b className={lead === 1 ? "lead" : undefined}>{d.wins![1]}</b>
            <small>{scoreWord(d.wins!, d.counted)}</small>
          </div>
          <div className="sr-team"><SideBadge name={d.sides[1]!.name} mine={d.sides[1]!.mine} size="lg" /><span>{d.sides[1]!.name}</span></div>
        </div>
      ) : (
        <div className="sr-pack">
          <div className="sr-pack-badges">{d.sides.map((s) => <SideBadge key={s.name} name={s.name} mine={s.mine} size="md" />)}</div>
          <small>{teamsText(d.sides.length)} · {matchesText(d.matchCount)}</small>
        </div>
      )}
      <p className={`sr-status ${textTone}`}>{won && two && <IconTrophy size={16} />}{d.status.text}</p>
      {d.format === "best_of" || d.counted > 0 ? <ProgressMarks format={d.format} bestOf={d.bestOf} counted={d.counted} /> : null}
      {(d.format === "open" || d.dates) && <small className="sr-fmtline">{d.format === "open" ? FORMAT_TEXT(d.format, d.bestOf) : ""}{d.format === "open" && d.dates ? " · " : ""}{d.dates ?? ""}</small>}
      {d.abandoned > 0 && <small className="sr-fmtline">{d.abandoned} abandoned match{d.abandoned === 1 ? "" : "es"} not counted</small>}
    </section>
  );
}

export type TableItem = { name: string; mine: boolean; played: number; won: number; lost: number; tied: number; points: number };

/** Rank, badge and bold points. Teams level on points and wins share a rank, so no leader is invented. */
export function PointsTable({ rows }: { rows: TableItem[] }) {
  let rank = 0;
  const ranks = rows.map((r, i) => { const p = rows[i - 1]; if (!p || p.points !== r.points || p.won !== r.won) rank = i + 1; return rank; });
  return (
    <section className="card sr-table">
      <div className="sr-table-head"><b>Points table</b><small>Win 2 · tie or no result 1</small></div>
      <table className="board" aria-label="Points table">
        <thead><tr><td className="muted small">#</td><td className="muted small">Team</td><td className="muted small">P</td><td className="muted small">W</td><td className="muted small">L</td><td className="muted small">T</td><td className="muted small">Pts</td></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className={r.mine ? "me" : undefined}>
              <td>{ranks[i]}</td>
              <td><span className="sr-trow"><SideBadge name={r.name} mine={r.mine} size="sm" /><b>{r.name}</b></span></td>
              <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.tied}</td><td><b>{r.points}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ margin: "6px 0 0" }}>A win is 2 points, a tie or no result 1 point each. A level series is shown as drawn: the app never forces a winner.</p>
    </section>
  );
}
