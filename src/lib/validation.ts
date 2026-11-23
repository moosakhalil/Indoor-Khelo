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

function clean(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}
