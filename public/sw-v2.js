// Self-destroying service worker cho URL /sw-v2.js CŨ (bị CDN cache immutable ngay sau deploy #294).
// SW thật đã chuyển sang /sw-v3.js (xem vite.config.ts) vì CDN từng cache
// các URL cũ. Client nào còn check update ở URL này sẽ nhận file này:
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
