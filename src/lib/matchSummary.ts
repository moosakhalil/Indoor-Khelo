// Phase B (UI redesign), Builder 4: what a match card says about the score. Pure functions over the engine's state
// and the saved result, so they can be tested without a database.
import { currentInnings, effectiveTarget, oversText } from "@/lib/engine/engine";
import type { MatchState } from "@/lib/engine/types";

export type CardSummary = { score: string | null; scoreSub: string | null; chase: string | null; result: string | null };
export const NO_SUMMARY: CardSummary = { score: null, scoreSub: null, chase: null, result: null };

/** Live or paused: the score of the innings in play and, in a chase, what is still needed. */
export function liveSummary(m: MatchState): CardSummary {
  const inn = currentInnings(m);
  if (!m.started || !inn) return NO_SUMMARY;
  const bpo = m.rules.ballsPerOver;
  const target = effectiveTarget(inn);
  const ballsLeft = Math.max(0, inn.maxOvers * bpo - inn.legalBalls);
  const chase = target !== null && !inn.ended ? `${m.sides[inn.batting - 1]} need ${Math.max(0, target - inn.runs)} from ${ballsLeft}` : null;
  return { score: `${inn.runs}/${inn.wickets}`, scoreSub: `${oversText(inn.legalBalls, bpo)} ov`, chase, result: null };
}

type SavedScores = { innings: number; batting: number; runs: number; wickets: number; balls: number; superOver: boolean }[] | null;

/** Completed or abandoned: the innings totals in order and the saved result sentence. */
export function pastSummary(scores: SavedScores, resultText: string | null): CardSummary {
  const regular = (scores ?? []).filter((s) => !s.superOver).sort((a, b) => a.innings - b.innings);
  return {
    score: regular.length ? regular.map((s) => `${s.runs}/${s.wickets}`).join(" · ") : null,
    scoreSub: null,
    chase: null,
    result: resultText && resultText.trim() ? resultText.trim() : null,
  };
}
