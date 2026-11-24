// The pieces of the Home screen. Plain server markup (no data loading here), so each piece can be tested and
// looked at on its own. src/app/c/[id]/page.tsx loads the data and puts them in order.
import Link from "next/link";
import ActionMenu from "@/components/ActionMenu";
import CommunityLogo from "@/components/CommunityLogo";
import HmIcon, { type HmIconName } from "@/components/HmIcons";
import ReplyBox from "@/components/ReplyBox";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import type { LineupEntry, MatchRow } from "@/lib/matches";
import { formatWhen } from "@/lib/matchRules";
import { scoreText, type ScoreLine } from "@/lib/scoreLine";
import "./home.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Good evening, Ali" from the hour in the viewer's own time zone. */
export function greetingFor(hour: number, name: string): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  return `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, ${first}`;
}

/** "Sat 22 Nov" in the viewer's time zone. */
export function formatDay(d: Date | null, tz: string): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(d);
}

/* ---------- banners: join requests (Admin) and new alerts ---------- */
export function Banners({ id, pending, alerts, isAdmin }: { id: string; pending: number; alerts: number; isAdmin: boolean }) {
  return (
    <>
      {isAdmin && pending > 0 && (
        <Link href={`/c/${id}/requests`} className="hm-banner">
          <HmIcon name="userplus" size={22} />
          <span className="t grow"><b>{plural(pending, "join request", "join requests")}</b><small>Approve or reject</small></span>
          <span className="btn gold small" aria-hidden="true">Review</span>
        </Link>
      )}
      {alerts > 0 && (
        <Link href={`/c/${id}/alerts`} className="hm-banner">
          <HmIcon name="bell" size={22} />
          <span className="t grow"><b>{plural(alerts, "new alert", "new alerts")}</b><small>New matches, reminders and changes</small></span>
          <span className="btn ghost small" aria-hidden="true">Open</span>
        </Link>
      )}
    </>
  );
}

/* ---------- live match: a broadcast score bug ---------- */
export function LiveCard({ id, live, line }: { id: string; live: MatchRow; line: ScoreLine | null }) {
  const names = [live.side1_name, live.side2_name] as const;
  return (
    <section className="hm-live-card" aria-label="Live match">
      <div className="row space">
        <span className="hm-livepill"><span className="hm-pulse" aria-hidden="true" /> {live.status === "paused" ? "PAUSED" : "LIVE"}</span>
        <small className="muted hm-trunc">{live.overs} overs{live.venue ? ` · ${live.venue}` : ""}</small>
      </div>
      <div className="hm-lrows">
        {([1, 2] as const).map((pos) => {
          const s = line?.sides[pos - 1];
          const batting = line?.batting === pos;
          return (
            <div key={pos} className={`hm-lrow${batting ? " bat" : ""}`}>
              <TeamBadge name={names[pos - 1]} size="sm" />
              <b className="grow hm-trunc">{names[pos - 1]}{batting && <span className="hm-sr"> (batting)</span>}</b>
              <span className="hm-lscore"><b className="score-num">{s ? scoreText(s) : "–"}</b>{s?.batted && <small className="score-num">{s.overs}</small>}</span>
            </div>
          );
        })}
      </div>
      {line?.chase && <p className="hm-chase">{line.chase}</p>}
      <div className="two" style={{ marginTop: 10 }}>
        <Link href={`/c/${id}/matches/${live.id}/score`} className="btn ghost small hm-fill"><HmIcon name="eye" /> Watch</Link>
        <Link href={`/c/${id}/matches/${live.id}/score`} className="btn gold small hm-fill"><HmIcon name="pencil" /> Score</Link>
      </div>
    </section>
  );
}

/* ---------- next match (not today): both teams, venue, time and the reply ---------- */
export function NextMatchCard({ id, next, tz }: { id: string; next: MatchRow; tz: string }) {
  return (
    <section className="card hm-next" aria-label="Next match">
      <div className="row space">
        <b>Next match</b>
        {!next.my_answer && <span className="hm-badge">Reply needed</span>}
      </div>
      <Link href={`/c/${id}/matches/${next.id}`} className="hm-vs" aria-label={`Open the match: ${next.side1_name} v ${next.side2_name}`}>
        <span className="hm-vs-badges">
          <TeamBadge name={next.side1_name} size="md" /><span className="muted" aria-hidden="true">v</span><TeamBadge name={next.side2_name} size="md" />
        </span>
        <b className="hm-vs-names">{next.side1_name} v {next.side2_name}</b>
        <small className="muted">{formatWhen(next.scheduled_at, tz)}{next.venue ? ` · ${next.venue}` : ""}</small>
      </Link>
      <ReplyBox communityId={id} matchId={next.id} answer={next.my_answer} />
    </section>
  );
}

