import type { Metadata } from "next";
import EnIcon from "@/components/EnIcons";
import EnJoinForm from "@/components/EnJoinForm";
import { EnHead, EnTopBar } from "@/components/EnParts";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Join a community" };

export default async function JoinPage() {
  const user = await requireAcceptedUser();
  return (
    <main className="app en-app en-narrow">
      <EnTopBar back="/choose" user={{ name: user.name }} />
      <div className="en-col">
        <EnHead title="Join a community" lead="Paste the invite link or type the code your Admin gave you." />
        <EnJoinForm />
        <section className="en-card en-examples" aria-labelledby="ex-h">
          <h2 id="ex-h" className="en-card-h">What it looks like</h2>
          <ul className="en-rows">
            <li className="en-ex"><span className="en-fact-ic"><EnIcon name="link" size={18} /></span><span className="en-row-t"><small>Link</small><b className="mono">…/join/KH-7Q4M</b></span></li>
            <li className="en-ex"><span className="en-fact-ic"><EnIcon name="code" size={18} /></span><span className="en-row-t"><small>Code</small><b className="mono">KH-7Q4M</b></span></li>
          </ul>
        </section>
      </div>
    </main>
  );
}
