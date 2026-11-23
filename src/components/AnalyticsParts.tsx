// Phase 8: charts and tables for the analytics screens. Hand-written inline SVG (no chart library), no hooks, so the server
// draws them and they work in the public report too. Every chart says what it shows in words (role="img" and a text summary).
import Link from "next/link";
import {
  formSummary, wormSeries, winSeries, type CompareRow, type DuelRow, type FormPoint, type OverBowlRow, type PairRow, type RecordLine, type RunSources, type HistoryItem,
} from "@/lib/analytics";
import type { MatchState } from "@/lib/engine/types";
import { BOWL_BY_OVER_MIN_BALLS } from "@/lib/analytics";

const W = 360;
const PAD = { l: 34, r: 10, t: 12, b: 26 };
/** A top of the scale that splits into four whole steps (5 becomes 8, 19 becomes 20, 53 becomes 60). */
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 100000];
const niceMax = (v: number) => (STEPS.find((t) => t * 4 >= v) ?? 100000) * 4;
const f1 = (n: number) => n.toFixed(1);

function Axes({ h, maxY, ticks = 4, unit = "" }: { h: number; maxY: number; ticks?: number; unit?: string }) {
  const inner = h - PAD.t - PAD.b;
  return (
    <g aria-hidden="true">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (maxY * i) / ticks, y = PAD.t + inner - (inner * i) / ticks;
        return <g key={i}><line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" /><text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--mute)">{Math.round(v)}{unit}</text></g>;
      })}
    </g>
  );
}

