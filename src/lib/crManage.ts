// Phase C (UI redesign), Builder C1: which management actions a match allows in each status, and why not.
// It repeats the rules of lib/matches.ts (updateMatch, postponeMatch, cancelMatch, deleteMatch), which still decide on the server.
import { NOT_STARTED, type MatchStatus } from "@/lib/matchRules";

export type ManageKey = "rematch" | "edit" | "postpone" | "cancel" | "delete";
export type ManageItem = { key: ManageKey; label: string; outcome: string; ok: boolean; why: string | null; danger?: boolean };

const notStarted = (s: MatchStatus) => (NOT_STARTED as readonly string[]).includes(s);

export function manageItems(status: MatchStatus): ManageItem[] {
  const started = !notStarted(status) && status !== "cancelled";
  return [
    { key: "rematch", label: "Rematch", outcome: "Same teams, venue, overs, rules and lineups. Pick a new date.", ok: true, why: null },
    {
      key: "edit", label: "Edit match", outcome: "Date, venue, overs, rules, umpire, notes. Teams are fixed.", ok: notStarted(status),
      why: notStarted(status) ? null : "Only a match that has not started can be edited.",
    },
    {
      key: "postpone", label: "Postpone", outcome: "Everyone is told. Schedule it again later by editing it.", ok: status === "scheduled" || status === "draft",
      why: status === "scheduled" || status === "draft" ? null : status === "postponed" ? "Already postponed. Edit it to choose a new date." : "Only a draft or scheduled match can be postponed.",
    },
    {
      key: "cancel", label: "Cancel match", outcome: "Everyone is told. A cancelled match stays in the list.", ok: notStarted(status), danger: true,
      why: notStarted(status) ? null : status === "cancelled" ? "Already cancelled." : "A match that has started cannot be cancelled. End it from the scoring pad.",
    },
    {
      key: "delete", label: "Delete match", outcome: "Removes the match, its lineups and replies for good.", ok: notStarted(status) || status === "cancelled", danger: true,
      why: notStarted(status) || status === "cancelled" ? null : "Only a match that never started can be deleted. This one carries scores and stats, so it stays.",
    },
  ];
}

/** The exact alert wording the server sends (lib/matches.ts), shown before it is sent. */
export const postponedAlert = (title: string) => `${title} has been postponed.`;
/** "3 players said they were coming" for the cancel box. Empty when nobody had said yes. */
export const comingText = (n: number) => (n > 0 ? `${n} ${n === 1 ? "player" : "players"} said they were coming` : "");
export const cancelledAlert = (title: string) => `${title} has been cancelled.`;
