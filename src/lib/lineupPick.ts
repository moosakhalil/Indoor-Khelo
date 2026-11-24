// Phase C3: the pure rules of the "Pick lineups" screen. Everything here runs in the browser while the person picks,
// so the limit, the counts and the "Add everyone who is in" tool work before anything is saved.
// The server still checks every rule again (setLineup in lib/matches.ts): nothing here replaces that.

export type PickSide = 0 | 1 | 2;
export type Answer = "in" | "out" | null;

export type PickMember = { id: string; name: string; number: number | null; answer: Answer; role: string | null; saved: PickSide };
export type PickGuest = { id: string; name: string; kind: "guest" | "linked"; userId: string | null; linkedBy: string | null; saved: PickSide };

/** What the person changed and has not saved: form field name ("m_<userId>" or "g_<entryId>") to the side picked. */
export type Draft = Record<string, PickSide>;

export const memberKey = (userId: string) => `m_${userId}`;
export const guestKey = (entryId: string) => `g_${entryId}`;

/** One lineup entry (one match_player row). A guest linked to a member is the same row as that member's. */
export type Row = { keys: string[]; saved: PickSide; countable: boolean };

export function buildRows(members: PickMember[], guests: PickGuest[]): Row[] {
  const known = new Set(members.map((m) => m.id));
  const rows: Row[] = members.map((m) => ({ keys: [memberKey(m.id)], saved: m.saved, countable: true }));
  const byUser = new Map(rows.map((r, i) => [members[i]!.id, r]));
  for (const g of guests) {
    const mate = g.userId && known.has(g.userId) ? byUser.get(g.userId) : undefined;
    if (mate) mate.keys.push(guestKey(g.id)); // same entry: both controls change together, counted once
    else rows.push({ keys: [guestKey(g.id)], saved: g.saved, countable: true });
  }
  return rows;
}

const draftOf = (row: Row, draft: Draft): PickSide | undefined => {
  for (const k of row.keys) if (draft[k] !== undefined) return draft[k];
  return undefined;
};

/** The side this entry has right now on screen (picked, or saved if untouched). */
export function sideOf(row: Row, draft: Draft): PickSide {
  return draftOf(row, draft) ?? row.saved;
}

/** Side of one control (a member row or a guest row) on screen. */
export function sideOfKey(rows: Row[], key: string, draft: Draft): PickSide {
  const row = rows.find((r) => r.keys.includes(key));
  return row ? sideOf(row, draft) : 0;
}

/** People on each side on screen. `fixed` is anyone saved on a side who is not in the list (for example a member who left). */
export function countsOf(rows: Row[], draft: Draft, fixed: [number, number] = [0, 0]): [number, number] {
  const n: [number, number] = [fixed[0], fixed[1]];
  for (const r of rows) {
    const s = sideOf(r, draft);
    if (s === 1) n[0] += 1;
    else if (s === 2) n[1] += 1;
  }
  return n;
}

/** Entries whose side differs from what is saved. */
export function changeCount(rows: Row[], draft: Draft): number {
  let n = 0;
  for (const r of rows) {
    const d = draftOf(r, draft);
    if (d !== undefined && d !== r.saved) n += 1;
  }
  return n;
}

/** Put the entry behind `key` on a side. Going back to the saved side removes the change. */
export function withSide(rows: Row[], draft: Draft, key: string, side: PickSide): Draft {
  const row = rows.find((r) => r.keys.includes(key));
  if (!row) return draft;
  const next = { ...draft };
  for (const k of row.keys) delete next[k];
  if (side !== row.saved) for (const k of row.keys) next[k] = side;
  return next;
}

/** Only the real changes, as the form fields the save action reads. */
export function changesOf(rows: Row[], draft: Draft): Draft {
  const out: Draft = {};
  for (const r of rows) {
    const d = draftOf(r, draft);
    if (d !== undefined && d !== r.saved) for (const k of r.keys) out[k] = d;
  }
  return out;
}

/** First side that is over the limit, if any. */
export function overLimit(counts: [number, number], max: number): 0 | 1 | 2 {
  if (counts[0] > max) return 1;
  if (counts[1] > max) return 2;
  return 0;
}

const byNumber = (a: PickMember, b: PickMember) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name);

/**
 * "Add everyone who is in": members who replied "I'm in" and are on no side yet go to `side` until it is full.
 * Same order and same rule as fillWithIn on the server (player number first).
 */
export function fillWithIn(members: PickMember[], rows: Row[], draft: Draft, side: 1 | 2, max: number, fixed: [number, number] = [0, 0]): { draft: Draft; added: number; skipped: number } {
  const room = Math.max(0, max - countsOf(rows, draft, fixed)[side - 1]!);
  const cands = members.filter((m) => m.answer === "in" && sideOfKey(rows, memberKey(m.id), draft) === 0).sort(byNumber);
  const take = cands.slice(0, room);
  let next = draft;
  for (const m of take) next = withSide(rows, next, memberKey(m.id), side);
  return { draft: next, added: take.length, skipped: cands.length - take.length };
}

export type Filter = "all" | "in" | "none" | "out";
export type GroupId = "in" | "none" | "out";
export const GROUP_TITLE: Record<GroupId, string> = { in: "Said yes", none: "No reply", out: "Can’t make it" };

const groupOf = (m: PickMember): GroupId => (m.answer === "in" ? "in" : m.answer === "out" ? "out" : "none");

export function replyCounts(members: PickMember[]): Record<Filter, number> {
  const c: Record<Filter, number> = { all: members.length, in: 0, none: 0, out: 0 };
  for (const m of members) c[groupOf(m)] += 1;
  return c;
}

/** The members in the order the app already used (In first, then No reply, then Can't make it; by number inside), narrowed by the filter and search. */
export function groupMembers(members: PickMember[], filter: Filter, query: string): { id: GroupId; title: string; items: PickMember[] }[] {
  const q = query.trim().toLowerCase();
  const out: { id: GroupId; title: string; items: PickMember[] }[] = [];
  for (const id of ["in", "none", "out"] as const) {
    if (filter !== "all" && filter !== id) continue;
    const items = members.filter((m) => groupOf(m) === id && (!q || m.name.toLowerCase().includes(q))).sort(byNumber);
    if (items.length) out.push({ id, title: GROUP_TITLE[id], items });
  }
  return out;
}

/** The unique-by-name rule for guests: letters in any case and extra spaces do not make a different name. */
export const sameGuestName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
