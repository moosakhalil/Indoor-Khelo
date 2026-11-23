// The public profile: profile fields and career totals only. A server component with no links into any community.
import { fmt, type Career } from "@/lib/career";
import { oversText } from "@/lib/engine/engine";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES, labelOf } from "@/lib/validation";

const n1 = (v: number | null) => fmt(v, { decimals: 1 });
const n2 = (v: number | null) => fmt(v, { decimals: 2 });

function Grid({ items }: { items: [string, string | number][] }) {
  return <div className="statgrid">{items.map(([k, v]) => <div key={k} className="statcell"><b>{v}</b><small className="muted">{k}</small></div>)}</div>;
}

export default function PublicProfileView({ p }: { p: { name: string; playing_role: string | null; batting_hand: string | null; batting_position: string | null; bowling_style: string | null; career: Career } }) {
  const c = p.career, b = c.batting, w = c.bowling;
  const rows: [string, string | null][] = [
    ["Playing role", labelOf(PLAYING_ROLES, p.playing_role)], ["Batting hand", labelOf(BATTING_HANDS, p.batting_hand)],
    ["Batting position", labelOf(BATTING_POSITIONS, p.batting_position)], ["Bowling style", labelOf(BOWLING_STYLES, p.bowling_style)],
  ];
  const max = Math.max(10, ...b.last5.map((i) => i.runs));
  return (
    <div className="stack">
      <section className="card center"><h2>{p.name}</h2><p className="muted small" style={{ margin: "2px 0 0" }}>Indoor cricket</p></section>
      <section className="card list">{rows.map(([k, v]) => <div key={k} className="item space"><span className="muted">{k}</span><b>{v ?? "Not set"}</b></div>)}</section>
      {c.matches === 0 ? (
        <section className="card center"><b>No finished matches yet</b><p className="muted small" style={{ margin: "6px 0 0" }}>Records come only from matches scored in Indoor Khelo.</p></section>
      ) : (
        <>
          <Grid items={[["Matches", c.matches], ["Runs", b.runs], ["Wickets", w.wickets]]} />
          <section className="card"><b>Batting</b><Grid items={[["Average", b.average === null ? "–" : n2(b.average)], ["Strike rate", n1(b.strikeRate)], ["Highest", b.highest ? `${b.highest.score}${b.highest.notOut ? "*" : ""}` : "–"], ["Fours", b.fours], ["Sixes", b.sixes], ["30 or more", b.thirties]]} /></section>
          <section className="card"><b>Bowling</b><Grid items={[["Overs", oversText(w.balls, w.bpo)], ["Economy", n2(w.economy)], ["Best", w.best ? `${w.best.wickets}/${w.best.runs}` : "–"]]} /></section>
          <section className="card"><b>Fielding and awards</b><Grid items={[["Catches", c.fielding.catches + c.fielding.caughtBowled], ["Run-outs", c.fielding.runOuts], ["Player of the Match", c.awards.count]]} /></section>
          {b.last5.length > 0 && (
            <section className="card">
              <b>Last {b.last5.length} innings</b>
              <div className="bars" role="img" aria-label={`Last innings: ${b.last5.map((i) => `${i.runs}${i.out ? "" : " not out"}`).join(", ")}`}>
                {b.last5.map((i, k) => {
                  const duck = i.runs === 0 && i.out, big = i.runs >= 30;
                  return <div key={k} className="barcol"><span className="barnum">{i.runs}{i.out ? "" : "*"}</span><span className={`bar${duck ? " duck" : big ? " big" : ""}`} style={{ height: `${Math.max(duck ? 6 : 8, (i.runs * 100) / max)}%` }} /></div>;
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
