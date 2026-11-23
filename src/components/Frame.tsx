import Link from "next/link";
import BottomNav from "@/components/BottomNav";

/** A page inside a community: header, content, and the five-tab bottom bar. */
export default function Frame({
  communityId,
  title,
  back,
  right,
  children,
}: {
  communityId: string;
  title: string;
  back?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="app has-nav">
        <header className="topbar">
          {back && <Link href={back} className="back" aria-label="Back">‹</Link>}
          <h1>{title}</h1>
          {right}
        </header>
        {children}
      </main>
      <BottomNav communityId={communityId} />
    </>
  );
}
