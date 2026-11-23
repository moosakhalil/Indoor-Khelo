import type { Metadata } from "next";
import Link from "next/link";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { GROUPS, STATS, buildBoard, careerOf, fmt, ordinal, type Career } from "@/lib/career";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { communityCareers } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";
import { listTeams } from "@/lib/teams";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Q = { group?: string; stat?: string; flip?: string; team?: string; from?: string; to?: string };

// One leaderboard ranks every member by any stat. Nobody is hidden; rate stats need a minimum before a player is ranked.
export default async function LeaderboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Q> }) {
  const { id } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const teams = await listTeams(id);
  const from = q.from && DATE.test(q.from) ? q.from : null;
  const to = q.to && DATE.test(q.to) ? q.to : null;
  const teamId = q.team && teams.some((t) => t.id === q.team) ? q.team : null;
  const def = STATS.find((s) => s.key === q.stat) ?? STATS.find((s) => s.group === (GROUPS.find((g) => g.key === q.group)?.key ?? "batting"))!;
  const group = def.group;
  const flip = q.flip === "1";

  const [members, careers] = await Promise.all([listApprovedMembers(id), communityCareers(id, { teamId, from, to })]);
  const empty = careerOf([]);
  const rows = buildBoard(members.map((m) => ({ userId: m.user_id, name: m.name, number: m.player_number, career: (careers.get(m.user_id) ?? empty) as Career })), def, flip);
  const ranked = rows.filter((r) => r.ranked);
  const mine = rows.find((r) => r.userId === user.id);
  const keep = new URLSearchParams();
  if (teamId) keep.set("team", teamId);
  if (from) keep.set("from", from);
  if (to) keep.set("to", to);
  const extra = keep.toString() ? `&${keep.toString()}` : "";
  const noData = careers.size === 0;

  return (
    <Frame communityId={id} title="Leaderboard" back={`/c/${id}/teams`}>
      <div className="stack">
        <nav className="row wrap" aria-label="Group">
          {GROUPS.map((g) => <Link key={g.key} href={`/c/${id}/leaderboard?group=${g.key}${extra}`} className={`chip${group === g.key ? " gold" : ""}`}>{g.label}</Link>)}
        </nav>
        <nav className="row wrap" aria-label="Statistic">
          {STATS.filter((s) => s.group === group).map((s) => <Link key={s.key} href={`/c/${id}/leaderboard?stat=${s.key}${extra}`} className={`chip${def.key === s.key ? " gold" : ""}`}>{s.label}</Link>)}
        </nav>

        <section className="card">
          <div className="row space">
            <b>{def.label}</b>
            <Link href={`/c/${id}/leaderboard?stat=${def.key}${flip ? "" : "&flip=1"}${extra}`} className="chip">{flip ? "Order: reversed" : (def.lowerIsBetter ? "Order: lowest first" : "Order: highest first")} · flip</Link>
          </div>
          {mine && (
            <p style={{ margin: "8px 0 0" }}>
              {mine.ranked ? <>You are <b>{ordinal(mine.rank!)}</b> of <b>{ranked.length}</b>{mine.tied ? " (tied)" : ""}.</> : <span className="muted">You are not ranked yet. {mine.note}.</span>}
            </p>
          )}
          {def.rule && <p className="muted small" style={{ margin: "6px 0 0" }}>{def.rule}. Members below it are listed last in grey.</p>}
          {noData && <p className="muted small" style={{ margin: "6px 0 0" }}>No finished matches yet. Everyone is listed, and the numbers fill in after the first match.</p>}
          <table className="board" aria-label={`${def.label} leaderboard`}>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className={`${r.userId === user.id ? "me" : ""}${r.ranked ? "" : " dim"}`}>
                  <td style={{ width: 46 }}><b>{r.rank !== null ? `${r.rank}${r.tied ? "=" : ""}` : "–"}</b></td>
                  <td style={{ width: 44 }}><Shirt number={r.number} size="small" /></td>
                  <td><Link href={`/c/${id}/players/${r.userId}`}><b>{r.name}</b>{r.userId === user.id ? " (you)" : ""}</Link>{r.note && <small className="muted" style={{ display: "block" }}>{r.note}</small>}</td>
                  <td style={{ textAlign: "right" }}><b>{fmt(r.value, def)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <form method="get" className="card" aria-label="Filter the leaderboard">
          <input type="hidden" name="stat" value={def.key} />
          <b>Filters</b>
          <label className="lb" htmlFor="l-team">Team</label>
          <select id="l-team" name="team" className="field" defaultValue={teamId ?? ""}><option value="">Any team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <div className="two">
            <div><label className="lb" htmlFor="l-from">From</label><input id="l-from" type="date" name="from" className="field" defaultValue={from ?? ""} /></div>
            <div><label className="lb" htmlFor="l-to">To</label><input id="l-to" type="date" name="to" className="field" defaultValue={to ?? ""} /></div>
          </div>
          <div className="two" style={{ marginTop: 10 }}>
            <button className="btn gold small" style={{ width: "100%" }}>Apply</button>
            {(teamId || from || to) && <Link href={`/c/${id}/leaderboard?stat=${def.key}`} className="btn ghost small" style={{ width: "100%" }}>Clear filters</Link>}
          </div>
        </form>
      </div>
    </Frame>
  );
}
