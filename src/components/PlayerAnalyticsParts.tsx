// Player analytics screen parts (server drawn). The numbers are formSeries/formSummary, runSources, batterVsBowler/bowlerVsBatters
// from analytics.ts and the career figures from career.ts; this file lays them out and says in words what each colour means.
import "./ld.css";
import Link from "next/link";
import type { FormView } from "@/components/AnalyticsTabs";
import { FormBars } from "@/components/AnalyticsParts";
import { IconChart, IconDown, IconInfo, IconMinus, IconUp } from "@/components/LdIcons";
import Shirt from "@/components/Shirt";
import { formSummary, type DuelRow, type FormPoint, type RunSources } from "@/lib/analytics";
import type { Career } from "@/lib/career";
import { STRIKE_RATE_HIGHLIGHT, bestText, f1, howOutRows, personLine, trendBadge } from "@/lib/ldView";

export function PlayerHeader({ name, number, role }: { name: string; number: number | null; role: string | null }) {
  return (
    <section className="ld-phead">
      <Shirt number={number} size="normal" />
      <div>
        <b className="ld-phead-name">{name}</b>
        <small className="muted">{personLine(number, role) || "Member"}</small>
        <small className="muted">From finished matches only. Nothing is added by hand.</small>
      </div>
    </section>
  );
}

export function NewTag() { return <span className="ld-newtag">New</span>; }

/* ---------- form ---------- */
const Dot = ({ c, dashed }: { c: string; dashed?: boolean }) => <i className={`ld-key${dashed ? " dashed" : ""}`} style={{ background: dashed ? "transparent" : c, borderColor: c }} aria-hidden="true" />;

function Tile({ value, label, hi }: { value: string; label: string; hi?: boolean }) {
  return <div className={`ld-tile2${hi ? " hi" : ""}`}><b className="ld-tile2-v">{value}</b><small className="muted">{label}</small></div>;
}

function FormBadge({ points }: { points: FormPoint[] }) {
  if (!points.length) return null;
  const t = trendBadge(formSummary(points), points.length);
  return (
    <span className={`ld-trend ${t.tone}`}>
      {t.tone === "up" ? <IconUp size={12} /> : t.tone === "down" ? <IconDown size={12} /> : <IconMinus size={12} />} {t.label}
    </span>
  );
}

/** The whole card body for one metric: chart, legend in words, four number tiles and the sentence the page has always had. */
function FormBody({ points, metric }: { points: FormPoint[]; metric: "runs" | "wickets" }) {
  if (!points.length) {
    return (
      <div className="ld-empty dashed inner">
        <span className="ld-empty-ic" aria-hidden="true"><IconChart size={26} /></span>
        <b>{metric === "runs" ? "No innings yet" : "No bowling yet"}</b>
        <p className="muted small" style={{ margin: 0 }}>The chart fills in after finished matches.</p>
      </div>
    );
  }
  const s = formSummary(points);
  const best = bestText(points, metric);
  return (
    <>
      <FormBars points={points} metric={metric} />
      <ul className="ld-legend" aria-label="What the colours mean">
        {metric === "runs" ? (
          <>
            <li><Dot c="var(--gold)" /> 30 or more</li>
            <li><Dot c="var(--blue)" /> Under 30</li>
            <li><Dot c="var(--red)" dashed /> Out for a duck (dashed)</li>
            <li><Dot c="var(--mute)" /> * not out</li>
          </>
        ) : <li><Dot c="var(--green)" /> Wickets taken in a match where this player bowled</li>}
        <li><Dot c="var(--orange)" dashed /> Average</li>
      </ul>
      <p className="muted small" style={{ margin: "0 0 8px" }}>Matches in order, 1 is the oldest shown.</p>
      <div className="ld-tiles2">
        <Tile value={s.average === null ? "–" : f1(s.average)} label="Average" />
        <Tile value={best ?? "–"} label="Best" hi />
        <Tile value={s.recent === null ? "–" : f1(s.recent)} label="Last 3 matches" />
        <Tile value={s.before === null ? "–" : f1(s.before)} label="Before that" />
      </div>
      <p className="muted small ld-trend-text">
        {s.direction === "up" && <><b>Improving:</b> the last three matches average {f1(s.recent!)} against {f1(s.before!)} before.</>}
        {s.direction === "down" && <><b>Down lately:</b> the last three matches average {f1(s.recent!)} against {f1(s.before!)} before.</>}
        {s.direction === "steady" && <><b>Steady:</b> the last three matches average {f1(s.recent!)}, about the same as before ({f1(s.before!)}).</>}
        {s.direction === null && points.length < 6 && <>Play six matches to see whether the trend is up or down.</>}
      </p>
    </>
  );
}

