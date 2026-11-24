import type { Metadata } from "next";
import Link from "next/link";
import { AcDangerZone, AcSessions } from "@/components/AcAccount";
import AcIcon from "@/components/AcIcons";
import Shirt from "@/components/Shirt";
import { accountPlan } from "@/lib/management";
import { requireAcceptedUser } from "@/lib/session";
import "@/components/ac.css";

export const metadata: Metadata = { title: "Account" };

// Phase G3: three zones (profile, Sessions, Danger zone). One column on a phone and tablet; from 1024 px the red
// Danger zone is a side panel. No community is open here, so the shell frame is not used: just the glass top bar.
export default async function AccountPage() {
  const user = await requireAcceptedUser();
  const plan = await accountPlan(user.id);
  return (
    <main className="app ac-page">
      <header className="topbar ac-bar">
        <Link href="/home" className="ac-back" aria-label="Back"><AcIcon name="back" size={22} /></Link>
        <span className="ac-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={28} height={28} />
          <span>Indoor <b>Khelo</b></span>
        </span>
      </header>
      <h1 className="ac-title">Account</h1>
      <div className="ac-cols">
        <div className="ac-main">
          <section className="ac-profile" aria-label="Signed in as">
            <Shirt number={null} size="big" name={user.name} />
            <div className="ac-profile-t">
              <h2>{user.name}</h2>
              <p><AcIcon name="lock" size={14} /> Signed in with Google. Your email is private and used only to sign you in.</p>
            </div>
          </section>
          <AcSessions />
        </div>
        <div className="ac-side">
          <AcDangerZone blockers={plan.blockers} willDelete={plan.willDelete} willLeave={plan.willLeave} />
        </div>
      </div>
    </main>
  );
}
