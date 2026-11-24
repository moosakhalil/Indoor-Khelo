"use client";
// Rematch, the right column: the one decision (when), the series choice, and the action. Posts to the SAME server action
// with the SAME fields as the old RematchForm (rematchAction: communityId, matchId, tz, when, makeSeries).
import "./sv.css";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { rematchAction } from "@/app/actions4";
import type { FormState } from "@/app/actions";
import { SvInfo, SvTrophy } from "@/components/C2Icons";
import { SvBanner, SvErr, TzField } from "@/components/SvBits";
import { quickDates, rematchBanner, rematchButton } from "@/lib/c2";

const initial: FormState = {};

export default function RematchPlan({ communityId, matchId, sourceIso, openSeriesName, seriesClosed, canMakeSeries }: {
  communityId: string; matchId: string;
  /** When the first match was played, as an ISO instant (null when it had no date). */
  sourceIso: string | null;
  /** The name of the OPEN series the first match belongs to (the rematch joins it). */
  openSeriesName?: string | null;
  /** The first match belongs to a series that is finished or closed. */
  seriesClosed?: boolean;
  /** The first match is in no series at all, so "Make this a series" can be offered. */
  canMakeSeries?: boolean;
}) {
  const [state, action, pending] = useActionState(rematchAction, initial);
  const [when, setWhen] = useState("");
  const [make, setMake] = useState(false);
  const [dismissed, setDismissed] = useState<FormState | null>(null);
  const [chips, setChips] = useState<ReturnType<typeof quickDates> | null>(null);
  const lastFd = useRef<FormData | null>(null);
  const fe = state.fieldErrors ?? {};
  const whenErr = dismissed === state ? undefined : fe.when;
  const banner = rematchBanner(state.error, !!state.fieldErrors);
  const inSeries = !!openSeriesName;

  // The chips use the clock of this phone (the same zone the form sends), so they are made after the page loads.
  useEffect(() => { setChips(quickDates(sourceIso, new Date())); }, [sourceIso]);

  const setValue = (v: string) => { setWhen(v); setDismissed(state); };
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    lastFd.current = fd;
    startTransition(() => action(fd));
  };
  const retry = () => { if (lastFd.current) startTransition(() => action(lastFd.current!)); };

  return (
    <form className="sv-when" onSubmit={submit} noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="matchId" value={matchId} />
      <TzField />
      <fieldset className="sv-fs" disabled={pending}>
        <h2 className="sv-h">When is the rematch?</h2>
        {banner && <SvBanner banner={banner} planHref={`/c/${communityId}/matches/new`} onRetry={retry} busy={pending} />}

        <label className="sv-fl" htmlFor="rm-when">Date and time of the rematch</label>
        <input id="rm-when" type="datetime-local" name="when" className={`field${whenErr ? " bad" : ""}`} value={when} aria-invalid={!!whenErr} onChange={(e) => setValue(e.target.value)} />
        <SvErr text={whenErr} />
        {chips && (
          <div className="sv-chips">
            {chips.nextWeek && <button type="button" className="sv-qchip" onClick={() => setValue(chips.nextWeek!.value)}>{chips.nextWeek.label}</button>}
            <button type="button" className="sv-qchip" onClick={() => setValue(chips.tomorrow.value)}>{chips.tomorrow.label}</button>
          </div>
        )}

        {inSeries && (
          <p className="sv-seriesbox gold">
            <SvTrophy size={18} />
            <span><b>Part of the series {openSeriesName}</b><span className="sv-sd">The new match joins it. Series table and fixtures update.</span></span>
          </p>
        )}
        {seriesClosed && (
          <p className="sv-seriesbox blue" role="note">
            <SvInfo size={18} />
            <span><b>This match’s series is finished</b><span className="sv-sd">The rematch is a normal match. Start a new series from the Series page.</span></span>
          </p>
        )}
        {canMakeSeries && (
          <label className={`sv-opt${make ? " on" : ""}`}>
            <input type="checkbox" name="makeSeries" checked={make} onChange={(e) => setMake(e.target.checked)} />
            <span><b>Make this a series</b><small>The first match and this rematch become a series between the same two teams. You can keep playing more.</small></span>
          </label>
        )}

        <button className="btn gold sv-create" disabled={pending}>{rematchButton(inSeries, make && !!canMakeSeries, pending)}</button>
        <Link href={`/c/${communityId}/matches/${matchId}`} className="btn ghost sv-cancel" aria-disabled={pending}>Cancel</Link>
      </fieldset>
    </form>
  );
}