/* ---------- 1. form over time ---------- */
export function FormChart({ points, metric }: { points: FormPoint[]; metric: "runs" | "wickets" }) {
  if (!points.length) return <div className="card center muted small">No {metric === "runs" ? "innings" : "bowling"} yet. The chart fills in after finished matches.</div>;
  const h = 170, inner = h - PAD.t - PAD.b;
  const maxY = niceMax(Math.max(5, ...points.map((p) => p.value)));
  const step = (W - PAD.l - PAD.r) / points.length, bw = Math.min(30, step * 0.62);
  const s = formSummary(points);
  const avgY = s.average === null ? null : PAD.t + inner - (inner * s.average) / maxY;
  const words = points.map((p) => `${p.value}${p.notOut ? " not out" : ""}`).join(", ");
  return (
    <section className="card">
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${metric === "runs" ? "Runs" : "Wickets"} in the last ${points.length} matches, oldest first: ${words}`} style={{ width: "100%", height: "auto" }}>
        <Axes h={h} maxY={maxY} />
        {points.map((p, i) => {
          const bh = Math.max(p.value === 0 ? 3 : 4, (inner * p.value) / maxY);
          const x = PAD.l + i * step + (step - bw) / 2, y = PAD.t + inner - bh;
          const duck = metric === "runs" && p.value === 0 && !p.notOut;
          const fill = duck ? "none" : metric === "wickets" ? "var(--green)" : p.value >= 30 ? "var(--gold)" : "var(--blue)";
          return (
            <g key={p.matchId}>
              <rect x={x} y={y} width={bw} height={bh} rx="4" fill={fill} stroke={duck ? "var(--red)" : "none"} strokeWidth={duck ? 2 : 0} strokeDasharray={duck ? "3 2" : undefined} />
              <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--white)">{p.value}{p.notOut ? "*" : ""}</text>
              <text x={x + bw / 2} y={h - 8} textAnchor="middle" fontSize="9" fill="var(--mute)">{i + 1}</text>
            </g>
          );
        })}
        {avgY !== null && <g aria-hidden="true"><line x1={PAD.l} x2={W - PAD.r} y1={avgY} y2={avgY} stroke="var(--orange)" strokeDasharray="5 4" /><text x={W - PAD.r} y={avgY - 4} textAnchor="end" fontSize="10" fill="var(--orange)">average {f1(s.average!)}</text></g>}
      </svg>
      <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
        Matches in order, 1 is the oldest shown. {metric === "runs" ? "Gold: 30 or more. Dashed red: out for a duck. * means not out." : "Wickets taken in each match where this player bowled."}
        {s.direction === "up" && <> <b style={{ color: "var(--white)" }}>Improving:</b> the last three matches average {f1(s.recent!)} against {f1(s.before!)} before.</>}
        {s.direction === "down" && <> <b style={{ color: "var(--white)" }}>Down lately:</b> the last three matches average {f1(s.recent!)} against {f1(s.before!)} before.</>}
        {s.direction === "steady" && <> <b style={{ color: "var(--white)" }}>Steady:</b> the last three matches average {f1(s.recent!)}, about the same as before ({f1(s.before!)}).</>}
        {s.direction === null && points.length < 6 && <> Play six matches to see whether the trend is up or down.</>}
      </p>
    </section>
  );
}

/* ---------- 7. team form and scores ---------- */
const WORD = { win: "Won", loss: "Lost", tie: "Tied", none: "No result" } as const;
const LETTER = { win: "W", loss: "L", tie: "T", none: "–" } as const;

export function FormStrip({ strip }: { strip: HistoryItem[] }) {
  if (!strip.length) return <p className="muted small" style={{ margin: "6px 0 0" }}>No finished matches yet.</p>;
  return (
    <div className="row wrap" role="list" aria-label={`Last ${strip.length} results, oldest first: ${strip.map((s) => WORD[s.result]).join(", ")}`} style={{ marginTop: 8 }}>
      {strip.map((s) => (
        <span key={s.matchId} role="listitem" className={`chip ${s.result === "win" ? "green" : s.result === "loss" ? "red" : s.result === "tie" ? "gold" : ""}`} style={{ minWidth: 44, justifyContent: "center", fontWeight: 800 }} title={`${WORD[s.result]} v ${s.opponent}`}>{LETTER[s.result]}</span>
      ))}
    </div>
  );
}

export function TeamScoresChart({ series }: { series: { matchId: string; value: number; against: number | null; result: HistoryItem["result"]; opponent: string }[] }) {
  if (series.length < 2) return <p className="muted small" style={{ margin: "6px 0 0" }}>The scores chart needs at least two finished matches.</p>;
  const h = 170, inner = h - PAD.t - PAD.b;
  const maxY = niceMax(Math.max(5, ...series.map((p) => Math.max(p.value, p.against ?? 0))));
  const step = (W - PAD.l - PAD.r) / series.length, bw = Math.min(26, step * 0.6);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`Team score in each match, oldest first: ${series.map((p) => `${p.value} (${WORD[p.result]} v ${p.opponent})`).join(", ")}`} style={{ width: "100%", height: "auto" }}>
        <Axes h={h} maxY={maxY} />
        {series.map((p, i) => {
          const bh = Math.max(3, (inner * p.value) / maxY), x = PAD.l + i * step + (step - bw) / 2, y = PAD.t + inner - bh;
          return (
            <g key={p.matchId}>
              <rect x={x} y={y} width={bw} height={bh} rx="4" fill={p.result === "win" ? "var(--green)" : p.result === "loss" ? "var(--red)" : "var(--gold)"} />
              <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--white)">{p.value}</text>
              <text x={x + bw / 2} y={h - 8} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--white)">{LETTER[p.result]}</text>
            </g>
          );
        })}
      </svg>
      <p className="muted small" style={{ margin: "4px 0 0" }}>The team&rsquo;s score in each match, oldest first. W won, L lost, T tied, – no result.</p>
    </div>
  );
}

/* ---------- 12. match worm ---------- */
export function WormChart({ m }: { m: MatchState }) {
  const { lines, maxBalls, maxRuns } = wormSeries(m);
  if (!lines.length || lines.every((l) => l.points.length < 2)) return <div className="card center muted small">No balls to draw yet.</div>;
  const h = 220, inner = h - PAD.t - PAD.b, bpo = m.rules.ballsPerOver;
  const maxY = niceMax(maxRuns);
  const x = (b: number) => PAD.l + ((W - PAD.l - PAD.r) * b) / maxBalls;
  const y = (r: number) => PAD.t + inner - (inner * r) / maxY;
  const colours = ["var(--gold)", "var(--blue)"];
  const overs = Math.ceil(maxBalls / bpo);
  const every = overs > 12 ? 2 : 1;
  const words = lines.map((l) => `${l.side} ${l.total}`).join(", ");
  return (
    <section className="card">
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`Match worm: runs ball by ball. ${words}. Red dots mark wickets.`} style={{ width: "100%", height: "auto" }}>
        <Axes h={h} maxY={maxY} />
        {Array.from({ length: Math.floor(overs / every) + 1 }, (_, i) => i * every).filter((o) => o <= overs).map((o) => (
          <text key={o} x={x(o * bpo)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--mute)" aria-hidden="true">{o}</text>
        ))}
        <text x={W - PAD.r} y={h - 8} textAnchor="end" fontSize="9" fill="var(--mute)" aria-hidden="true">overs</text>
        {lines.map((l, i) => (
          <g key={l.innings}>
            <polyline fill="none" stroke={colours[i % 2]} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray={i % 2 ? "6 4" : undefined} points={l.points.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")} />
            {l.points.filter((p) => p.wicket).map((p, k) => <circle key={k} cx={x(p.x)} cy={y(p.y)} r="4" fill="var(--red)" stroke="var(--night)" strokeWidth="1.5" />)}
          </g>
        ))}
      </svg>
      <div className="stack" style={{ gap: 4, marginTop: 8 }}>
        {lines.map((l, i) => (
          <div key={l.innings} className="row" style={{ gap: 8 }}>
            <svg width="30" height="8" aria-hidden="true"><line x1="0" x2="30" y1="4" y2="4" stroke={colours[i % 2]} strokeWidth="3" strokeDasharray={i % 2 ? "6 4" : undefined} /></svg>
            <span><b>{l.side}</b> {l.total}/{l.points.filter((p) => p.wicket).length}{i % 2 ? " (dashed line)" : " (solid line)"}</span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>Each line is a team&rsquo;s runs as the balls were bowled. Red dots are wickets. Where the lines cross or pull apart is where the match turned.</p>
    </section>
  );
}

/* ---------- 13. win likelihood ---------- */
export function WinChart({ m }: { m: MatchState }) {
  const w = winSeries(m);
  if (!w) return <div className="card center muted small">Win chance is shown for matches where one side chased a target. This match had no chase.</div>;
  const h = 200, inner = h - PAD.t - PAD.b;
  const x = (b: number) => PAD.l + ((W - PAD.l - PAD.r) * b) / Math.max(1, w.maxBalls);
  const y = (p: number) => PAD.t + inner - inner * p;
  const first = w.points[0]!, last = w.points[w.points.length - 1]!;
  const pts = w.points.map((p) => `${x(p.x).toFixed(1)},${y(p.p).toFixed(1)}`).join(" ");
  const bpo = m.rules.ballsPerOver, overs = Math.ceil(w.maxBalls / bpo), every = overs > 12 ? 2 : 1;
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  return (
    <section className="card">
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${w.chasing}'s chance of winning the chase, ball by ball. It starts at ${pct(first.p)} and ends at ${pct(last.p)}.`} style={{ width: "100%", height: "auto" }}>
        <Axes h={h} maxY={100} ticks={4} unit="%" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} stroke="var(--mute)" strokeDasharray="5 4" aria-hidden="true" />
        {Array.from({ length: Math.floor(overs / every) + 1 }, (_, i) => i * every).filter((o) => o <= overs).map((o) => (
          <text key={o} x={x(o * bpo)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--mute)" aria-hidden="true">{o}</text>
        ))}
        <text x={W - PAD.r} y={h - 8} textAnchor="end" fontSize="9" fill="var(--mute)" aria-hidden="true">overs</text>
        <polyline fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" points={pts} />
        <circle cx={x(last.x)} cy={y(last.p)} r="4.5" fill="var(--gold)" stroke="var(--night)" strokeWidth="1.5" />
      </svg>
      <p style={{ margin: "8px 0 0" }}><b>{w.chasing}</b> chase: <b>{pct(first.p)}</b> at the start, <b>{pct(last.p)}</b> at the end.</p>
      <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
        This is a <b style={{ color: "var(--white)" }}>rough estimate, not a prediction</b>. It looks at the target, the runs so far, the wickets lost and the balls left, and compares how fast the side has been scoring with the first innings. The dashed line is 50%.
      </p>
    </section>
  );
}

