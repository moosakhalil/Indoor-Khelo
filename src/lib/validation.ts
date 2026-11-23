// Pure rules shared by forms and server actions. No database or network in here,
// so every rule can be tested on its own.

export const PLAYER_NUMBER_MIN = 1;
export const PLAYER_NUMBER_MAX = 99;
/** Numbers are unique 1-99 inside a community, so a community holds at most 99 members. */
export const COMMUNITY_MEMBER_CAP = 99;

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 300;
export const LOCATION_MAX = 80;
export const PERSON_NAME_MAX = 60;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid mix-ups
const CODE_LENGTH = 4;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Player number: a whole number from 1 to 99. */
export function parsePlayerNumber(input: unknown): Result<number> {
  const raw = typeof input === "string" ? input.trim() : input;
  if (raw === "" || raw === null || raw === undefined) {
    return { ok: false, error: "Choose a player number from 1 to 99." };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n)) {
    return { ok: false, error: "A player number must be a whole number from 1 to 99." };
  }
  if (n < PLAYER_NUMBER_MIN || n > PLAYER_NUMBER_MAX) {
    return { ok: false, error: "A player number must be from 1 to 99." };
  }
  return { ok: true, value: n };
}

export type CommunityInput = {
  name: string;
  description: string;
  location: string;
  approvalRequired: boolean;
};

export type FieldErrors = Partial<Record<"name" | "description" | "location", string>>;

export function validateCommunityInput(raw: {
  name?: unknown;
  description?: unknown;
  location?: unknown;
  approvalRequired?: unknown;
}): { ok: true; value: CommunityInput } | { ok: false; errors: FieldErrors } {
  const name = clean(raw.name);
  const description = clean(raw.description);
  const location = clean(raw.location);
  const errors: FieldErrors = {};
  if (name.length < NAME_MIN) errors.name = `Give your community a name (at least ${NAME_MIN} letters).`;
  else if (name.length > NAME_MAX) errors.name = `The name can be at most ${NAME_MAX} characters.`;
  if (description.length > DESCRIPTION_MAX) errors.description = `The description can be at most ${DESCRIPTION_MAX} characters.`;
  if (location.length > LOCATION_MAX) errors.location = `The location can be at most ${LOCATION_MAX} characters.`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name, description, location, approvalRequired: raw.approvalRequired === true || raw.approvalRequired === "on" || raw.approvalRequired === "true" },
  };
}

export function validatePersonName(input: unknown): Result<string> {
  const name = clean(input);
  if (name.length < 1) return { ok: false, error: "Please enter your name." };
  if (name.length > PERSON_NAME_MAX) return { ok: false, error: `Your name can be at most ${PERSON_NAME_MAX} characters.` };
  return { ok: true, value: name };
}

