// Self-destroying service worker cho URL /sw.js CŨ.
// SW thật đã chuyển sang /sw-v2.js (xem vite.config.ts) vì CDN từng cache
// /sw.js 29 ngày. Client cũ nào còn check update ở /sw.js sẽ nhận file này:
// tự gỡ đăng ký + nạp lại trang → thoát hẳn SW/bundle cũ.
// Lưu ý: chỉ có tác dụng sau khi purge cache CDN cho /sw.js.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
