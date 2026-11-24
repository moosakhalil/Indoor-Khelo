// Phase 6: a player's statistics page content: Overview, Batting, Bowling, Fielding, Matches. Server component.
// Phase F5 (UI redesign): segmented tabs, tile rows with the key figure in gold, run mix and "how out" as bars with legends,
// result badges and one-line match rows, the help as an accordion. Every figure still comes from careerOf (src/lib/career.ts).
import Link from "next/link";
import PfIcon from "@/components/PfIcons";
import { pfDate } from "@/components/PfParts";
import TeamBadge from "@/components/TeamBadge";
import { fmt, type Career, type MatchLine } from "@/lib/career";
import { oversText } from "@/lib/engine/engine";
import "./pf.css";

export const STAT_TABS = [["overview", "Overview"], ["batting", "Batting"], ["bowling", "Bowling"], ["fielding", "Fielding"], ["matches", "Matches"]] as const;
export type StatTab = (typeof STAT_TABS)[number][0];

const n1 = (v: number | null) => fmt(v, { decimals: 1 });
const n2 = (v: number | null) => fmt(v, { decimals: 2 });

type Cell = [label: string, value: string | number, highlight?: boolean];

/** A row of figure tiles. `cols` is 2 on a phone-sized card of four or more, 3 for three. */
function Tiles({ items, cols = 3 }: { items: Cell[]; cols?: 2 | 3 }) {
  return (
    <div className={`pf-tiles${cols === 2 ? " two" : ""}`}>
      {items.map(([k, v, hi]) => <div key={k} className={`pf-tile${hi ? " hi" : ""}`}><b>{v}</b><span className="pf-tl">{k}</span></div>)}
    </div>
  );
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="pf-box"><div className="pf-box-head"><h2>{title}</h2></div>{children}</section>
);

/** Horizontal bars with the number at the end, for "how out" and "wickets by type". */
function HBars({ items }: { items: [string, number][] }) {
  const max = Math.max(1, ...items.map(([, v]) => v));
  return (
    <ul className="pf-hbars">
      {items.map(([k, v]) => (
        <li key={k}><span className="pf-hl">{k}</span><span className="pf-track" aria-hidden="true"><span style={{ width: `${(v * 100) / max}%` }} /></span><b>{v}</b></li>
      ))}
    </ul>
  );
}

/** Last five innings as bars: a duck is drawn differently, 30 or more is highlighted, with a legend in words. */
function Last5({ items }: { items: { runs: number; out: boolean }[] }) {
  if (!items.length) return null;
  const max = Math.max(10, ...items.map((i) => i.runs));
  return (
    <section className="pf-box">
      <div className="pf-box-head"><h2>Last {items.length} innings</h2></div>
      <div className="bars" role="img" aria-label={`Last innings: ${items.map((i) => `${i.runs}${i.out ? "" : " not out"}`).join(", ")}`}>
        {items.map((i, k) => {
          const duck = i.runs === 0 && i.out, big = i.runs >= 30;
          return (
            <div key={k} className="barcol">
              <span className="barnum">{i.runs}{i.out ? "" : "*"}</span>
              <span className={`bar${duck ? " duck" : big ? " big" : ""}`} style={{ height: `${Math.max(duck ? 6 : 8, (i.runs * 100) / max)}%` }} />
            </div>
          );
        })}
      </div>
      <ul className="pf-legend" aria-label="Key">
        <li><i className="pf-dotc gold" />30 or more</li>
        <li><i className="pf-dotc under" />Under 30</li>
        <li><i className="pf-dotc duck" />Out for a duck</li>
        <li>* not out</li>
      </ul>
    </section>
  );
}

const RESULT: Record<string, [string, string]> = { win: ["WON", "won"], loss: ["LOST", "lost"], tie: ["TIED", "tied"] };

