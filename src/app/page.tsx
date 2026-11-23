import { redirect } from "next/navigation";
import SignInButton from "@/components/SignInButton";
import { getSessionUser } from "@/lib/session";

export default async function WelcomePage() {
  const user = await getSessionUser();
  if (user) redirect("/home");
  return (
    <main className="app">
      <div className="stack center" style={{ flex: 1, justifyContent: "center", paddingTop: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512.png" alt="Indoor Khelo logo" width={150} height={150} style={{ borderRadius: 30, margin: "0 auto" }} />
        <h1 style={{ fontSize: "2.2rem", letterSpacing: "-0.02em" }}>
          Indoor <span style={{ color: "var(--gold)" }}>Khelo</span>
        </h1>
        <p className="muted" style={{ margin: "-4px 0 8px" }}>Play. Score. Split.</p>
        <SignInButton next="/home" />
        <p className="muted small" style={{ margin: "6px 8px 0" }}>
          One tap creates your account or signs you in. Only your name is used. No password to remember.
        </p>
      </div>
    </main>
  );
}
