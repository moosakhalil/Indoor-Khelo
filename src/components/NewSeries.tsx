"use client";
// New series: two ways in as tabs, so neither is hidden below a long form. Both stay mounted, so what was typed or ticked in one survives a visit to the other.
import "./sr.css";
import { useState } from "react";
import GroupMatches from "@/components/GroupMatches";
import { SeriesForm } from "@/components/FormsSeries";
import { IconList, IconPlus } from "@/components/SrIcons";
import type { FreeMatch } from "@/lib/seriesView";

type Team = { id: string; name: string };

export default function NewSeries({ communityId, teams, matches, initialTab = "start", groupError }: { communityId: string; teams: Team[]; matches: FreeMatch[]; initialTab?: "start" | "group"; groupError?: string }) {
  const [tab, setTab] = useState<"start" | "group">(initialTab);
  return (
    <div className="sr-new">
      <div className="sr-tabs" role="tablist" aria-label="How to start a series">
        <button type="button" role="tab" id="sr-tab-start" aria-selected={tab === "start"} aria-controls="sr-panel-start" className={tab === "start" ? "on" : undefined} onClick={() => setTab("start")}><IconPlus size={16} />Start a series</button>
        <button type="button" role="tab" id="sr-tab-group" aria-selected={tab === "group"} aria-controls="sr-panel-group" className={tab === "group" ? "on" : undefined} onClick={() => setTab("group")}><IconList size={16} />Group matches I have</button>
      </div>
      <div role="tabpanel" id="sr-panel-start" aria-labelledby="sr-tab-start" hidden={tab !== "start"}><SeriesForm mode="create" communityId={communityId} teams={teams} /></div>
      <div role="tabpanel" id="sr-panel-group" aria-labelledby="sr-tab-group" hidden={tab !== "group"}><GroupMatches communityId={communityId} matches={matches} initialError={groupError} /></div>
    </div>
  );
}
