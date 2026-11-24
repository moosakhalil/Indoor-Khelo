// Phase 6 and Phase D3: the pieces of a finished match's report. Server components (no hooks); the few things that react to a
// tap live in ReportClient.tsx. The same pieces draw the member report and the public report: `communityId === null` means the
// public view (no links into the community, nothing the public page did not show before).
import Link from "next/link";
import PdfActions from "@/components/PdfActions";
import { AppMark } from "@/components/RpBrand";
import { OversChart, WinView, WormView } from "@/components/ReportCharts";
import { BallsView, PomSheet, type BallRow, type InningsGroup } from "@/components/ReportClient";
import RpIcon, { type RpIconName } from "@/components/RpIcons";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { dismissalText, economy, oversText, runRate, strikeRate, totalExtras } from "@/lib/engine/engine";
import type { BallRecord, InningsState, MatchState, Side } from "@/lib/engine/types";
import type { CorrectionRecord } from "@/lib/corrections";
import { formatWhen } from "@/lib/matchRules";
import { POM_POINTS, computeMatchStats, matchFigures, oversSummary, partnershipsOf } from "@/lib/stats";
import "./rp.css";

type Common = { m: MatchState; communityId: string | null; matchId?: string };   // null = public view: no links into the community

/** The eight tabs of the report, in order. The same on the member page and the public page. */
export const REPORT_TABS = [["summary", "Summary"], ["scorecard", "Scorecard"], ["balls", "Ball by ball"], ["overs", "Over by over"], ["stats", "Match stats"], ["worm", "Worm"], ["win", "Win chance"], ["changes", "Changes"]] as const;
export type ReportTab = (typeof REPORT_TABS)[number][0];
export const reportTab = (raw: string | undefined): ReportTab => (REPORT_TABS.find(([k]) => k === raw)?.[0] ?? "summary");

/**
 * A shirt number is new on the public page (it showed names only before). It is shown because every player is a gold shirt
 * (locked design rule). Set this to false to leave shirts off the public page again; nothing else needs to change.
 */
export const PUBLIC_SHIRT_NUMBERS = true;

const side = (m: MatchState, s: Side) => m.sides[s - 1];

/* ---------- people ---------- */
export function PlayerName({ m, id, communityId, matchId }: { m: MatchState; id: string; communityId: string | null; matchId?: string }) {
  const p = m.players[id];
  if (!p) return <>Player</>;
  if (p.userId && communityId) return <Link href={`/c/${communityId}/players/${p.userId}${matchId ? `?match=${matchId}` : ""}`} className="rp-plink">{p.name}</Link>;
  return <>{p.name}{p.kind === "guest" && <span className="rp-guest">Guest</span>}</>;
}

/** The gold shirt of a player (grey and a dash for a guest). Nothing at all on the public page when PUBLIC_SHIRT_NUMBERS is off. */
export function PlayerShirt({ m, id, size = "small", communityId }: { m: MatchState; id: string; size?: "small" | "normal"; communityId: string | null }) {
  const p = m.players[id];
  if (!p || (communityId === null && !PUBLIC_SHIRT_NUMBERS)) return null;
  return <Shirt number={p.kind === "guest" ? null : p.number} size={size} label={p.kind === "guest" ? "Guest, no shirt number" : p.number === null ? "No shirt number" : `Shirt number ${p.number}`} />;
}

/* ---------- the score header on top of every tab ---------- */
type Status = { word: string; tone: "green" | "blue" | "red" | "grey" };
function statusOf(m: MatchState): Status {
  switch (m.result?.kind) {
    case "tie": return { word: "Tied", tone: "blue" };
    case "abandoned": return { word: "Abandoned", tone: "red" };
    case "no_result": return { word: "No result", tone: "grey" };
    default: return { word: "Completed", tone: "green" };
  }
}

