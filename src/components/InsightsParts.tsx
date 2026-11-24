// Insights screen parts (server drawn): tab control, record tiles, unbeaten-run bars, partnership rows and the bowling-by-over tables.
// The figures come from communityRecords(), partnershipPairs() and bowlingByOver() in analytics.ts; this file only lays them out.
import "./ld.css";
import Link from "next/link";
import { IconMatch, IconPair, IconSwap } from "@/components/LdIcons";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { BOWL_BY_OVER_MIN_BALLS, type OverBowlRow, type PairRow, type RecordLine } from "@/lib/analytics";

export type NumberOf = (userId: string) => number | null;

export function InsightsTabs({ communityId, tab, tabs }: { communityId: string; tab: string; tabs: readonly (readonly [string, string])[] }) {
  return (
    <nav className="ld-seg" aria-label="Insight sections">
      {tabs.map(([k, label]) => (
        <Link key={k} href={`/c/${communityId}/insights?tab=${k}`} className={tab === k ? "on" : undefined} aria-current={tab === k ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

/** "Compare players" is its own button, not a fourth tab. */
export function CompareButton({ communityId, className = "btn ghost small" }: { communityId: string; className?: string }) {
  return <Link href={`/c/${communityId}/compare`} className={className}><IconSwap size={16} /> Compare players</Link>;
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card ld-empty dashed">
      <span className="ld-empty-ic" aria-hidden="true">{icon}</span>
      <b>{title}</b>
      <p className="muted small" style={{ margin: 0 }}>{children}</p>
    </section>
  );
}

const isTeamRecord = (r: RecordLine) => r.title === "Longest unbeaten run";

export function RecordTiles({ lines, communityId, numberOf }: { lines: RecordLine[]; communityId: string; numberOf: NumberOf }) {
  return (
    <div className="ld-tiles">
      {lines.map((r) => {
        const has = !!r.holder;
        return (
          <section key={r.title} className={`ld-tile${has ? "" : " calm"}`} aria-label={r.title}>
            <span className="ld-eyebrow">{r.title.toUpperCase()}</span>
            <b className="ld-tile-fig">{r.figure}</b>
            <div className="ld-tile-who">
              {has ? (isTeamRecord(r) ? <TeamBadge name={r.holder!} size="md" /> : <Shirt number={r.userId ? numberOf(r.userId) : null} size="small" />) : <span className="ld-qmark sm" aria-hidden="true">?</span>}
              <span className="ld-tile-t">
                <b>{has ? (r.userId ? <Link href={`/c/${communityId}/players/${r.userId}`}>{r.holder}</Link> : r.holder) : "Nobody yet"}</b>
                <small className="muted">{r.detail}</small>
              </span>
              {r.matchId && <Link href={`/c/${communityId}/matches/${r.matchId}/report`} className="ld-see"><IconMatch size={16} /> See the match</Link>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function StreakBars({ streaks }: { streaks: { team: string; length: number }[] }) {
  if (streaks.length < 2) return null;
  const max = Math.max(...streaks.map((s) => s.length));
  return (
    <section className="card">
      <b>Unbeaten runs by team</b>
      <ol className="ld-streaks">
        {streaks.map((s) => (
          <li key={s.team}>
            <TeamBadge name={s.team} size="sm" />
            <span className="ld-streak-t"><span>{s.team}</span><span className="ld-bar" aria-hidden="true"><i style={{ width: `${(s.length * 100) / max}%` }} /></span></span>
            <b className="ld-num">{s.length}</b>
          </li>
        ))}
      </ol>
      <p className="muted small" style={{ margin: "8px 0 0" }}>Wins and ties in a row. A match with no result neither breaks nor extends a run. Guests are not in records.</p>
    </section>
  );
}

export function PairRows({ rows, communityId, numberOf }: { rows: PairRow[]; communityId: string; numberOf: NumberOf }) {
  if (!rows.length) return <EmptyState icon={<IconPair size={26} />} title="No partnerships yet">No partnerships between members yet.</EmptyState>;
  return (
    <section className="card">
      <ol className="ld-pairs">
        {rows.slice(0, 20).map((p, i) => (
          <li key={`${p.userIdA}${p.userIdB}`}>
            <b className="ld-rank">{i + 1}</b>
            <span className="ld-duo" aria-hidden="true"><Shirt number={numberOf(p.userIdA)} size="small" /><Shirt number={numberOf(p.userIdB)} size="small" /></span>
            <span className="ld-pair-t">
              <b><Link href={`/c/${communityId}/players/${p.userIdA}`}>{p.nameA}</Link> &amp; <Link href={`/c/${communityId}/players/${p.userIdB}`}>{p.nameB}</Link></b>
              <small className="muted">{p.partnerships} partnership{p.partnerships === 1 ? "" : "s"} · {p.balls} balls · best {p.best}</small>
            </span>
            <b className="ld-pair-runs">{p.runs}<small className="muted"> runs</small></b>
            <Link href={`/c/${communityId}/matches/${p.bestMatchId}/report`} className="ld-see"><IconMatch size={16} /> Best match</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BowlCard({ rows, title, communityId, numberOf }: { rows: OverBowlRow[]; title: string; communityId: string; numberOf: NumberOf }) {
  return (
    <section className="card ld-bowl">
      <b>{title}</b>
      {rows.length === 0 ? <p className="muted small" style={{ margin: "6px 0 0" }}>No bowling by members yet.</p> : (
        <div className="ld-scroll">
          <table className="ld-tbl" aria-label={title}>
            <thead><tr><th scope="col">Bowler</th><th scope="col">Balls</th><th scope="col">Runs</th><th scope="col">Wkts</th><th scope="col">Econ</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const best = r.ranked && i === 0;
                return (
                  <tr key={r.userId} className={r.ranked ? undefined : "dim"}>
                    <th scope="row" className="ld-bowler">
                      <b className="ld-rank">{r.ranked ? i + 1 : "–"}</b>
                      <Shirt number={numberOf(r.userId)} size="small" />
                      <span className="ld-bowler-t"><Link href={`/c/${communityId}/players/${r.userId}`}><b>{r.name}</b></Link>{!r.ranked && <small className="muted">needs {BOWL_BY_OVER_MIN_BALLS} balls to be ranked</small>}</span>
                    </th>
                    <td>{r.balls}</td><td>{r.runs}</td><td>{r.wickets}</td>
                    <td className={best ? "best" : undefined}>{r.economy === null ? "–" : r.economy.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
