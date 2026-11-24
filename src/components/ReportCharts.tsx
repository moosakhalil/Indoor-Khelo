// Phase D3: the charts of the match report (over by over, worm, win chance). Hand-drawn inline SVG that scales to the card
// width, no hooks, so the server draws them and the public report gets the same ones. The numbers come from the same
// functions the old charts used (wormSeries, winSeries, oversSummary); only the drawing is new.
import RpIcon from "@/components/RpIcons";
import TeamBadge from "@/components/TeamBadge";
import { winSeries, wormSeries } from "@/lib/analytics";
import type { MatchState } from "@/lib/engine/types";
import { oversSummary } from "@/lib/stats";
import "./rp.css";

const W = 360;
const GOLD = "var(--gold)";
const BLUE = "var(--blue)";

/** A top of the scale and a step so there are about four gridlines (e.g. 13 -> 15 in steps of 5). */
export function scale(max: number): { top: number; step: number } {
  const m = Math.max(1, max);
  const step = m <= 5 ? 1 : m <= 10 ? 2 : m <= 25 ? 5 : m <= 50 ? 10 : m <= 100 ? 20 : m <= 250 ? 50 : 100;
  return { top: Math.ceil(m / step) * step, step };
}

function Grid({ l, r, t, h, top, step, unit = "" }: { l: number; r: number; t: number; h: number; top: number; step: number; unit?: string }) {
  const lines: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) lines.push(v);
  return (
    <g aria-hidden="true">
      {lines.map((v) => {
        const y = t + h - (h * v) / top;
        return <g key={v}><line x1={l} x2={W - r} y1={y} y2={y} stroke="var(--line)" /><text x={l - 5} y={y + 3.500} textAnchor="end" fontSize="9.500" fill="var(--mute)">{v}{unit}</text></g>;
      })}
    </g>
  );
}

