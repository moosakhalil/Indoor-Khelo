import type { Metadata } from "next";

export const metadata: Metadata = { title: "You are offline" };

// Served by the service worker when a page cannot load. Plain on purpose: it must work with no internet.
export default function OfflinePage() {
  return (
    <main className="app">
      <div className="stack" style={{ paddingTop: 36 }}>
        <div className="center">
          <h1 style={{ fontSize: "1.6rem" }}>You are offline</h1>
          <p className="muted">This page could not load without internet. Your saved data is safe on this phone.</p>
        </div>
        <section className="card">
          <b>Works offline</b>
          <ul style={{ margin: "8px 0 0", paddingLeft: "1.2em", lineHeight: 1.8 }}>
            <li>Scoring a match, and undo</li>
            <li>Squads, scorecards and stats you opened before</li>
            <li>Creating a quick match</li>
            <li>Recording a cash payment</li>
          </ul>
        </section>
        <section className="card">
          <b>Needs internet</b>
          <ul style={{ margin: "8px 0 0", paddingLeft: "1.2em", lineHeight: 1.8 }}>
            <li>Signing in for the first time</li>
            <li>Joining a community</li>
            <li>Seeing live scores from other phones</li>
          </ul>
        </section>
        <a className="btn gold" href="/">Try again</a>
      </div>
    </main>
  );
}
