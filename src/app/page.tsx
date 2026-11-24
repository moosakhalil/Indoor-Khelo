import { redirect } from "next/navigation";
import EnIcon, { type EnIconName } from "@/components/EnIcons";
import EnInstallHint from "@/components/EnInstallHint";
import SignInButton from "@/components/SignInButton";
import { getSessionUser } from "@/lib/session";
import "@/components/en.css";

const PROMISES: { icon: EnIconName; title: string; text: string }[] = [
  { icon: "pencil", title: "Score every ball", text: "A fast scoring pad that keeps working with no signal." },
  { icon: "chart", title: "Teams, stats and leaderboards", text: "Career records come only from matches scored here." },
  { icon: "coin", title: "Share the venue cost", text: "See who has chipped in for each booking." },
];

// Welcome and sign in. A signed-in visitor never sees this page. Phone: the brand moment, then the sign-in card.
// Tablet and desktop: split hero (brand and the three promises on the left, the sign-in card on the right).
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ rf?: string }> }) {
  const { rf } = await searchParams;
  // First visit asks for a session renewal route if needed; the second visit (rf=1) never loops.
  const user = await getSessionUser({ refreshTo: rf === "1" ? undefined : "/" });
  if (user) redirect("/home");
  return (
    <main className="app en-app en-welcome">
      <section className="en-hero" aria-label="About Indoor Khelo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512.png" alt="Indoor Khelo logo" width={150} height={150} className="en-hero-img" />
        <h1 className="en-hero-h1">Indoor <span>Khelo</span></h1>
        <p className="en-hero-tag">Play. <b>Score.</b> Split.</p>
        <ul className="en-pills" aria-label="What the app does">
          <li><EnIcon name="pencil" size={16} />Live scoring</li>
          <li><EnIcon name="chart" size={16} />Stats</li>
          <li><EnIcon name="coin" size={16} />Split costs</li>
        </ul>
        <ul className="en-promises" aria-label="What the app does">
          {PROMISES.map((p) => (
            <li key={p.title}>
              <span className="en-promise-ic"><EnIcon name={p.icon} size={20} /></span>
              <span><b>{p.title}</b><small>{p.text}</small></span>
            </li>
          ))}
        </ul>
      </section>
      <section className="en-start" aria-labelledby="start-h">
        <div className="en-start-in">
          <h2 id="start-h" className="en-start-h">Get started</h2>
          <p className="en-lead">One tap creates your account or signs you in. No password to remember.</p>
          <SignInButton next="/home" />
          <p className="en-privacy"><EnIcon name="lock" size={16} /><span>Only your name is used. No photo, no password. Your email stays private.</span></p>
          <EnInstallHint />
        </div>
      </section>
    </main>
  );
}
