/**
 * Proactive stale-shell detection — the PREVENTIVE layer above the reactive
 * chunk-error recovery (src/lib/chunkError.ts + ChunkErrorBoundary).
 *
 * Cloudflare Pages deletes the previous build's hashed chunks on every deploy.
 * A tab left open across a deploy (an overnight tab, say) still
 * runs the OLD bundle; its next SPA navigation lazy-imports a chunk hash that
 * no longer exists → "Importing a module script failed". Instead of waiting
 * for that crash, we compare our baked-in __BUILD_ID__ against /build-id.txt
 * (emitted by the build, never precached) and, once a mismatch is seen:
 *
 *  - tab goes hidden        → reload invisibly, user never notices
 *  - next SPA navigation    → reload at the new URL (full page load gets the
 *                             fresh shell BEFORE any stale chunk is requested)
 *
 * Checks run when the tab becomes visible again and every 10 minutes.
 * Fail-open everywhere: offline, 404, or fetch errors mean "not stale".
 */

const CHECK_MIN_INTERVAL_MS = 60_000;
const PERIODIC_CHECK_MS = 10 * 60_000;
// Nếu CDN edge còn serve build-id.txt cũ sau khi client đã reload sang shell
// mới, id vẫn lệch → không được reload nữa kẻo loop. 5 phút là quá đủ cho
// edge propagate.
const RELOAD_COOLDOWN_MS = 5 * 60_000;
const RELOAD_TS_KEY = "stale-shell-reload-ts";

/**
 * Server báo build mới? Body phải là token base36 ngắn — body HTML/rỗng nghĩa
 * là routing sai (SPA fallback, error page), KHÔNG phải deploy mới.
 */
export const isNewerBuild = (body: string, clientId: string): boolean => {
  const serverId = body.trim();
  return /^[a-z0-9]{1,16}$/.test(serverId) && serverId !== clientId;
};

export function installStaleShellGuard(
  reload: () => void = () => window.location.reload(),
): void {
  const clientId = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
  let stale = false;
  let lastCheckAt = 0;

  const check = async (): Promise<void> => {
    const now = Date.now();
    if (stale || now - lastCheckAt < CHECK_MIN_INTERVAL_MS) return;
    lastCheckAt = now;
    try {
      const res = await fetch(`/build-id.txt?t=${now}`, { cache: "no-store" });
      if (!res.ok) return;
      if (isNewerBuild(await res.text(), clientId)) {
        stale = true;
      }
    } catch {
      // offline / blocked — fail open
    }
  };

  const guardedReload = (): void => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || "0");
      if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
      sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
    } catch {
      // Storage chặn → không dám auto-reload (không có gì chống loop).
      return;
    }
    reload();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
    else if (stale) guardedReload();
  });
  setInterval(() => void check(), PERIODIC_CHECK_MS);

  // Biến SPA navigation kế tiếp thành full page load: patch pushState (mọi
  // Link/navigate của react-router đi qua đây) — URL đã được cập nhật trước
  // khi reload nên user đáp đúng trang mới với shell mới. popstate cover
  // nút back/forward. replaceState cố tình BỎ QUA — nó dùng cho query-param
  // tweaks (filter, tab), reload ở đó phá form state.
  const origPushState = history.pushState.bind(history);
  history.pushState = (...args: Parameters<History["pushState"]>) => {
    origPushState(...args);
    if (stale) guardedReload();
  };
  window.addEventListener("popstate", () => {
    if (stale) guardedReload();
  });
}
