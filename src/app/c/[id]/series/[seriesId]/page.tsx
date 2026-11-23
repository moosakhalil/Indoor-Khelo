import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import { StatusChip } from "@/components/MatchBits";
import { deleteSeriesAction, removeMatchAction, seriesStatusAction } from "@/app/actionsSeries";
import { requireMember } from "@/lib/community";
import { formatWhen, type MatchStatus } from "@/lib/matchRules";
import { FORMAT_TEXT, tallyLine } from "@/lib/series";
import { getSeries } from "@/lib/seriesDb";
import { requireAcceptedUser } from "@/lib/session";
import { getZone } from "@/lib/zone";

export const metadata: Metadata = { title: "Series" };
export const dynamic = "force-dynamic";

type Q = { created?: string; saved?: string; added?: string; removed?: string; status?: string; e?: string };
const E: Record<string, string> = { not_in_series: "That match is not in this series.", bad_state: "That cannot be done in the series' current state.", forbidden: "Only members of this community can do that.", not_found: "That could not be found." };
const UPCOMING = ["draft", "scheduled", "postponed", "live", "paused"];

export default async function SeriesPage({ params, searchParams }: { params: Promise<{ id: string; seriesId: string }>; searchParams: Promise<Q> }) {
  const { id, seriesId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const s = await getSeries(id, seriesId);
  if (!s) notFound();
  const tz = await getZone();
  const open = s.status === "open";
  const upcoming = s.matches.filter((m) => UPCOMING.includes(m.status));
  const results = s.matches.filter((m) => !UPCOMING.includes(m.status)).slice().reverse();
  // "Play another" copies the latest match that was not cancelled or abandoned
  const latest = [...s.matches].filter((m) => m.status !== "cancelled" && m.status !== "abandoned").sort((a, b) => (b.scheduled_at?.getTime() ?? b.created_at.getTime()) - (a.scheduled_at?.getTime() ?? a.created_at.getTime()))[0];
  const base = `/c/${id}/series/${seriesId}`;
  const dates = s.starts_on || s.ends_on ? `${s.starts_on ?? "…"} to ${s.ends_on ?? "…"}` : null;

  const row = (m: (typeof s.matches)[number], withRemove: boolean) => (
    <div key={m.id} className="item" style={{ alignItems: "flex-start" }}>
      <Link href={`/c/${id}/matches/${m.id}${m.status === "completed" ? "/report" : ""}`} className="t grow">
        <b>{m.n1} v {m.n2}</b>
        <small>{formatWhen(m.scheduled_at, tz)} · {m.overs} overs{m.venue ? ` · ${m.venue}` : ""}</small>
        {m.status === "completed" && m.result?.text && <small>{m.result.text}</small>}
      </Link>
      <span className="row" style={{ gap: 6 }}>
        <StatusChip status={m.status as MatchStatus} />
        {withRemove && (
          <details>
            <summary className="chip" style={{ listStyle: "none", cursor: "pointer", minHeight: 32 }}>Remove</summary>
            <form action={removeMatchAction} style={{ marginTop: 6 }}>
              <input type="hidden" name="communityId" value={id} /><input type="hidden" name="seriesId" value={seriesId} /><input type="hidden" name="matchId" value={m.id} />
              <p className="muted small" style={{ margin: "0 0 6px" }}>Takes it out of the series. The match is kept.</p>
              <button className="btn red small">Yes, remove</button>
            </form>
          </details>
        )}
      </span>
    </div>
  );

  return (
    <Frame communityId={id} title="Series" back={`/c/${id}/series`} right={<span className={`chip ${open ? "green" : ""}`}>{open ? "Open" : "Closed"}</span>}>
      <div className="stack">
        {q.created && <div className="banner green" role="status">Series created. Add matches, or play the first one.</div>}
        {q.saved && <div className="banner green" role="status">Saved.</div>}
        {q.added && <div className="banner green" role="status">{q.added} match{q.added === "1" ? "" : "es"} added.</div>}
        {q.removed && <div className="banner green" role="status">Match removed from the series. The match itself is kept.</div>}
        {q.status && <div className="banner green" role="status">{open ? "Series reopened." : "Series closed. Its record is kept."}</div>}
        {q.e && <div className="banner red" role="alert">{E[q.e] ?? "That could not be done."}</div>}

        <section className="card center" style={s.status_view.winner ? { borderColor: "var(--gold)" } : undefined}>
          <small className="muted">{s.name}</small>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, margin: "4px 0" }}>{tallyLine(s.tally)}</div>
          <b style={{ color: s.status_view.drawn ? "var(--orange)" : s.status_view.winner ? "var(--gold)" : "var(--white)" }}>{s.status_view.text}</b>
          <small className="muted" style={{ display: "block", marginTop: 6 }}>{FORMAT_TEXT(s.format, s.best_of)}{dates ? ` · ${dates}` : ""}</small>
          {s.tally.abandoned > 0 && <small className="muted" style={{ display: "block" }}>{s.tally.abandoned} abandoned match{s.tally.abandoned === 1 ? "" : "es"} not counted</small>}
        </section>

        <div className="stack">
          {open && latest && <Link href={`/c/${id}/matches/${latest.id}/rematch`} className="btn gold">Play another match in this series</Link>}
          {open && !latest && <div className="banner mute">Add a match to the series, then you can play another one with one tap.</div>}
          <div className="two">
            <Link href={`${base}/add`} className="btn ghost small" style={{ width: "100%" }}>Add matches</Link>
            <Link href={`${base}/edit`} className="btn ghost small" style={{ width: "100%" }}>Edit series</Link>
          </div>
        </div>

        {s.tally.rows.length > 2 || s.tally.counted > 0 ? (
          <section className="card">
            <b>Points table</b>
            <table className="board" aria-label="Points table">
              <thead><tr><td className="muted small">Team</td><td className="muted small">P</td><td className="muted small">W</td><td className="muted small">L</td><td className="muted small">T</td><td className="muted small">Pts</td></tr></thead>
              <tbody>{s.table.map((r) => <tr key={r.name}><td><b>{r.name}</b></td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.tied}</td><td><b>{r.points}</b></td></tr>)}</tbody>
            </table>
            <p className="muted small" style={{ margin: "6px 0 0" }}>A win is 2 points, a tie or no result 1 point each. A level series is shown as drawn: the app never forces a winner.</p>
          </section>
        ) : null}

        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>Fixtures <small className="muted">({upcoming.length})</small></h2>
          <div className="list" style={{ marginTop: 6 }}>
            {upcoming.length === 0 && <div className="item muted">Nothing to play right now.</div>}
            {upcoming.map((m) => row(m, true))}
          </div>
        </section>
        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>Results <small className="muted">({results.length})</small></h2>
          <div className="list" style={{ marginTop: 6 }}>
            {results.length === 0 && <div className="item muted">No finished matches yet.</div>}
            {results.map((m) => row(m, true))}
          </div>
        </section>

        <section className="card list">
          <Link href={`/c/${id}/leaderboard?series=${seriesId}`} className="item"><span className="t grow"><b>Series leaderboard</b><small>Rank every member by any stat, in this series only</small></span><span aria-hidden="true">›</span></Link>
        </section>

        <p className="muted small" style={{ margin: 0 }}>Added by <b style={{ color: "var(--white)" }}>{s.created_by_name ?? "—"}</b> · Changed by <b style={{ color: "var(--white)" }}>{s.changed_by_name ?? "—"}</b> ({formatWhen(s.updated_at, tz)})</p>
        {s.notes && <section className="card"><small className="muted">Notes</small><p style={{ margin: "4px 0 0" }}>{s.notes}</p></section>}

        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>{open ? "Finished with this series?" : "This series is closed"}</h2>
          <p className="muted small" style={{ margin: "4px 0 8px" }}>{open ? "Closing keeps the record. You can reopen it any time and keep playing." : "Its record is kept. Reopen it to add matches or play another."}</p>
          <form action={seriesStatusAction}>
            <input type="hidden" name="communityId" value={id} /><input type="hidden" name="seriesId" value={seriesId} /><input type="hidden" name="to" value={open ? "closed" : "open"} />
            <button className="btn ghost small">{open ? "Close the series" : "Reopen the series"}</button>
          </form>
          <details style={{ marginTop: 10 }}>
            <summary className="btn red small" style={{ listStyle: "none", cursor: "pointer" }}>Delete series…</summary>
            <form action={deleteSeriesAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="communityId" value={id} /><input type="hidden" name="seriesId" value={seriesId} />
              <p className="muted small" style={{ margin: "0 0 8px" }}>Deletes the series only. Every match in it is kept, with all its stats.</p>
              <button className="btn red small">Yes, delete the series</button>
            </form>
          </details>
        </section>
      </div>
    </Frame>
  );
}
