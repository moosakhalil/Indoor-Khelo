import type { Metadata } from "next";
import AcIcon from "@/components/AcIcons";
import AcOfflineRetry from "@/components/AcOfflineRetry";

export const metadata: Metadata = { title: "You are offline" };

// Served by the service worker when a page cannot load, so it must work with no internet: inline icons, and the styles for this
// page are written into the page itself (no extra file that might not be saved on the phone). Offline is a normal state, not an error.
const CSS = `
.ac-off { max-width: 480px; }
.ac-off-hero { text-align: center; padding-top: 28px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ac-off-art { width: 112px; height: 112px; border-radius: 32px; background: #141c33; border: 1.5px dashed #5b4a2a; color: #ffb547; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 6px; }
.ac-off-hero h1 { font-size: 1.7rem; font-weight: 800; }
.ac-off-hero p { margin: 0; color: #8a97b5; max-width: 38ch; line-height: 1.5; }
.ac-off-cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin-top: 18px; }
.ac-off-card { background: #141c33; border: 1px solid #1e2a44; border-radius: 18px; padding: 16px; }
.ac-off-card h2 { font-size: 1rem; font-weight: 800; }
.ac-off-card ul { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ac-off-card li { display: flex; align-items: flex-start; gap: 10px; line-height: 1.4; }
.ac-off-card li svg { margin-top: 1px; }
.ac-off-card.ok li svg { color: #4be38a; }
.ac-off-card.net li svg { color: #ffb547; }
.ac-off-retry { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; align-items: stretch; text-align: center; }
.ac-off-auto { margin: 0; color: #8a97b5; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.ac-off-still { margin: 0; min-height: 1.2em; color: #ffd79a; font-size: 0.85rem; font-weight: 600; }
@media (min-width: 640px) {
  .ac-off { max-width: 720px; }
  .ac-off-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ac-off-retry { max-width: 360px; margin-left: auto; margin-right: auto; width: 100%; }
}
`;

export default function OfflinePage() {
  return (
    <main className="app ac-off">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="ac-off-hero">
        <span className="ac-off-art" aria-hidden="true"><AcIcon name="wifioff" size={52} /></span>
        <h1>You are offline</h1>
        <p>This page could not load without internet. Your saved data is safe on this phone.</p>
      </section>
      <div className="ac-off-cols">
        <section className="ac-off-card ok" aria-labelledby="ac-off-ok">
          <h2 id="ac-off-ok">Works offline</h2>
          <ul>
            <li><AcIcon name="check" size={20} /><span>Scoring a match, and undo</span></li>
            <li><AcIcon name="check" size={20} /><span>Squads, scorecards and stats you opened before</span></li>
            <li><AcIcon name="check" size={20} /><span>Creating a quick match</span></li>
            <li><AcIcon name="check" size={20} /><span>Recording a cash payment</span></li>
          </ul>
        </section>
        <section className="ac-off-card net" aria-labelledby="ac-off-net">
          <h2 id="ac-off-net">Needs internet</h2>
          <ul>
            <li><AcIcon name="wifioff" size={20} /><span>Signing in for the first time</span></li>
            <li><AcIcon name="wifioff" size={20} /><span>Joining a community</span></li>
            <li><AcIcon name="wifioff" size={20} /><span>Seeing live scores from other phones</span></li>
          </ul>
        </section>
      </div>
      <AcOfflineRetry />
    </main>
  );
}
