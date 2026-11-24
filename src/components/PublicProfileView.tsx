// The public profile: profile fields and career totals only. A server component with no links into any community.
// Phase G3 look: a shareable player card (gold shirt with the two initials and NO number: the number is private here),
// three big career tiles, then batting, bowling and fielding cards. Nothing new is shown: the same fields and totals as before.
import type { ReactNode } from "react";
import AcIcon from "@/components/AcIcons";
import Shirt from "@/components/Shirt";
import { fmt, type Career } from "@/lib/career";
import { oversText } from "@/lib/engine/engine";
import { BATTING_HANDS, BATTING_POSITIONS, BOWLING_STYLES, PLAYING_ROLES, labelOf } from "@/lib/validation";
import "./ac-public.css";

const n1 = (v: number | null) => fmt(v, { decimals: 1 });
const n2 = (v: number | null) => fmt(v, { decimals: 2 });

type Tile = { k: string; v: string | number; sub?: string; hi?: boolean };

function Tiles({ items, cols = 3 }: { items: Tile[]; cols?: 2 | 3 }) {
  return (
    <div className={`ac-tiles c${cols}`}>
      {items.map((t) => (
        <div key={t.k} className={`ac-tile${t.hi ? " hi" : ""}`}>
          <b>{t.v}</b>
          <span className="ac-tl">{t.k}</span>
          {t.sub && <small>{t.sub}</small>}
        </div>
      ))}
    </div>
  );
}

export default function PublicProfileView({ p, after }: {
  p: { name: string; playing_role: string | null; batting_hand: string | null; batting_position: string | null; bowling_style: string | null; career: Career };
  /** Page-level extras (the call to action and the "shared by the player" note), shown at the end of the stats column. */
  after?: ReactNode;
}) {
  const c = p.career, b = c.batting, w = c.bowling;
  const rows: [string, string | null][] = [
    ["Playing role", labelOf(PLAYING_ROLES, p.playing_role)], ["Batting hand", labelOf(BATTING_HANDS, p.batting_hand)],
    ["Batting position", labelOf(BATTING_POSITIONS, p.batting_position)], ["Bowling style", labelOf(BOWLING_STYLES, p.bowling_style)],
  ];
  const chips = rows.filter(([, v]) => v);
  const max = Math.max(10, ...b.last5.map((i) => i.runs));
  return (
    <div className="ac-pub-grid">
      <div className="ac-pub-side">
        <section className="ac-pcard" aria-label="Player">
          <Shirt size="big" name={p.name} hideNumber />
          <div className="ac-pcard-t">
            <h1>{p.name}</h1>
            <p>Indoor cricket</p>
            <ul className="ac-pchips">
              {chips.length === 0 && <li className="ac-pchip quiet">Role not set</li>}
              {chips.map(([k, v]) => <li key={k} className={`ac-pchip${k === "Playing role" ? " role" : ""}`}>{v}</li>)}
            </ul>
          </div>
        </section>
        <section className="ac-box" aria-labelledby="ac-details-h">
          <h2 id="ac-details-h" className="ac-h">Player details</h2>
          <div className="ac-drows">
            {rows.map(([k, v]) => <div key={k} className="ac-drow"><span>{k}</span><b className={v ? "" : "unset"}>{v ?? "Not set"}</b></div>)}
          </div>
        </section>
      </div>

      <div className="ac-pub-main">
        {c.matches === 0 ? (
          <section className="ac-empty span">
            <span className="ac-empty-ic"><AcIcon name="chart" size={26} /></span>
            <b>No finished matches yet</b>
            <p>Records come only from matches scored in Indoor Khelo.</p>
          </section>
        ) : (
          <>
            <div className="span">
              <Tiles items={[
                { k: "Matches", v: c.matches },
                { k: "Runs", v: b.runs, hi: true, sub: b.highest ? `HS ${b.highest.score}${b.highest.notOut ? "*" : ""}` : undefined },
                { k: "Wickets", v: w.wickets, hi: true, sub: w.best ? `Best ${w.best.wickets}/${w.best.runs}` : undefined },
              ]} />
            </div>
            <section className="ac-box" aria-labelledby="ac-bat-h">
              <h2 id="ac-bat-h" className="ac-h">Batting</h2>
              <Tiles items={[
                { k: "Average", v: b.average === null ? "–" : n2(b.average) }, { k: "Strike rate", v: n1(b.strikeRate) },
                { k: "Highest", v: b.highest ? `${b.highest.score}${b.highest.notOut ? "*" : ""}` : "–", hi: !!b.highest },
                { k: "Fours", v: b.fours }, { k: "Sixes", v: b.sixes }, { k: "30 or more", v: b.thirties },
              ]} />
            </section>
            <section className="ac-box" aria-labelledby="ac-bowl-h">
              <h2 id="ac-bowl-h" className="ac-h">Bowling</h2>
              <Tiles items={[
                { k: "Overs", v: oversText(w.balls, w.bpo) }, { k: "Economy", v: n2(w.economy) },
                { k: "Best", v: w.best ? `${w.best.wickets}/${w.best.runs}` : "–", hi: !!w.best },
              ]} />
            </section>
            <section className="ac-box" aria-labelledby="ac-field-h">
              <h2 id="ac-field-h" className="ac-h">Fielding and awards</h2>
              <Tiles items={[
                { k: "Catches", v: c.fielding.catches + c.fielding.caughtBowled }, { k: "Run-outs", v: c.fielding.runOuts },
                { k: "Player of the Match", v: c.awards.count, hi: c.awards.count > 0 },
              ]} />
            </section>
            {b.last5.length > 0 ? (
              <section className="ac-box">
                <h2 className="ac-h">Last {b.last5.length} innings</h2>
                <div className="bars" role="img" aria-label={`Last innings: ${b.last5.map((i) => `${i.runs}${i.out ? "" : " not out"}`).join(", ")}`}>
                  {b.last5.map((i, k) => {
                    const duck = i.runs === 0 && i.out, big = i.runs >= 30;
                    return <div key={k} className="barcol"><span className="barnum">{i.runs}{i.out ? "" : "*"}</span><span className={`bar${duck ? " duck" : big ? " big" : ""}`} style={{ height: `${Math.max(duck ? 6 : 8, (i.runs * 100) / max)}%` }} /></div>;
                  })}
                </div>
                <ul className="ac-legend" aria-label="How to read the bars">
                  <li><i className="sw big" />30 or more</li>
                  <li><i className="sw" />Under 30</li>
                  <li><i className="sw duck" />Out for a duck</li>
                  <li><b>*</b> not out</li>
                </ul>
              </section>
            ) : (
              <section className="ac-box">
                <h2 className="ac-h">Last innings</h2>
                <p className="ac-quiet">No batting innings yet.</p>
              </section>
            )}
          </>
        )}
        {after}
      </div>
    </div>
  );
}
