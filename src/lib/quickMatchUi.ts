// Small pure helpers for the "no signal" screens (no browser, no database): how old the saved player list is, and the state of a team meter.
// Used only for what the screen SAYS. The rules themselves stay in quickMatchRules.ts.

export const STALE_DAYS = 7;
const DAY = 86_400_000;

/** Whole days since the player list was saved on this phone (never negative). */
export function rosterAgeDays(savedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - savedAt) / DAY));
}

/** The saved player list is "old" when it is more than a week old. */
export function isStaleRoster(savedAt: number, now: number): boolean {
  return now - savedAt > STALE_DAYS * DAY;
}

export type MeterState = "empty" | "filling" | "full" | "over";

/** One team's meter: green when the side is exactly full, red when over, plain while filling. `max` null means "not a valid number yet". */
export function meterState(n: number, max: number | null): MeterState {
  if (max === null) return n > 0 ? "filling" : "empty";
  if (n > max) return "over";
  if (n === max) return "full";
  return n === 0 ? "empty" : "filling";
}

/** Width of the meter bar, 0 to 100. */
export function meterPercent(n: number, max: number | null): number {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((n / max) * 100)));
}