/** One match as one row: opponent badge, result word, date, number worn, then the figures in tabular numerals. */
function MatchRow({ l, communityId, show = "all" }: { l: MatchLine; communityId: string; show?: "all" | "bat" | "bowl" }) {
  const [word, cls] = RESULT[l.result] ?? ["No result", "none"];
  const catches = l.field.catches + l.field.caughtBowled;
  const batFig = l.bat.length ? l.bat.map((x) => `${x.runs}${x.out ? "" : "*"}`).join(", ") : null;
  const balls = l.bat.length ? l.bat.map((x) => `(${x.balls})`).join(" ") : "";
  const bowlFig = l.bowl.length ? l.bowl.map((x) => `${x.wickets}/${x.runs}`).join(", ") : null;
  const bits = [pfDate(l.when), l.numberUsed !== null ? `wore #${l.numberUsed}` : "", catches > 0 ? `${catches} ${catches === 1 ? "catch" : "catches"}` : "", `${l.points} pts`].filter(Boolean);
  return (
    <Link href={`/c/${communityId}/matches/${l.matchId}/report`} className="pf-mrow">
      <TeamBadge name={l.opponent} size="sm" label={`Opponent ${l.opponent}`} />
      <span className="pf-mid">
        <b>{l.teamName} v {l.opponent}</b>
        <span className="pf-mmeta">
          <span className={`pf-res ${cls}`}>{word}</span>
          <span>{bits.join(" · ")}</span>
          {l.pom && <span className="pf-pom">Player of the Match</span>}
        </span>
      </span>
      <span className="pf-figs">
        {show !== "bowl" && (batFig ? <span><b>{batFig}</b> <small>{balls}</small></span> : <small>did not bat</small>)}
        {show !== "bat" && (bowlFig ? <span><b>{bowlFig}</b></span> : <small>did not bowl</small>)}
      </span>
      <PfIcon name="chevron" size={18} />
    </Link>
  );
}

/** The "What the numbers mean" accordion, closed by default, at the end of every tab. */
export function PfHelp() {
  return (
    <details className="pf-help">
      <summary><PfIcon name="info" size={18} /><b>What the numbers mean</b><PfIcon name="chevdown" size={18} /></summary>
      <ul>
        <li><b>Batting average</b> = runs ÷ times out. Not outs are not counted as outs. If never out, it shows a dash.</li>
        <li><b>Strike rate</b> = runs ÷ balls faced × 100. A wide is not a ball faced. A no ball is a ball faced.</li>
        <li><b>Dot ball (batting):</b> a legal ball faced with no runs off the bat. <b>Dot ball (bowling):</b> a legal ball with no runs conceded by the bowler; byes and leg-byes count as dots for the bowler.</li>
        <li><b>Economy</b> = runs conceded ÷ overs bowled, counting wides and no balls but not byes or leg-byes. <b>Bowling average</b> = runs ÷ wickets. <b>Bowling strike rate</b> = balls ÷ wickets.</li>
        <li><b>Bowler wickets</b> are bowled, caught (including caught and bowled), LBW, stumped and hit wicket. Run-outs and retirements are not credited to the bowler.</li>
        <li><b>Maiden:</b> a full over by one bowler with no runs conceded. A wide or a no ball breaks a maiden.</li>
        <li><b>Fielding</b> counts only where the scorer named the fielder.</li>
        <li>Only finished matches count. Abandoned matches and super-over balls are left out. A guest&rsquo;s figures count only once the guest is linked to a member.</li>
      </ul>
    </details>
  );
}

