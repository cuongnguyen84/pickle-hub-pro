// Imported BEFORE generated Workbox navigation/fallback registration.
// Strict NetworkOnly semantics for capability/auth URLs. Never read a cached
// private document, even offline or when an old html-shell entry exists.
(function () {
        function privateUrl(input) {
          try {
            var decoded = input;
            for (var depth = 0; depth < 3; depth++) {
              var next = decodeURIComponent(decoded);
              if (next === decoded) break;
              decoded = next;
            }
            if (/%[0-9a-f]{2}/i.test(decoded)) return true;
            var url = new URL(decoded, self.location.href);
            var path = decodeURIComponent(url.pathname).replace(/\/+/g, '/').toLowerCase();
            if (/^\/(?:vi\/)?(?:dang-ky|join|auth|match\/confirm|reset-password|update-password|khoi-phuc-dang-ky)(?:\/|$)/.test(path)) return true;
            if (/(?:access_token|refresh_token|magic_token|authorization|password|otp|session|(?:^|[&#])code)=/i.test(url.hash)) return true;
            for (var pair of url.searchParams) {
              if (/token|secret|code|otp|phone|email|password|session|authorization/i.test(pair[0]) || /(?:(?:dang-ky|match\/confirm)(?:\/|%2f)|(?:access_token|refresh_token|magic_token|code|otp|password)(?:=|%3d))/i.test(pair[1])) return true;
            }
            return false;
          } catch (e) { return true; }
        }

  self.addEventListener('fetch', function (event) {
    if (event.request.mode !== 'navigate' || !privateUrl(event.request.url)) return;
    event.stopImmediatePropagation();
    event.respondWith(fetch(new Request(event.request, { cache: 'no-store', referrerPolicy: 'no-referrer' })).catch(function () {
      return new Response('<!doctype html><meta name="robots" content="noindex,nofollow"><p>Private pages require an online connection. Reconnect and reload.</p>', {
        status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'" }
      });
    }));
  });
  self.addEventListener('activate', function (event) {
    event.waitUntil((async function () {
      for (var name of await caches.keys()) {
        var cache = await caches.open(name);
        for (var request of await cache.keys()) {
          var url = new URL(request.url);
          if (request.method === 'GET' && url.origin === self.location.origin && privateUrl(request.url)) await cache.delete(request);
        }
      }
    })());
  });
})();