/** For the report tabs: both charts have a short heading. */
export function WormTab({ m }: { m: MatchState }) { return <div className="stack"><WormChart m={m} /></div>; }
export function WinTab({ m }: { m: MatchState }) { return <div className="stack"><WinChart m={m} /></div>; }

/* ---------- 2. compare two players ---------- */
export function CompareTable({ rows, aName, bName }: { rows: CompareRow[]; aName: string; bName: string }) {
  const aWins = rows.filter((r) => r.better === "a").length, bWins = rows.filter((r) => r.better === "b").length;
  const groups = ["batting", "bowling", "fielding", "awards", "matches"] as const;
  const title = { batting: "Batting", bowling: "Bowling", fielding: "Fielding", awards: "Awards", matches: "Matches" };
  return (
    <div className="stack">
      <section className="card center">
        <b>{aName} <span className="muted">v</span> {bName}</b>
        <p style={{ margin: "6px 0 0" }}>{aName} is ahead in <b>{aWins}</b> row{aWins === 1 ? "" : "s"}, {bName} in <b>{bWins}</b>.</p>
      </section>
      {groups.map((g) => {
        const list = rows.filter((r) => r.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="card">
            <b>{title[g]}</b>
            <table className="sc" aria-label={`${title[g]} comparison`}>
              <thead><tr><th></th><th>{aName}</th><th>{bName}</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}{r.lowSample && <small className="muted" style={{ display: "block" }}>small sample</small>}</td>
                    <td className={r.better === "a" ? "cmp-best" : undefined}>{r.fa}{r.better === "a" && <small className="cmp-word"> better</small>}</td>
                    <td className={r.better === "b" ? "cmp-best" : undefined}>{r.fb}{r.better === "b" && <small className="cmp-word"> better</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <p className="muted small" style={{ margin: 0 }}>The better number is marked with the word “better”. A tie, or a missing number, marks neither. Economy, bowling average, bowling strike rate and batting dot-ball percentage are better when lower.</p>
    </div>
  );
}

/* ---------- 3. batter v bowler ---------- */
export function DuelTable({ rows, kind, communityId }: { rows: DuelRow[]; kind: "bat" | "bowl"; communityId: string }) {
  if (!rows.length) return <div className="card center muted small">{kind === "bat" ? "No balls faced against members yet." : "No balls bowled to members yet."}</div>;
  return (
    <section className="card">
      <table className="sc" aria-label={kind === "bat" ? "Batter against each bowler" : "Bowler against each batter"}>
        <thead><tr><th>{kind === "bat" ? "Bowler" : "Batter"}</th><th>B</th><th>R</th><th>{kind === "bat" ? "Out" : "Wkts"}</th><th>{kind === "bat" ? "SR" : "Dots"}</th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.opponentUserId}>
              <td><Link href={`/c/${communityId}/players/${d.opponentUserId}`} style={{ textDecoration: "underline", textDecorationColor: "var(--line)" }}><b>{d.name}</b></Link></td>
              <td>{d.balls}</td><td>{d.runs}</td><td>{d.dismissals}</td><td>{kind === "bat" ? (d.strikeRate === null ? "–" : f1(d.strikeRate)) : d.dots}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>B balls faced (a wide is not a ball faced), R runs off the bat, {kind === "bat" ? "Out times dismissed by that bowler (a run-out is not the bowler's), SR strike rate" : "Wkts wickets credited to the bowler, Dots balls with no run off the bat"}. Members only.</p>
    </section>
  );
}

/* ---------- 4. where the runs come from ---------- */
export function RunSourcesCard({ s }: { s: RunSources }) {
  if (s.runs === 0) return <div className="card center muted small">No runs off the bat yet.</div>;
  const parts: { key: string; label: string; runs: number; pct: number; colour: string }[] = [
    { key: "singles", label: "Singles", runs: s.singles, pct: s.share.singles, colour: "#5b6b94" },
    { key: "running", label: "Running (2, 3, 5)", runs: s.running, pct: s.share.running, colour: "#a7b3d1" },
    { key: "fours", label: "Fours", runs: s.fours, pct: s.share.fours, colour: "var(--blue)" },
    { key: "sixes", label: "Sixes", runs: s.sixes, pct: s.share.sixes, colour: "var(--gold)" },
    { key: "other", label: "Other", runs: s.other, pct: s.share.other, colour: "var(--orange)" },
  ].filter((p) => p.runs > 0);
  return (
    <section className="card">
      <b>{s.runs} runs off {s.balls} balls</b>
      <div className="stackedbar" role="img" aria-label={`Where the runs came from: ${parts.map((p) => `${p.label} ${Math.round(p.pct)} percent`).join(", ")}`} style={{ marginTop: 10, height: 18 }}>
        {parts.map((p) => <span key={p.key} style={{ flexGrow: p.runs, background: p.colour }} />)}
      </div>
      <table className="sc" aria-label="Runs by source">
        <thead><tr><th>Source</th><th>Runs</th><th>Share</th></tr></thead>
        <tbody>{parts.map((p) => <tr key={p.key}><td>{p.label}</td><td>{p.runs}</td><td>{Math.round(p.pct)}%</td></tr>)}</tbody>
      </table>
      <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
        Extras the team gained while this batter was on strike (wides, no balls, byes and leg-byes) are not his runs and are kept apart: <b style={{ color: "var(--white)" }}>{s.extrasWhileOnStrike}</b>.
      </p>
    </section>
  );
}

/* ---------- 9. partnership pairs ---------- */
export function PairsList({ rows, communityId }: { rows: PairRow[]; communityId: string }) {
  if (!rows.length) return <div className="card center muted small">No partnerships between members yet.</div>;
  return (
    <section className="card list">
      {rows.slice(0, 20).map((p, i) => (
        <div key={`${p.userIdA}${p.userIdB}`} className="item" style={{ alignItems: "flex-start" }}>
          <b style={{ width: 26 }}>{i + 1}</b>
          <span className="t grow">
            <b><Link href={`/c/${communityId}/players/${p.userIdA}`}>{p.nameA}</Link> &amp; <Link href={`/c/${communityId}/players/${p.userIdB}`}>{p.nameB}</Link></b>
            <small>{p.partnerships} partnership{p.partnerships === 1 ? "" : "s"} · {p.balls} balls · best {p.best} (<Link href={`/c/${communityId}/matches/${p.bestMatchId}/report`} style={{ textDecoration: "underline" }}>match</Link>)</small>
          </span>
          <b>{p.runs}</b>
        </div>
      ))}
    </section>
  );
}

/* ---------- 10. community records ---------- */
export function RecordsList({ lines, communityId }: { lines: RecordLine[]; communityId: string }) {
  return (
    <section className="card list">
      {lines.map((r) => (
        <div key={r.title} className="item" style={{ alignItems: "flex-start" }}>
          <span className="t grow">
            <small className="muted">{r.title}</small>
            <b style={{ fontSize: "1.05rem" }}>{r.holder ? (r.userId ? <Link href={`/c/${communityId}/players/${r.userId}`}>{r.holder}</Link> : r.holder) : "Nobody yet"}</b>
            <small>{r.detail}{r.matchId && <> · <Link href={`/c/${communityId}/matches/${r.matchId}/report`} style={{ textDecoration: "underline" }}>see the match</Link></>}</small>
          </span>
          <b style={{ fontSize: "1.2rem", color: "var(--gold)" }}>{r.figure}</b>
        </div>
      ))}
    </section>
  );
}

/* ---------- 11. bowling by over ---------- */
export function BowlOverTable({ rows, title, communityId }: { rows: OverBowlRow[]; title: string; communityId: string }) {
  return (
    <section className="card">
      <b>{title}</b>
      {rows.length === 0 ? <p className="muted small" style={{ margin: "6px 0 0" }}>No bowling by members yet.</p> : (
        <table className="sc" aria-label={title}>
          <thead><tr><th>Bowler</th><th>Balls</th><th>Runs</th><th>Wkts</th><th>Econ</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} style={r.ranked ? undefined : { opacity: 0.55 }}>
                <td><Link href={`/c/${communityId}/players/${r.userId}`}><b>{r.name}</b></Link>{!r.ranked && <small className="muted" style={{ display: "block" }}>needs {BOWL_BY_OVER_MIN_BALLS} balls to be ranked</small>}</td>
                <td>{r.balls}</td><td>{r.runs}</td><td>{r.wickets}</td><td>{r.economy === null ? "–" : r.economy.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