export function formViews(runs: FormPoint[], wickets: FormPoint[]): Record<"runs" | "wickets", FormView> {
  const title = (n: number) => (n ? `Form, last ${n} match${n === 1 ? "" : "es"}` : "Form");
  return {
    runs: { title: title(runs.length), badge: <FormBadge points={runs} />, body: <FormBody points={runs} metric="runs" /> },
    wickets: { title: title(wickets.length), badge: <FormBadge points={wickets} />, body: <FormBody points={wickets} metric="wickets" /> },
  };
}

/* ---------- where the runs come from ---------- */
export function RunSourcesPanel({ s }: { s: RunSources }) {
  if (s.runs === 0) {
    return (
      <section className="card ld-empty dashed ld-c-runs">
        <span className="ld-empty-ic" aria-hidden="true"><IconChart size={26} /></span>
        <b>No runs off the bat yet</b>
        <p className="muted small" style={{ margin: 0 }}>Runs appear here after the first innings of a finished match.</p>
      </section>
    );
  }
  const parts = [
    { key: "singles", label: "Singles", runs: s.singles, pct: s.share.singles, colour: "#5b6b94" },
    { key: "running", label: "Running (2, 3, 5)", runs: s.running, pct: s.share.running, colour: "#a7b3d1" },
    { key: "fours", label: "Fours", runs: s.fours, pct: s.share.fours, colour: "var(--blue)" },
    { key: "sixes", label: "Sixes", runs: s.sixes, pct: s.share.sixes, colour: "var(--gold)" },
    { key: "other", label: "Other", runs: s.other, pct: s.share.other, colour: "var(--orange)" },
  ].filter((p) => p.runs > 0);
  return (
    <section className="card ld-c-runs">
      <h2>Where the runs come from</h2>
      <p className="ld-bignum"><b>{s.runs}</b> <span className="muted">runs off <b style={{ color: "var(--white)" }}>{s.balls}</b> balls</span></p>
      <div className="stackedbar" role="img" aria-label={`Where the runs came from: ${parts.map((p) => `${p.label} ${Math.round(p.pct)} percent`).join(", ")}`} style={{ height: 18 }}>
        {parts.map((p) => <span key={p.key} style={{ flexGrow: p.runs, background: p.colour }} />)}
      </div>
      <table className="ld-tbl ld-src" aria-label="Runs by source">
        <thead><tr><th scope="col"><span className="ld-sr">Colour</span></th><th scope="col">Source</th><th scope="col">Runs</th><th scope="col">Share</th></tr></thead>
        <tbody>{parts.map((p) => <tr key={p.key}><td><Dot c={p.colour} /></td><th scope="row">{p.label}</th><td>{p.runs}</td><td>{Math.round(p.pct)}%</td></tr>)}</tbody>
      </table>
      <div className="ld-note" role="note"><IconInfo size={18} /><span>Extras the team gained while this batter was on strike (wides, no balls, byes and leg-byes) are not his runs and are kept apart: <b>{s.extrasWhileOnStrike}</b>.</span></div>
    </section>
  );
}

/** The three cards that use numbers the stats page already has (career.ts); they add no new data. */
export function BoundariesCard({ c }: { c: Career }) {
  const b = c.batting;
  const dash = (v: number | null, f: (n: number) => string) => (v === null ? "–" : f(v));
  return (
    <section className="card ld-c-bound">
      <div className="row space"><h2>Boundaries and dots</h2><NewTag /></div>
      <div className="ld-tiles2">
        <Tile value={dash(b.boundaryPercent, (n) => `${f1(n)}%`)} label="Of runs from boundaries" hi />
        <Tile value={dash(b.ballsPerBoundary, f1)} label="Balls per boundary" />
        <Tile value={dash(b.dotPercent, (n) => `${f1(n)}%`)} label="Dot ball %" />
        <Tile value={dash(b.strikeRate, f1)} label="Strike rate" />
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>{b.fours} fours, {b.sixes} sixes · {b.dots} dot balls in {b.balls} balls faced.</p>
    </section>
  );
}

