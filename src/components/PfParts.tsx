// Phase F5: shared pieces of My profile, Edit my profile and the Player page. Plain markup (no hooks), so a server page can use them
// and the edit form can use the same card as a live preview.
import Link from "next/link";
import PfIcon from "@/components/PfIcons";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import { fmt, type Career, type MatchLine } from "@/lib/career";
import { oversText } from "@/lib/engine/engine";
import "./pf.css";

const n1 = (v: number | null) => fmt(v, { decimals: 1 });
const n2 = (v: number | null) => fmt(v, { decimals: 2 });

export const pfDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

/* ---------- the player card ---------- */
export type PfTeam = { id: string; name: string; mine?: boolean };

/**
 * The broadcast-style player card: the gold shirt (number and initials), the name, the role and hand chips, the team badges
 * and, only for the owner, a pencil to edit. The faded number behind is decoration.
 */
export function PfPlayerCard({
  communityId, name, number, isMe, subtitle, role, hand, position, bowling, teams, editHref, label = "Player",
}: {
  communityId: string; name: string; number: number | null; isMe?: boolean; subtitle?: string;
  role: string | null; hand: string | null; position: string | null; bowling: string | null;
  teams: PfTeam[]; editHref?: string; label?: string;
}) {
  return (
    <section className="pf-card" aria-label={label}>
      <span className="pf-ghostnum" aria-hidden="true">{number ?? ""}</span>
      <div className="pf-card-top">
        <Shirt number={number} size="big" name={name} />
        <div className="pf-card-id">
          <div className="pf-card-name">
            <h2>{name}{isMe ? " (you)" : ""}</h2>
            {editHref && <Link href={editHref} className="pf-pencil" aria-label="Edit my profile"><PfIcon name="pencil" size={18} /></Link>}
          </div>
          {subtitle && <p className="pf-sub">{subtitle}</p>}
          <div className="pf-chips">
            {role ? <span className="pf-chip role">{role}</span> : <span className="pf-chip quiet">Role not set</span>}
            {hand && <span className="pf-chip">{hand}</span>}
            {position && <span className="pf-chip">{position}</span>}
            {bowling && <span className="pf-chip">{bowling}</span>}
          </div>
        </div>
      </div>
      {teams.length === 0 ? (
        <p className="pf-noteam">Not in a team yet</p>
      ) : (
        <ul className="pf-teams" aria-label="Teams">
          {teams.map((t) => (
            <li key={t.id}>
              <Link href={`/c/${communityId}/teams/${t.id}`} className={`pf-team${t.mine ? " mine" : ""}`}>
                <TeamBadge name={t.name} size="sm" />
                <span>{t.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- career strip ---------- */
export type PfTile = { key: string; label: string; value: string; sub: string; hi?: boolean };

/** The six headline numbers. Every figure comes from careerOf (nothing is worked out here). */
export function careerTiles(c: Career): PfTile[] {
  const b = c.batting, w = c.bowling;
  return [
    { key: "matches", label: "Matches", value: String(c.matches), sub: `${c.record.won} won` },
    { key: "runs", label: "Runs", value: String(b.runs), sub: `HS ${b.highest ? `${b.highest.score}${b.highest.notOut ? "*" : ""}` : "–"}`, hi: true },
    { key: "avg", label: "Bat avg", value: b.average === null ? "–" : n2(b.average), sub: `${n1(b.strikeRate)} SR` },
    { key: "wickets", label: "Wickets", value: String(w.wickets), sub: `Best ${w.best ? `${w.best.wickets}/${w.best.runs}` : "–"}`, hi: true },
    { key: "economy", label: "Economy", value: n2(w.economy), sub: `${oversText(w.balls, w.bpo)} ov` },
    { key: "pom", label: "Player of the Match", value: String(c.awards.count), sub: `${c.awards.points} pts` },
  ];
}

export function PfCareerStrip({ career, title, fullHref }: { career: Career; title: string; fullHref?: string }) {
  return (
    <section className="pf-box" aria-label={title}>
      <div className="pf-box-head"><h2>{title}</h2>{fullHref && <Link href={fullHref} className="pf-link">Full stats</Link>}</div>
      <div className="pf-tiles">
        {careerTiles(career).map((t) => (
          <div key={t.key} className={`pf-tile${t.hi ? " hi" : ""}`}>
            <b>{t.value}</b>
            <span className="pf-tl">{t.label}</span>
            <small>{t.sub}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The empty state: a dashed card with a chart icon and the same promise as today. */
export function PfStatsStart({ title = "Stats start here", text, action }: { title?: string; text: string; action?: React.ReactNode }) {
  return (
    <section className="pf-empty" aria-label={title}>
      <span className="pf-empty-ic" aria-hidden="true"><PfIcon name="chart" size={24} /></span>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </section>
  );
}

export const STATS_START_TEXT = "Records build only from matches scored in Indoor Khelo. Nothing is added by hand. Runs, wickets, catches and awards appear here after this player’s first finished match.";

/* ---------- details with Add buttons (my own profile) ---------- */
export function PfDetails({ rows, editHref }: { rows: [string, string | null][]; editHref: string }) {
  return (
    <section className="pf-box" aria-label="Player details">
      <div className="pf-box-head">
        <h2>Player details</h2>
        <Link href={editHref} className="pf-pencil" aria-label="Edit player details"><PfIcon name="pencil" size={18} /></Link>
      </div>
      <ul className="pf-rows">
        {rows.map(([label, value]) => (
          <li key={label}>
            <span className="muted">{label}</span>
            {value ? <b>{value}</b> : <Link href={editHref} className="pf-add" aria-label={`Add ${label.toLowerCase()}`}><PfIcon name="plus" size={16} />Add</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- "In this match": the gold card when opened from a scorecard ---------- */
const batText = (l: MatchLine) => l.bat.map((x) => `${x.runs}${x.out ? "" : "*"}`).join(", ");
const batSub = (l: MatchLine) => l.bat.map((x) => `${x.balls} balls · ${x.fours}×4 ${x.sixes}×6`).join("; ");
const bowlText = (l: MatchLine) => l.bowl.map((x) => `${x.wickets}/${x.runs}`).join(", ");
const bowlSub = (l: MatchLine) => l.bowl.map((x) => `${oversText(x.balls, l.ballsPerOver)} ov`).join(", ");

export function PfInThisMatch({ communityId, line }: { communityId: string; line: MatchLine }) {
  const f = line.field;
  const when = pfDate(line.when);
  return (
    <section className="pf-hero" aria-label="This match">
      <div className="pf-hero-top">
        <div className="pf-hero-id">
          <span className="pf-tag">In this match</span>
          <b>{line.teamName} v {line.opponent}</b>
          <small className="muted">{[when, line.numberUsed !== null ? `wore #${line.numberUsed}` : "joined the community after this match"].filter(Boolean).join(" · ")}</small>
        </div>
        <Link href={`/c/${communityId}/matches/${line.matchId}/report`} className="pf-open">Open the match <PfIcon name="chevron" size={16} /></Link>
      </div>
      <div className="pf-tiles two">
        <div className="pf-tile"><span className="pf-tl">Batting</span><b>{line.bat.length ? batText(line) : "–"}</b><small>{line.bat.length ? batSub(line) : "did not bat"}</small></div>
        <div className="pf-tile"><span className="pf-tl">Bowling</span><b>{line.bowl.length ? bowlText(line) : "–"}</b><small>{line.bowl.length ? bowlSub(line) : "did not bowl"}</small></div>
        <div className="pf-tile"><span className="pf-tl">Fielding</span><b>{f.catches + f.caughtBowled}</b><small>{f.catches + f.caughtBowled} catches, {f.runOuts} run-outs, {f.stumpings} stumpings</small></div>
        <div className={`pf-tile${line.pom ? " hi" : ""}`}><span className="pf-tl">Player of the Match points</span><b>{line.points}</b><small>{line.pom ? "Player of the Match" : "points in this match"}</small></div>
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>Career figures are below.</p>
    </section>
  );
}
