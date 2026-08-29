import { ReactNode, useEffect, useState, useCallback, useRef, useMemo, FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/lib/auth-config";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useMyApplication, useMyShop } from "@/hooks/shop/useSellerApplication";
import { UnifiedNotificationBell } from "@/components/social/notifications";
import { ConnectDuprBanner } from "@/components/dupr/ConnectDuprBanner";
import { HeaderDuprBadge } from "@/components/dupr/HeaderDuprBadge";
import { supabase } from "@/integrations/supabase/client";
import { NAV_ITEMS, type Active } from "./navItems";
import "@/styles/the-line.css";

export interface TheLineLayoutProps {
  title: string;
  description?: string;
  /** Optional — production homepage is indexed; pass true for noindex routes. */
  noindex?: boolean;
  active?: Active;
  children: ReactNode;
}

const STORAGE_KEY = "tl-theme-mode";

/* ---------------------------------------------------------------------------
 * The Line layout — production chrome for / and /vi.
 *
 * Promoted from the preview shell during the 2026-04-25 cutover; the
 * retired /preview/the-line/* source pages were deleted (CLOSE-01).
 *
 * - Pins data-theme="the-line" on <html> while mounted (cleans up on unmount)
 * - Restores previous data-mode (light/dark) preference from localStorage
 * - Mobile drawer with search, nav, mode toggle, language toggle, auth
 * - Children render INSIDE the chrome
 * ------------------------------------------------------------------------- */

/**
 * Prefix path with /vi when active language is Vietnamese so primary nav
 * keeps users in their language tree. Mirrors the pattern used in the
 * footer (line ~492). All listed routes have /vi/* equivalents in App.tsx
 * routing — verified 2026-04-29.
 */
const localizedPath = (path: string, language: "vi" | "en"): string =>
  language === "vi" ? `/vi${path}` : path;

/**
 * UX-08 — deep-link back fallback. A fresh tab landing directly on a
 * detail page (history.length <= 1) has nothing to pop, so the back
 * affordance becomes a Link to the section's root listing derived from
 * the pathname. Unknown sections fall back to home in the right locale.
 */
const SECTION_ROOTS: Record<string, string> = {
  social: "/social",
  clb: "/clubs",
  tournament: "/tournaments",
  san: "/san",
  news: "/news",
  blog: "/blog",
  live: "/live",
  watch: "/live",
};

const sectionRootFor = (pathname: string): string => {
  const isVi = pathname === "/vi" || pathname.startsWith("/vi/");
  const bare = isVi ? pathname.slice(3) || "/" : pathname;
  const root = SECTION_ROOTS[bare.split("/")[1] ?? ""];
  if (!root) return isVi ? "/vi" : "/";
  return isVi ? `/vi${root}` : root;
};

export const TheLineLayout = ({ title, description, noindex = false, active, children }: TheLineLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  usePresenceHeartbeat();
  const canonicalUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `https://www.thepicklehub.net${location.pathname}`;
    }
    return `${window.location.origin}${location.pathname}`;
  }, [location.pathname]);
  // PR63 — universal back button. Web users get this when they navigated
  // in via a link rather than typing the URL; a visible chrome affordance
  // beats relying on the browser's own back gesture.
  //
  // Hidden on root pages so the brand mark stays the leftmost item
  // when you can't actually go anywhere back. The history-length
  // check guards against the "fresh tab landing directly on a deep
  // link" case where navigate(-1) would leave the SPA.
  const ROOT_PATHS = new Set<string>([
    "/",
    "/vi",
    "/clubs",
    "/vi/clubs",
    "/san",
    "/vi/san",
    "/social",
    "/vi/social",
    "/live",
    "/vi/live",
    "/tournaments",
    "/vi/tournaments",
    "/videos",
    "/vi/videos",
    "/feed",
    "/vi/feed",
    "/blog",
    "/vi/blog",
    "/news",
    "/vi/news",
    "/forum",
    "/vi/forum",
    "/search",
    "/vi/search",
  ]);
  const hasHistory =
    typeof window !== "undefined" && window.history.length > 1;
  const onRootPath = ROOT_PATHS.has(location.pathname);
  // UX-08: no history (deep-link landing) no longer hides the affordance —
  // it renders as a Link to the section root instead (sectionRootFor).
  const { language, setLanguage } = useI18n();

  // Phase 4 news fix (2026-05-19): clicking EN/VI in the global toggle used
  // to only call setLanguage(), which mutated i18n state but kept the URL
  // unchanged. After we routed /news (EN) and /vi/news (VI) as DISTINCT
  // pages that derive their language from the route prop (not i18n state),
  // toggling on /news did nothing visible — News.tsx kept showing EN rows
  // because its `language` prop is hard-coded to "en" in the route def.
  //
  // Fix: when the toggle is clicked, also navigate to the EN/VI twin of
  // the current path so the route prop changes. Convention in this app
  // is "/x" ↔ "/vi/x", so we strip or prepend "/vi" on the leading segment.
  //
  // 2026-05-19 follow-up (Codex P2): only navigate when the current page
  // actually has a /vi twin. Routes like /clb/:slug, /nguoi-choi/:slug,
  // and /tran-dau/:slug are Vietnamese-canonical URLs with no /vi prefix;
  // admin pages, /onboarding, /tools/*, /privacy, and /terms have no VI
  // variant. For those, blindly prepending /vi would send users to NotFound.
  // Whitelist the first path segment to keep the toggle safe — flip i18n
  // state only, stay on the same URL.
  const VI_ENABLED_FIRST_SEGMENTS = new Set<string>([
    "", "blog", "news", "forum", "feed", "clubs", "san",
    "tournaments", "tournament", "videos", "watch",
    "rankings", "live", "social", "su-kien",
    "u", "org", "account", "notifications", "thong-bao",
    "dang-ky", "khoi-phuc-dang-ky", "search",
    // NOTE: "livestream" is intentionally NOT whitelisted. /livestream and
    // /livestream/:id are legacy 301 redirects to /live and /live/:id (App.tsx)
    // and have NO /vi/livestream* route. Prepending /vi here sent the toggle to
    // /vi/livestream/:id → NotFound. Excluding it makes the toggle flip i18n
    // state only and keep the URL, which then redirects to /live as intended.
    // 2026-05-19 codex P2 follow-up: App.tsx has /vi/tools + every
    // /vi/tools/<subroute> mirror, so the toggle should navigate
    // /tools ↔ /vi/tools instead of flipping i18n state only.
    "tools",
  ]);
  const hasViTwin = (path: string): boolean => {
    const en = path === "/vi" || path === "/vi/"
      ? "/"
      : path.startsWith("/vi/")
        ? path.slice(3)
        : path;
    const seg = en.split("/")[1] ?? "";
    return VI_ENABLED_FIRST_SEGMENTS.has(seg);
  };
  const switchLanguage = (next: "en" | "vi") => {
    if (next === language) return;
    setLanguage(next);
    const cur = location.pathname;
    if (!hasViTwin(cur)) return; // no localized twin → keep URL, flip state only
    let target = cur;
    if (next === "vi") {
      if (!cur.startsWith("/vi/") && cur !== "/vi") {
        target = cur === "/" ? "/vi" : `/vi${cur}`;
      }
    } else {
      if (cur === "/vi" || cur === "/vi/") {
        target = "/";
      } else if (cur.startsWith("/vi/")) {
        target = cur.slice(3); // "/vi/news" → "/news"
      }
    }
    if (target !== cur) navigate(target + location.search + location.hash);
  };
  // gives us auth.users only. Defaults to undefined while loading; the
  // menu item disables itself in that state.
  const { user, signOut } = useAuth();
  // Pulled here purely for the "View my profile" dropdown link. The
  // profile.username slug isn't stored on the auth User object — useAuth
  // gives us auth.users only. Defaults to undefined while loading; the
  // menu item disables itself in that state.
    const { profile } = useUserProfile();
  const profileUsername = (profile as { username?: string | null } | null | undefined)?.username ?? null;

  // Role flags for the avatar dropdown. We DON'T gate the dropdown opening
  // on `isLoading` because that would briefly show no role links to admins
  // on every page navigation; instead each link renders only once its role
  // hook has confirmed access. Both hooks already key off `user`, so they
  // return false for signed-out viewers without an extra check.
  const { isAdmin } = useAdminAuth();
  const { isCreator } = useCreatorAuth(); // true for creator OR admin
  // ponytail: owner-only (useMyShop); shop_members không owner chưa thấy
  // Cả hai hook gate `enabled: !!user` — khách vãng lai không tạo query.
  const myShop = useMyShop().data;
  const applicationStatus = useMyApplication().data?.status;
  const sellerLink = myShop
    ? { to: "/seller", vi: "Kênh người bán", en: "Seller hub" }
    : applicationStatus === "submitted" || applicationStatus === "under_review"
      ? { to: "/seller/application/status", vi: "Đơn mở shop: đang chờ duyệt", en: "Shop application: under review" }
      : applicationStatus === "needs_changes"
        ? { to: "/seller/application/status", vi: "Đơn mở shop: cần bổ sung", en: "Shop application: needs changes" }
        : null;

  // PR55: surface the viewer's own clubs in the avatar dropdown so they
  // can jump straight to /clb/<slug>/quan-ly. Limit 5 to keep the menu
  // scannable. 2026-05-21 (managers MVP): merge in clubs the viewer
  // manages (via club_managers) so non-creator organizers also have a
  // navigation entry point.
  const { data: myClubs } = useQuery<
    { slug: string; name: string; role: "creator" | "manager" }[]
  >({
    queryKey: ["my-clubs", user?.id ?? null],
    queryFn: async () => {
      if (!user?.id) return [];

      // Two parallel reads so latency doesn't double. Both queries are
      // covered by existing RLS (clubs.select_all public + club_managers
      // public select), so no role-elevation needed.
      const [ownedRes, managedRes] = await Promise.all([
        supabase
          .from("clubs")
          .select("id, slug, name, created_at")
          // Hide archived clubs — the owner has explicitly removed the
          // CLB from active rotation; direct link still works.
          .eq("created_by", user.id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("club_managers")
          .select("club_id, added_at, club:clubs!club_managers_club_id_fkey(id, slug, name, archived_at)")
          .eq("profile_id", user.id)
          .order("added_at", { ascending: false })
          .limit(10),
      ]);

      if (ownedRes.error) {
        console.error("TheLineLayout: owned-clubs error", ownedRes.error);
      }
      if (managedRes.error) {
        console.error("TheLineLayout: managed-clubs error", managedRes.error);
      }

      const owned = (ownedRes.data ?? []) as { id: string; slug: string; name: string }[];
      const managed = (managedRes.data ?? []) as {
        club_id: string;
        club: { id: string; slug: string; name: string; archived_at: string | null } | null;
      }[];

      const ownedIds = new Set(owned.map((c) => c.id));
      const ownedRows = owned.map((c) => ({
        slug: c.slug,
        name: c.name,
        role: "creator" as const,
      }));
      const managedRows = managed
        .map((m) => m.club)
        .filter(
          (c): c is { id: string; slug: string; name: string; archived_at: string | null } =>
            c != null && c.archived_at == null && !ownedIds.has(c.id),
        )
        .map((c) => ({ slug: c.slug, name: c.name, role: "manager" as const }));

      // Creator rows first, then managed. Cap to 5 total to keep the
      // dropdown scannable on small screens.
      return [...ownedRows, ...managedRows].slice(0, 5);
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [search, setSearch] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  // PR69 — open state for nav-parent dropdowns (currently only the
  // "Social" group with Tickets + Clubs children). Keyed by NavItem.key
  // so a future second parent stays independent.
  const [openNavKey, setOpenNavKey] = useState<Active | null>(null);
  const navDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside / Escape closes avatar dropdown
  useEffect(() => {
    if (!avatarOpen) return undefined;
    const onClick = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAvatarOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [avatarOpen]);

  // PR69 — same click-outside/Escape pattern for nav-parent dropdowns.
  useEffect(() => {
    if (openNavKey === null) return undefined;
    const onClick = (e: MouseEvent) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target as Node)) {
        setOpenNavKey(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenNavKey(null);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [openNavKey]);

  // Derived user display values
  const userEmail = user?.email ?? "";
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    userEmail.split("@")[0] ?? "";
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ?? "";
  const userInitial = (userName || userEmail || "?").charAt(0).toUpperCase();

  // Pin theme + restore mode preference
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    const prevMode = root.getAttribute("data-mode");
    root.setAttribute("data-theme", "the-line");
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    // No stored preference → follow the OS colour scheme
    const initialMode: "light" | "dark" =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    setMode(initialMode);
    if (initialMode === "light") root.setAttribute("data-mode", "light");
    else root.removeAttribute("data-mode");

    return () => {
      if (prevTheme) root.setAttribute("data-theme", prevTheme);
      else root.removeAttribute("data-theme");
      if (prevMode) root.setAttribute("data-mode", prevMode);
      else root.removeAttribute("data-mode");
    };
  }, []);

  // Body scroll lock while drawer open
  useEffect(() => {
    const root = document.documentElement;
    if (menuOpen) root.classList.add("tl-drawer-open");
    else root.classList.remove("tl-drawer-open");
    return () => root.classList.remove("tl-drawer-open");
  }, [menuOpen]);

  // Drawer a11y — focus the close button on open + trap Tab inside the
  // dialog (simple first/last-focusable cycle; Escape handled below).
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    drawerCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Escape closes drawer
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      const root = document.documentElement;
      if (next === "light") root.setAttribute("data-mode", "light");
      else root.removeAttribute("data-mode");
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q.length === 0) return;
    setMenuOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="tl-root">
      <DynamicMeta title={title} description={description} noindex={noindex} url={canonicalUrl} />

      <div className="tl-scroll">
      <nav className="tl-nav">
        {/* PR63 — back affordance, hidden on root listing pages. UX-08:
            with history it pops (navigate(-1)); on a deep-link landing
            with no history it links to the section root instead. */}
        {!onRootPath && (() => {
          const backIcon = (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          );
          const backLabel = language === "vi" ? "Quay lại" : "Back";
          return hasHistory ? (
            <button
              type="button"
              className="tl-icon-btn tl-back-btn"
              aria-label={backLabel}
              title={backLabel}
              onClick={() => navigate(-1)}
            >
              {backIcon}
            </button>
          ) : (
            <Link
              to={sectionRootFor(location.pathname)}
              className="tl-icon-btn tl-back-btn"
              aria-label={backLabel}
              title={backLabel}
            >
              {backIcon}
            </Link>
          );
        })()}
        <Link to={language === "vi" ? "/vi" : "/"} className="tl-brand" aria-label="ThePickleHub home">
          <span className="tl-brand-mark" aria-hidden="true" />
          <span className="tl-brand-text">
            The<em>Pickle</em>Hub
          </span>
        </Link>

        {/* 2026-05-20 — mobile-only login + signup pills for anonymous
            visitors. Sits between brand and dark-toggle so the auth CTA
            is visible without opening the hamburger drawer. CSS class
            `.tl-auth-mobile` (in the-line.css) hides this group on
            screens > 900px and on logged-in viewers. The signup link
            passes `mode: signup` so /login lands on the create-account
            tab directly. */}
        {!user && (
          <div className="tl-auth-mobile">
            <Link
              to={getLoginUrl(location.pathname + location.search)}
              className="tl-auth-pill"
              aria-label={language === "vi" ? "Đăng nhập" : "Log in"}
            >
              {language === "vi" ? "Đăng nhập" : "Log in"}
            </Link>
            <Link
              to={getLoginUrl(location.pathname + location.search, { mode: "signup" })}
              className="tl-auth-pill tl-auth-pill-primary"
              aria-label={language === "vi" ? "Đăng ký" : "Sign up"}
            >
              {language === "vi" ? "Đăng ký" : "Sign up"}
            </Link>
          </div>
        )}

        <div className="tl-nav-links">
          {NAV_ITEMS.map((item) => {
            const label = language === "vi" && item.labelVi ? item.labelVi : item.label;
            // Leaf — same render as before.
            if (!("children" in item)) {
              return (
                <Link
                  key={item.key}
                  to={localizedPath(item.to, language)}
                  className={active === item.key ? "active" : ""}
                >
                  {label}
                </Link>
              );
            }
            // Parent — button + popup of children. Active when ANY child
            // matches the current page.
            const isActive =
              active === item.key ||
              item.children.some((c) => c.key === active);
            const isOpen = openNavKey === item.key;
            return (
              <div
                key={item.key}
                ref={isOpen ? navDropdownRef : undefined}
                style={{ position: "relative", display: "inline-block" }}
              >
                <button
                  type="button"
                  className={`tl-nav-link-btn${isActive ? " active" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  onClick={() => setOpenNavKey((k) => (k === item.key ? null : item.key))}
                >
                  {label}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ marginLeft: 6, opacity: 0.7 }}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="tl-nav-submenu" role="menu">
                    {item.children.map((child) => (
                      <Link
                        key={child.key}
                        role="menuitem"
                        to={localizedPath(child.to, language)}
                        className={active === child.key ? "active" : ""}
                        onClick={() => setOpenNavKey(null)}
                      >
                        {language === "vi" && child.labelVi ? child.labelVi : child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="tl-nav-right">
          <button
            className="tl-nav-search"
            type="button"
            aria-label={language === "vi" ? "Tìm kiếm" : "Search"}
            onClick={() => navigate("/search")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>{language === "vi" ? "Tìm VĐV, sự kiện…" : "Search players, events…"}</span>
            {/* ⌘K hint hidden on touch devices via CSS (@media hover:none) */}
            <kbd>⌘K</kbd>
          </button>

          {/* Language toggle (inline EN|VI) */}
          <div
            className="tl-lang"
            role="group"
            aria-label={language === "vi" ? "Chọn ngôn ngữ" : "Choose language"}
          >
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => switchLanguage("en")}
              aria-pressed={language === "en"}
              aria-label="English"
            >
              EN
            </button>
            <span className="sep" aria-hidden="true">|</span>
            <button
              type="button"
              className={language === "vi" ? "active" : ""}
              onClick={() => switchLanguage("vi")}
              aria-pressed={language === "vi"}
              aria-label="Tiếng Việt"
            >
              VI
            </button>
          </div>

          {/* Mode toggle */}
          <button
            className="tl-icon-btn"
            type="button"
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleMode}
          >
            {mode === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <Link to="/tools" className="tl-nav-cta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{language === "vi" ? "Tạo bracket" : "Create bracket"}</span>
          </Link>

          {user ? (
            <>
              {/* DUPR header widget — Connect button or rating pill */}
              <HeaderDuprBadge />

              {/* Unified notification bell — legacy + social merged (Sprint 2 Phase 3B.2 unify) */}
              <UnifiedNotificationBell className="tl-icon-btn" />

              {/* Avatar + dropdown */}
              <div ref={avatarRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  className="tl-avatar"
                  aria-label="Account menu"
                  aria-expanded={avatarOpen}
                  onClick={() => setAvatarOpen((p) => !p)}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" />
                  ) : (
                    <span>{userInitial}</span>
                  )}
                </button>
                {avatarOpen && (
                  <div className="tl-dropdown" role="menu">
                    <div className="tl-dropdown-head">
                      <div className="name">{userName || "Signed in"}</div>
                      <div className="email">{userEmail}</div>
                    </div>
                    {/* View my profile shortcut — disabled while the
                        profile is still loading or for users whose
                        onboarding hasn't assigned a username yet. */}
                    {profileUsername ? (
                      <Link
                        to={`/nguoi-choi/${profileUsername}`}
                        onClick={() => setAvatarOpen(false)}
                      >
                        {language === "vi" ? "Xem hồ sơ" : "View my profile"}
                      </Link>
                    ) : (
                      <span style={{ opacity: 0.5, cursor: "default", padding: "8px 12px", display: "block" }}>
                        {language === "vi" ? "Xem hồ sơ" : "View my profile"}
                      </span>
                    )}
                    <Link to="/account" onClick={() => setAvatarOpen(false)}>
                      {language === "vi" ? "Tài khoản" : "Account"}
                    </Link>
                    <Link to="/account/my-tournaments" onClick={() => setAvatarOpen(false)}>
                      {language === "vi" ? "Giải đấu của tôi" : "My Tournaments"}
                    </Link>
                    {sellerLink && (
                      <Link to={sellerLink.to} onClick={() => setAvatarOpen(false)}>
                        {language === "vi" ? sellerLink.vi : sellerLink.en}
                      </Link>
                    )}
                    {isCreator && (
                      <Link to="/creator" onClick={() => setAvatarOpen(false)}>
                        {language === "vi" ? "Bảng điều khiển Creator" : "Creator dashboard"}
                      </Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setAvatarOpen(false)}>
                        Admin
                      </Link>
                    )}
                    <div className="divider" />
                    {/* PR55 — my-clubs section. Header label + flat list
                        of the viewer's clubs (up to 5) so they can jump
                        straight to /clb/<slug>/quan-ly. Always shows the
                        "Tạo CLB mới" link at the bottom, regardless of
                        whether they have any clubs yet. */}
                    <div
                      style={{
                        padding: "6px 12px 4px",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--tl-fg-3)",
                        fontFamily: "Geist Mono",
                      }}
                    >
                      {language === "vi" ? "CLB của tôi" : "My clubs"}
                    </div>
                    {(myClubs ?? []).length > 0 ? (
                      (myClubs ?? []).map((c) => (
                        <Link
                          key={c.slug}
                          to={`/clb/${c.slug}/quan-ly`}
                          onClick={() => setAvatarOpen(false)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.name}
                          </span>
                          {/* Visual cue so a viewer who manages multiple
                              clubs can tell at a glance which ones they
                              own vs which they help organize. */}
                          {c.role === "manager" && (
                            <span
                              style={{
                                fontSize: 11,
                                letterSpacing: "0.05em",
                                textTransform: "uppercase",
                                fontFamily: "Geist Mono",
                                color: "var(--tl-fg-3)",
                                border: "1px solid var(--tl-border)",
                                borderRadius: 3,
                                padding: "1px 5px",
                                flexShrink: 0,
                              }}
                            >
                              {language === "vi" ? "QL" : "Mgr"}
                            </span>
                          )}
                        </Link>
                      ))
                    ) : (
                      <span
                        style={{
                          opacity: 0.6,
                          display: "block",
                          padding: "4px 12px",
                          fontSize: 12,
                        }}
                      >
                        {language === "vi" ? "Chưa có CLB nào." : "No clubs yet."}
                      </span>
                    )}
                    <Link to="/clubs/new" onClick={() => setAvatarOpen(false)}>
                      + {language === "vi" ? "Tạo CLB mới" : "Create new club"}
                    </Link>
                    <div className="divider" />
                    <button
                      type="button"
                      onClick={async () => {
                        setAvatarOpen(false);
                        await signOut();
                      }}
                    >
                      {language === "vi" ? "Đăng xuất" : "Sign out"}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to={getLoginUrl(location.pathname + location.search)} className="tl-nav-btn">
              {language === "vi" ? "Đăng nhập" : "Sign in"}
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className="tl-icon-btn tl-menu-btn"
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Drawer */}
      {menuOpen && (
        <>
          <div
            className="tl-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className="tl-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={language === "vi" ? "Menu điều hướng" : "Navigation menu"}
            ref={drawerRef}
          >
            <div className="tl-drawer-head">
              <span className="tl-drawer-title">Menu</span>
              <button
                type="button"
                className="tl-drawer-close"
                aria-label={language === "vi" ? "Đóng menu" : "Close menu"}
                onClick={() => setMenuOpen(false)}
                ref={drawerCloseRef}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            <form onSubmit={onSearch}>
              <div className="tl-drawer-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--tl-fg-3)" }}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  aria-label={language === "vi" ? "Tìm vận động viên, giải đấu" : "Search players, events"}
                  placeholder={language === "vi" ? "Tìm vận động viên, giải đấu…" : "Search players, events…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </form>

            <div className="tl-drawer-nav">
              <Link
                to={language === "vi" ? "/vi" : "/"}
                onClick={() => setMenuOpen(false)}
                className={active === "home" ? "active" : ""}
              >
                <span>{language === "vi" ? "Trang chủ" : "Home"}</span>
                <span className="arr">→</span>
              </Link>
              {NAV_ITEMS.map((item) => {
                const label = language === "vi" && item.labelVi ? item.labelVi : item.label;
                // Leaf — keep existing single-row Link.
                if (!("children" in item)) {
                  return (
                    <Link
                      key={item.key}
                      to={localizedPath(item.to, language)}
                      onClick={() => setMenuOpen(false)}
                      className={active === item.key ? "active" : ""}
                    >
                      <span>{label}</span>
                      <span className="arr">→</span>
                    </Link>
                  );
                }
                // Parent — render section header + indented child rows.
                // Drawer is collapsible-friendly but for now we just
                // show both children inline; that's the same affordance
                // a top-level item would have.
                return (
                  <div key={item.key} className="tl-drawer-nav-group">
                    <div className="tl-drawer-nav-group-label">{label}</div>
                    {item.children.map((child) => (
                      <Link
                        key={child.key}
                        to={localizedPath(child.to, language)}
                        onClick={() => setMenuOpen(false)}
                        className={active === child.key ? "active tl-drawer-nav-child" : "tl-drawer-nav-child"}
                      >
                        <span>
                          {language === "vi" && child.labelVi ? child.labelVi : child.label}
                        </span>
                        <span className="arr">→</span>
                      </Link>
                    ))}
                  </div>
                );
              })}
              {user ? (
                <>
                  <Link to="/account" onClick={() => setMenuOpen(false)}>
                    <span>{language === "vi" ? "Tài khoản" : "Account"}</span>
                    <span className="arr">→</span>
                  </Link>
                  <Link to="/notifications" onClick={() => setMenuOpen(false)}>
                    <span>{language === "vi" ? "Thông báo" : "Notifications"}</span>
                    <span className="arr">→</span>
                  </Link>
                </>
              ) : (
                <Link to={getLoginUrl(location.pathname + location.search)} onClick={() => setMenuOpen(false)}>
                  <span>{language === "vi" ? "Đăng nhập" : "Sign in"}</span>
                  <span className="arr">→</span>
                </Link>
              )}
            </div>

            {/* Secondary nav — pages not in the 5 primary nav items but useful for mobile discoverability */}
            <div className="tl-drawer-nav-secondary">
              <div className="tl-drawer-section-label">{language === "vi" ? "Khám phá thêm" : "More"}</div>
              <Link to={localizedPath("/videos", language)} onClick={() => setMenuOpen(false)}>
                <span>{language === "vi" ? "Video" : "Videos"}</span>
                <span className="arr">→</span>
              </Link>
              <Link to={localizedPath("/news", language)} onClick={() => setMenuOpen(false)}>
                <span>{language === "vi" ? "Tin tức" : "News"}</span>
                <span className="arr">→</span>
              </Link>
              <Link to={localizedPath("/forum", language)} onClick={() => setMenuOpen(false)}>
                <span>{language === "vi" ? "Diễn đàn" : "Forum"}</span>
                <span className="arr">→</span>
              </Link>
            </div>

            <div className="tl-drawer-foot">
              <span className="tl-drawer-foot-label">
                {language === "vi" ? "Ngôn ngữ" : "Language"}
              </span>
              <div className="tl-lang" style={{ display: "inline-flex" }}>
                <button
                  type="button"
                  className={language === "en" ? "active" : ""}
                  onClick={() => switchLanguage("en")}
                >
                  EN
                </button>
                <span className="sep">|</span>
                <button
                  type="button"
                  className={language === "vi" ? "active" : ""}
                  onClick={() => switchLanguage("vi")}
                >
                  VI
                </button>
              </div>
            </div>

            <div className="tl-drawer-foot" style={{ marginTop: 0, paddingTop: 14 }}>
              <span className="tl-drawer-foot-label">
                {language === "vi" ? "Giao diện" : "Appearance"}
              </span>
              <button className="tl-icon-btn" type="button" onClick={toggleMode} aria-label="Toggle mode">
                {mode === "dark" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>

            {user && (
              <button
                type="button"
                onClick={async () => { setMenuOpen(false); await signOut(); }}
                style={{
                  marginTop: 8, padding: "10px 12px", borderRadius: 8,
                  background: "transparent", border: "1px solid var(--tl-border)",
                  color: "var(--tl-fg-2)", font: "inherit", fontSize: 13.5,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                {language === "vi" ? "Đăng xuất" : "Sign out"}
              </button>
            )}
          </aside>
        </>
      )}

      {/* DUPR connect prompt — slim banner above every page for authed
          users who haven't linked. Component guards internally on
          useAuth + useDuprConnection; renders nothing otherwise. */}

      {/* DUPR connect prompt — slim banner above every page for authed
          users who haven't linked. Component guards internally on
          useAuth + useDuprConnection; renders nothing otherwise. */}
      <ConnectDuprBanner />

      {children}

      <footer className="tl-footer">
        <div className="tl-shell">
          <div className="tl-foot-grid">
            <div className="tl-foot-brand">
              <div className="tl-foot-tagline">
                {language === "vi"
                  ? <>Phóng viên. <em>Vợt.</em> Tường thuật thật.</>
                  : <>Reporters. <em>Rackets.</em> Real coverage.</>}
              </div>
              <h3>
                The<em style={{ fontFamily: "inherit" }}>Pickle</em>Hub
              </h3>
              <p>
                {language === "vi"
                  ? "Đưa tin pickleball chuyên nghiệp toàn cầu. Trụ sở tại TP.HCM, tường thuật từ Austin, Naples, Barcelona, Singapore và nhiều thành phố khác."
                  : "Global coverage of professional pickleball. Headquartered in Ho Chi Minh City, reporting from Austin, Naples, Barcelona, Singapore and elsewhere."}
              </p>
            </div>
            <div className="tl-foot-col">
              <h4>{language === "vi" ? "XEM" : "Watch"}</h4>
              <ul>
                <li><Link to="/live">{language === "vi" ? "Sân trực tiếp" : "Live courts"}</Link></li>
                <li><Link to="/videos">{language === "vi" ? "Video" : "Videos"}</Link></li>
                <li><Link to="/tournaments">{language === "vi" ? "Lịch thi đấu" : "Schedule"}</Link></li>
              </ul>
            </div>
            <div className="tl-foot-col">
              <h4>{language === "vi" ? "THI ĐẤU" : "Compete"}</h4>
              <ul>
                <li><Link to="/tournaments">{language === "vi" ? "Giải đấu" : "Tournaments"}</Link></li>
                <li><Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link></li>
                <li><Link to="/forum">{language === "vi" ? "Diễn đàn" : "Forum"}</Link></li>
              </ul>
            </div>
            <div className="tl-foot-col">
              <h4>{language === "vi" ? "ĐỌC" : "Read"}</h4>
              <ul>
                <li><Link to={language === "vi" ? "/vi/blog" : "/blog"}>{language === "vi" ? "Bài viết" : "Stories"}</Link></li>
                <li><Link to="/news">{language === "vi" ? "Tin tức" : "News"}</Link></li>
              </ul>
            </div>
            {/* Chân trang là chỗ người mua đến sau khi cuộn hết một trang sản
                phẩm mà chưa quyết mua. Trước 19/08 nó chỉ có link tin tức và
                giải đấu — đúng lúc cần một đường về chợ thì không có đường nào. */}
            <div className="tl-foot-col">
              <h4>{language === "vi" ? "MUA SẮM" : "Shop"}</h4>
              <ul>
                <li><Link to={localizedPath("/shop", language)}>{language === "vi" ? "Chợ đồ pickleball" : "Marketplace"}</Link></li>
                <li><Link to="/shop/sell">{language === "vi" ? "Mở shop" : "Sell with us"}</Link></li>
              </ul>
            </div>
          </div>
          <div className="tl-foot-bottom">
            <span>© 2026 ThePickleHub · Ho Chi Minh City</span>
            <div
              className="tl-social"
              role="group"
              aria-label={language === "vi" ? "Mạng xã hội" : "Social channels"}
            >
              <a
                // BRAND-01 (2026-08-18): /ThePickleHub is someone else's page —
                // Facebook resolves that vanity URL to "Pickle Hub | Guntur"
                // (India). Ours is /thepicklehubnet/. Kept in sync with the
                // Organization sameAs list in functions/_lib/render/home.ts.
                href="https://www.facebook.com/thepicklehubnet"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={language === "vi" ? "ThePickleHub trên Facebook" : "ThePickleHub on Facebook"}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M13.5 21v-8h2.7l.4-3.13H13.5V7.9c0-.9.25-1.52 1.55-1.52h1.66V3.57c-.29-.04-1.27-.12-2.42-.12-2.4 0-4.04 1.46-4.04 4.15v2.31H7.55V13h2.7v8h3.25z" />
                </svg>
              </a>
              {/* Instagram and YouTube links removed 2026-08-18: neither
                  instagram.com/thepicklehub nor youtube.com/@thepicklehub is
                  ours (confirmed by Cuong). Kept in sync with the Organization
                  sameAs list in functions/_lib/render/home.ts — do not restore
                  either without confirming ownership first. */}
              <a
                href="https://x.com/thepicklehub"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={language === "vi" ? "ThePickleHub trên X" : "ThePickleHub on X"}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
            <span>
              <Link to={language === "vi" ? "/vi/advertise" : "/advertise"} style={{ color: "inherit", textDecoration: "none" }}>
                {language === "vi" ? "Quảng cáo" : "Advertise"}
              </Link>
              {" · "}
              <Link to={language === "vi" ? "/vi/about" : "/about"} style={{ color: "inherit", textDecoration: "none" }}>
                {language === "vi" ? "Về chúng tôi" : "About"}
              </Link>
              <span aria-hidden="true">·</span>
              <Link to={language === "vi" ? "/vi/contact" : "/contact"} style={{ color: "inherit", textDecoration: "none" }}>
                {language === "vi" ? "Liên hệ" : "Contact"}
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
                {language === "vi" ? "Quyền riêng tư" : "Privacy"}
              </Link>
              {" · "}
              <Link to="/terms" style={{ color: "inherit", textDecoration: "none" }}>
                {language === "vi" ? "Điều khoản" : "Terms"}
              </Link>
            </span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};