/* ---------- over by over ---------- */
export function OversChart({ m }: { m: MatchState }) {
  const regular = m.innings.filter((i) => !i.superOver);
  const all = oversSummary(m).filter((o) => regular.some((i) => i.index === o.innings));
  if (!all.length) return null;
  const nOvers = Math.max(...all.map((o) => o.over)) + 1;
  const L = 28, R = 8, T = 30, B = 24, H = 210, h = H - T - B;
  const { top, step } = scale(Math.max(...all.map((o) => o.runs)));
  const group = (W - L - R) / nOvers;
  const bw = Math.min(16, (group - 6) / regular.length);
  const colours = [GOLD, BLUE];
  const label = regular.map((inn) => `${m.sides[inn.batting - 1]}: ${all.filter((o) => o.innings === inn.index).map((o) => `over ${o.over + 1} ${o.runs}${o.wickets ? ` with ${o.wickets} wicket${o.wickets === 1 ? "" : "s"}` : ""}`).join(", ")}`).join(". ");
  return (
    <section className="rp-card">
      <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Runs in each over. ${label}.`}>
        <Grid l={L} r={R} t={T} h={h} top={top} step={step} />
        {Array.from({ length: nOvers }, (_, i) => {
          const gx = L + i * group + (group - bw * regular.length) / 2;
          return (
            <g key={i}>
              <text x={L + i * group + group / 2} y={H - 8} textAnchor="middle" fontSize="9.500" fill="var(--mute)" aria-hidden="true">{i + 1}</text>
              {regular.map((inn, k) => {
                const o = all.find((x) => x.innings === inn.index && x.over === i);
                if (!o) return null;
                const bh = Math.max(o.runs === 0 ? 2 : 3, (h * o.runs) / top);
                const x = gx + k * bw, y = T + h - bh;
                return (
                  <g key={k}>
                    <rect x={x} y={y} width={bw - 1.500} height={bh} rx="2.500" fill={colours[k % 2]} />
                    {nOvers <= 12 && <text x={x + (bw - 1.500) / 2} y={y - 3} textAnchor="middle" fontSize="8.500" fontWeight="700" fill="var(--white)" aria-hidden="true">{o.runs}</text>}
                    {o.wickets > 0 && (
                      <g aria-hidden="true">
                        <circle cx={x + (bw - 1.500) / 2} cy={y - (nOvers <= 12 ? 15 : 8)} r="6" fill="var(--red)" stroke="var(--night)" strokeWidth="1.200" />
                        <text x={x + (bw - 1.500) / 2} y={y - (nOvers <= 12 ? 12 : 5)} textAnchor="middle" fontSize="7.500" fontWeight="800" fill="#fff">W</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        <text x={W - R} y={11} textAnchor="end" fontSize="9" fill="var(--mute)" aria-hidden="true">runs in the over</text>
      </svg>
      <ul className="rp-legend">
        {regular.map((inn, k) => (
          <li key={inn.index}><span className="rp-swatch" style={{ background: colours[k % 2] }} aria-hidden="true" /><TeamBadge name={m.sides[inn.batting - 1]} size="sm" /> {m.sides[inn.batting - 1]}</li>
        ))}
        <li><span className="rp-wdot" aria-hidden="true">W</span> Wicket in the over</li>
      </ul>
    </section>
  );
}

/* ---------- worm ---------- */
export function WormView({ m }: { m: MatchState }) {
  const { lines, maxBalls, maxRuns } = wormSeries(m);
  if (!lines.length || lines.every((l) => l.points.length < 2)) {
    return <EmptyState icon="chart" title="Nothing to draw yet" text="No balls to draw yet." />;
  }
  const L = 30, R = 10, T = 16, B = 26, H = 230, h = H - T - B, bpo = m.rules.ballsPerOver;
  const { top, step } = scale(maxRuns);
  const x = (b: number) => L + ((W - L - R) * b) / maxBalls;
  const y = (r: number) => T + h - (h * r) / top;
  const overs = Math.ceil(maxBalls / bpo), every = overs > 12 ? 2 : 1;
  const colours = [GOLD, BLUE];
  const words = lines.map((l) => `${l.side} ${l.total}`).join(", ");
  return (
    <div className="stack">
      <section className="rp-card">
        <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Match worm: runs ball by ball. ${words}. Red dots marked W are wickets.`}>
          <Grid l={L} r={R} t={T} h={h} top={top} step={step} />
          {Array.from({ length: Math.floor(overs / every) + 1 }, (_, i) => i * every).filter((o) => o <= overs).map((o) => (
            <text key={o} x={x(o * bpo)} y={H - 9} textAnchor="middle" fontSize="9.500" fill="var(--mute)" aria-hidden="true">{o}</text>
          ))}
          <text x={W - R} y={H - 9} textAnchor="end" fontSize="9" fill="var(--mute)" aria-hidden="true">overs</text>
          {lines.map((l, i) => (
            <g key={l.innings}>
              <polyline fill="none" stroke={colours[i % 2]} strokeWidth="2.800" strokeLinejoin="round" strokeDasharray={i % 2 ? "7 4" : undefined} points={l.points.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")} />
              {l.points.filter((p) => p.wicket).map((p, k) => (
                <g key={k} aria-hidden="true">
                  <circle cx={x(p.x)} cy={y(p.y)} r="4.500" fill="var(--red)" stroke="var(--night)" strokeWidth="1.500" />
                  <text x={x(p.x)} y={y(p.y) - 8} textAnchor="middle" fontSize="8.500" fontWeight="800" fill="#ff9a9e">W</text>
                </g>
              ))}
            </g>
          ))}
        </svg>
        <ul className="rp-legend">
          {lines.map((l, i) => (
            <li key={l.innings}>
              <svg width="30" height="8" aria-hidden="true"><line x1="0" x2="30" y1="4" y2="4" stroke={colours[i % 2]} strokeWidth="3" strokeDasharray={i % 2 ? "7 4" : undefined} /></svg>
              <TeamBadge name={l.side} size="sm" />
              <span><b>{l.side}</b> {l.total}/{l.points.filter((p) => p.wicket).length}{i % 2 ? " (dashed line)" : " (solid line)"}</span>
            </li>
          ))}
          <li><span className="rp-wdot" aria-hidden="true">W</span> Wicket</li>
        </ul>
      </section>
      <p className="rp-info"><RpIcon name="info" size={18} /><span>Each line is a team&rsquo;s runs as the balls were bowled. Red dots are wickets. Where the lines cross or pull apart is where the match turned.</span></p>
    </div>
  );
}

