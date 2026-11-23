// Phase 6: a player's statistics page content: Overview, Batting, Bowling, Fielding, Matches, with filters. Server component.
import Link from "next/link";
import { fmt, type Career, type MatchLine } from "@/lib/career";
import { oversText } from "@/lib/engine/engine";

export const STAT_TABS = [["overview", "Overview"], ["batting", "Batting"], ["bowling", "Bowling"], ["fielding", "Fielding"], ["matches", "Matches"]] as const;
export type StatTab = (typeof STAT_TABS)[number][0];

const n1 = (v: number | null) => fmt(v, { decimals: 1 });
const n2 = (v: number | null) => fmt(v, { decimals: 2 });
const int = (v: number | null) => fmt(v, {});

function Grid({ items }: { items: [string, string | number][] }) {
  return (
    <div className="statgrid">
      {items.map(([k, v]) => <div key={k} className="statcell"><b>{v}</b><small className="muted">{k}</small></div>)}
    </div>
  );
}

/** Last five innings as bars: a duck is drawn differently, 30 or more is highlighted. */
function Last5({ items }: { items: { runs: number; out: boolean }[] }) {
  if (!items.length) return null;
  const max = Math.max(10, ...items.map((i) => i.runs));
  return (
    <section className="card">
      <b>Last {items.length} innings</b>
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
      <p className="muted small" style={{ margin: "6px 0 0" }}>Gold: 30 or more. Dashed red: out for a duck. * means not out.</p>
    </section>
  );
}

