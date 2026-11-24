import { initials } from "@/lib/validation";

// A team is shown as a rounded square with its initials, never as a shirt (shirts are for players).
// The colour comes from the team name, so no database column and no upload are needed.

export type BadgeSize = "sm" | "md" | "lg";

// Each pair is a background and a text colour that keep contrast of at least 4.5 : 1.
export const TEAM_COLORS: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "#F5C84B", fg: "#0B1020" }, // gold
  { bg: "#2FBF71", fg: "#06210F" }, // green
  { bg: "#5AA9FF", fg: "#06182E" }, // blue
  { bg: "#FFB547", fg: "#1A1205" }, // orange
  { bg: "#F0686C", fg: "#1F0406" }, // red
  { bg: "#A78BFA", fg: "#140B33" }, // violet
  { bg: "#2DD4BF", fg: "#042420" }, // teal
  { bg: "#F472B6", fg: "#2E0A1C" }, // pink
];

/** Same name always gives the same colour (case and spacing do not matter). */
export function teamColor(name: string): { bg: string; fg: string } {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TEAM_COLORS[h % TEAM_COLORS.length]!;
}

export default function TeamBadge({ name, size = "md", label }: { name: string; size?: BadgeSize; label?: string }) {
  const c = teamColor(name);
  return (
    <span
      className={`team-badge ${size}`}
      style={{ background: c.bg, color: c.fg }}
      role="img"
      aria-label={label ?? `Team ${name}`}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}
