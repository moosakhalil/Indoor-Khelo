// Phase G2 (UI redesign): small pure helpers for the number picker, player numbers, leave and delete screens.
// No database here, so they are easy to test.
import { PLAYER_NUMBER_MAX, PLAYER_NUMBER_MIN } from "@/lib/validation";

export const ALL_NUMBERS: number[] = Array.from({ length: PLAYER_NUMBER_MAX - PLAYER_NUMBER_MIN + 1 }, (_, i) => i + PLAYER_NUMBER_MIN);

/** The community counts as "nearly full" when this many numbers (or fewer) are still free. */
export const NEARLY_FULL_AT = 10;

/** Free numbers for the person: everything that is not taken by someone else (their own number counts as free for them). */
export function freeNumbers(takenByOthers: ReadonlySet<number>): number[] {
  return ALL_NUMBERS.filter((n) => !takenByOthers.has(n));
}

/** The closest free numbers to `n` (smaller one first on a tie), never `n` itself and never `skip`. */
export function nearestFree(n: number, takenByOthers: ReadonlySet<number>, count = 3, skip: number | null = null): number[] {
  return freeNumbers(takenByOthers)
    .filter((x) => x !== n && x !== skip)
    .sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b)
    .slice(0, count)
    .sort((a, b) => a - b);
}

/** Digits typed in "Jump to a number": a number shows when its digits contain what was typed. Empty means all. */
export function matchesJump(n: number, typed: string): boolean {
  const t = typed.trim();
  if (!t) return true;
  return String(n).includes(t);
}

/** "12, 15 and 17" style list for a sentence. */
export function listNumbers(nums: number[]): string {
  return nums.join(", ");
}

/** Short name of a community for button labels: "Karachi Indoor Cricket Club" becomes "KICC"; one word stays as it is. */
export function communityAbbr(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return name.trim();
  return words.slice(0, 4).map((w) => w[0]!.toUpperCase()).join("");
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The server's own rule for the delete name check (case and extra spaces ignored). */
export function sameName(typed: string, expected: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(expected).length > 0 && norm(typed) === norm(expected);
}

/** Search on the player numbers list: by name (any part) or by the exact number. */
export function matchesPerson(name: string, number: number | null, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (/^\d+$/.test(t)) return number !== null && String(number) === t;
  return name.toLowerCase().includes(t);
}

/** Search on the successor list: name or number (contains). */
export function matchesSuccessor(name: string, number: number | null, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return name.toLowerCase().includes(t) || (number !== null && String(number).includes(t));
}

export type NumberMember = { user_id: string; name: string; player_number: number | null };

/** People without a number first (as the real page does today), then by number, then by name. */
export function sortByNumber<T extends { name: string; player_number: number | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.player_number === null && b.player_number !== null) return -1;
    if (b.player_number === null && a.player_number !== null) return 1;
    return (a.player_number ?? 0) - (b.player_number ?? 0) || a.name.localeCompare(b.name);
  });
}
