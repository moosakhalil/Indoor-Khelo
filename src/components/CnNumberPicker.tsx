"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { chooseNumberAction, type FormState } from "@/app/actions";
import CnIc from "@/components/CnIcons";
import Shirt from "@/components/Shirt";
import { ALL_NUMBERS, NEARLY_FULL_AT, freeNumbers, listNumbers, matchesJump, nearestFree } from "@/lib/cn";
import "./cn.css";

const initial: FormState = {};

/**
 * The number board. Same rules and the same server action (`chooseNumberAction`) as before: 1 to 99, first come first served,
 * locked while you are in a live match. New: a legend, TAKEN and YOU labels, jump to a number, a Free only filter, a
 * "nearly full" note, a big confirm panel, the lock said before the tap, and a board that updates after "just taken".
 */
export default function CnNumberPicker({
  communityId, taken, mine, isNew, liveMatch, keepHref,
}: {
  communityId: string;
  /** Every number in use in the community (it may include the person's own). */
  taken: number[];
  mine: number | null;
  isNew: boolean;
  /** The live or paused match that locks this person's number, if any. */
  liveMatch?: { title: string } | null;
  /** Where "Keep number N" goes (the profile) when changing. */
  keepHref?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(chooseNumberAction, initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [extraTaken, setExtraTaken] = useState<number[]>([]);
  const [suggest, setSuggest] = useState<number[]>([]);
  const [errVisible, setErrVisible] = useState(false);
  const submitted = useRef<number | null>(null);

  const takenSet = new Set([...taken, ...extraTaken].filter((n) => n !== mine));
  const free = freeNumbers(takenSet).filter((n) => n !== mine);
  const nearlyFull = free.length <= NEARLY_FULL_AT;
  const [freeOnlyChoice, setFreeOnly] = useState<boolean | null>(null);
  const freeOnly = freeOnlyChoice ?? nearlyFull;
  const freeCount = ALL_NUMBERS.length - takenSet.size;
  const changing = mine !== null;
  const locked = !!liveMatch;

  // A new answer from the server. "Just taken": mark that number as taken at once, clear the choice, offer the closest
  // free numbers, then reload the real list from the server.
  const seen = useRef<FormState | null>(null);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (!state.error) return;
    setErrVisible(true);
    if (!/was just taken/i.test(state.error)) return;
    const n = submitted.current;
    if (n === null) return;
    const next = new Set([...taken, ...extraTaken, n].filter((x) => x !== mine));
    setExtraTaken((e) => (e.includes(n) ? e : [...e, n]));
    setPicked(null);
    setSuggest(nearestFree(n, next, 3, mine));
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const shown = ALL_NUMBERS.filter((n) => matchesJump(n, typed) && (!freeOnly || !takenSet.has(n)));
  const exact = /^\d+$/.test(typed.trim()) ? Number(typed.trim()) : null;

  function pick(n: number) {
    if (takenSet.has(n)) return;
    setPicked(n);
    setSuggest([]);
    setErrVisible(false);
  }

  const confirmLabel = locked ? "Locked until your match ends"
    : pending ? "Saving…"
    : picked === null ? "Choose a number"
    : `Confirm number ${picked}`;

  return (
    <form action={action} className="cn-pick" onSubmit={() => { submitted.current = picked; }}>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="isNew" value={isNew ? "1" : "0"} />
      <input type="hidden" name="number" value={picked ?? ""} />

      <div className="cn-board">
        {nearlyFull && (
          <div className="cn-note gold" role="status">
            <CnIc name="info" />
            <div>
              <b>{free.length === 0 ? "No numbers are left" : free.length === 1 ? "Only 1 number left" : `Only ${free.length} numbers left`}</b>
              {free.length > 0 && <span>{listNumbers(free)} {free.length === 1 ? "is" : "are"} free.</span>}
            </div>
          </div>
        )}

        <div className="cn-boardcard">
          <div className="cn-tools">
            <label className="cn-jump">
              <CnIc name="search" />
              <span className="cn-sr">Jump to a number</span>
              <input
                type="search"
                inputMode="numeric"
                placeholder="Jump to a number"
                value={typed}
                maxLength={2}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault(); // Enter must not send the form from the search box
                  if (exact !== null && ALL_NUMBERS.includes(exact)) pick(exact);
                }}
              />
            </label>
            <button type="button" className={`cn-chip${freeOnly ? " on" : ""}`} aria-pressed={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>
              {freeOnly && <CnIc name="check" />}Free only ({freeCount})
            </button>
          </div>

          <ul className="cn-legend" aria-label="Legend">
            <li><i className="sw free" aria-hidden="true" />Free</li>
            <li><i className="sw taken" aria-hidden="true" />Taken</li>
            <li><i className="sw you" aria-hidden="true" />Yours</li>
            <li><i className="sw sel" aria-hidden="true" />Selected</li>
          </ul>

          {shown.length === 0 ? (
            <p className="cn-none" role="status">
              {exact !== null && (exact < 1 || exact > 99) ? "Numbers go from 1 to 99." : freeOnly ? "No free number matches. Switch off Free only to see all numbers." : "No number matches."}
            </p>
          ) : (
            <div className="cn-grid" role="group" aria-label="Player numbers 1 to 99">
              {shown.map((n) => {
                const isTaken = takenSet.has(n);
                const isMine = n === mine;
                const isSel = picked === n;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`cn-num${isTaken ? " taken" : ""}${isMine ? " mine" : ""}${isSel ? " sel" : ""}`}
                    disabled={isTaken}
                    aria-pressed={isSel}
                    aria-label={isTaken ? `${n}, already taken` : isMine ? `${n}, your current number` : `${n}`}
                    onClick={() => pick(n)}
                  >
                    <span className="cn-n">{n}</span>
                    {isTaken && <small>TAKEN</small>}
                    {isMine && !isSel && <small>YOU</small>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="cn-confirm" aria-label="Your number">
        <div className="cn-pv">
          <Shirt number={picked ?? mine} />
          <div className="cn-pvt">
            <b>{picked !== null ? `Number ${picked}` : mine !== null ? `Number ${mine}` : "No number yet"}</b>
            <small>{picked !== null ? "This number is free" : mine !== null ? "Your current number. Tap a free number to change it." : "Tap a free number"}</small>
          </div>
        </div>

        {locked && (
          <div className="cn-note lock" role="status">
            <CnIc name="lock" />
            <div>
              <span>You are in a match that is being played, so your number is locked until it ends.</span>
              <em><i className="cn-live" aria-hidden="true">LIVE</i>{liveMatch!.title}</em>
            </div>
          </div>
        )}

        {state.error && errVisible && (
          <div className="cn-note red" role="alert">
            <CnIc name="warn" />
            <div>
              <span>{state.error}</span>
              {suggest.length > 0 && (
                <div className="cn-sugg">
                  <small>Closest free numbers</small>
                  <div>
                    {suggest.map((n) => (
                      <button key={n} type="button" className="cn-pill" onClick={() => pick(n)}>{n}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button className="btn gold cn-save" disabled={pending || picked === null || locked}>
          {pending && <span className="cn-spin" aria-hidden="true" />}{confirmLabel}
        </button>
        {changing && keepHref && <Link href={keepHref} className="btn ghost">Keep number {mine}</Link>}
      </aside>
    </form>
  );
}