export function HowOutCard({ c }: { c: Career }) {
  const rows = howOutRows(c.batting.howOut);
  return (
    <section className="card ld-c-out">
      <div className="row space"><h2>How out</h2><NewTag /></div>
      {c.batting.innings === 0 ? <p className="muted small" style={{ margin: "8px 0 0" }}>No innings yet. This fills in after finished matches.</p> : (
        <ul className="ld-howout">
          {rows.map((r) => <li key={r.key}><span>{r.label}</span><span className="ld-bar" aria-hidden="true"><i style={{ width: `${r.pct}%` }} /></span><b className="ld-num">{r.count}</b></li>)}
        </ul>
      )}
    </section>
  );
}

export function PartnershipCard({ c, name, number }: { c: Career; name: string; number: number | null }) {
  const p = c.batting.bestPartnership;
  return (
    <section className="card ld-c-part">
      <div className="row space"><h2>Best partnership</h2><NewTag /></div>
      {!p ? <p className="muted small" style={{ margin: "8px 0 0" }}>No partnership yet. This fills in after finished matches.</p> : (
        <>
          <p className="ld-bignum"><b>{p.runs}</b> <span className="muted">runs in {p.balls} balls</span></p>
          <div className="ld-partner"><Shirt number={number} size="small" label={name} /><span className="muted small">with <b style={{ color: "var(--white)" }}>{p.withName}</b></span></div>
        </>
      )}
    </section>
  );
}

/* ---------- batter v bowler ---------- */
export function DuelCard({ rows, kind, communityId, title, numberOf }: { rows: DuelRow[]; kind: "bat" | "bowl"; communityId: string; title: string; numberOf: (userId: string) => number | null }) {
  return (
    <section className="card ld-duel">
      <h2>{title}</h2>
      {!rows.length ? (
        <div className="ld-empty dashed inner">
          <span className="ld-empty-ic" aria-hidden="true"><IconChart size={26} /></span>
          <p className="muted small" style={{ margin: 0 }}>{kind === "bat" ? "No balls faced against members yet." : "No balls bowled to members yet."}</p>
          <small className="muted">{kind === "bat" ? "Bowlers appear after this player has faced them in a finished match." : "Batters appear after this player has bowled to them in a finished match."}</small>
        </div>
      ) : (
        <>
          <div className="ld-scroll">
            <table className="ld-tbl ld-duels ld-stack" aria-label={kind === "bat" ? "Batter against each bowler" : "Bowler against each batter"}>
              <thead><tr><th scope="col">{kind === "bat" ? "Bowler" : "Batter"}</th><th scope="col">B</th><th scope="col">R</th><th scope="col">{kind === "bat" ? "Out" : "Wkts"}</th><th scope="col">{kind === "bat" ? <>SR<small> over {STRIKE_RATE_HIGHLIGHT} is gold</small></> : "Dots"}</th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.opponentUserId}>
                    <th scope="row" className="ld-opp ld-who-cell"><Shirt number={numberOf(d.opponentUserId)} size="small" /><Link href={`/c/${communityId}/players/${d.opponentUserId}`}><b>{d.name}</b></Link></th>
                    <td data-label="Balls">{d.balls}</td><td data-label="Runs">{d.runs}</td><td data-label={kind === "bat" ? "Out" : "Wkts"}>{d.dismissals}</td>
                    <td data-label={kind === "bat" ? "SR" : "Dots"} className={kind === "bat" && d.strikeRate !== null && d.strikeRate > STRIKE_RATE_HIGHLIGHT ? "best" : undefined}>{kind === "bat" ? (d.strikeRate === null ? "–" : f1(d.strikeRate)) : d.dots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>B balls faced (a wide is not a ball faced), R runs off the bat, {kind === "bat" ? `Out times dismissed by that bowler (a run-out is not the bowler's), SR strike rate (over ${STRIKE_RATE_HIGHLIGHT} is gold)` : "Wkts wickets credited to the bowler, Dots balls with no run off the bat"}. Members only.</p>
        </>
      )}
    </section>
  );
}
