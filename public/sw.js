/* Indoor Khelo service worker. Caching rules (PRD section 23.3):
   - /api/*                     NetworkOnly. API answers are never cached.
   - /_next/static/*            CacheFirst.
   - pages with personal data   NetworkOnly (payments, profile, account, terms). Protects shared or lost phones.
   - pages with a sign-in button NetworkOnly (welcome, invite). A saved copy would look like being signed out.
   - other pages (rosters etc.) NetworkFirst with a 3 second timeout, cached copy as backup.
   - anything that cannot load  falls back to the /offline page.
   - A new version waits until the person taps Refresh (no skipWaiting on install), so scoring is never interrupted. */

const VERSION = "v1";
const STATIC_CACHE = `ik-static-${VERSION}`;
const PAGE_CACHE = `ik-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Fetch the offline page fresh on every new version.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await cache.addAll(PRECACHE.filter((u) => u !== OFFLINE_URL));
    }),
  );
  // Deliberately NOT calling skipWaiting() here. See the SKIP_WAITING message below.
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
  if (type === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGE_CACHE)); // on sign-out
  if (type === "CACHE_PAGES") event.waitUntil(cachePages(event.data.urls)); // keep the "new match with no signal" screens ready
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
      for (const name of await caches.keys()) {
        if (name.startsWith("ik-") && !keep.has(name)) await caches.delete(name);
      }
      // Remove copies that an older version saved and this one never saves. Other saved pages stay.
      const pages = await caches.open(PAGE_CACHE);
      for (const saved of await pages.keys()) {
        if (isNeverSaved(new URL(saved.url).pathname)) await pages.delete(saved);
      }
      await self.clients.claim();
    })(),
  );
});

/* Only the two "no signal" screens may be kept ahead of time. They carry no private data: everything on them comes from the phone's own storage. */
const PREPARED = /^\/c\/[0-9a-f-]{36}\/matches\/quick(\/score)?$/i;
const QUICK_SCORE = /^\/c\/[0-9a-f-]{36}\/matches\/quick\/score$/i;

/* Fetch the page and the scripts and styles it needs, so it opens with no signal even if it was never visited. */
async function cachePages(urls) {
  if (!Array.isArray(urls)) return;
  const pages = await caches.open(PAGE_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  for (const u of urls.slice(0, 4)) {
    try {
      const url = new URL(u, self.location.origin);
      if (url.origin !== self.location.origin || !PREPARED.test(url.pathname)) continue;
      const res = await fetch(url.pathname, { credentials: "same-origin" });
      if (!res.ok || res.redirected) continue;
      await pages.put(new Request(url.pathname), res.clone());
      const html = await res.text();
      const files = Array.from(new Set(html.match(/\/_next\/static\/[A-Za-z0-9_\-./%]+\.(?:js|css)/g) || [])).slice(0, 60);
      for (const f of files) {
        if (await statics.match(f)) continue;
        try { const r = await fetch(f); if (r.ok) await statics.put(f, r); } catch (e) { /* try again next time */ }
      }
    } catch (e) { /* offline or signed out: nothing to prepare now */ }
  }
}

const PRIVATE = [/^\/c\/[^/]+\/payments(\/|$)/, /^\/c\/[^/]+\/profile(\/|$)/, /^\/terms(\/|$)/, /^\/account(\/|$)/, /^\/profile(\/|$)/, /^\/c\/[^/]+\/alerts(\/|$)/];
const SIGN_IN = [/^\/$/, /^\/join(\/|$)/];
const isNeverSaved = (path) => PRIVATE.some((re) => re.test(path)) || SIGN_IN.some((re) => re.test(path));

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function offlineFallback() {
  const cache = await caches.open(STATIC_CACHE);
  return (await cache.match(OFFLINE_URL)) || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) return; // NetworkOnly: let the browser handle it, nothing is stored

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    if (isNeverSaved(url.pathname)) {
      event.respondWith(fetch(req).catch(offlineFallback));
      return;
    }
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        try {
          const res = await withTimeout(fetch(req), 3000);
          // Never keep redirects or error pages. Only real pages.
          if (res.ok && !res.redirected) cache.put(req, res.clone());
          return res;
        } catch {
          // the scoring screen for a match made with no signal has a different ?m= each time: any kept copy works, it reads its own data
          const cached = (await cache.match(req)) || (QUICK_SCORE.test(url.pathname) ? await cache.match(url.pathname, { ignoreSearch: true }) : undefined);
          return cached || offlineFallback();
        }
      })(),
    );
  }
});
