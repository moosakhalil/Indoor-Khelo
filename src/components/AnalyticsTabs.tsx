"use client";
// Player analytics: three tabs on a phone and a tablet (no page reload), every card at once on a wide screen (CSS only: the
// tab bar is hidden and every panel is shown). All panels are drawn by the server and passed in; this only decides which one is visible.
// The chosen tab and chart are written to the address (?tab=&metric=) with replaceState, so a link keeps working like before.
import "./ld.css";
import { useId, useState } from "react";

export type TabKey = "form" | "runs" | "duels";
export type Metric = "runs" | "wickets";

export const ANALYTICS_TABS: readonly (readonly [TabKey, string])[] = [["form", "Form"], ["runs", "Run sources"], ["duels", "Duels"]];

const remember = (tab: TabKey, metric: Metric) => {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("tab", tab);
    u.searchParams.set("metric", metric);
    window.history.replaceState(null, "", u.toString());
  } catch { /* the address is only a convenience */ }
};

export type FormView = { title: string; badge: React.ReactNode; body: React.ReactNode };

export default function AnalyticsTabs({ initialTab, initialMetric, form, runs, duels }: {
  initialTab: TabKey; initialMetric: Metric; form: Record<Metric, FormView>; runs: React.ReactNode; duels: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [metric, setMetric] = useState<Metric>(initialMetric);
  const id = useId();
  const pick = (k: TabKey) => { setTab(k); remember(k, metric); };
  const pickMetric = (m: Metric) => { setMetric(m); remember(tab, m); };
  const f = form[metric];
  return (
    <div className="ld-dash">
      <div className="ld-seg ld-tabbar" role="tablist" aria-label="Analytics sections">
        {ANALYTICS_TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`${id}-t-${k}`} aria-selected={tab === k} aria-controls={`${id}-p-${k}`} tabIndex={tab === k ? 0 : -1} className={tab === k ? "on" : undefined} onClick={() => pick(k)}
            onKeyDown={(e) => {
              const i = ANALYTICS_TABS.findIndex(([x]) => x === k);
              const to = e.key === "ArrowRight" ? ANALYTICS_TABS[(i + 1) % 3] : e.key === "ArrowLeft" ? ANALYTICS_TABS[(i + 2) % 3] : null;
              if (to) { e.preventDefault(); pick(to[0]); document.getElementById(`${id}-t-${to[0]}`)?.focus(); }
            }}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-p-form`} aria-labelledby={`${id}-t-form`} hidden={tab !== "form"} className="ld-panel ld-p-form">
        <section className="card ld-form">
          <div className="row space ld-form-head"><h2>{f.title}</h2>{f.badge}</div>
          <div className="ld-segmini" role="group" aria-label="Chart of">
            <button type="button" className={metric === "runs" ? "on" : undefined} aria-pressed={metric === "runs"} onClick={() => pickMetric("runs")}>Runs</button>
            <button type="button" className={metric === "wickets" ? "on" : undefined} aria-pressed={metric === "wickets"} onClick={() => pickMetric("wickets")}>Wickets</button>
          </div>
          {f.body}
        </section>
      </div>
      <div role="tabpanel" id={`${id}-p-runs`} aria-labelledby={`${id}-t-runs`} hidden={tab !== "runs"} className="ld-panel ld-p-runs">{runs}</div>
      <div role="tabpanel" id={`${id}-p-duels`} aria-labelledby={`${id}-t-duels`} hidden={tab !== "duels"} className="ld-panel ld-p-duels">{duels}</div>
    </div>
  );
}
