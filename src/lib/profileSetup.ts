// "Tell us how you play": the optional profile step shown once, right after a player picks their number for the first time
// (decided 2026-11-25). Everything is optional and can be skipped; nothing here ever blocks joining or lineups.
// Pure rules only. Nothing is stored for "skipped": we ask at the first number choice, and only when the profile is still empty.

type Fields = { playing_role?: string | null; batting_hand?: string | null; batting_position?: string | null; bowling_style?: string | null };

/** True when the person has not set any of the four choices yet. */
export function profileIsEmpty(p: Fields | null | undefined): boolean {
  return !p || !(p.playing_role || p.batting_hand || p.batting_position || p.bowling_style);
}

/** Ask only at the FIRST number choice in a community (not when changing a number), and only if the profile is still empty. */
export function shouldAskProfile(hadNumberBefore: boolean, profile: Fields | null | undefined): boolean {
  return !hadNumberBefore && profileIsEmpty(profile);
}

/** Where the player goes after the number step (or after the profile step): the invite page for a community's creator, otherwise Home. */
export function afterNumberHref(communityId: string, isNew: boolean): string {
  return isNew ? `/c/${communityId}/invite?new=1` : `/c/${communityId}`;
}

/** The page that asks for the profile. `new=1` is kept so a community's creator still ends on the invite page. */
export function profileSetupHref(communityId: string, isNew: boolean): string {
  return `/c/${communityId}/profile/setup${isNew ? "?new=1" : ""}`;
}
