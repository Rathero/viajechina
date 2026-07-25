/* Service worker mínimo y conservador.

   Qué hace:
   - Arranque rápido y tolerante a cortes: guarda el "shell" (index.html) y los
     assets con hash de Vite.
   - Nunca toca las peticiones a Supabase: los datos del viaje siempre salen de
     la red, así que no se sirven viajes desactualizados desde la caché.

   Ojo: la app necesita conexión para leer y guardar datos. Este SW hace que
   abra rápido, no que funcione sin internet. */

const CACHE = "miviaje-v1";
const SHELL = "/index.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([SHELL, "/"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Solo nuestro propio origen: Supabase y cualquier API quedan intactos.
  if (url.origin !== self.location.origin) return;

  // Navegación: primero la red (para recibir despliegues nuevos), con el
  // shell cacheado como respaldo si no hay conexión.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || Response.error()))
    );
    return;
  }

  // Assets con hash (inmutables) e iconos: primero la caché.
  const cacheable = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
  if (!cacheable) return;

  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
    )
  );
});
