import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamScoresChart } from "@/components/AnalyticsParts";
import { IconPlus, IconWarn } from "@/components/B4Icons";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { SquadCard, TeamTopActions } from "@/components/TeamPageBits";
import TeamBadge from "@/components/TeamBadge";
import { FormGuide, TeamBadgeMine } from "@/components/TeamsList";
import { scoresSeries, teamForm } from "@/lib/analytics";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { teamMatchCounts } from "@/lib/listB4";
import { mayManage } from "@/lib/ownerRule";
import { teamContributors, teamRecord, teamTable } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";
import { getTeam, listSquad, listTeams, teamsOfPlayer } from "@/lib/teams";
import { formKey, matchesText } from "@/lib/teamList";
import { PLAYING_ROLES, labelOf, ordinal } from "@/lib/validation";
import "@/components/b4.css";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await params;
  const user = await requireAcceptedUser();
  const { membership } = await requireMember(id, user.id);
  const team = await getTeam(id, teamId);
  if (!team) notFound();
  const canDelete = mayManage({ id: user.id, admin: membership.role === "admin" }, team.created_by);   // who added the team, or an Admin
  const [squad, rec, who, members, teams, counts, squads] = await Promise.all([
    listSquad(teamId), teamRecord(id, teamId), teamContributors(id, teamId), listApprovedMembers(id), listTeams(id), teamMatchCounts(id), teamsOfPlayer(id, user.id),
  ]);
  const table = (await teamTable(id, teams.map((t) => ({ id: t.id, name: t.name })))).filter((t) => t.played > 0);
  const position = table.findIndex((t) => t.id === teamId);
  const numberOf = new Map(members.map((m) => [m.user_id, m.player_number]));
  const mine = squads.some((s) => s.id === teamId) || team.captain_id === user.id || team.vice_captain_id === user.id;
  const matchCount = counts.get(teamId) ?? 0;
  const formStrip = teamForm(rec.history).strip.map((h) => ({ result: h.result, opponent: h.opponent }));
  const lead = (uid: string | null, name: string | null, tag: string) => (uid && name ? (
    <span className="tm-leader"><Shirt number={numberOf.get(uid) ?? null} size="small" /><span>{name}</span><span className="tm-role" title={tag === "C" ? "Captain" : "Vice-captain"}>{tag}</span></span>
  ) : null);
  const newMatch = `/c/${id}/matches/new?team=${teamId}`;

  return (
    <Frame communityId={id} title={team.name} back={`/c/${id}/teams`} right={<TeamTopActions communityId={id} teamId={teamId} name={team.name} matchCount={matchCount} canDelete={canDelete} />}>
      <div className="tm-page">
        <section className="card tm-hero tm-span">
          <TeamBadgeMine name={team.name} mine={mine} size="lg" />
          {mine && <span className="tm-tag">Your team</span>}
          <h2 className="tm-hero-name">{team.name}</h2>
          {team.description && <p className="muted" style={{ margin: 0 }}>{team.description}</p>}
          <div className="tm-leaders">
            {lead(team.captain_id, team.captain_name, "C")}
            {lead(team.vice_captain_id, team.vice_name, "VC")}
            {!team.captain_id && <span className="chip tm-warn"><IconWarn size={14} /> No captain yet</span>}
          </div>
          <div className="tm-chips tm-center">
            {rec.played > 0 ? (
              <>
                <span className="chip green">{rec.won} won</span>
                <span className="chip red">{rec.lost} lost</span>
                {rec.tied > 0 && <span className="chip gold">{rec.tied} tied</span>}
                {rec.winPercent !== null && <span className="chip">{rec.winPercent.toFixed(0)}% win</span>}
              </>
            ) : <span className="chip">No matches yet</span>}
            <span className="chip tm-players">{squad.length} player{squad.length === 1 ? "" : "s"}</span>
          </div>
          {formStrip.length > 0 && (
            <div className="tm-formblock">
              <small className="muted">Form, last {formStrip.length} (oldest first)</small>
              <FormGuide form={formStrip} big />
              <small className="muted tm-key">{formStrip.map(formKey).join(" · ")}</small>
            </div>
          )}
          <div className="tm-hero-btns">
            <Link href={`/c/${id}/teams/${teamId}/squad`} className="btn gold">Edit squad</Link>
            <Link href={`/c/${id}/teams/${teamId}/edit`} className="btn ghost">Edit team</Link>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Added by <b style={{ color: "var(--white)" }}>{team.added_by ?? "—"}</b> · Changed by <b style={{ color: "var(--white)" }}>{team.changed_by ?? "—"}</b></p>
        </section>

        <div className="stack tm-left">
          <section className="card">
            <div className="row space"><b>Team record</b>{position >= 0 && <span className="chip gold">{ordinal(position + 1)} of {table.length} in the table</span>}</div>
            {rec.played === 0 ? (
              <div className="tm-norec">
                <p className="muted small" style={{ margin: "6px 0 10px" }}>No finished matches yet. The record fills in after the first match.</p>
                <Link href={newMatch} className="btn ghost small"><IconPlus size={16} /> New match</Link>
              </div>
            ) : (
              <div className="statgrid">
                {([["Played", rec.played], ["Won", rec.won], ["Lost", rec.lost], ["Tied", rec.tied], ["Win %", rec.winPercent === null ? "–" : `${rec.winPercent.toFixed(1)}%`], ["Total runs", rec.totalRuns], ["Highest score", rec.highest ?? "–"], ["Lowest score", rec.lowest ?? "–"]] as [string, string | number][]).map(([k, v]) => (
                  <div key={k} className="statcell"><b>{v}</b><small className="muted">{k}</small></div>
                ))}
              </div>
            )}
          </section>
          {rec.played > 0 && (
            <section className="card">
              <b>Scores over time</b>
              <small className="muted" style={{ display: "block" }}>Each bar is this team&rsquo;s score. Green won, red lost, gold tied; the letter and the number say the same.</small>
              <TeamScoresChart series={scoresSeries(rec.history)} />
            </section>
          )}
          {rec.headToHead.length > 0 && (
            <section className="card">
              <b>Head to head</b>
              <div className="list" style={{ marginTop: 6 }}>
                {rec.headToHead.map((h) => (
                  <div key={h.opponent} className="item" style={{ display: "block" }}>
                    <div className="row space"><span className="row" style={{ gap: 10 }}><TeamBadge name={h.opponent} size="sm" /><b>v {h.opponent}</b></span><b>{h.won}W {h.lost}L{h.tied ? ` ${h.tied}T` : ""} <small className="muted">of {h.played}</small></b></div>
                    {h.highestFor !== null && (
                      <small className="muted" style={{ display: "block", marginTop: 4, lineHeight: 1.5 }}>
                        This team scored: highest {h.highestFor}, lowest {h.lowestFor}. {h.opponent} scored: highest {h.highestAgainst}, lowest {h.lowestAgainst}.
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {rec.recent.length > 0 && (
            <section className="card">
              <b>Recent matches</b>
              <div className="list" style={{ marginTop: 6 }}>
                {rec.recent.map((r) => (
                  <Link key={r.matchId} href={`/c/${id}/matches/${r.matchId}/report`} className="item">
                    <span className={`chip ${r.result === "win" ? "green" : r.result === "loss" ? "red" : r.result === "tie" ? "gold" : ""}`} style={{ minHeight: 28 }} aria-label={r.result === "win" ? "Won" : r.result === "loss" ? "Lost" : r.result === "tie" ? "Tied" : "No result"}>{r.result === "win" ? "W" : r.result === "loss" ? "L" : r.result === "tie" ? "T" : "–"}</span>
                    <TeamBadge name={r.opponent} size="sm" />
                    <span className="t grow"><b>v {r.opponent}</b><small>{r.runsFor !== null ? `${r.runsFor} v ${r.runsAgainst}. ` : ""}{r.text}</small></span>
                    <span aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {who.length > 0 && (
            <section className="card">
              <b>Player contributions</b>
              <div className="list" style={{ marginTop: 6 }}>
                {who.slice(0, 8).map((w) => (
                  <div key={`${w.userId ?? w.name}`} className="item space">
                    <span className="row" style={{ gap: 10 }}>
                      <Shirt number={w.userId ? numberOf.get(w.userId) ?? null : null} size="small" />
                      <span>{w.userId ? <Link href={`/c/${id}/players/${w.userId}`}>{w.name}</Link> : <>{w.name} <small className="muted">(guest)</small></>}</span>
                    </span>
                    <b>{w.runs} runs · {w.wickets} wkts <small className="muted">({matchesText(w.matches)})</small></b>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="stack tm-right">
          <SquadCard
            communityId={id}
            teamId={teamId}
            teamName={team.name}
            rows={squad.map((m) => ({ user_id: m.user_id, name: m.name, player_number: m.player_number, role: labelOf(PLAYING_ROLES, m.playing_role) || null }))}
            captainId={team.captain_id}
            viceId={team.vice_captain_id}
            me={user.id}
          />
        </div>
      </div>
    </Frame>
  );
}
