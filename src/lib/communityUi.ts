// Small pure helpers for the Community screen (icons per activity kind, member progress, dates).
import { COMMUNITY_MEMBER_CAP } from "@/lib/validation";

/** The icon for each kind of recent activity (see SHOWN in lib/management.ts). */
export const ACTIVITY_ICONS: Record<string, string> = {
  community_created: "star",
  request_approved: "userplus",
  joined_open: "userplus",
  member_left: "logout",
  member_removed: "logout",
  admin_granted: "shield",
  admin_removed: "shieldoff",
  settings_changed: "cog",
  match_created: "calendar",
  match_postponed: "clock",
  match_cancelled: "x",
  match_corrected: "pencil",
};

export const activityIcon = (action: string) => ACTIVITY_ICONS[action] ?? "bell";

/** "75 places left. Numbers 1 to 99 are unique in a community." */
export function placesText(members: number, cap = COMMUNITY_MEMBER_CAP): string {
  const left = Math.max(0, cap - members);
  return `${left} place${left === 1 ? "" : "s"} left. Numbers 1 to ${cap} are unique in a community.`;
}

export const progressPercent = (members: number, cap = COMMUNITY_MEMBER_CAP) => Math.min(100, Math.round((members / cap) * 100));

/** "22 Nov" in the viewer's time zone. */
export function shortDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(d));
}

/** More than this many members: the list shows "See all". */
export const FIRST_MEMBERS = 5;
