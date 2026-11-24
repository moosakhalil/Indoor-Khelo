"use client";

import { useEffect, useState } from "react";
import { EnSplash } from "@/components/EnParts";

/** The Open button of a community on /switch. A plain link to /switch/[id] (the server stores the choice in a cookie
 *  and redirects). While the next page loads, a loading screen with the logo and the community's name covers the page,
 *  so the person does not stare at a blank dark page on a slow connection. The link stretches over the whole card. */
export default function EnOpenLink({ id, name, label, primary, pending }: { id: string; name: string; label: string; primary?: boolean; pending?: boolean }) {
  const [opening, setOpening] = useState(false);

  // Coming back with the browser's back button can restore this page as it was: do not keep the cover on.
  useEffect(() => {
    const show = (e: PageTransitionEvent) => { if (e.persisted) setOpening(false); };
    window.addEventListener("pageshow", show);
    return () => window.removeEventListener("pageshow", show);
  }, []);

  return (
    <>
      <a
        href={`/switch/${id}`}
        className={`btn small en-open${primary ? " gold" : ""}`}
        aria-label={`${label} ${name}`}
        onClick={() => setOpening(true)}
      >
        {label}
      </a>
      {opening && <EnSplash overlay title={pending ? `Checking ${name}` : `Opening ${name}`} sub={pending ? "Looking at your request…" : "Checking your communities…"} />}
    </>
  );
}