/* ---------- win chance ---------- */
export function WinView({ m }: { m: MatchState }) {
  const w = winSeries(m);
  if (!w) return <EmptyState icon="chart" title="No chase in this match" text="Win chance is shown for matches where one side chased a target. This match had no chase." />;
  const L = 34, R = 10, T = 12, B = 26, H = 210, h = H - T - B, bpo = m.rules.ballsPerOver;
  const x = (b: number) => L + ((W - L - R) * b) / Math.max(1, w.maxBalls);
  const y = (p: number) => T + h - h * p;
  const first = w.points[0]!, last = w.points[w.points.length - 1]!;
  const pts = w.points.map((p) => `${x(p.x).toFixed(1)},${y(p.p).toFixed(1)}`).join(" ");
  const area = `${x(first.x).toFixed(1)},${y(0).toFixed(1)} ${pts} ${x(last.x).toFixed(1)},${y(0).toFixed(1)}`;
  const overs = Math.ceil(w.maxBalls / bpo), every = overs > 12 ? 2 : 1;
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  return (
    <div className="stack">
      <section className="rp-card">
        <div className="rp-win-head">
          <TeamBadge name={w.chasing} size="md" />
          <div className="grow"><b>{w.chasing}</b><small className="muted" style={{ display: "block" }}>Chance of winning the chase</small></div>
          <div className="rp-win-num score-num" aria-hidden="true">{pct(first.p)} <span>&rarr;</span> {pct(last.p)}</div>
        </div>
        <p className="rp-sr">{w.chasing} chase: {pct(first.p)} at the start, {pct(last.p)} at the end.</p>
        <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${w.chasing}'s chance of winning the chase, ball by ball. It starts at ${pct(first.p)} and ends at ${pct(last.p)}.`}>
          <Grid l={L} r={R} t={T} h={h} top={100} step={25} unit="%" />
          <line x1={L} x2={W - R} y1={y(0.5)} y2={y(0.5)} stroke="var(--mute)" strokeDasharray="5 4" aria-hidden="true" />
          {Array.from({ length: Math.floor(overs / every) + 1 }, (_, i) => i * every).filter((o) => o <= overs).map((o) => (
            <text key={o} x={x(o * bpo)} y={H - 9} textAnchor="middle" fontSize="9.500" fill="var(--mute)" aria-hidden="true">{o}</text>
          ))}
          <text x={W - R} y={H - 9} textAnchor="end" fontSize="9" fill="var(--mute)" aria-hidden="true">overs</text>
          <polygon points={area} fill={GOLD} fillOpacity="0.16" aria-hidden="true" />
          <polyline fill="none" stroke={GOLD} strokeWidth="2.800" strokeLinejoin="round" points={pts} />
          <circle cx={x(last.x)} cy={y(last.p)} r="4.800" fill={GOLD} stroke="var(--night)" strokeWidth="1.500" />
        </svg>
      </section>
      <div className="rp-caution" role="note">
        <RpIcon name="info" size={20} />
        <div>
          <b>A rough estimate, not a prediction</b>
          <p>It looks at the target, the runs so far, the wickets lost and the balls left, and compares how fast the side has been scoring with the first innings. The dashed line is 50%.</p>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: "chart" | "ball" | "trophy"; title: string; text: string }) {
  return (
    <div className="rp-empty">
      <span className="rp-empty-ic"><RpIcon name={icon} size={28} /></span>
      <b>{title}</b>
      <p className="muted small">{text}</p>
    </div>
  );
}
