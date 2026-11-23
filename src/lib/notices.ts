// Short messages shown after a match action. The address carries only a code, never text.
export type Notice = { tone: "green" | "red" | "mute"; text: string };

export function noticeFor(code: string | undefined, extra: { n?: string; skip?: string; side?: string; max?: string } = {}): Notice | null {
  switch (code) {
    case undefined: case "": return null;
    case "reminded": return { tone: "green", text: `Reminder sent to ${extra.n ?? "the"} people who have not replied.` };
    case "too_soon": return { tone: "mute", text: `A reminder was sent recently. You can send another in about ${extra.n ?? "60"} minutes.` };
    case "nobody": return { tone: "mute", text: "Everyone has replied, so there is nobody to remind." };
    case "postponed": return { tone: "green", text: "Match postponed. Everyone was told." };
    case "cancelled": return { tone: "green", text: "Match cancelled. Everyone was told." };
    case "toss_saved": return { tone: "green", text: "Toss saved." };
    case "lineup_saved": return { tone: "green", text: "Lineups saved." };
    case "linked": return { tone: "green", text: "Guest linked to the member. Those figures now count toward their career." };
    case "unlinked": return { tone: "green", text: "Link undone." };
    case "filled": return { tone: "green", text: `Added ${extra.n ?? 0} player${extra.n === "1" ? "" : "s"} who replied “I’m in”.${Number(extra.skip) > 0 ? ` ${extra.skip} more did not fit: this side is full.` : ""}` };
    case "guest_added": return { tone: "green", text: "Guest added." };
    case "guest_name": return { tone: "red", text: "Type the guest's name (up to 60 characters)." };
    case "duplicate_guest": return { tone: "red", text: "A guest with that name is already in this match. Use a slightly different name." };
    case "too_many": return { tone: "red", text: `${extra.side ?? "That side"} can have at most ${extra.max ?? "?"} players. Raise “players per side” in Edit match first, or take someone out.` };
    case "locked": return { tone: "red", text: "This match has already started, so this can no longer be changed here." };
    case "bad_state": return { tone: "red", text: "That cannot be done in this match's current state." };
    case "not_found": return { tone: "red", text: "That match or entry could not be found." };
    case "forbidden": return { tone: "red", text: "Only members of this community can do that." };
    case "not_a_member": return { tone: "red", text: "That person is not a member of this community." };
    case "already_in_match": return { tone: "red", text: "That member is already in this match, so the guest cannot be linked to them." };
    case "bad_side": return { tone: "red", text: "Choose a side." };
    default: return null;
  }
}