export function ScoreHeader({ m, whenText, venue, overs, mySide }: { m: MatchState; whenText: string; venue?: string | null; overs: number; mySide?: Side | null }) {
  const st = statusOf(m);
  const regular = m.innings.filter((i) => !i.superOver);
  const bpo = m.rules.ballsPerOver;
  const kind = m.result?.kind;
  const rows: { side: Side; score: InningsState | null }[] = regular.length ? regular.map((i) => ({ side: i.batting, score: i })) : ([1, 2] as Side[]).map((s) => ({ side: s, score: null }));
  const decided = kind === "win" || kind === "innings";
  const resultIcon: RpIconName = kind === "tie" ? "equal" : decided ? "trophy" : "info";
  return (
    <section className="rp-head" aria-label="Result">
      <div className="rp-head-meta">
        <span className={`rp-status ${st.tone}`}>{st.word}</span>
        <span className="muted small">{overs} overs · {whenText}{venue ? ` · ${venue}` : ""}</span>
      </div>
      {rows.map(({ side: s, score }) => {
        const won = decided && m.result?.winner === s;
        const me = mySide === s;
        return (
          <div key={s} className={`rp-team${won ? " won" : ""}${me ? " me" : ""}`}>
            <TeamBadge name={side(m, s)} size="md" />
            <span className="rp-team-name">
              <b>{side(m, s)}</b>
              {won && <><RpIcon name="trophy" size={16} className="rp-trophy" /><span className="rp-sr"> (won)</span></>}
              {me && <small className="rp-mine">Your team</small>}
            </span>
            {score ? (
              <span className="rp-team-score" aria-label={`${score.runs} for ${score.wickets} in ${oversText(score.legalBalls, bpo)} overs`}>
                <b className="score-num rp-score">{score.runs}<span>/{score.wickets}</span></b>
                <small className="muted">{oversText(score.legalBalls, bpo)} ov</small>
              </span>
            ) : <span className="muted small">No score</span>}
          </div>
        );
      })}
      {m.result && <p className={`rp-result ${kind === "tie" ? "tie" : decided ? "win" : "neutral"}`} role="status"><RpIcon name={resultIcon} size={16} /> <b>{m.result.text}</b></p>}
      {m.toss && <p className="muted small rp-toss">{side(m, m.toss.winner)} won the toss and chose to {m.toss.decision}</p>}
    </section>
  );
}

