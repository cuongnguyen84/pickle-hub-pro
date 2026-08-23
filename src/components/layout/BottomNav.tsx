import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Home, Radio, MoreHorizontal, Wrench, Newspaper, Store, type LucideIcon } from "lucide-react";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useLivestreams } from "@/hooks/useSupabaseData";
import { isMorePath } from "./moreItems";
import MoreSheet from "./MoreSheet";

/**
 * Mobile bottom nav, redesigned to match The Line editorial system used
 * across homepage, stats strip, kickers, footer:
 *
 *   - Solid editorial bg (no backdrop blur — content shouldn't see through
 *     to varied photos; calm panel beats glass).
 *   - 28×3px green accent bar at top of active cell — exact primitive from
 *     the homepage stats strip. The signature editorial move.
 *   - Lucide icons at 20px stroke 1.5 — slimmer, refined, identical
 *     weight in both states (no stroke swap on active; too app-y).
 *   - Mono CAPS labels (Geist Mono 9px / 0.14em tracking) matching the
 *     kicker style used in pills, news source tags, etc.
 *   - Color discipline: muted by default, full white when active. Green
 *     only appears as the accent bar — same restraint as the rest of the
 *     site (one accent, never flooded).
 *   - Hairline 1px vertical dividers between cells.
 *
 * Design constraints kept from previous version:
 *   - Mobile only (md:hidden)
 *   - Hide on /admin, /creator, /embed
 *   - Hide when virtual keyboard is open
 *   - iOS / Android Capacitor safe-area padding helpers
 *   - i18n labels unchanged
 *
 * ── 23/08/2026, quyết định của PO sau bản so sánh 5 phương án ───────────────
 * Bốn ô CỐ ĐỊNH: Trang chủ · Chợ · Bảng tin · Thêm. Ô thứ hai đổi mặt.
 *
 * Nút xanh nổi "Social" bị gỡ. Số đo 30 ngày: 16 buổi được tạo nhưng chỉ 6
 * lượt đăng ký (90 ngày trước đó: 42) — bề mặt đang nguội không giữ được vị
 * trí đẹp nhất màn hình. Social lên đầu tấm trượt "Thêm", và con số 6 là mốc
 * để một tháng nữa biết việc gỡ này có làm nó tệ thêm không.
 *
 * Ô thứ hai là Trực tiếp khi có trận đang phát, còn lại là Công cụ. Lý do là
 * hình dạng dữ liệu chứ không phải sở thích: 90 ngày qua chỉ 10 ngày có
 * livestream (buổi gần nhất 08/08), nhưng đúng những ngày đó nó kéo 375 người
 * và 6.346 lượt xem — đông hơn mọi bề mặt khác cộng lại. Một ô cố định phục
 * vụ sai cả hai trạng thái.
 */

