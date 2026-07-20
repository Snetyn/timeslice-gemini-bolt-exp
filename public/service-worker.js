const CACHE_NAME = "timeslice-runtime-v3";
const APP_SHELL = "/index.html";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("timeslice-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

const cacheResponse = async (request, response) => {
  if (response?.ok && new URL(request.url).origin === self.location.origin) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheResponse(event.request, response))
        .catch(
          async () =>
            (await caches.match(event.request)) ||
            (await caches.match(APP_SHELL)) ||
            Response.error(),
        ),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      const fresh = fetch(event.request).then((response) =>
        cacheResponse(event.request, response),
      );
      return cached || fresh;
    })(),
  );
});
