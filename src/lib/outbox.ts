"use client";
// Phase 5: the scorer's phone keeps every ball on the device first (IndexedDB) and sends them to the server in order.
// Nothing is dropped: a ball leaves this store only after the server has confirmed it (or the scorer chooses to discard a refused one).
import type { ScoreEvent } from "@/lib/engine/types";

const DB_NAME = "indoor-khelo";
const DB_VERSION = 2;

export type OutboxItem = { id: string; communityId: string; matchId: string; seq: number; event: ScoreEvent; status: "pending" | "rejected" | "blocked"; reason: string | null };
export type CachedMatch = { matchId: string; events: ScoreEvent[]; savedAt: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no_indexeddb"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) {
        const s = db.createObjectStore("outbox", { keyPath: "id" });
        s.createIndex("matchId", "matchId");
      }
      if (!db.objectStoreNames.contains("matches")) db.createObjectStore("matches", { keyPath: "matchId" });
      if (!db.objectStoreNames.contains("payments")) {
        const p = db.createObjectStore("payments", { keyPath: "id" });
        p.createIndex("bookingId", "bookingId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(req ? (req.result as T) : undefined); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  }));
}

/** Waiting events of one match, in order. */
export async function readOutbox(matchId: string): Promise<OutboxItem[]> {
  try {
    const all = (await run<OutboxItem[]>("outbox", "readonly", (s) => s.index("matchId").getAll(matchId))) ?? [];
    return all.sort((a, b) => a.seq - b.seq);
  } catch { return []; }
}

export async function putOutbox(item: OutboxItem): Promise<boolean> {
  try { await run("outbox", "readwrite", (s) => s.put(item)); return true; } catch { return false; }
}

export async function removeOutbox(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try { await run("outbox", "readwrite", (s) => { for (const id of ids) s.delete(id); }); } catch { /* ignore */ }
}

export async function saveMatchCache(matchId: string, events: ScoreEvent[]): Promise<void> {
  try { await run("matches", "readwrite", (s) => s.put({ matchId, events, savedAt: Date.now() } satisfies CachedMatch)); } catch { /* ignore */ }
}

export async function readMatchCache(matchId: string): Promise<CachedMatch | null> {
  try { return ((await run<CachedMatch>("matches", "readonly", (s) => s.get(matchId))) as CachedMatch | undefined) ?? null; } catch { return null; }
}

/** All matches that still have unsent events (used to flush when the app opens anywhere). */
export async function matchesWithWaiting(): Promise<{ communityId: string; matchId: string }[]> {
  try {
    const all = (await run<OutboxItem[]>("outbox", "readonly", (s) => s.getAll())) ?? [];
    const seen = new Map<string, { communityId: string; matchId: string }>();
    for (const i of all) if (i.status === "pending" && i.communityId) seen.set(i.matchId, { communityId: i.communityId, matchId: i.matchId });
    return Array.from(seen.values());
  } catch { return []; }
}

/* ---------- payments recorded with no signal ---------- */
export type QueuedPayment = {
  id: string; communityId: string; bookingId: string; createdAt: number; status: "waiting" | "refused"; reason: string | null;
  payment: Record<string, string>;   // exactly what was typed (payer, amount, date, method, reference, kind)
};

export async function queuePayment(item: QueuedPayment): Promise<boolean> {
  try { await run("payments", "readwrite", (s) => s.put(item)); return true; } catch { return false; }
}
export async function readQueuedPayments(bookingId?: string): Promise<QueuedPayment[]> {
  try {
    const all = bookingId
      ? ((await run<QueuedPayment[]>("payments", "readonly", (s) => s.index("bookingId").getAll(bookingId))) ?? [])
      : ((await run<QueuedPayment[]>("payments", "readonly", (s) => s.getAll())) ?? []);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch { return []; }
}
export async function removeQueuedPayment(id: string): Promise<void> {
  try { await run("payments", "readwrite", (s) => { s.delete(id); }); } catch { /* ignore */ }
}

export type PaymentSend = { kind: "sent" | "duplicate" } | { kind: "offline" } | { kind: "signin" } | { kind: "refused"; message: string };

/** One payment record to the server. The id was made on the phone, so sending it twice is harmless. */
export async function sendPayment(item: QueuedPayment): Promise<PaymentSend> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { kind: "offline" };
  let res: Response;
  try {
    res = await fetch(`/api/bookings/${item.bookingId}/payments`, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
      body: JSON.stringify({ communityId: item.communityId, payment: { ...item.payment, id: item.id } }),
    });
  } catch { return { kind: "offline" }; }
  if (res.redirected || res.status === 401 || !(res.headers.get("content-type") ?? "").includes("json")) return { kind: "signin" };
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; duplicate?: boolean; message?: string };
  if (res.ok && body.ok) return { kind: body.duplicate ? "duplicate" : "sent" };
  if (res.status >= 500) return { kind: "offline" };          // the server is having a problem: keep it and try again later
  return { kind: "refused", message: body.message ?? "The server did not accept this payment record." };
}