/* ---------- Player of the Match ---------- */
export function PomCard({ m, communityId, matchId }: Common) {
  const { pom, players } = computeMatchStats(m);
  if (!pom || pom.winners.length === 0) {   // (no winners: points level and nobody to separate them; shown as no award rather than an empty card)
    return (
      <section className="rp-card rp-pom-none">
        <span className="rp-empty-ic small"><RpIcon name="trophy" size={22} /></span>
        <div>
          <b>Player of the Match</b>
          <p className="muted small" style={{ margin: "2px 0 0" }}>{m.result?.kind === "abandoned" ? "An abandoned match has no Player of the Match." : "No Player of the Match for this result."}</p>
        </div>
      </section>
    );
  }
  const winners = players.filter((p) => pom.winners.includes(p.entryId));
  return (
    <section className="rp-card rp-pom">
      <p className="rp-eyebrow"><RpIcon name="trophy" size={16} /> Player of the Match{winners.length > 1 ? " (shared)" : ""}</p>
      {winners.map((w) => {
        const p = m.players[w.entryId];
        return (
          <div key={w.entryId} className="rp-pom-win">
            <div className="rp-pom-top">
              {p && (communityId !== null || PUBLIC_SHIRT_NUMBERS) && <Shirt number={p.kind === "guest" ? null : p.number} size="big" name={p.name} label={`${p.name}, ${p.kind === "guest" ? "guest" : p.number === null ? "no shirt number" : `shirt number ${p.number}`}`} />}
              <div className="grow">
                <b className="rp-pom-name"><PlayerName m={m} id={w.entryId} communityId={communityId} matchId={matchId} /></b>
                <span className="rp-who-team"><TeamBadge name={side(m, w.side)} size="sm" /> {side(m, w.side)}</span>
              </div>
              <div className="rp-pom-pts">
                <span className="rp-sr">{w.points} points</span>
                <span aria-hidden="true"><b className="score-num">{w.points}</b><small>POINTS</small></span>
              </div>
            </div>
            <div className="rp-chips">
              {(pom.breakdown[w.entryId] ?? []).map((x, i) => <span key={i} className="rp-chip">{x.label} <b>{x.points > 0 ? "+" : ""}{x.points}</b></span>)}
            </div>
            {p?.kind === "guest" && <p className="muted small" style={{ margin: "8px 0 0" }}>Guest (shown here; not counted in a career unless linked)</p>}
          </div>
        );
      })}
      <div className="rp-pom-foot">
        <p className="small" style={{ margin: 0 }}><b>Top three:</b> {pom.top.map((t, i) => `${i + 1}. ${t.name} ${t.points}`).join(" · ")}</p>
        <p className="muted small" style={{ margin: "2px 0 0" }}>Worked out from the balls scored. Nobody picks the winner.</p>
        <div style={{ marginTop: 8 }}>
          <PomSheet>
            <p className="muted small" style={{ margin: "0 0 8px" }}>The app adds up points from the balls scored in this match. Nobody picks the winner.</p>
            <dl className="rp-rules">
              <div><dt>Batting runs</dt><dd>{POM_POINTS.run} per run</dd></div>
              <div><dt>Boundaries</dt><dd>+{POM_POINTS.four} per four, +{POM_POINTS.six} per six</dd></div>
              <div><dt>Strike-rate bonus</dt><dd>6 or more balls faced: 120+ +3, 150+ +6, 200+ +10</dd></div>
              <div><dt>Wickets</dt><dd>{POM_POINTS.wicket} each (not run-outs)</dd></div>
              <div><dt>Dot balls</dt><dd>+{POM_POINTS.dot} each</dd></div>
              <div><dt>Maidens</dt><dd>+{POM_POINTS.maiden} each</dd></div>
              <div><dt>Economy bonus</dt><dd>1 over or more: 6 or less +6, 4 or less +12</dd></div>
              <div><dt>Fielding</dt><dd>+{POM_POINTS.fielding} per catch, stumping or run-out</dd></div>
              <div><dt>Winning side</dt><dd>+{POM_POINTS.win} (+{POM_POINTS.tie} each in a tie)</dd></div>
            </dl>
            <p className="small" style={{ margin: "10px 0 4px" }}><b>Top three:</b> {pom.top.map((t, i) => `${i + 1}. ${t.name} ${t.points}`).join(" · ")}</p>
            <p className="muted small" style={{ margin: 0 }}>If points are level: the player on the winning side, then more runs, then more wickets, then the better economy. If still level, the award is shared. If the match is corrected later, the award is worked out again by itself.</p>
          </PomSheet>
        </div>
      </div>
    </section>
  );
}

/* ---------- small shared pieces ---------- */
function Strip({ m, id, communityId, matchId, figure, note }: { m: MatchState; id: string; communityId: string | null; matchId?: string; figure: React.ReactNode; note?: React.ReactNode }) {
  const p = m.players[id];
  return (
    <div className="rp-strip">
      <PlayerShirt m={m} id={id} communityId={communityId} />
      <span className="grow">
        <b><PlayerName m={m} id={id} communityId={communityId} matchId={matchId} /></b>
        {p && <span className="rp-who-team"><TeamBadge name={side(m, p.side)} size="sm" /> {side(m, p.side)}</span>}
        {note}
      </span>
      <span className="rp-fig">{figure}</span>
    </div>
  );
}

function Tiles({ m }: { m: MatchState }) {
  const f = matchFigures(m);
  const extras = f.extras.wide + f.extras.noball + f.extras.bye + f.extras.legbye + f.extras.penalty;
  return (
    <div className="rp-tiles">
      <div className="rp-tile"><b className="score-num">{f.fours}</b><span>Fours</span></div>
      <div className="rp-tile"><b className="score-num">{f.sixes}</b><span>Sixes</span></div>
      <div className="rp-tile"><b className="score-num">{f.dotPercent}%</b><span>Dot balls</span></div>
      <div className="rp-tile"><b className="score-num">{extras}</b><span>Extras</span></div>
    </div>
  );
}

