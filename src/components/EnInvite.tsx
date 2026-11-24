import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import EnIcon from "@/components/EnIcons";
import { EnBrand } from "@/components/EnParts";

type Community = { name: string; location: string; description: string; approval_required: boolean };

/** The welcome card: big initials logo, name, location chip, description and the three facts with icons.
 *  Only what the page showed before (name, location, description, member count, Admin's name, how joining works). */
export function EnInviteCard({ community, members, adminName }: { community: Community; members: number; adminName: string }) {
  const bare = !community.location && !community.description;
  return (
    <section className="en-card en-invite" aria-label="The invitation">
      <p className="en-eyebrow center">You are invited to join</p>
      <div className="en-invite-logo"><CommunityLogo name={community.name} big /></div>
      <h1 className="en-invite-name">{community.name}</h1>
      {community.location && <p className="en-chip"><EnIcon name="pin" size={14} />{community.location}</p>}
      {community.description && <p className="en-invite-desc">{community.description}</p>}
      {bare && <p className="muted small center">No location or description added yet.</p>}
      <ul className="en-facts-list">
        <li><span className="en-fact-ic"><EnIcon name="people" size={18} /></span><span className="muted">Members</span><b>{members}</b></li>
        <li><span className="en-fact-ic"><EnIcon name="person" size={18} /></span><span className="muted">Admin</span><b>{adminName}</b></li>
        <li>
          <span className="en-fact-ic"><EnIcon name={community.approval_required ? "shield" : "check"} size={18} /></span>
          <span className="muted">Joining</span>
          <b>{community.approval_required ? "Admin approval needed" : "Open, join straight away"}</b>
        </li>
      </ul>
    </section>
  );
}

/** "What happens next": the steps match the mode. The Admin step only appears when approval is on. */
export function EnNextSteps({ approval, signedIn }: { approval: boolean; signedIn: boolean }) {
  return (
    <div className="en-next">
      <p className="en-eyebrow">What happens next</p>
      <ol className="en-nsteps">
        <li className={signedIn ? "done" : "now"}>
          <span className="en-nstep-ic"><EnIcon name="check" size={16} /></span>
          <span><b>{signedIn ? "You are signed in" : "Sign in with Google"}</b></span>
        </li>
        {approval && (
          <li className={signedIn ? "now" : undefined}>
            <span className="en-nstep-ic"><EnIcon name="shield" size={16} /></span>
            <span><b>The Admin approves you</b></span>
          </li>
        )}
        <li>
          <span className="en-nstep-ic"><EnIcon name="person" size={16} /></span>
          <span><b>Pick your player number</b><small>From 1 to 99. You can change it later.</small></span>
        </li>
      </ol>
    </div>
  );
}

/** The community is full: a state with a way out, not an error line. Same message as before plus a next step. */
export function EnFullCard({ cap }: { cap: number }) {
  return (
    <section className="en-card en-state red" aria-labelledby="full-h">
      <span className="en-state-ic"><EnIcon name="lock" size={30} /></span>
      <h2 id="full-h">This community is full</h2>
      <p>This community already has {cap} members, so no one else can join. Ask the Admin to make room, or join another community.</p>
      <Link href="/join" className="btn en-ghostbtn">Try another code</Link>
    </section>
  );
}

/** Invalid or replaced invite: same words, plus a way back to the start. */
export function EnInvalid() {
  return (
    <main className="app en-app en-narrow">
      <header className="topbar en-top"><EnBrand /></header>
      <div className="en-col">
        <section className="en-card en-state">
          <span className="en-state-ic"><EnIcon name="brokenlink" size={30} /></span>
          <h1>This invite is not valid</h1>
          <p>The link or code may be wrong, or the Admin replaced it. Ask your Admin for a new one.</p>
          <Link className="btn gold" href="/join">Try another code</Link>
          <Link className="btn en-ghostbtn" href="/">Go to Indoor Khelo</Link>
        </section>
      </div>
    </main>
  );
}
