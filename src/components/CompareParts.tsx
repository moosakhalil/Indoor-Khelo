// Compare players: the result (score of the comparison, then Batting, Bowling, Fielding, Awards, Matches as cards) and the quick picks.
// All numbers are the rows compareCareers() already produced; nothing is recomputed here except counting the marks.
import "./ld.css";
import Link from "next/link";
import { IconInfo, IconSwap } from "@/components/LdIcons";
import type { CompareRow } from "@/lib/analytics";
import { LOWER_IS_BETTER_KEYS, compareHref, compareScore, type QuickPick } from "@/lib/ldView";

const GROUPS = ["batting", "bowling", "fielding", "awards", "matches"] as const;
const TITLE = { batting: "Batting", bowling: "Bowling", fielding: "Fielding", awards: "Awards", matches: "Matches" };

export function QuickPicks({ communityId, picks }: { communityId: string; picks: QuickPick[] }) {
  if (!picks.length) return null;
  return (
    <div className="ld-quick">
      <span className="ld-eyebrow" id="ld-quick-h">QUICK PICKS</span>
      <ul aria-labelledby="ld-quick-h">
        {picks.map((p) => (
          <li key={`${p.a}-${p.b}`}><Link href={compareHref(communityId, p.a, p.b)} className="ld-chipbtn" aria-label={`Compare ${p.aName} and ${p.bName}`}><IconSwap size={14} /> {p.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export function CompareBoard({ rows, aName, bName, aMatches, bMatches }: { rows: CompareRow[]; aName: string; bName: string; aMatches: number; bMatches: number }) {
  const s = compareScore(rows);
  const none = [aMatches === 0 ? aName : null, bMatches === 0 ? bName : null].filter((x): x is string => !!x);
  const pct = (n: number) => `${s.total ? (n * 100) / s.total : 0}%`;
  return (
    <div className="stack">
      <section className="ld-score" aria-label="Score of the comparison">
        <div className="ld-score-row">
          <div className="ld-score-side"><b className="ld-score-num">{s.a}</b><span className="ld-eyebrow">{aName.toUpperCase()}</span></div>
          <div className="ld-score-mid"><span className="ld-eyebrow">ROWS WON</span><span className="muted small">{s.level} level</span></div>
          <div className="ld-score-side b"><b className="ld-score-num">{s.b}</b><span className="ld-eyebrow">{bName.toUpperCase()}</span></div>
        </div>
        <div className="ld-splitbar" aria-hidden="true"><span style={{ width: pct(s.a) }} className="a" /><span style={{ width: pct(s.level) }} className="lv" /><span style={{ width: pct(s.b) }} className="b" /></div>
        <p className="ld-sr">{aName} is ahead in {s.a} row{s.a === 1 ? "" : "s"}, {bName} in {s.b}; {s.level} {s.level === 1 ? "is" : "are"} level.</p>
      </section>
      {none.length > 0 && (
        <div className="ld-note" role="note">
          <IconInfo size={18} />
          <span>{none.join(" and ")} {none.length === 1 ? "has" : "have"} no finished matches yet. Counts show 0, rates show – and a row with a missing number is never marked better.</span>
        </div>
      )}
      <div className="ld-bento">
        {GROUPS.map((g) => {
          const list = rows.filter((r) => r.group === g);
          if (!list.length) return null;
          return (
            <section key={g} className="card ld-cmp-card">
              <b>{TITLE[g]}</b>
              <table className="ld-cmp" aria-label={`${TITLE[g]} comparison`}>
                <thead><tr><th scope="col">{aName}</th><th scope="col"><span className="ld-sr">Measure</span></th><th scope="col">{bName}</th></tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.key}>
                      <td className={`ld-cv${r.better === "a" ? " best" : ""}`}><span>{r.fa}</span>{r.better === "a" && <small className="ld-better">Better</small>}</td>
                      <th scope="row" className="ld-cl">
                        {r.label}
                        {LOWER_IS_BETTER_KEYS.has(r.key) && <small className="muted">lower is better</small>}
                        {r.lowSample && <small className="ld-sample">Small sample</small>}
                      </th>
                      <td className={`ld-cv${r.better === "b" ? " best" : ""}`}><span>{r.fb}</span>{r.better === "b" && <small className="ld-better">Better</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: 0 }}>The better number is gold and carries the word “better”. A tie, or a missing number, marks neither. Economy, bowling average, bowling strike rate and batting dot-ball percentage are better when lower.</p>
    </div>
  );
}
