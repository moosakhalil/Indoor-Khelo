import type { Metadata } from "next";
import EnCreateForm from "@/components/EnCreateForm";
import { EnHead, EnTopBar } from "@/components/EnParts";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create a community" };

const STEPS = ["Community", "Player number", "Invite friends"];

export default async function CreatePage() {
  const user = await requireAcceptedUser();
  return (
    <main className="app en-app en-wide">
      <EnTopBar back="/choose" user={{ name: user.name }} />
      <div className="en-col">
        <ol className="en-steps" aria-label="Step 1 of 3">
          {STEPS.map((s, i) => (
            <li key={s} className={i === 0 ? "on" : undefined} aria-current={i === 0 ? "step" : undefined}>
              <i aria-hidden="true" />
              <span>{i + 1} {s}</span>
            </li>
          ))}
        </ol>
        <EnHead title="Create a community" lead="For your club, friends or office team. You become the Admin automatically." />
        <EnCreateForm />
      </div>
    </main>
  );
}