export default function PlayerStats({ c, lines, tab, base, linesFilter, communityId, analyticsHref, showSummary = true }: {
  c: Career; lines: MatchLine[]; tab: StatTab; base: string; linesFilter: "all" | "bat" | "bowl"; communityId: string;
  /** Shows the Analytics card before the help (the Player page passes it). */
  analyticsHref?: string;
  /** The Matches / Runs / Wickets tiles at the top of Overview. The Player page shows the career strip instead, so it turns this off. */
  showSummary?: boolean;
}) {
  const link = (t: StatTab, extra = "") => `${base}${base.includes("?") ? "&" : "?"}tab=${t}${extra}`;
  const b = c.batting, w = c.bowling, f = c.fielding;
  const bpo = w.bpo;
  const avg = b.average === null ? "–" : n2(b.average);
  const highest = b.highest ? `${b.highest.score}${b.highest.notOut ? "*" : ""}` : "–";
  const best = w.best ? `${w.best.wickets}/${w.best.runs}` : "–";
  const pct = (v: number | null) => (v === null ? "–" : `${n1(v)}%`);
  const newest = [...lines].reverse();
  const shownLines = newest.filter((l) => (linesFilter === "bat" ? l.bat.length : linesFilter === "bowl" ? l.bowl.length : true));
  const mix: [string, string, number][] = [["dots", "Dots", b.dots], ["singles", "Singles", b.singles], ["twos", "Twos", b.twos], ["threes", "Threes", b.threes], ["fours", "Fours", b.fours], ["fives", "Fives", b.fives], ["sixes", "Sixes", b.sixes]];

  return (
    <div className="stack pf-stats">
      <nav className="pf-tabs" aria-label="Statistics sections">
        {STAT_TABS.map(([k, label]) => <Link key={k} href={link(k)} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
      </nav>

      {tab === "overview" && (
        <>
          {showSummary && <Tiles items={[["Matches", c.matches], ["Runs", b.runs, true], ["Wickets", w.wickets]]} />}
          <Card title="Batting"><Tiles items={[["Average", avg], ["Strike rate", n1(b.strikeRate)], ["Highest", highest, true]]} /></Card>
          <Card title="Bowling"><Tiles items={[["Economy", n2(w.economy)], ["Average", n2(w.average)], ["Best", best, true]]} /></Card>
          <Last5 items={b.last5} />
          <Card title="Awards">
            <p className="pf-award"><span className="pf-big">{c.awards.count}</span><span><b>Player of the Match</b>{c.awards.count ? <small className="muted">{c.awards.points} points in those matches</small> : <small className="muted">None yet</small>}</span></p>
            {c.awards.list.length > 0 && (
              <ul className="pf-plain">
                {c.awards.list.map((a) => (
                  <li key={a.matchId}><Link href={`/c/${communityId}/matches/${a.matchId}/report`} className="pf-line"><span>v {a.opponent}</span><b>{a.points} pts</b><PfIcon name="chevron" size={16} /></Link></li>
                ))}
              </ul>
            )}
          </Card>
          <section className="pf-box pf-wide">
            <div className="pf-box-head"><h2>Recent matches</h2><Link href={link("matches")} className="pf-link">All matches</Link></div>
            <div className="pf-mlist">{newest.slice(0, 5).map((l) => <MatchRow key={l.matchId} l={l} communityId={communityId} />)}</div>
          </section>
        </>
      )}

      {tab === "batting" && (
        <>
          <Card title="Totals"><Tiles cols={2} items={[["Matches", c.matches], ["Innings", b.innings], ["Not outs", b.notOuts], ["Runs", b.runs, true], ["Balls faced", b.balls]]} /></Card>
          <Card title="Rates"><Tiles cols={2} items={[["Average", avg], ["Strike rate", n1(b.strikeRate)], ["Highest score", highest, true], ["Best strike rate (6+ balls)", n1(b.bestStrikeRate)], ["Runs on free hits", b.freeHitRuns]]} /></Card>
          <Card title="How the runs were scored">
            <div className="stackedbar" role="img" aria-label={`Run mix: ${mix.map(([, l, v]) => `${l} ${v}`).join(", ")}`}>
              {mix.map(([k, , v]) => <span key={k} className={`seg ${k}`} style={{ flexGrow: v || 0 }} />)}
            </div>
            <ul className="pf-legend wide" aria-label="Run mix legend">
              {mix.map(([k, l, v]) => <li key={k}><i className={`pf-dotc ${k}`} />{l} <b>{v}</b></li>)}
            </ul>
          </Card>
          <Card title="Boundaries">
            <Tiles cols={2} items={[["Fours", b.fours], ["Sixes", b.sixes], ["Boundary runs", b.boundaryRuns], ["Boundary runs %", pct(b.boundaryPercent)], ["Balls per boundary", n1(b.ballsPerBoundary)], ["Dot ball %", pct(b.dotPercent)]]} />
          </Card>
          <Card title="Scores">
            <Tiles items={[["30 or more", b.thirties], ["Ducks", b.ducks], ["Golden ducks", b.goldenDucks]]} />
            {b.bestPartnership && (
              <p className="pf-callout"><PfIcon name="star" size={18} /><span><b>Best partnership: {b.bestPartnership.runs} runs</b><small className="muted">{b.bestPartnership.balls} balls with {b.bestPartnership.withName}</small></span></p>
            )}
          </Card>
          <Card title="How out">
            <HBars items={[["Not out", b.howOut.not_out ?? 0], ["Bowled", b.howOut.bowled ?? 0], ["Caught", b.howOut.caught ?? 0], ["LBW", b.howOut.lbw ?? 0], ["Stumped", b.howOut.stumped ?? 0], ["Hit wicket", b.howOut.hit_wicket ?? 0], ["Run out", b.howOut.run_out ?? 0], ["Retired out", b.howOut.retired_out ?? 0]]} />
          </Card>
          <Last5 items={b.last5} />
        </>
      )}

      {tab === "bowling" && (
        <>
          <Card title="Totals"><Tiles cols={2} items={[["Innings", w.innings], ["Overs", oversText(w.balls, bpo)], ["Runs conceded", w.runs], ["Wickets", w.wickets, true]]} /></Card>
          <Card title="Rates"><Tiles items={[["Economy", n2(w.economy)], ["Average", n2(w.average)], ["Strike rate", n1(w.strikeRate)], ["Best figures", best, true], ["Best economy", n2(w.bestEconomy)], ["Worst economy", n2(w.worstEconomy)]]} /></Card>
          <Card title="Wickets by type">
            <HBars items={[["Bowled", w.byType.bowled], ["Caught", w.byType.caught], ["Caught & bowled", w.byType.caughtBowled], ["LBW", w.byType.lbw], ["Stumped", w.byType.stumped], ["Hit wicket", w.byType.hit_wicket]]} />
          </Card>
          <Card title="Control">
            <Tiles items={[["Dot balls", w.dots], ["Dot ball %", pct(w.dotPercent)], ["Maidens", w.maidens]]} />
            {w.dotPercent !== null && (
              <div className="pf-gaugerow"><span className="pf-gauge" role="img" aria-label={`Dot ball ${n1(w.dotPercent)} percent`}><span style={{ width: `${Math.min(100, w.dotPercent)}%` }} /></span><b>{n1(w.dotPercent)}%</b></div>
            )}
          </Card>
          <Card title="Extras and boundaries conceded">
            <Tiles items={[["Wides", w.wides], ["No balls", w.noballs], ["Free hits given", w.freeHits], ["Fours", w.fours], ["Sixes", w.sixes], ["Runs from them", w.fours * 4 + w.sixes * 6]]} />
          </Card>
          <Card title="Hauls"><Tiles items={[["2+ wickets", w.twoWicketHauls], ["3+ wickets", w.threeWicketHauls], ["Hat-tricks", w.hatTricks]]} /></Card>
        </>
      )}

      {tab === "fielding" && (
        <Card title="Fielding">
          <Tiles items={[["Catches", f.catches], ["Caught & bowled", f.caughtBowled], ["Run-outs", f.runOuts], ["Stumpings", f.stumpings], ["All dismissals", f.total, true], ["Matches with a fielder recorded", f.matchesRecorded]]} />
          <p className="pf-note"><PfIcon name="info" size={18} /><span>Fielding counts only where the scorer named the fielder. Dropped catches and misfields are not recorded.</span></p>
        </Card>
      )}

      {tab === "matches" && (
        <>
          <Card title="Team record while this player played">
            <Tiles items={[["Played", c.record.played], ["Won", c.record.won], ["Lost", c.record.lost], ["Tied", c.record.tied], ["Win %", pct(c.record.winPercent), true]]} />
            <div className="pf-record" role="img" aria-label={`Won ${c.record.won}, tied ${c.record.tied}, lost ${c.record.lost}`}>
              <span className="won" style={{ flexGrow: c.record.won }} /><span className="tied" style={{ flexGrow: c.record.tied }} /><span className="lost" style={{ flexGrow: c.record.lost }} />
            </div>
            <ul className="pf-legend" aria-label="Record legend">
              <li><i className="pf-dotc won" />Won {c.record.won}</li><li><i className="pf-dotc tied" />Tied {c.record.tied}</li><li><i className="pf-dotc lost" />Lost {c.record.lost}</li>
            </ul>
          </Card>
          <Card title="Awards"><Tiles items={[["Player of the Match", c.awards.count, true], ["Points in those", c.awards.points], ["Average points a match", n1(c.awards.averagePoints)]]} /></Card>
          <section className="pf-box pf-wide">
            <div className="pf-box-head"><h2>Every match</h2><span className="pf-count-shown">{shownLines.length} shown</span></div>
            <div className="pf-seg" role="group" aria-label="Show">
              {([["all", "All lines"], ["bat", "Batting"], ["bowl", "Bowling"]] as const).map(([k, t]) => <Link key={k} href={link("matches", `&lines=${k}`)} className={linesFilter === k ? "on" : ""} aria-current={linesFilter === k ? "true" : undefined}>{t}</Link>)}
            </div>
            <div className="pf-mlist">{shownLines.map((l) => <MatchRow key={l.matchId} l={l} communityId={communityId} show={linesFilter} />)}</div>
          </section>
        </>
      )}

      {analyticsHref && (
        <Link href={analyticsHref} className="pf-analytics">
          <span className="pf-analytics-ic" aria-hidden="true"><PfIcon name="chart" size={22} /></span>
          <span><b>Analytics</b><small className="muted">Form, where the runs come from, batter v bowler</small></span>
          <PfIcon name="chevron" size={18} />
        </Link>
      )}
      <PfHelp />
    </div>
  );
}
