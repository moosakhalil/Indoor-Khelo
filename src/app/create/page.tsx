import type { Metadata } from "next";
import Link from "next/link";
import { CreateCommunityForm } from "@/components/Forms";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create a community" };

export default async function CreatePage() {
  await requireAcceptedUser();
  return (
    <main className="app">
      <header className="topbar">
        <Link href="/choose" className="back" aria-label="Back">‹</Link>
        <h1>Create a community</h1>
      </header>
      <CreateCommunityForm />
    </main>
  );
}
