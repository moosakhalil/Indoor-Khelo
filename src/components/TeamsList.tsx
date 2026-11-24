"use client";
// The Teams screen: a card per team (badge, leaders, record, form guide, menu), the team table beside it, search, and the shortcuts.
import "./b4.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import { IconPencil, IconPlus, IconSearch, IconUsers, IconWarn } from "@/components/B4Icons";
import TeamBadge from "@/components/TeamBadge";
import TeamDeleteDialog from "@/components/TeamDeleteDialog";
import {
  MIN_PLAYERS, RESULT_LETTER, RESULT_WORD, filterTeams, leadersText, matchesText, playersText, sortTeams,
  type TableRow, type TeamItem,
} from "@/lib/teamList";

export function FormGuide({ form, big }: { form: TeamItem["form"]; big?: boolean }) {
  if (!form.length) return null;
  return (
    <div className={`tm-form${big ? " big" : ""}`} role="list" aria-label={`Last ${form.length} results, oldest first: ${form.map((f) => RESULT_WORD[f.result]).join(", ")}`}>
      {form.map((f, i) => (
        <span key={i} role="listitem" className={`tm-f ${f.result}`} title={`${RESULT_WORD[f.result]} v ${f.opponent}`} aria-label={`${RESULT_WORD[f.result]} v ${f.opponent}`}>{RESULT_LETTER[f.result]}</span>
      ))}
    </div>
  );
}

export function TeamBadgeMine({ name, mine, size = "md" }: { name: string; mine: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={mine ? "tm-mine" : undefined}>
      <TeamBadge name={name} size={size} label={mine ? `Team ${name}, your team` : undefined} />
    </span>
  );
}

function TeamCard({ communityId, t }: { communityId: string; t: TeamItem }) {
  const [askDelete, setAskDelete] = useState(false);
  const base = `/c/${communityId}/teams/${t.id}`;
  const items: ActionItem[] = [
    { label: "Edit team", href: `${base}/edit` },
    { label: "Edit squad", href: `${base}/squad` },
    // Delete stays red and can be tapped: with matches it explains why it is not allowed instead of failing later.
    { label: t.matches > 0 ? `Delete team (has ${matchesText(t.matches)}, not allowed)` : "Delete team…", danger: true, onSelect: () => setAskDelete(true) },
  ];
  return (
    <article className={`tm-card${t.mine ? " mine" : ""}`}>
      <TeamBadgeMine name={t.name} mine={t.mine} />
      <div className="tm-main">
        <div className="tm-head">
          <Link href={base} className="tm-name">{t.name}</Link>
          {t.mine && <span className="tm-tag">Your team</span>}
        </div>
        <small className="tm-sub">{leadersText(t)}</small>
        <div className="tm-chips">
          {t.played > 0 ? (
            <>
              <span className="chip green">{t.won} won</span>
              <span className="chip red">{t.lost} lost</span>
              {t.tied > 0 && <span className="chip gold">{t.tied} tied</span>}
            </>
          ) : <span className="chip">No matches yet</span>}
          <span className="chip tm-players">{playersText(t.squad)}</span>
          {t.squad < MIN_PLAYERS && <span className="chip tm-warn"><IconWarn size={14} /> Needs {MIN_PLAYERS}+ players to play</span>}
        </div>
        {t.form.length > 0 && <div className="tm-formrow"><small>Form, last {t.form.length}</small><FormGuide form={t.form} /></div>}
      </div>
      <div className="tm-tools">
        <Link href={`${base}/edit`} className="tm-iconlink" aria-label={`Edit ${t.name}`}><IconPencil /></Link>
        <ActionMenu items={items} label={`Actions for ${t.name}`} />
      </div>
      <TeamDeleteDialog open={askDelete} onClose={() => setAskDelete(false)} communityId={communityId} teamId={t.id} name={t.name} matchCount={t.matches} />
    </article>
  );
}

