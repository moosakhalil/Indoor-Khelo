// Offline quick match: the rules for a match made on a phone with no signal. Pure (no database, no browser), so the phone checks
// exactly what the server checks again when the match is sent.
import { DEFAULT_RULES, GUEST_NAME_MAX, validateGuestName, validateMatchDetails, validateSides, type Rules } from "@/lib/matchRules";

export type QuickPlayer = { id: string; side: 1 | 2; userId: string | null; guestName: string | null };
/** What travels to the server. Every id is made on the phone, so sending it twice is harmless. */
export type QuickMatchWire = {
  id: string;
  sides: [{ id: string; name: string }, { id: string; name: string }];
  overs: number;
  playersPerSide: number;
  players: QuickPlayer[];
};
export type QuickMatchInput = QuickMatchWire & { rules: Rules };

export type RosterMember = { id: string; name: string; number: number | null; role: string | null };
export type RosterTeam = { id: string; name: string; squad: string[] };
/** The community's players, kept on the phone so a match can be set up with no signal. */
export type Roster = { communityId: string; me: string; savedAt: number; members: RosterMember[]; teams: RosterTeam[] };

export const QUICK_MIN_PER_SIDE = 2;
export type Errors = Record<string, string>;
type Result = { ok: true; value: QuickMatchInput } | { ok: false; errors: Errors };

const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d{1,3}$/.test(v.trim()) ? Number(v) : null);

export function validateQuickMatch(raw: unknown, isUuid: (s: string) => boolean): Result {
  const errors: Errors = {};
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!o) return { ok: false, errors: { general: "The match is missing." } };
  const id = typeof o.id === "string" && isUuid(o.id) ? o.id : null;
  if (!id) errors.general = "The match has no valid id.";

  // sides: two different match-only names (2 to 40 characters), each with its own id
  const sidesRaw = Array.isArray(o.sides) && o.sides.length === 2 ? (o.sides as Record<string, unknown>[]) : null;
  const sideIds: string[] = [];
  let names: [string, string] = ["", ""];
  if (!sidesRaw) errors.general = "A match has exactly two sides.";
  else {
    const s = validateSides({ name: sidesRaw[0]?.name }, { name: sidesRaw[1]?.name }, new Map());
    if (!s.ok) Object.assign(errors, s.errors);
    else names = [s.value[0].name, s.value[1].name];
    for (const [i, x] of sidesRaw.entries()) {
      const sid = typeof x?.id === "string" && isUuid(x.id) ? x.id : null;
      if (!sid) errors.general = "A side has no valid id.";
      else sideIds[i] = sid;
    }
    if (sideIds.length === 2 && sideIds[0] === sideIds[1]) errors.general = "The two sides need different ids.";
  }

  // overs, players per side and the default rules: the same rules as the normal match form
  const oversN = int(o.overs), ppN = int(o.playersPerSide);
  const details = validateMatchDetails({ oversPreset: "custom", oversCustom: oversN === null ? "" : String(oversN), playersPerSide: ppN === null ? "x" : String(ppN) }, "UTC", new Date());
  let rules: Rules = DEFAULT_RULES;
  let overs = 0, playersPerSide = 0;
  if (!details.ok) { if (details.errors.overs) errors.overs = details.errors.overs; if (details.errors.playersPerSide) errors.playersPerSide = details.errors.playersPerSide; }
  else { rules = details.value.rules; overs = details.value.overs; playersPerSide = details.value.playersPerSide; }

  // players: members (by account) or guests (by name), each on one side only
  const players: QuickPlayer[] = [];
  if (!Array.isArray(o.players) || o.players.length > 22) errors.players = "The lineups are not valid.";
  else {
    const ids = new Set<string>(id ? [id] : []);
    const members = new Set<string>();
    const guests = new Set<string>();
    for (const x of o.players as Record<string, unknown>[]) {
      const pid = typeof x?.id === "string" && isUuid(x.id) ? x.id : null;
      const side = x?.side === 1 || x?.side === 2 ? x.side : null;
      const userId = typeof x?.userId === "string" && isUuid(x.userId) ? x.userId : null;
      const hasGuest = x?.guestName !== undefined && x?.guestName !== null && x?.guestName !== "";
      if (!pid || !side || ids.has(pid) || sideIds.includes(pid)) { errors.players = "A lineup entry is not valid."; continue; }
      ids.add(pid);
      if (userId && hasGuest) { errors.players = "A lineup entry is either a member or a guest, not both."; continue; }
      if (userId) {
        if (members.has(userId)) { errors.players = "A member can only be in one lineup, once."; continue; }
        members.add(userId);
        players.push({ id: pid, side, userId, guestName: null });
      } else if (hasGuest) {
        const g = validateGuestName(x.guestName);
        if (!g.ok) { errors.players = g.error; continue; }
        if (guests.has(g.value.toLowerCase())) { errors.players = "Two guests cannot have the same name."; continue; }
        guests.add(g.value.toLowerCase());
        players.push({ id: pid, side, userId: null, guestName: g.value });
      } else errors.players = "A lineup entry needs a member or a guest name.";
    }
  }
  if (playersPerSide) {
    for (const s of [1, 2] as const) {
      const n = players.filter((p) => p.side === s).length;
      const label = names[s - 1] || `Team ${s}`;
      if (n > playersPerSide) errors[`players_${s}`] = `${label} can have at most ${playersPerSide} players. Raise “players per side” or take someone out.`;
      else if (n < QUICK_MIN_PER_SIDE) errors[`players_${s}`] = `${label} needs at least ${QUICK_MIN_PER_SIDE} players to start scoring.`;
    }
  }
  if (Object.keys(errors).length || !id) return { ok: false, errors };
  return {
    ok: true,
    value: { id, sides: [{ id: sideIds[0]!, name: names[0] }, { id: sideIds[1]!, name: names[1] }], overs, playersPerSide, players, rules },
  };
}

export { GUEST_NAME_MAX };
