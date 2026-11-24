import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EnIcon, { type EnIconName } from "@/components/EnIcons";
import { EnHead, EnTopBar } from "@/components/EnParts";
import EnTermsForm from "@/components/EnTermsForm";
import { requireUser } from "@/lib/session";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Terms and privacy" };

// The same four facts as before, now one icon, one bold label and one line each.
const FACTS: { icon: EnIconName; label: string; text: string }[] = [
  { icon: "shield", label: "What it is", text: "Indoor Khelo helps indoor cricket communities organise matches, score them, keep records and split venue costs." },
  { icon: "person", label: "Your name", text: "We take only your name from Google. No photos are used. Your email stays private and is used only to sign you in." },
  { icon: "people", label: "Open communities", text: "Members of a community can create matches and teams and can score. Every change shows who made it." },
  { icon: "chart", label: "Your records", text: "Career stats come only from matches scored in the app. Nobody can edit them by hand." },
];

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser();
  const { next } = await searchParams;
  const dest = safeNextPath(next, "/choose");
  if (user.termsAccepted) redirect(dest);
  // Not accepted yet: /account would send the person back here, so the account menu only offers Log out.
  const first = user.name.split(" ")[0] || user.name;
  return (
    <main className="app en-app en-narrow">
      <EnTopBar user={{ name: user.name }} showAccount={false} />
      <div className="en-col">
        <EnHead eyebrow="Terms and privacy" title={`Welcome to Indoor Khelo, ${first}`} lead="Please read this once. It takes 30 seconds." />
        <section className="card en-facts" aria-label="The Terms and the Privacy notice">
          {FACTS.map((f) => (
            <div key={f.label} className="en-fact">
              <span className="en-fact-ic"><EnIcon name={f.icon} size={20} /></span>
              <p><b>{f.label}</b><span>{f.text}</span></p>
            </div>
          ))}
        </section>
        <EnTermsForm next={dest} />
      </div>
    </main>
  );
}
