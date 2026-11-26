// Runs public/sw.js against a pretend browser, to check which pages it saves and shows again.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://app.test";
const source = readFileSync("public/sw.js", "utf8");

type Req = { url: string; method: string; mode: string };
type Res = { ok: boolean; redirected: boolean; body: string; clone: () => Res };
const page = (body: string): Res => ({ ok: true, redirected: false, body, clone: () => page(body) });
const nav = (path: string): Req => ({ url: ORIGIN + path, method: "GET", mode: "navigate" });

function start(network: (url: string) => Promise<Res>) {
  const stores = new Map<string, Map<string, Res>>();
  const full = (k: Req | string) => (typeof k === "string" ? new URL(k, ORIGIN).href : k.url);
  const open = async (name: string) => {
    const m = stores.get(name) ?? new Map<string, Res>();
    stores.set(name, m);
    return {
      match: async (k: Req | string) => m.get(full(k)),
      put: async (k: Req | string, v: Res) => { m.set(full(k), v); },
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (k: { url: string }) => m.delete(k.url),
    };
  };
  const caches = { open, keys: async () => [...stores.keys()], delete: async (n: string) => stores.delete(n) };
  const on: Record<string, (e: unknown) => void> = {};
  const self = { location: { origin: ORIGIN }, clients: { claim: async () => {} }, addEventListener: (t: string, f: (e: unknown) => void) => { on[t] = f; } };
  runInNewContext(source, { self, caches, URL, Request: class {}, Response: class {}, setTimeout, clearTimeout, fetch: (r: Req) => network(r.url) });
  return {
    stores,
    open,
    visit(path: string) {
      let out!: Promise<Res>;
      on.fetch({ request: nav(path), respondWith: (p: Promise<Res>) => { out = p; } });
      return out;
    },
    async activate() {
      let done!: Promise<unknown>;
      on.activate({ waitUntil: (p: Promise<unknown>) => { done = p; } });
      await done;
    },
  };
}

afterEach(() => { vi.useRealTimers(); });

describe("service worker: sign-in pages", () => {
  for (const path of ["/", "/?source=pwa", "/?rf=1", "/join/KH-7Q4M"]) {
    it(`never saves ${path}`, async () => {
      const sw = start(async () => page("sign in"));
      await sw.visit(path);
      expect(sw.stores.get("ik-pages-v1")?.size ?? 0).toBe(0);
    });
  }

  it("waits for a slow server on / instead of showing a saved copy after 3 seconds", async () => {
    vi.useFakeTimers();
    const sw = start(() => new Promise((r) => setTimeout(() => r(page("home")), 8000)));
    await (await sw.open("ik-pages-v1")).put("/?source=pwa", page("old sign in"));
    const answer = sw.visit("/?source=pwa");
    await vi.advanceTimersByTimeAsync(8000);
    expect((await answer).body).toBe("home");
  });

  it("with no internet shows the offline page, not an old sign-in page", async () => {
    const sw = start(async () => { throw new Error("offline"); });
    await (await sw.open("ik-static-v1")).put("/offline", page("offline"));
    await (await sw.open("ik-pages-v1")).put("/?source=pwa", page("old sign in"));
    expect((await sw.visit("/?source=pwa")).body).toBe("offline");
  });

  it("a new version deletes old sign-in copies and keeps other saved pages", async () => {
    const sw = start(async () => page("x"));
    const pages = await sw.open("ik-pages-v1");
    for (const p of ["/", "/?source=pwa", "/?rf=1", "/join/KH-7Q4M", "/c/abc/matches"]) await pages.put(p, page(p));
    await sw.activate();
    expect((await pages.keys()).map((k) => k.url)).toEqual([`${ORIGIN}/c/abc/matches`]);
  });

  it("other pages still open from the saved copy with no internet", async () => {
    const sw = start(async () => { throw new Error("offline"); });
    await (await sw.open("ik-pages-v1")).put("/c/abc/matches", page("saved matches"));
    expect((await sw.visit("/c/abc/matches")).body).toBe("saved matches");
  });
});