export function TeamTable({ communityId, rows, placeholder }: { communityId: string; rows: TableRow[]; placeholder?: boolean }) {
  if (rows.length === 0) {
    return placeholder ? (
      <section className="card tm-tablecard" aria-label="Team table">
        <b>Team table</b>
        <p className="muted small" style={{ margin: "6px 0 0" }}>The table appears after the first finished match, ranked by wins, then win percentage, then runs.</p>
      </section>
    ) : null;
  }
  return (
    <section className="card tm-tablecard">
      <b>Team table</b>
      <table className="board" aria-label="Team table">
        <thead><tr><td className="muted small">#</td><td className="muted small">Team</td><td className="muted small">P</td><td className="muted small">W</td><td className="muted small">L</td><td className="muted small">T</td><td className="muted small">Win %</td><td className="muted small">Runs</td></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={t.mine ? "me" : undefined}>
              <td>{t.rank}</td>
              <td><Link href={`/c/${communityId}/teams/${t.id}`} className="tm-trow"><TeamBadge name={t.name} size="sm" /><b>{t.name}</b>{t.mine && <span className="tm-tag">You</span>}</Link></td>
              <td>{t.played}</td><td><b>{t.won}</b></td><td>{t.lost}</td><td>{t.tied}</td>
              <td>{t.winPercent === null ? "–" : t.winPercent.toFixed(0)}</td><td>{t.totalRuns}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ margin: "6px 0 0" }}>Ranked by wins, then win percentage, then runs.</p>
    </section>
  );
}

export function Explore({ communityId }: { communityId: string }) {
  const rows: [string, string, string][] = [
    ["members", "Members", "Everyone in this community"],
    ["series", "Series", "Group matches: best of 3, tournaments"],
    ["leaderboard", "Leaderboards", "Rank every member by any stat"],
    ["insights", "Insights", "Records, partnerships, bowling by over"],
    ["compare", "Compare two players", "Side by side"],
  ];
  return (
    <section className="card tm-explore" aria-labelledby="tm-explore-h">
      <h2 id="tm-explore-h">Explore</h2>
      <div className="list">
        {rows.map(([path, title, sub]) => (
          <Link key={path} href={`/c/${communityId}/${path}`} className="item">
            <span className="t grow"><b>{title}</b><small>{sub}</small></span><span aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function TeamsList({ communityId, teams, table }: { communityId: string; teams: TeamItem[]; table: TableRow[] }) {
  const [query, setQuery] = useState("");
  const [by, setBy] = useState<"az" | "record">("az");
  const shown = useMemo(() => sortTeams(filterTeams(teams, query), by), [teams, query, by]);
  const newTeam = `/c/${communityId}/teams/new`;

  if (teams.length === 0) {
    return (
      <div className="stack">
        <section className="ml-empty" aria-labelledby="tm-empty-h">
          <span className="ml-empty-icon"><IconUsers size={30} /></span>
          <h2 id="tm-empty-h">Make your first team</h2>
          <p>Teams keep a regular squad. Each match picks its own lineup, so the squad never changes by accident.</p>
          <span className="tm-preview" aria-hidden="true"><TeamBadge name="Your team" size="lg" /></span>
          <small>Your team gets its initials badge as soon as it is created.</small>
          <Link href={newTeam} className="btn gold ml-act"><IconPlus /> Create a team</Link>
        </section>
        <Explore communityId={communityId} />
      </div>
    );
  }

  return (
    <div className="stack tm-list-pad">
      <div className="tm-tools-row">
        <div className="ml-search tm-search">
          <IconSearch />
          <input type="search" className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teams" aria-label="Search teams" autoComplete="off" />
          {query && <button type="button" className="ml-clear" onClick={() => setQuery("")} aria-label="Clear what you typed">Clear</button>}
        </div>
        <button type="button" className="tm-sort" onClick={() => setBy(by === "az" ? "record" : "az")} aria-label={`Sorted ${by === "az" ? "A to Z" : "by record"}. Change the order`}>{by === "az" ? "A to Z" : "By record"}</button>
        <Link href={newTeam} className="btn gold tm-new-wide"><IconPlus /> New team</Link>
      </div>
      <div className="tm-split">
        <div className="stack">
          {shown.length === 0 ? (
            <section className="ml-none" role="status">
              <span className="ml-empty-icon"><IconSearch size={26} /></span>
              <b>No team for “{query.trim()}”</b>
              <p>No team has that name. Check the spelling or clear the search.</p>
              <button type="button" className="btn ghost small" onClick={() => setQuery("")}>Clear the search</button>
            </section>
          ) : shown.map((t) => <TeamCard key={t.id} communityId={communityId} t={t} />)}
        </div>
        <div className="stack tm-side">
          <TeamTable communityId={communityId} rows={table} placeholder />
        </div>
      </div>
      <p className="muted small" style={{ margin: "0 2px" }}>Any member can create or edit teams. Each team shows who created it and who changed it last, on its page.</p>
      <Explore communityId={communityId} />
      <Link href={newTeam} className="btn gold tm-fab"><IconPlus /> New team</Link>
    </div>
  );
}