/** Accepts a code ("KH-7Q4M", "kh7q4m") or a full invite link and returns "KH-XXXX", or null. */
export function normalizeInviteCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  const linkMatch = s.match(/\/join\/([^/?#\s]+)/i);
  if (linkMatch) s = decodeURIComponent(linkMatch[1]);
  s = s.toUpperCase().replace(/[\s_]/g, "");
  const m = s.match(/^KH-?([A-Z0-9]{4,8})$/);
  if (!m) return null;
  return `KH-${m[1]}`;
}

export function generateInviteCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `KH-${out}`;
}

/** Only same-site paths are allowed as a post-sign-in destination (stops open redirects). */
export function safeNextPath(input: unknown, fallback = "/home"): string {
  if (typeof input !== "string") return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  return input;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function clean(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/* ---------- player profile (Phase 3). One profile per person, shown in every community. ---------- */

export const BATTING_HANDS = [
  { value: "right", label: "Right-hand" },
  { value: "left", label: "Left-hand" },
] as const;
export const BATTING_POSITIONS = [
  { value: "opener", label: "Opener" },
  { value: "top_order", label: "Top order" },
  { value: "middle_order", label: "Middle order" },
  { value: "finisher", label: "Finisher" },
] as const;
export const BOWLING_STYLES = [
  { value: "right_fast", label: "Right-arm fast" },
  { value: "right_medium", label: "Right-arm medium" },
  { value: "right_spin", label: "Right-arm spin" },
  { value: "left_fast", label: "Left-arm fast" },
  { value: "left_medium", label: "Left-arm medium" },
  { value: "left_spin", label: "Left-arm spin" },
  { value: "none", label: "Doesn’t bowl" },
] as const;
export const PLAYING_ROLES = [
  { value: "batter", label: "Batter" },
  { value: "bowler", label: "Bowler" },
  { value: "all_rounder", label: "All-rounder" },
  { value: "wicket_keeper", label: "Wicket-keeper" },
] as const;

type Option = { value: string; label: string };
const has = (list: readonly Option[], v: unknown): v is string => typeof v === "string" && list.some((o) => o.value === v);
export const labelOf = (list: readonly Option[], v: string | null | undefined): string | null => list.find((o) => o.value === v)?.label ?? null;

export type ProfileInput = {
  name: string;
  battingHand: string | null;
  battingPosition: string | null;
  bowlingStyle: string | null;
  playingRole: string | null;
};

/** An empty choice means "not set yet". A value that is not on the list is refused. */
export function validateProfileInput(raw: Record<string, unknown>): { ok: true; value: ProfileInput } | { ok: false; error: string } {
  const name = validatePersonName(raw.name);
  if (!name.ok) return { ok: false, error: name.error };
  const pick = (key: string, list: readonly Option[], label: string): { ok: true; v: string | null } | { ok: false; error: string } => {
    const v = raw[key];
    if (v === undefined || v === null || v === "") return { ok: true, v: null };
    if (!has(list, v)) return { ok: false, error: `Please choose a ${label} from the list.` };
    return { ok: true, v };
  };
  const hand = pick("battingHand", BATTING_HANDS, "batting hand");
  if (!hand.ok) return hand;
  const pos = pick("battingPosition", BATTING_POSITIONS, "batting position");
  if (!pos.ok) return pos;
  const bowl = pick("bowlingStyle", BOWLING_STYLES, "bowling style");
  if (!bowl.ok) return bowl;
  const role = pick("playingRole", PLAYING_ROLES, "playing role");
  if (!role.ok) return role;
  return { ok: true, value: { name: name.value, battingHand: hand.v, battingPosition: pos.v, bowlingStyle: bowl.v, playingRole: role.v } };
}

/* ---------- teams ---------- */
export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 40;
export const TEAM_DESCRIPTION_MAX = 200;

export type TeamInput = { name: string; description: string; captainId: string | null; viceCaptainId: string | null };

export function validateTeamInput(raw: { name?: unknown; description?: unknown; captainId?: unknown; viceCaptainId?: unknown }):
  | { ok: true; value: TeamInput }
  | { ok: false; errors: Partial<Record<"name" | "description" | "captain", string>> } {
  const name = clean(raw.name);
  const description = clean(raw.description);
  const errors: Partial<Record<"name" | "description" | "captain", string>> = {};
  if (name.length < TEAM_NAME_MIN) errors.name = `Give the team a name (at least ${TEAM_NAME_MIN} letters).`;
  else if (name.length > TEAM_NAME_MAX) errors.name = `The name can be at most ${TEAM_NAME_MAX} characters.`;
  if (description.length > TEAM_DESCRIPTION_MAX) errors.description = `The description can be at most ${TEAM_DESCRIPTION_MAX} characters.`;
  const captainId = typeof raw.captainId === "string" && raw.captainId ? raw.captainId : null;
  const viceCaptainId = typeof raw.viceCaptainId === "string" && raw.viceCaptainId ? raw.viceCaptainId : null;
  if (captainId && viceCaptainId && captainId === viceCaptainId) errors.captain = "The captain and vice-captain must be two different people.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, description, captainId, viceCaptainId } };
}
