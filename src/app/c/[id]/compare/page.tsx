import type { Metadata } from "next";
import Frame from "@/components/Frame";
import { CompareTable } from "@/components/AnalyticsParts";
import { compareCareers } from "@/lib/analytics";
import { careerOf } from "@/lib/career";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { communityCareers } from "@/lib/reports";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Compare players" };
export const dynamic = "force-dynamic";

// Two members side by side: batting, bowling, fielding, awards and matches, with the better number marked.
export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const user = await requireAcceptedUser();
  await requireMember(id, user.id);
  const members = await listApprovedMembers(id);
  const a = members.find((m) => m.user_id === q.a) ?? null;
  const b = members.find((m) => m.user_id === q.b) ?? null;
  const same = !!a && !!b && a.user_id === b.user_id;
  const careers = a && b && !same ? await communityCareers(id) : null;
  const empty = careerOf([]);
  return (
    <Frame communityId={id} title="Compare players" back={`/c/${id}/teams`}>
      <div className="stack">
        <form method="get" className="card" aria-label="Choose two players">
          <label className="lb" htmlFor="cmp-a" style={{ marginTop: 0 }}>First player</label>
          <select id="cmp-a" name="a" className="field" defaultValue={a?.user_id ?? ""}>
            <option value="">Choose</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name} ({m.player_number ?? "–"})</option>)}
          </select>
          <label className="lb" htmlFor="cmp-b">Second player</label>
          <select id="cmp-b" name="b" className="field" defaultValue={b?.user_id ?? ""}>
            <option value="">Choose</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name} ({m.player_number ?? "–"})</option>)}
          </select>
          <button className="btn gold" style={{ marginTop: 12 }}>Compare</button>
        </form>
        {same && <div className="banner red" role="alert">Choose two different players.</div>}
        {!a && !b && <div className="card center muted small">Choose two members to see them side by side. Figures come from finished matches only.</div>}
        {(a && !b) || (!a && b) ? <div className="banner mute">Choose the second player too.</div> : null}
        {careers && a && b && <CompareTable rows={compareCareers(careers.get(a.user_id) ?? empty, careers.get(b.user_id) ?? empty)} aName={a.name} bName={b.name} />}
      </div>
    </Frame>
  );
}
