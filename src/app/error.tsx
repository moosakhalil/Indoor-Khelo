"use client";

// Shown when a page could not be built, for example when the sign-in service or the database did not answer.
// It never signs anyone out: "Try again" asks the server for the same page once more.
import AcIcon from "@/components/AcIcons";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="app" style={{ maxWidth: 480, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 64 }}>
      <span aria-hidden="true" style={{ color: "#ffb547" }}><AcIcon name="wifioff" size={52} /></span>
      <h1>Couldn&rsquo;t connect</h1>
      <p className="muted" role="alert">This page did not load. Check your internet and try again. This does not sign you out.</p>
      <button type="button" className="btn gold" onClick={() => retry()}>Try again</button>
    </main>
  );
}
