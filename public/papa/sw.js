importScripts("./release.js");

const scope = new URL(self.registration.scope);
const { version, assets, html } = self.PAPA_RELEASE;
const cachePrefix = "buongiorno-papa-shell-";
const releaseCache = cachePrefix + version;
const settingsCache = "buongiorno-papa-settings";
const selectionKey = new URL("__versione_scelta__", scope).href;
const indexPath = new URL("index.html", scope).pathname;

async function stageRelease() {
  const requests = assets.map(({ name, integrity }) =>
    new Request(new URL(name, scope), { cache: "reload", redirect: "error", integrity })
  );
  const cache = await caches.open(releaseCache);
  await cache.addAll(requests);
  // Use the exact HTML shipped with this release, even on deploy previews
  // where the host can inject additional markup into the response.
  await cache.put(scope.href, new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  }));
  await cache.put(new URL("release.js", scope).href, new Response(
    `globalThis.PAPA_RELEASE = ${JSON.stringify({ version })};`,
    { headers: { "Content-Type": "text/javascript; charset=utf-8" } }
  ));
  // The new worker can serve the old release. The app controls when to switch.
  await self.skipWaiting();
}

async function selectedRelease() {
  const cache = await caches.open(settingsCache);
  return (await cache.match(selectionKey))?.text();
}

async function selectRelease() {
  const cache = await caches.open(settingsCache);
  await cache.put(selectionKey, new Response(version));
}

async function activate() {
  const selected = await selectedRelease();
  const installed = selected && await caches.has(cachePrefix + selected);
  if (!installed) await selectRelease();
  const obsolete = (await caches.keys()).filter((key) =>
    key.startsWith(cachePrefix) && key !== releaseCache && key !== cachePrefix + selected
  );
  await Promise.all(obsolete.map((key) => caches.delete(key)));
  await self.clients.claim();
}

self.addEventListener("install", (event) => event.waitUntil(stageRelease()));
self.addEventListener("activate", (event) => event.waitUntil(activate()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  const isIndex = request.mode === "navigate" &&
    (url.pathname === scope.pathname || url.pathname === indexPath);
  if (request.mode === "navigate" && !isIndex) return;

  event.respondWith((async () => {
    const selected = await selectedRelease();
    const cache = await caches.open(selected ? cachePrefix + selected : releaseCache);
    return await cache.match(isIndex ? scope.href : request) ?? fetch(request);
  })());
});

self.addEventListener("message", (event) => {
  const reply = event.ports[0];
  if (!reply || !["CHECK_RELEASE", "USE_RELEASE"].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    const { type, wanted } = event.data;
    if (type === "USE_RELEASE" && wanted === version) await selectRelease();
    reply.postMessage({ latest: version, selected: await selectedRelease() });
  })());
});
