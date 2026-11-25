// Who may cancel or delete (decided 2026-11-25, "Option A"): the person who added the record, or an Admin.
// Applies to: cancel and delete a match, delete a team, a series, a venue or a booking, and edit or remove a payment record.
// Everything else stays open to every approved member (creating, editing, postponing, lineups, scoring, recording payments,
// correcting a finished match). Every one of these tables already stores `created_by`, so nothing new is saved.
// The same rule is checked on the server (these functions) and used to hide or switch off the buttons.
import type { PoolClient } from "pg";

/** True for an Admin, or for the person who added the record. A record with no known creator (the person was deleted) is for Admins only. */
export function mayManage(me: { id: string; admin: boolean }, createdBy: string | null | undefined): boolean {
  return me.admin || (!!createdBy && createdBy === me.id);
}

/** Whether this person is an approved Admin of the community (read inside the caller's transaction). */
export async function isAdminMember(c: PoolClient, communityId: string, userId: string): Promise<boolean> {
  const r = await c.query("select 1 from community_member where community_id = $1 and user_id = $2 and role = 'admin' and status = 'approved'", [communityId, userId]);
  return r.rows.length > 0;
}

/** The sentence shown when the rule says no, for example "Only Ali (who added this) or an Admin can delete it." */
export function ownerReason(verb: string, createdByName?: string | null): string {
  return createdByName ? `Only ${createdByName} (who added this) or an Admin can ${verb} it.` : `Only an Admin can ${verb} this, because the person who added it is no longer here.`;
}

/** The short sentence for the pages that only know the code. */
export const NOT_OWNER_TEXT = "Only the person who added this, or an Admin, can do that.";