export default function PlayerStats({ c, lines, tab, base, linesFilter, communityId }: {
  c: Career; lines: MatchLine[]; tab: StatTab; base: string; linesFilter: "all" | "bat" | "bowl"; communityId: string;
}) {
  const link = (t: StatTab, extra = "") => `${base}${base.includes("?") ? "&" : "?"}tab=${t}${extra}`;
  const b = c.batting, w = c.bowling, f = c.fielding;
  const bpo = w.bpo;
  return (
    <div className="stack">
      <nav className="row wrap" aria-label="Statistics sections">
        {STAT_TABS.map(([k, label]) => <Link key={k} href={link(k)} className={`chip${tab === k ? " gold" : ""}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
      </nav>

      {tab === "overview" && (
        <>
          <Grid items={[["Matches", c.matches], ["Runs", b.runs], ["Wickets", w.wickets]]} />
          <section className="card">
            <b>Batting</b>
            <Grid items={[["Average", b.average === null ? "–" : n2(b.average)], ["Strike rate", n1(b.strikeRate)], ["Highest", b.highest ? `${b.highest.score}${b.highest.notOut ? "*" : ""}` : "–"]]} />
          </section>
          <section className="card">
            <b>Bowling</b>
            <Grid items={[["Economy", n2(w.economy)], ["Average", n2(w.average)], ["Best", w.best ? `${w.best.wickets}/${w.best.runs}` : "–"]]} />
          </section>
          <Last5 items={b.last5} />
          <section className="card">
            <b>Awards</b>
            <p style={{ margin: "6px 0 0" }}>Player of the Match: <b>{c.awards.count}</b>{c.awards.count ? ` · ${c.awards.points} points in those matches` : ""}</p>
            {c.awards.list.map((a) => <Link key={a.matchId} href={`/c/${communityId}/matches/${a.matchId}/report`} className="muted small" style={{ display: "block", textDecoration: "underline" }}>v {a.opponent}: {a.points} points</Link>)}
          </section>
          <section className="card">
            <b>Recent matches</b>
            <div className="list" style={{ marginTop: 6 }}>
              {[...lines].reverse().slice(0, 5).map((l) => (
                <Link key={l.matchId} href={`/c/${communityId}/matches/${l.matchId}/report`} className="item">
                  <span className={`chip ${l.result === "win" ? "green" : l.result === "loss" ? "red" : ""}`} style={{ minHeight: 28 }}>{l.result === "win" ? "W" : l.result === "loss" ? "L" : l.result === "tie" ? "T" : "–"}</span>
                  <span className="t grow"><b>{l.teamName} v {l.opponent}</b><small>{l.bat.length ? `${l.bat.reduce((a, x) => a + x.runs, 0)} (${l.bat.reduce((a, x) => a + x.balls, 0)})` : "did not bat"}{l.bowl.length ? ` · ${l.bowl.reduce((a, x) => a + x.wickets, 0)}/${l.bowl.reduce((a, x) => a + x.runs, 0)}` : ""}</small></span>
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "batting" && (
        <>
          <section className="card"><b>Totals</b><Grid items={[["Matches", c.matches], ["Innings", b.innings], ["Not outs", b.notOuts], ["Runs", b.runs], ["Balls faced", b.balls]]} /></section>
          <section className="card"><b>Rates</b>
            <Grid items={[["Average", b.average === null ? "–" : n2(b.average)], ["Strike rate", n1(b.strikeRate)], ["Highest score", b.highest ? `${b.highest.score}${b.highest.notOut ? "*" : ""}` : "–"], ["Best strike rate (6+ balls)", n1(b.bestStrikeRate)], ["Runs on free hits", b.freeHitRuns]]} />
          </section>
          <section className="card"><b>How the runs were scored</b>
            <Grid items={[["Dots", b.dots], ["Singles", b.singles], ["Twos", b.twos], ["Threes", b.threes], ["Fours", b.fours], ["Fives", b.fives], ["Sixes", b.sixes]]} />
            <div className="stackedbar" aria-hidden="true">
              {[["dots", b.dots], ["singles", b.singles], ["twos", b.twos], ["threes", b.threes], ["fours", b.fours], ["fives", b.fives], ["sixes", b.sixes]].map(([k, v]) => <span key={k as string} className={`seg ${k}`} style={{ flexGrow: (v as number) || 0 }} />)}
            </div>
          </section>
          <section className="card"><b>Boundaries</b>
            <Grid items={[["Fours", b.fours], ["Sixes", b.sixes], ["Boundary runs", b.boundaryRuns], ["Boundary runs %", b.boundaryPercent === null ? "–" : `${n1(b.boundaryPercent)}%`], ["Balls per boundary", n1(b.ballsPerBoundary)], ["Dot ball %", b.dotPercent === null ? "–" : `${n1(b.dotPercent)}%`]]} />
          </section>
          <section className="card"><b>Scores</b>
            <Grid items={[["30 or more", b.thirties], ["Ducks", b.ducks], ["Golden ducks", b.goldenDucks]]} />
            {b.bestPartnership && <p className="muted small" style={{ margin: "8px 0 0" }}>Best partnership: <b style={{ color: "var(--white)" }}>{b.bestPartnership.runs}</b> ({b.bestPartnership.balls} balls) with {b.bestPartnership.withName}</p>}
          </section>
          <section className="card"><b>How out</b>
            <Grid items={Object.entries({ "Not out": b.howOut.not_out ?? 0, Bowled: b.howOut.bowled ?? 0, Caught: b.howOut.caught ?? 0, LBW: b.howOut.lbw ?? 0, Stumped: b.howOut.stumped ?? 0, "Hit wicket": b.howOut.hit_wicket ?? 0, "Run out": b.howOut.run_out ?? 0, "Retired out": b.howOut.retired_out ?? 0 })} />
          </section>
          <Last5 items={b.last5} />
        </>
      )}

      {tab === "bowling" && (
        <>
          <section className="card"><b>Totals</b><Grid items={[["Innings", w.innings], ["Overs", oversText(w.balls, bpo)], ["Runs conceded", w.runs], ["Wickets", w.wickets]]} /></section>
          <section className="card"><b>Rates</b>
            <Grid items={[["Economy", n2(w.economy)], ["Average", n2(w.average)], ["Strike rate", n1(w.strikeRate)], ["Best figures", w.best ? `${w.best.wickets}/${w.best.runs}` : "–"], ["Best economy", n2(w.bestEconomy)], ["Worst economy", n2(w.worstEconomy)]]} />
          </section>
          <section className="card"><b>Wickets by type</b>
            <Grid items={[["Bowled", w.byType.bowled], ["Caught", w.byType.caught], ["Caught & bowled", w.byType.caughtBowled], ["LBW", w.byType.lbw], ["Stumped", w.byType.stumped], ["Hit wicket", w.byType.hit_wicket]]} />
          </section>
          <section className="card"><b>Control</b>
            <Grid items={[["Dot balls", w.dots], ["Dot ball %", w.dotPercent === null ? "–" : `${n1(w.dotPercent)}%`], ["Maidens", w.maidens]]} />
          </section>
          <section className="card"><b>Extras and boundaries conceded</b>
            <Grid items={[["Wides", w.wides], ["No balls", w.noballs], ["Free hits given", w.freeHits], ["Fours", w.fours], ["Sixes", w.sixes], ["Runs from them", w.fours * 4 + w.sixes * 6]]} />
          </section>
          <section className="card"><b>Hauls</b><Grid items={[["2+ wickets", w.twoWicketHauls], ["3+ wickets", w.threeWicketHauls], ["Hat-tricks", w.hatTricks]]} /></section>
        </>
      )}

      {tab === "fielding" && (
        <section className="card">
          <b>Fielding</b>
          <Grid items={[["Catches", f.catches], ["Caught & bowled", f.caughtBowled], ["Run-outs", f.runOuts], ["Stumpings", f.stumpings], ["All dismissals", f.total], ["Matches with a fielder recorded", f.matchesRecorded]]} />
          <p className="muted small" style={{ margin: "8px 0 0" }}>Fielding counts only where the scorer named the fielder. Dropped catches and misfields are not recorded.</p>
        </section>
      )}

      {tab === "matches" && (
        <>
          <section className="card"><b>Team record while this player played</b>
            <Grid items={[["Played", c.record.played], ["Won", c.record.won], ["Lost", c.record.lost], ["Tied", c.record.tied], ["Win %", c.record.winPercent === null ? "–" : `${n1(c.record.winPercent)}%`]]} />
          </section>
          <section className="card"><b>Awards</b>
            <Grid items={[["Player of the Match", c.awards.count], ["Points in those", c.awards.points], ["Average points a match", n1(c.awards.averagePoints)]]} />
          </section>
          <div className="row wrap" role="group" aria-label="Show">
            {([["all", "All lines"], ["bat", "Batting"], ["bowl", "Bowling"]] as const).map(([k, t]) => <Link key={k} href={link("matches", `&lines=${k}`)} className={`chip${linesFilter === k ? " gold" : ""}`}>{t}</Link>)}
          </div>
          <section className="card list">
            {[...lines].reverse().filter((l) => (linesFilter === "bat" ? l.bat.length : linesFilter === "bowl" ? l.bowl.length : true)).map((l) => (
              <Link key={l.matchId} href={`/c/${communityId}/matches/${l.matchId}/report`} className="item" style={{ alignItems: "flex-start" }}>
                <span className={`chip ${l.result === "win" ? "green" : l.result === "loss" ? "red" : ""}`} style={{ minHeight: 28 }}>{l.result === "win" ? "W" : l.result === "loss" ? "L" : l.result === "tie" ? "T" : "–"}</span>
                <span className="t grow">
                  <b>{l.teamName} v {l.opponent}</b>
                  <small>{l.when ? new Date(l.when).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}{l.numberUsed !== null ? ` · wore #${l.numberUsed}` : ""}</small>
                  {linesFilter !== "bowl" && <small>Bat: {l.bat.length ? l.bat.map((x) => `${x.runs}${x.out ? "" : "*"} (${x.balls}) ${x.fours}×4 ${x.sixes}×6`).join(", ") : "did not bat"}</small>}
                  {linesFilter !== "bat" && <small>Bowl: {l.bowl.length ? l.bowl.map((x) => `${x.wickets}/${x.runs} (${oversText(x.balls, l.ballsPerOver)} ov)`).join(", ") : "did not bowl"} · catches {l.field.catches + l.field.caughtBowled}</small>}
                  <small>Player of the Match points: {l.points}{l.pom ? " · Player of the Match" : ""}</small>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </section>
        </>
      )}

      <details className="card">
        <summary style={{ cursor: "pointer" }}><b>ⓘ What the numbers mean</b></summary>
        <ul className="muted small" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
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
    </div>
  );
}