/* ---------- match day: lineups as lists, three actions ---------- */
export function MatchDayCard({ id, today, lineup, tz, mySide }: { id: string; today: MatchRow; lineup: LineupEntry[]; tz: string; mySide: 1 | 2 | null }) {
  return (
    <section className="card gold hm-day" aria-label="Match day">
      <div className="row space"><b>Match day</b><span className="hm-badge">Today</span></div>
      <h2 className="hm-day-title">{today.side1_name} <span className="muted">v</span> {today.side2_name}</h2>
      <small className="muted" style={{ display: "block" }}>{formatWhen(today.scheduled_at, tz)}{today.venue ? ` · ${today.venue}` : ""} · {today.overs} overs · {today.players_per_side} a side</small>
      <div className="hm-sides">
        {([1, 2] as const).map((pos) => {
          const name = pos === 1 ? today.side1_name : today.side2_name;
          const side = lineup.filter((l) => l.position === pos);
          const mine = mySide === pos;
          return (
            <div key={pos} className="hm-side">
              <div className="row">
                <span className={`hm-ringwrap${mine ? " mine" : ""}`}><TeamBadge name={name} size="sm" label={mine ? `Team ${name}, your team` : undefined} /></span>
                <b className="grow hm-trunc">{name}{mine && <small className="muted"> · your team</small>}</b>
                <span className="hm-count" aria-label={plural(side.length, "player", "players")}>{side.length}</span>
              </div>
              {side.length > 0 ? (
                <ul className="hm-lineup">
                  {side.map((l) => (
                    <li key={l.id}>
                      <Shirt number={l.player_number} size="normal" label={l.kind === "guest" ? "Guest, no player number" : undefined} />
                      <span className="grow hm-trunc">{l.name}{l.kind === "guest" && <small className="muted"> · guest</small>}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="hm-nolineup">
                  <span className="muted">No lineup yet</span>
                  <Link href={`/c/${id}/matches/${today.id}/lineup`} className="btn ghost small"><HmIcon name="list" /> Pick lineup</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="stack" style={{ gap: 8, marginTop: 14 }}>
        <Link href={`/c/${id}/matches/${today.id}/score`} className="btn gold"><HmIcon name="pencil" /> Start scoring</Link>
        <Link href={`/c/${id}/matches/${today.id}/lineup`} className="btn ghost"><HmIcon name="list" /> Pick lineups</Link>
        <Link href={`/c/${id}/matches/${today.id}#toss`} className="btn ghost"><HmIcon name="coin" /> Toss the coin</Link>
      </div>
    </section>
  );
}

/* ---------- quick actions: always the same three, so nothing jumps ---------- */
export function QuickActions({ id, live, next }: { id: string; live: MatchRow | null; next: MatchRow | null }) {
  const target = live ?? next;
  return (
    <section className="card hm-quick" aria-label="Quick actions">
      <b>Quick actions</b>
      {target ? (
        <Link href={`/c/${id}/matches/${target.id}/score`} className="btn gold"><HmIcon name="pencil" /> {live ? "Continue scoring" : "Start scoring"}</Link>
      ) : (
        <div>
          <button type="button" className="btn gold hm-disabled" disabled aria-describedby="hm-noscore"><HmIcon name="pencil" /> Start scoring</button>
          <small id="hm-noscore" className="muted hm-reason">Create a match first</small>
        </div>
      )}
      <Link href={`/c/${id}/matches/new`} className="btn ghost"><HmIcon name="plus" /> New match</Link>
      <Link href={`/c/${id}/invite`} className="btn ghost hm-outline"><HmIcon name="userplus" /> Invite friends</Link>
    </section>
  );
}

/* ---------- empty state: no match planned ---------- */
export function NoMatchCard({ id }: { id: string }) {
  return (
    <section className="card hm-empty" aria-label="No match planned">
      <span className="hm-empty-ic" aria-hidden="true"><HmIcon name="coin" size={30} /></span>
      <b>No match planned yet</b>
      <p className="muted small" style={{ margin: 0 }}>Create one and everyone is asked if they are coming.</p>
      <Link href={`/c/${id}/matches/new`} className="btn gold"><HmIcon name="plus" /> New match</Link>
    </section>
  );
}

/* ---------- recent results with both scores and a three-dots menu ---------- */
export type ResultItem = { id: string; n1: string; n2: string; text: string; when: Date | null; line: ScoreLine | null };

export function ResultsCard({ id, results, tz }: { id: string; results: ResultItem[]; tz: string }) {
  return (
    <section className="card hm-results" aria-label="Recent results">
      <div className="row space"><b>Recent results</b>{results.length > 0 && <Link href={`/c/${id}/matches`} className="hm-seeall">See all</Link>}</div>
      {results.length === 0 ? (
        <div className="hm-noresults"><b>No results yet</b><small className="muted">Finished matches show up here with both scores.</small></div>
      ) : (
        <div className="hm-reslist">
          {results.map((r) => (
            <div key={r.id} className="hm-res">
              <Link href={`/c/${id}/matches/${r.id}/report`} className="grow hm-resbody" aria-label={`${r.n1} v ${r.n2}${r.text ? `, ${r.text}` : ""}. Open the report`}>
                <small className="muted hm-trunc">{[formatDay(r.when, tz), r.text].filter(Boolean).join(" · ")}</small>
                {([r.n1, r.n2] as const).map((n, i) => {
                  const s = r.line?.sides[i];
                  return (
                    <span key={i} className="hm-resrow">
                      <TeamBadge name={n} size="sm" />
                      <b className="grow hm-trunc">{n}</b>
                      <b className="score-num hm-rscore">{s ? scoreText(s) : ""}</b>
                    </span>
                  );
                })}
              </Link>
              <ActionMenu
                label={`More for ${r.n1} v ${r.n2}`}
                items={[
                  { label: "Open report", href: `/c/${id}/matches/${r.id}/report` },
                  { label: "View PDF", href: `/api/matches/${r.id}/pdf?communityId=${id}` },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- the community card and the link list (in the page, and in the side panel on very wide screens) ---------- */
export function CommunityCard({ id, name, members, cap, location, description, number, isAdmin }: {
  id: string; name: string; members: number; cap: number; location: string | null; description: string | null; number: number | null; isAdmin: boolean;
}) {
  return (
    <section className="card hm-comm" aria-label="Community">
      <div className="row">
        <CommunityLogo name={name} />
        <span className="t grow"><b>{name}</b><small className="muted">{members} of {cap} members{location ? ` · ${location}` : ""}</small></span>
      </div>
      {description && <p className="muted small" style={{ margin: "10px 0 0" }}>{description}</p>}
      <div className="row hm-me">
        <Shirt number={number} size="normal" />
        <span className="muted grow">Your number{isAdmin ? " · Admin" : ""}</span>
        <Link href={`/c/${id}/community`} className="btn small ghost" aria-label={`Open the community page for ${name}`}>Community</Link>
      </div>
    </section>
  );
}

function LinkRow({ href, icon, title, sub }: { href: string; icon: HmIconName; title: string; sub: string }) {
  return (
    <Link href={href} className="item hm-link">
      <span className="hm-link-ic"><HmIcon name={icon} size={20} /></span>
      <span className="t grow"><b>{title}</b><small>{sub}</small></span>
      <HmIcon name="right" size={18} />
    </Link>
  );
}

export function LinkList({ id, members, alerts, pending, isAdmin }: { id: string; members: number; alerts: number; pending: number; isAdmin: boolean }) {
  return (
    <section className="card list hm-links" aria-label="More">
      <LinkRow href={`/c/${id}/invite`} icon="userplus" title="Invite friends" sub="Link, code and QR" />
      <LinkRow href={`/c/${id}/members`} icon="people" title="Members" sub={plural(members, "player", "players")} />
      <LinkRow href={`/c/${id}/alerts`} icon="bell" title="Alerts" sub={alerts ? `${alerts} unread` : "Nothing new"} />
      {isAdmin && <LinkRow href={`/c/${id}/requests`} icon="shield" title="Join requests" sub={pending ? `${pending} waiting` : "None waiting"} />}
    </section>
  );
}

/** Floating "New match" button, phones only (the CSS hides it from 640 px up). */
export function NewMatchFab({ id }: { id: string }) {
  return (
    <Link href={`/c/${id}/matches/new`} className="hm-fab"><HmIcon name="plus" size={20} /> New match</Link>
  );
}
