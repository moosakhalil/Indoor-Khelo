import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountPanel } from "@/components/Forms2";
import SignOutButton, { SignOutAllButton } from "@/components/SignOutButton";
import { accountPlan } from "@/lib/management";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireAcceptedUser();
  const plan = await accountPlan(user.id);
  const blocked = plan.blockers.length > 0;
  return (
    <main className="app">
      <header className="topbar">
        <Link href="/home" className="back" aria-label="Back">‹</Link>
        <h1>Account</h1>
      </header>
      <div className="stack">
        <section className="card">
          <b>{user.name}</b>
          <p className="muted small" style={{ margin: "2px 0 0" }}>Signed in with Google. Your email is private and used only to sign you in.</p>
        </section>
        <SignOutButton />
        <SignOutAllButton />

        <section className="card stack" style={{ marginTop: 16 }}>
          <b>Delete my account</b>
          <p className="muted small" style={{ margin: 0 }}>Your name is removed and you leave every community. Past scorecards keep the record that a player took part, shown as &ldquo;Deleted player&rdquo;.</p>
          {blocked && (
            <div className="banner gold">
              You are the only Admin of {plan.blockers.map((c) => c.name).join(", ")}, which still {plan.blockers.length === 1 ? "has" : "have"} members. Make someone else Admin first (Community page, Manage members), or delete that community.
              <div className="row wrap" style={{ marginTop: 8 }}>
                {plan.blockers.map((c) => <Link key={c.id} href={`/c/${c.id}/leave`} className="chip">{c.name}</Link>)}
              </div>
            </div>
          )}
          {plan.willDelete.length > 0 && (
            <div className="banner red">These communities have only you in them, so they will be deleted too: {plan.willDelete.map((c) => c.name).join(", ")}.</div>
          )}
          {plan.willLeave.length > 0 && (
            <p className="muted small" style={{ margin: 0 }}>You will leave: {plan.willLeave.map((c) => c.name).join(", ")}.</p>
          )}
          <DeleteAccountPanel blocked={blocked} />
        </section>
      </div>
    </main>
  );
}
