import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { addGuestAction, fillInAction, setLineupAction } from "@/app/actions4";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { getMatch, listLineup, listReplies } from "@/lib/matches";
import { NOT_STARTED } from "@/lib/matchRules";
import { noticeFor } from "@/lib/notices";
import { requireAcceptedUser } from "@/lib/session";
import { PLAYING_ROLES, labelOf } from "@/lib/validation";

export const metadata: Metadata = { title: "Pick lineups" };

type Q = { e?: string; n?: string; skip?: string; side?: string; max?: string };

const clip: React.CSSProperties = { maxWidth: "9ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "bottom" };

function Pick({ name, current, sides }: { name: string; current: 0 | 1 | 2; sides: [string, string] }) {
  const opts: [0 | 1 | 2, string][] = [[0, "Not playing"], [1, sides[0]], [2, sides[1]]];
  return (
    <span className="row" style={{ gap: 6, flexWrap: "wrap" }} role="radiogroup">
      {opts.map(([v, label]) => (
        <label key={v} className="chip" style={{ cursor: "pointer", minHeight: 44 }} title={label}>
          <input type="radio" name={name} value={v} defaultChecked={current === v} style={{ accentColor: "var(--gold)" }} aria-label={label} />
          <span style={clip}>{v === 0 ? "Out" : label}</span>
        </label>
      ))}
    </span>
  );
}

// Lineups for both sides on one screen. Replies decide only the order of the list, never who can play.
export default async function LineupPage({ params, searchParams }: { params: Promise<{ id: string; matchId: string }>; searchParams: Promise<Q> }) {
  const { id, matchId } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const m = await getMatch(id, matchId, user.id);
  if (!m) notFound();
  if (!(NOT_STARTED as readonly string[]).includes(m.status)) redirect(`/c/${id}/matches/${matchId}?e=locked`);
  const [lineup, replies, members] = await Promise.all([listLineup(id, matchId), listReplies(id, matchId), listApprovedMembers(id)]);
  const sideOf = new Map<string, 1 | 2>();
  for (const l of lineup) if (l.user_id) sideOf.set(l.user_id, l.position);
  const roleOf = new Map(members.map((p) => [p.user_id, p.playing_role]));
  const answerOf = new Map(replies.map((r) => [r.user_id, r.answer]));
  const rank = (uid: string) => (answerOf.get(uid) === "in" ? 0 : answerOf.get(uid) === "out" ? 2 : 1);
  const ordered = [...replies].sort((a, b) => rank(a.user_id) - rank(b.user_id) || (a.player_number ?? 999) - (b.player_number ?? 999));
  const guests = lineup.filter((l) => l.kind !== "member");
  const count = (pos: 1 | 2) => lineup.filter((l) => l.position === pos).length;
  const sides: [string, string] = [m.side1_name, m.side2_name];
  const notice = noticeFor(q.e, { n: q.n, skip: q.skip, side: q.side, max: q.max });

  return (
    <Frame communityId={id} title="Pick lineups" back={`/c/${id}/matches/${matchId}`}>
      <div className="stack">
        {notice && <div className={`banner ${notice.tone}`} role="status">{notice.text}</div>}
        <section className="card">
          <b>{m.side1_name}: {count(1)} of {m.players_per_side}</b><br />
          <b>{m.side2_name}: {count(2)} of {m.players_per_side}</b>
          <p className="muted small" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>A player can be on one side per match. The permanent squads are never changed by a lineup. Members who replied “I&rsquo;m in” are listed first, but anyone can be picked.</p>
        </section>

        <section className="card">
          <h2 style={{ fontSize: "1rem" }}>Quick tools</h2>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>Use these first, then adjust the list below and save. (They save straight away.)</p>
          <div className="two">
            {([1, 2] as const).map((pos) => (
              <form key={pos} action={fillInAction}>
                <input type="hidden" name="communityId" value={id} />
                <input type="hidden" name="matchId" value={matchId} />
                <input type="hidden" name="side" value={pos} />
                <button className="btn ghost small" style={{ width: "100%" }}>Add everyone who is in to {sides[pos - 1]}</button>
              </form>
            ))}
          </div>
          <form action={addGuestAction} style={{ marginTop: 14 }}>
            <input type="hidden" name="communityId" value={id} />
            <input type="hidden" name="matchId" value={matchId} />
            <label className="lb" htmlFor="g-name" style={{ marginTop: 0 }}>Add a guest (a name is enough)</label>
            <input id="g-name" name="guestName" className="field" maxLength={60} autoComplete="off" placeholder="Guest's name" />
            <div className="two" style={{ marginTop: 8 }}>
              <button name="side" value="1" className="btn ghost small" style={{ width: "100%" }}>Add to {sides[0]}</button>
              <button name="side" value="2" className="btn ghost small" style={{ width: "100%" }}>Add to {sides[1]}</button>
            </div>
            <p className="muted small" style={{ margin: "8px 0 0" }}>A guest has no account and no player number. Their figures stay on this match&rsquo;s scorecard.</p>
          </form>
        </section>

        <form action={setLineupAction} className="stack">
          <input type="hidden" name="communityId" value={id} />
          <input type="hidden" name="matchId" value={matchId} />
          <section className="card list">
            {ordered.map((p) => {
              const a = p.answer;
              const role = labelOf(PLAYING_ROLES, roleOf.get(p.user_id) ?? null);
              return (
                <div key={p.user_id} className="item" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Shirt number={p.player_number} size="small" />
                  <span className="t grow" style={{ minWidth: 120 }}>
                    <b>{p.name}</b>
                    <small>{a === "in" ? "In" : a === "out" ? "Can’t make it" : "No reply"}{role ? ` · ${role}` : ""}</small>
                  </span>
                  <Pick name={`m_${p.user_id}`} current={sideOf.get(p.user_id) ?? 0} sides={sides} />
                </div>
              );
            })}
          </section>
          {guests.length > 0 && (
            <section className="card list">
              <b style={{ marginBottom: 4 }}>Guests in this match</b>
              {guests.map((g) => (
                <div key={g.id} className="item" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Shirt number={null} size="small" label="Guest, no player number" />
                  <span className="t grow" style={{ minWidth: 120 }}><b>{g.name}</b><small>{g.kind === "linked" ? "Guest, linked to a member" : "Guest"}</small></span>
                  <Pick name={`g_${g.id}`} current={g.position} sides={sides} />
                </div>
              ))}
            </section>
          )}
          <div className="stickybar">
            <button className="btn gold">Save lineups</button>
          </div>
        </form>
      </div>
    </Frame>
  );
}
