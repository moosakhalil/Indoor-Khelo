import type { Metadata } from "next";
import Frame from "@/components/Frame";
import ComparePicker from "@/components/ComparePicker";
import { CompareBoard, QuickPicks } from "@/components/CompareParts";
import { IconInfo, IconSwap, IconWarn } from "@/components/LdIcons";
import { compareCareers } from "@/lib/analytics";
import { careerOf } from "@/lib/career";
import { listApprovedMembers, requireMember } from "@/lib/community";
import { quickPicks } from "@/lib/ldView";
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
  // The careers are needed for the comparison and, when nobody is chosen yet, for the quick picks.
  const careers = (a && b && !same) || (!a && !b) ? await communityCareers(id) : null;
  const empty = careerOf([]);
  const picks = !a && !b && careers ? quickPicks(members, careers, user.id) : [];
  const both = careers && a && b && !same ? { ca: careers.get(a.user_id) ?? empty, cb: careers.get(b.user_id) ?? empty } : null;
  return (
    <Frame communityId={id} title="Compare players" subtitle={<small className="muted">Finished matches only</small>} back={`/c/${id}/teams`}>
      <div className="stack ld-page">
        <ComparePicker communityId={id} members={members.map((m) => ({ user_id: m.user_id, name: m.name, player_number: m.player_number, playing_role: m.playing_role }))} a={a?.user_id ?? null} b={b?.user_id ?? null} />
        {same && <div className="banner red ld-banner" role="alert"><IconWarn size={18} /><span>Choose two different players.</span></div>}
        {!a && !b && (
          <section className="card ld-empty">
            <span className="ld-empty-ic" aria-hidden="true"><IconSwap size={26} /></span>
            <b>Pick two members to compare</b>
            <p className="muted small" style={{ margin: 0 }}>Choose two members to see them side by side. Figures come from finished matches only.</p>
            <QuickPicks communityId={id} picks={picks} />
          </section>
        )}
        {(a && !b) || (!a && b) ? <div className="ld-note" role="status"><IconInfo size={18} /><span>Choose the {a ? "second" : "first"} player too.</span></div> : null}
        {both && a && b && <CompareBoard rows={compareCareers(both.ca, both.cb)} aName={a.name} bName={b.name} aMatches={both.ca.matches} bMatches={both.cb.matches} />}
      </div>
    </Frame>
  );
}
