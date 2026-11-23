import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import CommunityLogo from "@/components/CommunityLogo";
import CopyButton from "@/components/CopyButton";
import Frame from "@/components/Frame";
import { LiveScore } from "@/components/Live";
import { Counts, ReplyButtons, StatusChip } from "@/components/MatchBits";
import Shirt from "@/components/Shirt";
import { TossForm } from "@/components/Forms4";
import { cancelAction, deleteMatchAction, linkGuestAction, postponeAction, remindAction, unlinkGuestAction } from "@/app/actions4";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { buildState } from "@/lib/engine/engine";
import { getLock, loadEvents, scorersOf } from "@/lib/scoring";
import { getMatch, listLineup, listReplies, noReplyCount } from "@/lib/matches";
import { NOT_STARTED, DISMISSALS, SUPER_OVER_MODES, bowlerLimitWarning, formatWhen, patternText } from "@/lib/matchRules";
import { noticeFor } from "@/lib/notices";
import { getOrigin } from "@/lib/origin";
import { requireAcceptedUser } from "@/lib/session";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Match" };

type Q = { created?: string; saved?: string; rematch?: string; e?: string; n?: string; skip?: string };

export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string; matchId: string }>; searchParams: Promise<Q> }) {
  const { id, matchId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  const [lineup, replies, members, tz, origin, events, lock, scorers] = await Promise.all([listLineup(id, matchId), listReplies(id, matchId), listApprovedMembers(id), getZone(), getOrigin(), loadEvents(matchId), getLock(id, matchId), scorersOf(matchId)]);
  const built = buildState(events);
  const state = built.ok && built.state.started ? built.state : null;
  const isLive = m.status === "live" || m.status === "paused";
  const notStarted = (NOT_STARTED as readonly string[]).includes(m.status);
  const canEnd = notStarted || m.status === "cancelled";
  const link = `${origin}/c/${id}/matches/${matchId}`;
  const notice = noticeFor(q.e, { n: q.n, skip: q.skip });
  const r = m.rules;
  const warning = bowlerLimitWarning(r.bowlerLimit, m.overs);
  const sideName = (pos: 1 | 2) => (pos === 1 ? m.side1_name : m.side2_name);
  const inMatch = new Set(lineup.map((l) => l.user_id).filter(Boolean));
  const linkable = members.filter((p) => !inMatch.has(p.user_id));
  const limitText = r.bowlerLimit.mode === "none" ? "No limit" : r.bowlerLimit.mode === "max" ? `${r.bowlerLimit.overs} over${r.bowlerLimit.overs === 1 ? "" : "s"} per bowler` : `Pattern ${patternText(r.bowlerLimit.pattern)}`;
  const outTeams = replies.filter((p) => p.answer === "out");
  const inPeople = replies.filter((p) => p.answer === "in");
  const none = replies.filter((p) => p.answer === null);

  const played = ["live", "paused", "completed", "abandoned"].includes(m.status);
  const scoring = (
        <section className="stack">
        {isLive && <AutoRefresh seconds={5} />}
        {state && <LiveScore m={state} />}
        {state?.result && <div className="banner green" role="status"><b>{state.result.text}</b></div>}
        {scorers.length > 0 && <p className="muted small" style={{ margin: 0 }}>Scored by <b style={{ color: "var(--white)" }}>{scorers.map((s) => `${s.name} (${s.balls} ball${s.balls === 1 ? "" : "s"})`).join(", ")}</b></p>}
        {lock?.scorer_name && isLive && <p className="muted small" style={{ margin: 0 }}>Scoring now: <b style={{ color: "var(--white)" }}>{lock.scorer_name}</b></p>}
        {m.status === "completed" || m.status === "abandoned" ? (
          <Link href={`/c/${id}/matches/${matchId}/report`} className="btn gold">Match report: scorecard, ball by ball, stats</Link>
        ) : m.status === "cancelled" || m.status === "postponed" ? null : (
          <Link href={`/c/${id}/matches/${matchId}/score`} className="btn gold">{isLive ? (lock?.scorer_id === user.id ? "Open the scoring pad" : "Watch live or take over") : "Start scoring"}</Link>
        )}
      </section>
  );

  return (
    <Frame communityId={id} title="Match" back={`/c/${id}/matches`} right={<StatusChip status={m.status} />}>
      <div className="stack">
        {q.created && <div className="banner green" role="status">Match created. Everyone in the community was told and can reply.</div>}
        {q.saved && <div className="banner green" role="status">Changes saved.</div>}
        {q.rematch && <div className="banner green" role="status">Rematch created. Lineups were copied: change them below if you need to.</div>}
        {notice && <div className={`banner ${notice.tone}`} role="status">{notice.text}</div>}
        {warning && <div className="banner gold" role="status">{warning} <Link href={`/c/${id}/matches/${matchId}/edit`} style={{ textDecoration: "underline" }}>Edit the match</Link></div>}

        <section className="card">
          <div className="row" style={{ justifyContent: "center", gap: 12 }}>
            <span className="center"><CommunityLogo name={m.side1_name} big /><b style={{ display: "block", marginTop: 6 }}>{m.side1_name}</b></span>
            <b aria-hidden="true" className="muted">v</b>
            <span className="center"><CommunityLogo name={m.side2_name} big /><b style={{ display: "block", marginTop: 6 }}>{m.side2_name}</b></span>
          </div>
          <hr className="line" />
          <div className="list">
            <div className="item space"><span className="muted">When</span><b>{formatWhen(m.scheduled_at, tz)}</b></div>
            <div className="item space"><span className="muted">Venue</span><b>{m.venue || "Not set"}</b></div>
            <div className="item space"><span className="muted">Overs</span><b>{m.overs} per innings</b></div>
            <div className="item space"><span className="muted">Players per side</span><b>{m.players_per_side}</b></div>
            {m.umpire && <div className="item space"><span className="muted">Umpire</span><b>{m.umpire}</b></div>}
            {m.notes && <div className="item" style={{ display: "block" }}><span className="muted">Notes</span><p style={{ margin: "4px 0 0" }}>{m.notes}</p></div>}
          </div>
          <p className="muted small" style={{ margin: "10px 0 0" }}>
            Created by <b style={{ color: "var(--white)" }}>{m.created_by_name ?? "—"}</b> · Changed by <b style={{ color: "var(--white)" }}>{m.changed_by_name ?? "—"}</b> ({formatWhen(m.updated_at, tz)})
            {m.rematch_of && <> · <Link href={`/c/${id}/matches/${m.rematch_of}`} style={{ textDecoration: "underline" }}>Rematch of an earlier match</Link></>}
          </p>
        </section>

        {played && scoring}

        {m.status === "cancelled" && <div className="banner red">This match was cancelled.</div>}
        {m.status === "postponed" && <div className="banner mute">This match is postponed. Edit it and choose a new date and time to schedule it again.</div>}

        {notStarted && (
        <section className="card">
            <h2 style={{ fontSize: "1rem" }}>Are you coming?</h2>
            <p className="muted small" style={{ margin: "4px 0 10px" }}><Counts m={m} />. Replies are only guidance: the lineup can include anyone, even on match day.</p>
            {notStarted ? <ReplyButtons communityId={id} m={m} /> : <p className="muted small" style={{ margin: 0 }}>Replies closed because the match has started.</p>}
            {[["I’m in", inPeople], ["Can’t make it", outTeams], ["No reply", none]].map(([label, list]) => {
              const people = list as typeof replies;
              return (
                <p key={label as string} className="small" style={{ margin: "10px 0 0", lineHeight: 1.5 }}>
                  <b>{label as string} ({people.length}):</b>{" "}
                  <span className="muted">{people.length ? people.map((p) => p.name).join(", ") : "nobody"}</span>
                </p>
              );
            })}
            {m.status === "scheduled" && noReplyCount(m) > 0 && (
              <form action={remindAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="communityId" value={id} />
                <input type="hidden" name="matchId" value={matchId} />
                <button className="btn ghost small">Remind those who have not replied</button>
              </form>
            )}
          </section>
        )}

        <section className="card">
          <div className="row space"><h2 style={{ fontSize: "1rem" }}>Lineups</h2>{notStarted && <Link href={`/c/${id}/matches/${matchId}/lineup`} className="chip gold">Pick lineups</Link>}</div>
          {([1, 2] as const).map((pos) => {
            const side = lineup.filter((l) => l.position === pos);
            return (
              <div key={pos} style={{ marginTop: 12 }}>
                <b>{sideName(pos)} <small className="muted">({side.length} of {m.players_per_side})</small></b>
                <div className="list">
                  {side.length === 0 && <div className="item muted">No players picked yet.</div>}
                  {side.map((p) => (
                    <div key={p.id} className="item" style={{ alignItems: "flex-start" }}>
                      <Shirt number={p.player_number} size="small" label={p.kind === "member" ? undefined : "Guest, no player number"} />
                      <span className="t grow">
                        {p.user_id && p.kind === "member" ? <Link href={`/c/${id}/players/${p.user_id}`}><b>{p.name}</b></Link> : <b>{p.name}</b>}
                        <small>
                          {p.kind === "guest" ? "Guest" : p.kind === "linked" ? `Guest · linked by ${p.linked_by_name ?? "a member"}` : labelOf(PLAYING_ROLES, p.playing_role) ?? "Member"}
                        </small>
                        {p.kind === "guest" && (
                          <form action={linkGuestAction} className="row" style={{ marginTop: 6 }}>
                            <input type="hidden" name="communityId" value={id} />
                            <input type="hidden" name="matchId" value={matchId} />
                            <input type="hidden" name="entryId" value={p.id} />
                            <select name="targetId" className="field" style={{ minHeight: 44, padding: "6px 10px" }} aria-label={`Link ${p.name} to a member`} defaultValue="">
                              <option value="" disabled>Link to a member…</option>
                              {linkable.map((x) => <option key={x.user_id} value={x.user_id}>{x.name} ({x.player_number ?? "–"})</option>)}
                            </select>
                            <button className="btn ghost small">Link</button>
                          </form>
                        )}
                        {p.kind === "linked" && (
                          <form action={unlinkGuestAction} style={{ marginTop: 6 }}>
                            <input type="hidden" name="communityId" value={id} />
                            <input type="hidden" name="matchId" value={matchId} />
                            <input type="hidden" name="entryId" value={p.id} />
                            <button className="btn ghost small">Undo link</button>
                          </form>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="muted small" style={{ margin: "10px 0 0" }}>Guest figures stay on this match&rsquo;s scorecard until a guest is linked to a member. The permanent squads are never changed by a lineup.</p>
        </section>

        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>Toss and batting order</h2>
          {m.toss_winner_side && m.toss_decision ? (
            <p style={{ margin: "6px 0 10px" }}>
              <b>{sideName(m.toss_winner_side as 1 | 2)}</b> won the toss and chose to {m.toss_decision}. <b>{sideName(m.batting_first_side as 1 | 2)}</b> bats first.
            </p>
          ) : <p className="muted" style={{ margin: "6px 0 10px" }}>Not recorded yet. Record it here before the match, or at the start of scoring.</p>}
          {notStarted ? <TossForm communityId={id} matchId={matchId} sideNames={[m.side1_name, m.side2_name]} winner={m.toss_winner_side} decision={m.toss_decision} /> : null}
        </section>

        <details className="card" open={!played}>
          <summary style={{ cursor: "pointer" }}><b style={{ fontSize: "1rem" }}>Rules for this match</b> <small className="muted">(saved with the match, never changed by later settings)</small></summary>
          <div className="list">
            {([
              ["Innings", r.innings === 2 ? "Each team bats once" : "One innings"],
              ["Balls per over", String(r.ballsPerOver)],
              ["Wide", `${r.wideRuns} run${r.wideRuns === 1 ? "" : "s"}${r.widesReBowled ? ", bowled again" : ", counts as a ball"}`],
              ["No ball", `${r.noBallRuns} run${r.noBallRuns === 1 ? "" : "s"}${r.noBallsReBowled ? ", bowled again" : ", counts as a ball"}`],
              ["Byes and leg-byes", `${r.byesCountAsBalls ? "Byes count" : "Byes do not count"}, ${r.legByesCountAsBalls ? "leg-byes count" : "leg-byes do not count"} as balls`],
              ["Free hit", r.freeHit ? "On after a no ball" : "Off"],
              ["Overthrows", r.overthrows ? "Allowed" : "Not allowed"],
              ["Retired batter", r.retiredCanReturn ? "Can come back" : "Cannot come back"],
              ["Same bowler twice in a row", r.sameBowlerTwoInARow ? "Allowed" : "Not allowed"],
              ["Last batter", r.lastBatterAlone ? "Can bat alone" : "Innings ends when one batter is left"],
              ["Ways of getting out", r.dismissals.map((d) => DISMISSALS.find((x) => x.value === d)?.label ?? d).join(", ")],
              ["If level", SUPER_OVER_MODES.find((x) => x.value === r.superOver)?.label ?? ""],
              ["Bowler limit", limitText],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="item space" style={{ alignItems: "flex-start" }}><span className="muted" style={{ width: "42%" }}>{label}</span><b style={{ width: "58%", textAlign: "right" }}>{value}</b></div>
            ))}
          </div>
        </details>

        {!played && scoring}

        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>Match link</h2>
          <div className="row space" style={{ margin: "6px 0 0" }}>
            <span className="mono" style={{ fontSize: "0.75rem", overflowWrap: "anywhere" }}>{link}</span>
            <CopyButton text={link} />
          </div>
          <p className="muted small" style={{ margin: "6px 0 0" }}>Members of this community can open it. Anyone else is asked to sign in and join first.</p>
        </section>

        <div className="stack">
          <Link href={`/c/${id}/matches/${matchId}/rematch`} className="btn gold">Rematch</Link>
          {notStarted && <Link href={`/c/${id}/matches/${matchId}/edit`} className="btn ghost">Edit match</Link>}
          {(m.status === "scheduled" || m.status === "draft") && (
            <details>
              <summary className="btn ghost" style={{ listStyle: "none", cursor: "pointer" }}>Postpone…</summary>
              <form action={postponeAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="communityId" value={id} />
                <input type="hidden" name="matchId" value={matchId} />
                <p className="muted small" style={{ margin: "0 0 8px" }}>Everyone is told. You can schedule it again later by editing it.</p>
                <button className="btn ghost">Yes, postpone this match</button>
              </form>
            </details>
          )}
          {notStarted && (
            <details>
              <summary className="btn red" style={{ listStyle: "none", cursor: "pointer" }}>Cancel match…</summary>
              <form action={cancelAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="communityId" value={id} />
                <input type="hidden" name="matchId" value={matchId} />
                <p className="muted small" style={{ margin: "0 0 8px" }}>Everyone is told. A cancelled match stays in the list.</p>
                <button className="btn red">Yes, cancel this match</button>
              </form>
            </details>
          )}
          {canEnd && (
            <details>
              <summary className="btn red" style={{ listStyle: "none", cursor: "pointer" }}>Delete match…</summary>
              <form action={deleteMatchAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="communityId" value={id} />
                <input type="hidden" name="matchId" value={matchId} />
                <p className="muted small" style={{ margin: "0 0 8px" }}>Removes the match, its lineups and replies for good. Only matches that never started can be deleted.</p>
                <button className="btn red">Yes, delete this match</button>
              </form>
            </details>
          )}
        </div>
      </div>
    </Frame>
  );
}