const batFigure = (p: { bat: { runs: number; balls: number }[] }) => <><b>{p.bat.reduce((a, b) => a + b.runs, 0)}</b> <small className="muted">({p.bat.reduce((a, b) => a + b.balls, 0)})</small></>;
const bowlFigure = (m: MatchState, p: { bowl: { wickets: number; runs: number; balls: number }[] }, withOvers: boolean) => (
  <><b>{p.bowl.reduce((a, b) => a + b.wickets, 0)}/{p.bowl.reduce((a, b) => a + b.runs, 0)}</b>{withOvers && <> <small className="muted">({oversText(p.bowl.reduce((a, b) => a + b.balls, 0), m.rules.ballsPerOver)} ov)</small></>}</>
);

/* ---------- Summary ---------- */
export function SummaryTab({ m, communityId, matchId, scorers, createdBy, showResult = true }: Common & { scorers: { name: string; balls: number }[]; createdBy: string | null; showResult?: boolean }) {
  const f = matchFigures(m);
  return (
    <div className="stack">
      {showResult && m.result && <div className="banner green" role="status"><b style={{ fontSize: "1.05rem" }}>{m.result.text}</b></div>}
      <PomCard m={m} communityId={communityId} matchId={matchId} />
      <section className="rp-card">
        <b>Top performers</b>
        <div className="rp-strips">
          {f.topBatters.map((p) => <Strip key={`b${p.entryId}`} m={m} id={p.entryId} communityId={communityId} matchId={matchId} figure={batFigure(p)} />)}
          {f.topBowlers.map((p) => <Strip key={`w${p.entryId}`} m={m} id={p.entryId} communityId={communityId} matchId={matchId} figure={bowlFigure(m, p, true)} />)}
        </div>
      </section>
      <Tiles m={m} />
      <p className="rp-by muted small">
        Created by <b>{createdBy ?? "—"}</b>
        {scorers.length > 0 && <> · Scored by <b>{scorers.map((s) => `${s.name} (${s.balls} ball${s.balls === 1 ? "" : "s"})`).join(", ")}</b></>}
      </p>
    </div>
  );
}