interface NavSlot {
  path: string;
  label: string;
  icon: LucideIcon;
  liveBadge?: boolean;
}

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();
  const keyboardHeight = useKeyboardHeight();
  const [moreOpen, setMoreOpen] = useState(false);
  // Live count for the Live tab badge. Must be called BEFORE any early
  // returns or React detects a hook-count mismatch when the component
  // toggles between "render normally" and "return null" (e.g. keyboard
  // opens after the drawer search input autofocuses) and crashes the
  // whole tree — that was the "menu button freezes the page" regression.
  const { data: liveStreams = [], isSuccess } = useLivestreams("live");
  const liveCount = liveStreams.length;

  /**
   * Cái CHỐT chống nhấp nháy.
   *
   * `useLivestreams` là dữ liệu tải bất đồng bộ: lần vẽ đầu tiên luôn là danh
   * sách rỗng. Nếu ô thứ hai đọc thẳng `liveCount` thì nó hiện "Công cụ", rồi
   * đổi thành "Trực tiếp" khi dữ liệu về — nhãn đổi ngay dưới ngón tay, và ai
   * bấm đúng lúc đó sẽ tới nhầm trang.
   *
   * Nên: chưa biết thì là Công cụ, và một khi đã thành Trực tiếp thì GIỮ tới
   * hết phiên — kể cả khi trận kết thúc. Đánh đổi có chủ ý: một ô Trực tiếp
   * dẫn tới trang không còn trận nào là chuyện nhỏ; một ô đổi tên dưới ngón
   * tay đang bấm là lỗi.
   */
  const [liveSlot, setLiveSlot] = useState(false);
  useEffect(() => {
    if (isSuccess && liveCount > 0) setLiveSlot(true);
  }, [isSuccess, liveCount]);

  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/creator") ||
    location.pathname.startsWith("/embed") ||
    location.pathname.startsWith("/tools/quick-tables/referee") || // full-screen live-scoring tool
    // Kênh người bán + quản trị Shop có thanh điều hướng riêng của shell; để
    // thanh 5 mục này hiện nữa là hai thanh chồng nhau ở đáy điện thoại.
    // (/admin/shop đã nằm trong /admin ở trên.)
    location.pathname.startsWith("/seller") ||
    location.pathname.startsWith("/proto/shop/seller") ||
    location.pathname.startsWith("/proto/shop/admin") ||
    /\/tools\/team-match\/match\/[^/]+\/score/.test(location.pathname) // team-match referee scoring
  ) {
    return null;
  }

  if (keyboardHeight > 0) {
    return null;
  }

  const secondSlot: NavSlot = liveSlot
    ? { path: "/live", label: t.nav.live, icon: Radio, liveBadge: true }
    : { path: "/tools", label: t.nav.tools, icon: Wrench };

  const navItems: NavSlot[] = [
    { path: "/", label: t.nav.home, icon: Home },
    secondSlot,
    { path: "/shop", label: t.nav.shop, icon: Store },
    { path: "/feed", label: t.nav.feed, icon: Newspaper },
  ];

  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();

  const getBottomPadding = () => {
    if (isAndroidDevice && isNative) {
      return "max(env(safe-area-inset-bottom, 14px), 14px)";
    }
    if (isIOSDevice) {
      return "env(safe-area-inset-bottom, 0px)";
    }
    return "0px";
  };

  const getNavHeight = () => {
    if (isAndroidDevice && isNative) return "72px";
    if (isIOSDevice) return "68px";
    return "56px";
  };

  const cellStyle = (isActive: boolean, isLast: boolean): React.CSSProperties => ({
    borderRight: isLast ? "none" : "1px solid var(--tl-border, #22252a)",
    color: isActive ? "var(--tl-fg, #f5f3ee)" : "var(--tl-fg-3, #86837d)",
    transition: "color 0.18s ease",
  });

  const CELL_CLASS =
    "relative flex flex-col items-center justify-center flex-1 py-2.5 px-1 focus-visible:outline-none focus-visible:bg-white/[0.04]";

  const LABEL_STYLE: React.CSSProperties = {
    fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginTop: 6,
    whiteSpace: "nowrap",
  };

  /* Active accent bar — 28×3 green, same primitive as stats strip. Sits at top
     of cell, slightly overlapping the hairline border so it reads as a "tab
     marker" rather than a stripe inside the cell. */
  const accent = (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: -1,
        left: "50%",
        transform: "translateX(-50%)",
        width: 28,
        height: 3,
        background: "var(--tl-green, #00b96b)",
      }}
    />
  );

  // Ô "Thêm" sáng khi tấm trượt đang mở HOẶC khi đang đứng ở một trang nằm
  // trong đó — nếu không, /clubs hay /rankings sẽ không ô nào sáng và thanh
  // dưới trông như đang hỏng.
  const moreActive = moreOpen || isMorePath(location.pathname);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden"
        style={{
          paddingBottom: getBottomPadding(),
          background: "var(--tl-bg, #08090a)",
          borderTop: "1px solid var(--tl-border, #22252a)",
        }}
        role="navigation"
        aria-label="Primary mobile navigation"
      >
        <div className="flex items-stretch justify-around" style={{ minHeight: getNavHeight() }}>
          {navItems.map((item) => {
            // Match /<path> AND /vi/<path>. The slot links to the English
            // path; light up when the user is on either language variant
            // of the same surface (Phase 4A shipped /feed + /vi/feed).
            const path = location.pathname;
            const viPath = item.path === "/" ? "/vi" : `/vi${item.path}`;
            const isActive =
              path === item.path ||
              path === viPath ||
              (item.path !== "/" &&
                (path.startsWith(`${item.path}/`) || path.startsWith(`${viPath}/`)));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={CELL_CLASS}
                style={cellStyle(isActive, false)}
              >
                {isActive && accent}
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  {item.liveBadge && (
                    <span
                      aria-hidden="true"
                      className="tl-bn-live-dot"
                      style={{
                        position: "absolute",
                        top: -3,
                        right: -5,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--tl-live, #ff4136)",
                        boxShadow: "0 0 0 2px var(--tl-bg, #08090a)",
                      }}
                    />
                  )}
                </span>
                <span style={LABEL_STYLE}>{item.label}</span>
              </Link>
            );
          })}

          {/* Ô thứ năm là NÚT, không phải liên kết: nó không đi đâu cả, nó mở
              tấm trượt. Dùng <Link> cho một hành động mở lớp phủ là hứa với
              người dùng (và với trình đọc màn hình) một chuyến đi không xảy ra. */}
          <button
            type="button"
            aria-label={t.nav.more}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={CELL_CLASS}
            style={{ ...cellStyle(moreActive, true), background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setMoreOpen(true)}
          >
            {moreActive && accent}
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <MoreHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span style={LABEL_STYLE}>{t.nav.more}</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
};

export default BottomNav;