let sendingPayments = false;
/** Send every waiting payment record. Records the server refuses stay on the phone, marked, never thrown away silently. */
export async function flushPayments(): Promise<{ sent: number; left: number }> {
  if (sendingPayments) return { sent: 0, left: -1 };
  sendingPayments = true;
  let sent = 0;
  try {
    const items = (await readQueuedPayments()).filter((i) => i.status === "waiting");
    for (const item of items) {
      const r = await sendPayment(item);
      if (r.kind === "sent" || r.kind === "duplicate") { await removeQueuedPayment(item.id); sent++; }
      else if (r.kind === "refused") await queuePayment({ ...item, status: "refused", reason: r.message });
      else break;   // offline or signed out: stop and try again later
    }
    return { sent, left: (await readQueuedPayments()).filter((i) => i.status === "waiting").length };
  } finally { sendingPayments = false; }
}

/** Send whatever is waiting (balls and payment records), wherever in the app the person is. Used when the app opens and when the signal returns. */
export async function flushAllWaiting(): Promise<void> {
  for (const w of await matchesWithWaiting()) await flushMatch(w.communityId, w.matchId);
  await flushPayments();
}

/** One id per phone, so the server can tell two devices apart. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem("ik_device");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("ik_device", id); }
    return id;
  } catch { return "no-storage"; }
}

/** Ask the browser not to clear our storage, and say if the phone is nearly full. */
export async function protectStorage(): Promise<{ persisted: boolean; low: boolean }> {
  let persisted = false;
  let low = false;
  try {
    if (navigator.storage?.persist) persisted = await navigator.storage.persist();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      if (e.quota && e.usage !== undefined && e.quota - e.usage < 50 * 1024 * 1024) low = true;
    }
  } catch { /* not available */ }
  return { persisted, low };
}

/** Sends everything waiting for a match, in order. Returns what happened so the screen can say it in words. */
export type FlushResult =
  | { kind: "empty" }
  | { kind: "busy" }
  | { kind: "offline" }
  | { kind: "signin" }
  | { kind: "error"; message: string }
  | { kind: "done"; accepted: string[]; duplicates: string[]; saved: ScoreEvent[]; lockLost: boolean; rejected: { id: string | null; reason: string; code: string }[]; held: { id: string; status: "rejected" | "blocked"; reason: string }[] };

let flushing = false;

export async function flushMatch(communityId: string, matchId: string): Promise<FlushResult> {
  if (flushing) return { kind: "busy" };   // another send is running (this screen or another); the caller tries again shortly
  flushing = true;
  try {
    const waiting = (await readOutbox(matchId)).filter((i) => i.status === "pending");
    if (!waiting.length) return { kind: "empty" };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { kind: "offline" };
    let res: Response;
    try {
      res = await fetch(`/api/matches/${matchId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ communityId, deviceId: deviceId(), events: waiting.map((i) => i.event) }),
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch { return { kind: "offline" }; }
    // A redirect to the sign-in page, or a 401, means the session ran out. The balls stay on the phone.
    if (res.redirected || res.status === 401 || !(res.headers.get("content-type") ?? "").includes("json")) return { kind: "signin" };
    if (!res.ok) return { kind: "error", message: res.status === 403 ? "You can no longer score this match." : "The server could not save the balls yet. They are safe on this phone." };
    const body = (await res.json()) as { accepted: string[]; duplicates: string[]; rejected: { id: string | null; reason: string; code: string }[]; lockLost: boolean };
    await removeOutbox([...body.accepted, ...body.duplicates]);
    const bad = new Map(body.rejected.filter((r) => r.id).map((r) => [r.id as string, r]));
    const held: { id: string; status: "rejected" | "blocked"; reason: string }[] = [];
    for (const item of waiting) {
      const r = bad.get(item.id);
      if (r) {
        const status = r.code === "blocked" ? "blocked" : "rejected";
        await putOutbox({ ...item, status, reason: r.reason });
        held.push({ id: item.id, status, reason: r.reason });
      }
    }
    // A refusal that names no event (the event itself was malformed): hold the first one that was not saved, so it is never resent blindly.
    const nameless = body.rejected.find((r) => !r.id);
    if (nameless) {
      const done = new Set([...body.accepted, ...body.duplicates]);
      const first = waiting.find((i) => !done.has(i.id) && !bad.has(i.id));
      if (first) { await putOutbox({ ...first, status: "rejected", reason: nameless.reason }); held.push({ id: first.id, status: "rejected", reason: nameless.reason }); }
    }
    // the events the server now has, taken from what was actually sent (never from screen state, which may be a moment behind)
    const savedIds = new Set([...body.accepted, ...body.duplicates]);
    const saved = waiting.filter((i) => savedIds.has(i.id)).map((i) => i.event);
    return { kind: "done", accepted: body.accepted, duplicates: body.duplicates, saved, lockLost: body.lockLost, rejected: body.rejected, held };
  } finally {
    flushing = false;
  }
}