/* ---------- Scorecard ---------- */
function InningsCard({ m, inn, communityId, matchId }: { m: MatchState; inn: InningsState; communityId: string | null; matchId?: string }) {
  const bpo = m.rules.ballsPerOver;
  const team = side(m, inn.batting);
  const batted = Object.values(inn.batters).sort((a, b) => a.order - b.order);
  const dnb = Object.values(m.players).filter((p) => p.side === inn.batting && !inn.batters[p.id] && !m.gone[p.id]);
  const bowlers = Object.values(inn.bowlers);
  const label = inn.superOver ? "Super over" : `Innings ${inn.index + 1}`;
  const name = inn.superOver ? `Super over: ${team}` : `${team}, innings ${inn.index + 1}`;
  return (
    <section className="rp-card rp-innings">
      <div className="rp-inn-head">
        <TeamBadge name={team} size="md" />
        <div className="rp-inn-title"><small>{inn.superOver ? <span className="rp-so">Super over</span> : label.toUpperCase()}</small><b>{team}</b></div>
        <div className="rp-inn-score"><b className="score-num">{inn.runs}<span>/{inn.wickets}</span></b><small className="muted">{oversText(inn.legalBalls, bpo)} ov · RR {runRate(inn, bpo).toFixed(2)}</small></div>
      </div>
      <table className="rp-tbl" aria-label={`${name} batting`}>
        <thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
        <tbody>
          {batted.map((b) => (
            <tr key={b.id}>
              <td>
                <div className="rp-who">
                  <PlayerShirt m={m} id={b.id} communityId={communityId} />
                  <span><b><PlayerName m={m} id={b.id} communityId={communityId} matchId={matchId} />{b.status === "batting" && <span className="rp-star" aria-hidden="true">*</span>}</b><small className="muted">{dismissalText(m, b)}</small></span>
                </div>
              </td>
              <td className={b.runs >= 30 ? "hi" : undefined}><b>{b.runs}</b></td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td><td>{strikeRate(b).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dnb.length > 0 && <p className="muted small rp-line">Did not bat: {dnb.map((p) => p.name).join(", ")}</p>}
      <p className="small rp-line rp-extras"><span className="muted">Extras</span> <b>{totalExtras(inn)}</b> <span className="muted">(wides {inn.extras.wide}, no balls {inn.extras.noball}, byes {inn.extras.bye}, leg-byes {inn.extras.legbye}{inn.extras.penalty ? `, penalty ${inn.extras.penalty}` : ""})</span></p>
      {inn.fow.length > 0 && (
        <div className="rp-fow">
          <p className="rp-eyebrow quiet">Fall of wickets</p>
          <ul>
            {inn.fow.map((w) => <li key={w.n} className="rp-chip"><b>{w.n}-{w.runs}</b> {m.players[w.player]?.name ?? "Player"} · {w.over} ov</li>)}
          </ul>
        </div>
      )}
      <table className="rp-tbl" aria-label={`${name} bowling`}>
        <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
        <tbody>
          {bowlers.map((b) => (
            <tr key={b.id}>
              <td><div className="rp-who"><PlayerShirt m={m} id={b.id} communityId={communityId} /><span><b><PlayerName m={m} id={b.id} communityId={communityId} matchId={matchId} /></b></span></div></td>
              <td>{oversText(b.legalBalls, bpo)}</td><td>{b.maidens}</td><td>{b.runs}</td><td className={b.wickets > 0 ? "hi" : undefined}><b>{b.wickets}</b></td><td>{economy(b, bpo).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PartnershipCard({ m, inn, communityId, matchId }: { m: MatchState; inn: InningsState; communityId: string | null; matchId?: string }) {
  const parts = partnershipsOf(inn);
  if (!parts.length) return null;
  const max = Math.max(1, ...parts.map((p) => p.runs));
  const best = Math.max(...parts.map((p) => p.runs));
  return (
    <section className="rp-card">
      <b>Partnerships: {inn.superOver ? "super over" : `innings ${inn.index + 1}`}</b>
      <ul className="rp-parts">
        {parts.map((p, i) => (
          <li key={i}>
            <div className="rp-part-top">
              <span><PlayerName m={m} id={p.a} communityId={communityId} matchId={matchId} />{p.b && <> &amp; <PlayerName m={m} id={p.b} communityId={communityId} matchId={matchId} /></>}</span>
              <b>{p.runs} <small className="muted">({p.balls})</small></b>
            </div>
            <span className="rp-bar" aria-hidden="true"><span className={p.runs === best && best > 0 ? "gold" : ""} style={{ width: `${Math.max(3, (p.runs * 100) / max)}%` }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ScorecardTab({ m, communityId, matchId }: Common) {
  const regular = m.innings.filter((i) => !i.superOver);
  const supers = m.innings.filter((i) => i.superOver);
  return (
    <div className="stack">
      <div className="rp-innings-cols">{regular.map((inn) => <InningsCard key={inn.index} m={m} inn={inn} communityId={communityId} matchId={matchId} />)}</div>
      {supers.length > 0 && <div className="rp-innings-cols">{supers.map((inn) => <InningsCard key={inn.index} m={m} inn={inn} communityId={communityId} matchId={matchId} />)}</div>}
      <div className="rp-innings-cols">{m.innings.map((inn) => <PartnershipCard key={inn.index} m={m} inn={inn} communityId={communityId} matchId={matchId} />)}</div>
    </div>
  );
}

/* ---------- Ball by ball ---------- */
function kindOf(b: BallRecord): BallRow["kind"] {
  if (b.wicket) return "wicket";
  if (b.extra) return "extra";
  if (b.batRuns === 6) return "six";
  if (b.batRuns === 4) return "four";
  return b.teamRuns === 0 ? "dot" : "run";
}

/** The balls of every innings, grouped by over (exported so the grouping can be tested). */
export function ballGroups(m: MatchState): InningsGroup[] {
  return m.innings.map((inn) => {
    const byOver = new Map<number, BallRecord[]>();
    for (const b of inn.balls) (byOver.get(b.over) ?? byOver.set(b.over, []).get(b.over)!).push(b);
    return {
      key: `i${inn.index}`,
      label: inn.superOver ? "SUPER OVER" : `INNINGS ${inn.index + 1}`,
      team: side(m, inn.batting),
      score: `${inn.runs}/${inn.wickets}`,
      overs: Array.from(byOver.entries()).sort((a, b) => a[0] - b[0]).map(([over, balls]) => ({
        key: `i${inn.index}o${over}`,
        number: over + 1,
        bowler: m.players[balls[0]!.bowler]?.name ?? "Bowler",
        runs: balls.reduce((a, b) => a + b.teamRuns, 0),
        wickets: balls.filter((b) => b.wicket).length,
        balls: balls.map((b) => ({
          id: b.eventId, label: b.label, text: b.text, over: b.over, ball: b.ball, kind: kindOf(b),
          boundary: (b.extra === null || b.extra === "noball") && (b.batRuns === 4 || b.batRuns === 6), extra: b.extra !== null, wicket: b.wicket,
        })),
      })),
    };
  });
}

/** Every delivery in order, grouped by over, with the over and ball, who bowled to whom and what happened. */
export function BallsTab({ m, communityId, matchId }: Common & { matchId: string }) {
  return (
    <div className="stack">
      {communityId && <p className="muted small" style={{ margin: 0 }}>Every delivery, in order. Spotted a mistake? Tap the pencil on that ball: any member can, and the change is logged with their name.</p>}
      <BallsView innings={ballGroups(m)} communityId={communityId} matchId={matchId} />
    </div>
  );
}

/* ---------- Over by over ---------- */
export function OversTab({ m }: { m: MatchState }) {
  const all = oversSummary(m);
  const max = Math.max(1, ...all.map((o) => o.runs));
  return (
    <div className="stack">
      <OversChart m={m} />
      <div className="rp-innings-cols">
        {m.innings.map((inn) => {
          const overs = all.filter((o) => o.innings === inn.index);
          return (
            <section key={inn.index} className="rp-card">
              <div className="rp-inn-head compact">
                <TeamBadge name={side(m, inn.batting)} size="sm" />
                <b>{inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}: {side(m, inn.batting)}</b>
              </div>
              <ul className="rp-over-rows">
                {overs.map((o) => (
                  <li key={o.over}>
                    <b className="rp-over-lbl">Over {o.over + 1}</b>
                    <span className="rp-bar grow" aria-hidden="true"><span className={o.wickets ? "red" : "blue"} style={{ width: `${Math.max(4, (o.runs * 100) / max)}%` }} /></span>
                    <span className="rp-over-fig small"><b>{o.runs}</b> runs{o.wickets ? <b className="rp-wk">, {o.wickets} wkt{o.wickets === 1 ? "" : "s"}</b> : ""}<br /><span className="muted">{m.players[o.bowler]?.name}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: 0 }}>Blue bars are runs in the over. A red bar means a wicket fell (W).</p>
    </div>
  );
}

/* ---------- Match stats ---------- */
export function StatsTab({ m, communityId, matchId }: Common) {
  const f = matchFigures(m);
  const regular = m.innings.filter((i) => !i.superOver);
  const bpo = m.rules.ballsPerOver;
  const rates = regular.map((i) => ({ i, rate: i.legalBalls ? (i.runs * bpo) / i.legalBalls : 0 }));
  const maxRate = Math.max(1, ...rates.map((r) => r.rate));
  const ex = f.extras;
  const parts = [
    { k: "wide", label: "Wides", n: ex.wide, colour: "var(--gold)" },
    { k: "noball", label: "No balls", n: ex.noball, colour: "var(--red)" },
    { k: "bye", label: "Byes", n: ex.bye, colour: "var(--blue)" },
    { k: "legbye", label: "Leg-byes", n: ex.legbye, colour: "#a78bfa" },
    ...(ex.penalty ? [{ k: "penalty", label: "Penalty", n: ex.penalty, colour: "var(--orange)" }] : []),
  ];
  const total = parts.reduce((a, p) => a + p.n, 0);
  const bestMax = Math.max(1, ...f.bestPartnerships.map((p) => p.runs));
  return (
    <div className="stack">
      <Tiles m={m} />
      <section className="rp-card">
        <b>Run rate</b>
        <ul className="rp-rates">
          {rates.map(({ i, rate }, k) => (
            <li key={i.index}>
              <TeamBadge name={side(m, i.batting)} size="sm" />
              <span className="rp-rate-name">Run rate, {side(m, i.batting)}</span>
              <span className="rp-bar grow" aria-hidden="true"><span className={k % 2 ? "blue" : "gold"} style={{ width: `${Math.max(3, (rate * 100) / maxRate)}%` }} /></span>
              <b>{rate.toFixed(2)}</b>
            </li>
          ))}
        </ul>
      </section>
      <section className="rp-card">
        <b>Extras</b>
        {total > 0 ? (
          <span className="rp-stack" aria-hidden="true">{parts.filter((p) => p.n > 0).map((p) => <span key={p.k} style={{ flex: p.n, background: p.colour }} />)}</span>
        ) : <p className="muted small" style={{ margin: "6px 0 0" }}>No extras.</p>}
        <ul className="rp-legend tight">
          {parts.map((p) => <li key={p.k}><span className="rp-swatch" style={{ background: p.colour }} aria-hidden="true" />{p.label} {p.n}</li>)}
        </ul>
        <p className="rp-sr">Wides {ex.wide} · no balls {ex.noball} · byes {ex.bye} · leg-byes {ex.legbye}{ex.penalty ? ` · penalty ${ex.penalty}` : ""}</p>
      </section>
      <section className="rp-card">
        <b>Best partnerships</b>
        <ul className="rp-parts">
          {f.bestPartnerships.map((p, i) => (
            <li key={i}>
              <div className="rp-part-top">
                <span><PlayerName m={m} id={p.a} communityId={communityId} matchId={matchId} />{p.b && <> &amp; <PlayerName m={m} id={p.b} communityId={communityId} matchId={matchId} /></>}</span>
                <b>{p.runs} <small className="muted">({p.balls})</small></b>
              </div>
              <span className="rp-bar" aria-hidden="true"><span className={i === 0 ? "gold" : ""} style={{ width: `${Math.max(3, (p.runs * 100) / bestMax)}%` }} /></span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rp-card">
        <b>Top batters</b>
        <div className="rp-strips">{f.topBatters.map((p) => <Strip key={p.entryId} m={m} id={p.entryId} communityId={communityId} matchId={matchId} figure={batFigure(p)} />)}</div>
      </section>
      <section className="rp-card">
        <b>Top bowlers</b>
        <div className="rp-strips">{f.topBowlers.map((p) => <Strip key={p.entryId} m={m} id={p.entryId} communityId={communityId} matchId={matchId} figure={bowlFigure(m, p, false)} />)}</div>
      </section>
    </div>
  );
}

/* ---------- Worm and Win chance (drawn in ReportCharts) ---------- */
export function WormPanel({ m }: { m: MatchState }) { return <WormView m={m} />; }
export function WinPanel({ m }: { m: MatchState }) { return <WinView m={m} />; }

/* ---------- Changes ---------- */
const CORRECTED = "A delivery was corrected";

function iconFor(m: MatchState, text: string): RpIconName {
  if (/^A delivery was corrected/.test(text)) return "pencil";
  if (/^Match started/.test(text)) return "flag";
  if (/^(Innings|Super over)/.test(text)) return "bat";
  if (/ joined /.test(text)) return "userplus";
  if (/^Match (paused|resumed)/.test(text)) return "pause";
  if (m.result && text === m.result.text) return m.result.kind === "win" || m.result.kind === "innings" ? "trophy" : "info";
  return "dot";
}

function Correction({ c, tz }: { c: CorrectionRecord; tz?: string }) {
  return (
    <div className="rp-corr">
      {c.ballText && <p className="rp-corr-ball">{c.inningsLabel ? `${c.inningsLabel} · ` : ""}{c.ballText}</p>}
      {c.changes.length === 0 && <p className="rp-corr-ba"><span className="muted">Was</span> {c.before} <RpIcon name="swap" size={14} /> <span className="muted">Now</span> <b>{c.after}</b></p>}
      {c.changes.length > 0 && (
        <ul className="rp-corr-list">
          {c.changes.map((x) => <li key={x.label}><span className="muted">{x.label}:</span> {x.from} &rarr; <b>{x.to}</b></li>)}
        </ul>
      )}
      {c.reason && <p className="rp-corr-why"><span className="muted">Reason:</span> {c.reason}</p>}
      {(c.scores.length > 0 || (c.resultBefore && c.resultAfter && c.resultBefore !== c.resultAfter) || (c.pomBefore !== c.pomAfter)) && (
        <ul className="rp-corr-list effect">
          {c.scores.map((s) => <li key={s.label}><span className="muted">{s.label}:</span> {s.before} &rarr; <b>{s.after}</b></li>)}
          {c.resultBefore && c.resultAfter && c.resultBefore !== c.resultAfter && <li><span className="muted">Result:</span> {c.resultBefore} &rarr; <b>{c.resultAfter}</b></li>}
          {c.pomBefore !== c.pomAfter && <li><span className="muted">Player of the Match:</span> {c.pomBefore ?? "none"} &rarr; <b>{c.pomAfter ?? "none"}</b></li>}
        </ul>
      )}
      {tz && c.at && <p className="muted small" style={{ margin: "4px 0 0" }}>Saved {when(c.at, tz)}</p>}
    </div>
  );
}

function when(iso: string, tz: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : formatWhen(d, tz);
}

/**
 * The match log: what happened, who did it, and every correction made after the match. `corrections` (member report only)
 * adds what each correction changed; without it the list is the plain timeline, exactly the facts the public report always showed.
 */
export function ChangesTab({ m, corrections, tz }: { m: MatchState; corrections?: CorrectionRecord[]; tz?: string }) {
  let next = 0;
  return (
    <section className="rp-card">
      <b>Changes during the match, and corrections after it</b>
      {m.timeline.length === 0 ? <p className="muted small" style={{ margin: "6px 0 0" }}>Nothing was changed.</p> : (
        <ol className="rp-tl">
          {m.timeline.map((t, i) => {
            const isCorr = t.text.startsWith(CORRECTED);
            const c = isCorr && corrections ? corrections[next++] : undefined;
            const shownTime = tz && !isCorr && t.at ? when(t.at, tz) : "";
            return (
              <li key={i} className={`rp-tl-item${isCorr ? " corr" : ""}`}>
                <span className="rp-tl-ic"><RpIcon name={iconFor(m, t.text)} size={16} /></span>
                <div className="rp-tl-body">
                  <b>{t.text}</b>
                  {t.by && <small className="muted">by {t.by}</small>}
                  {shownTime && <small className="muted">{shownTime}</small>}
                  {c && <Correction c={c} tz={tz} />}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ---------- cards at the end of the page ---------- */
export function PdfCard({ pdfBase, shareUrl, title, fileName, idSuffix = "" }: { pdfBase: string; shareUrl: string; title: string; fileName: string; idSuffix?: string }) {
  return (
    <section className="rp-card" id={`pdf${idSuffix}`}>
      <div className="rp-card-head"><b><RpIcon name="doc" size={18} /> PDF report</b></div>
      <p className="muted small" style={{ margin: "4px 0 10px" }}>Open it, save it, or send it to WhatsApp or another app.</p>
      <PdfActions pdfBase={pdfBase} shareUrl={shareUrl} title={title} fileName={fileName} />
    </section>
  );
}

/** The "Scored with Indoor Khelo" call to action of the public report. */
export function AppPromoCard() {
  return (
    <section className="rp-card rp-promo">
      <div className="rp-promo-head"><AppMark /><div><b>Scored with Indoor Khelo</b><p className="muted small" style={{ margin: "2px 0 0" }}>Score your own indoor cricket matches, with live scoring, stats and leaderboards.</p></div></div>
      <Link href="/" className="btn gold">Open Indoor Khelo</Link>
    </section>
  );
}
