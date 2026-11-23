import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { leaveAction } from "@/app/actions2";
import CommunityLogo from "@/components/CommunityLogo";
import { getCommunity, getMembership } from "@/lib/community";
import { one } from "@/lib/db";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Waiting for approval" };

export default async function WaitingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  const community = await getCommunity(id);
  if (!community) redirect("/choose");
  const m = await getMembership(id, user.id);
  if (!m || m.status === "left" || m.status === "removed") redirect("/choose");
  if (m.status === "approved") redirect(m.player_number === null ? `/c/${id}/number` : `/c/${id}`);
  const admin = await one<{ name: string }>("select name from app_user where id = $1", [community.created_by]);

  if (m.status === "rejected") {
    return (
      <main className="app">
        <div className="stack center" style={{ paddingTop: 48 }}>
          <div style={{ display: "flex", justifyContent: "center" }}><CommunityLogo name={community.name} big /></div>
          <h1 style={{ fontSize: "1.3rem" }}>Your request was not approved</h1>
          <p className="muted">The Admin of {community.name} did not approve this request. You can ask again later.</p>
          <Link className="btn gold" href={`/join/${community.invite_code}`}>Ask again</Link>
          <Link className="btn ghost" href="/choose">Back</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="stack center" style={{ paddingTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "center" }}><CommunityLogo name={community.name} big /></div>
        <h1 style={{ fontSize: "1.3rem" }}>Request sent</h1>
        <p className="muted" style={{ margin: 0 }}>{admin?.name ?? "The Admin"} will approve you soon. Come back and check, or we will show it here as soon as you are in.</p>
        <section className="card" style={{ textAlign: "left" }}>
          <ol className="steps">
            <li><i>✓</i><span><b>Request sent</b></span></li>
            <li><i style={{ background: "var(--line)", color: "var(--white)" }}>2</i><span><b>Admin approves</b><br /><small className="muted">Waiting</small></span></li>
            <li><i style={{ background: "var(--line)", color: "var(--white)" }}>3</i><span><b>Pick your player number</b></span></li>
          </ol>
        </section>
        <Link className="btn gold" href={`/c/${id}/waiting`}>Check again</Link>
        <form action={leaveAction}>
          <input type="hidden" name="communityId" value={id} />
          <button className="btn red small" style={{ width: "100%" }}>Cancel my request</button>
        </form>
        <Link className="btn ghost" href="/choose">Back</Link>
      </div>
    </main>
  );
}
