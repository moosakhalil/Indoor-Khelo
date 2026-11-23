import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TermsForm } from "@/components/Forms";
import { requireUser } from "@/lib/session";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Terms and privacy" };

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser();
  const { next } = await searchParams;
  const dest = safeNextPath(next, "/choose");
  if (user.termsAccepted) redirect(dest);
  return (
    <main className="app">
      <header className="topbar"><h1>Terms and privacy</h1></header>
      <div className="stack">
        <section className="card muted" style={{ lineHeight: 1.6 }}>
          <b style={{ color: "var(--white)" }}>Welcome to Indoor Khelo, {user.name}</b>
          <p>Indoor Khelo helps indoor cricket communities organise matches, score them, keep records and split venue costs.</p>
          <p><b style={{ color: "var(--white)" }}>Your name.</b> We take only your name from Google. No photos are used. Your email stays private and is used only to sign you in.</p>
          <p><b style={{ color: "var(--white)" }}>Open communities.</b> Members of a community can create matches and teams and can score. Every change shows who made it.</p>
          <p><b style={{ color: "var(--white)" }}>Your records.</b> Career stats come only from matches scored in the app. Nobody can edit them by hand.</p>
        </section>
        <TermsForm next={dest} />
      </div>
    </main>
  );
}
