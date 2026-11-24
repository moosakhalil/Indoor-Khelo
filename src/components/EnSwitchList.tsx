import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import EnIcon from "@/components/EnIcons";
import EnOpenLink from "@/components/EnOpenLink";
import Shirt from "@/components/Shirt";
import type { EnMine } from "@/components/EnCommunityList";

/** Each community is a big tappable card: logo, name, role badge, the player's gold shirt (grey with a dash while waiting),
 *  and an Open button. The one the app opens by default is the primary button; "Last opened" is shown only when the
 *  ik_last cookie really points at it. */
export default function EnSwitchList({ mine, preferredId, lastId }: { mine: EnMine[]; preferredId?: string; lastId?: string }) {
  if (mine.length === 0) {
    return (
      <section className="en-card en-state" aria-labelledby="none-h">
        <span className="en-state-ic"><EnIcon name="people" size={30} /></span>
        <h2 id="none-h">You are not in a community yet</h2>
        <p>Create one for your group, or join one with an invite link.</p>
        <div className="en-state-actions">
          <Link href="/create" className="btn gold"><EnIcon name="plus" size={18} />Create</Link>
          <Link href="/join" className="btn en-ghostbtn"><EnIcon name="userplus" size={18} />Join</Link>
        </div>
      </section>
    );
  }
  return (
    <>
      <ul className="en-cards">
        {mine.map((c) => {
          const pend = c.status === "pending";
          return (
            <li key={c.id} className={`en-ccard${c.id === preferredId ? " pref" : ""}`}>
              <CommunityLogo name={c.name} />
              <div className="en-ccard-t">
                <b>{c.name}</b>
                {pend ? (
                  <>
                    <span className="en-badges"><span className="en-badge pend">Pending</span><Shirt number={null} size="small" label="No player number yet" /></span>
                    <small className="muted">Waiting for approval</small>
                  </>
                ) : (
                  <span className="en-badges">
                    <span className={`en-badge ${c.role === "admin" ? "admin" : "member"}`}>{c.role === "admin" ? "Admin" : "Member"}</span>
                    <span className="muted small">number</span>
                    <Shirt number={c.player_number} size="small" />
                    {c.id === lastId && <span className="en-badge last">Last opened</span>}
                  </span>
                )}
              </div>
              <EnOpenLink id={c.id} name={c.name} label={pend ? "Status" : "Open"} primary={c.id === preferredId} pending={pend} />
            </li>
          );
        })}
      </ul>
      <div className="two en-two">
        <Link href="/create" className="btn en-ghostbtn"><EnIcon name="plus" size={18} />Create community</Link>
        <Link href="/join" className="btn en-ghostbtn"><EnIcon name="userplus" size={18} />Join community</Link>
      </div>
    </>
  );
}
