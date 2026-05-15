import { ReactNode, useEffect, useState, useCallback, useRef, FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { UnifiedNotificationBell } from "@/components/social/notifications";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/the-line.css";

/* ---------------------------------------------------------------------------
 * The Line layout — production chrome for / and /vi.
 *
 * Promoted from preview/_shell.tsx during 2026-04-25 cutover. Differences
 * vs the preview shell:
 *   - No preview banner (this IS production)
 *   - Nav links point to production routes (/live, /tournaments, etc.)
 *   - Brand link goes to / (or /vi via ViLanguageWrapper)
 *
 * The preview/_shell.tsx remains intact and unchanged so /preview/the-line/*
 * routes continue working through the 14-day rollback window.
 *
 * - Pins data-theme="the-line" on <html> while mounted (cleans up on unmount)
 * - Restores previous data-mode (light/dark) preference from localStorage
 * - Mobile drawer with search, nav, mode toggle, language toggle, auth
 * - Children render INSIDE the chrome
 * ------------------------------------------------------------------------- */

type Active = "live" | "tournaments" | "lab" | "rankings" | "feed" | "stories" | "stats" | "home" | "events" | "clubs" | "social";

export interface TheLineLayoutProps {
  title: string;
  description?: string;
  /** Optional — production homepage is indexed; pass true for noindex routes. */
  noindex?: boolean;
  active?: Active;
  children: ReactNode;
}

const STORAGE_KEY = "tl-theme-mode";

/**
 * Optional `labelVi` opts a nav item into bilingual rendering. Items without
 * a labelVi keep the existing English-only behaviour (Live, Tournaments,
 * etc. read the same in both locales). Feed gets a Vietnamese label
 * because "Feed" doesn't carry meaning for VI-only readers.
 *
 * PR69 — items may declare `children` for a 2-level dropdown. Parents with
 * children render as a button that toggles a popup; clicking a child
 * navigates. The parent itself has no `to` (it's only a menu trigger). The
 * highlight matches on the parent's `key` when any child is the active page.
 */
interface NavLeaf {
  label: string;
  labelVi?: string;
  to: string;
  key: Active;
}
interface NavParent {
  label: string;
  labelVi?: string;
  key: Active;
  children: NavLeaf[];
}
type NavItem = NavLeaf | NavParent;

const NAV_ITEMS: NavItem[] = [
  { label: "Live", to: "/live", key: "live" },
  { label: "Tournaments", to: "/tournaments", key: "tournaments" },
  {
    label: "Social",
    labelVi: "Social",
    key: "social",
    children: [
      { label: "Tickets", labelVi: "Xé vé", to: "/social", key: "events" },
      { label: "Clubs", labelVi: "CLB", to: "/clubs", key: "clubs" },
    ],
  },
  { label: "Bracket Lab", to: "/tools", key: "lab" },
  { label: "Rankings", to: "/rankings", key: "rankings" },
  { label: "Feed", labelVi: "Bảng tin", to: "/feed", key: "feed" },
  { label: "Stories", to: "/blog", key: "stories" },
];

/**
 * Prefix path with /vi when active language is Vietnamese so primary nav
 * keeps users in their language tree. Mirrors the pattern used in the
 * footer (line ~492). All listed routes have /vi/* equivalents in App.tsx
 * routing — verified 2026-04-29.
 */
const localizedPath = (path: string, language: "vi" | "en"): string =>
  language === "vi" ? `/vi${path}` : path;

export const TheLineLayout = ({ title, description, noindex = false, active, children }: TheLineLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  usePresenceHeartbeat();
  // PR63 — universal back button. iOS users in the Capacitor wrapper
  // don't have a browser back gesture by default (true edge-swipe
  // requires an AppDelegate.swift edit — see capacitor.config.ts
  // note). Android has a hardware back button but a visible chrome
  // affordance is still helpful. Web users always get this when
  // they navigated in via a link rather than typing the URL.
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
  const showBackButton = hasHistory && !onRootPath;
  const { language, setLanguage } = useI18n();
  const { user, signOut } = useAuth();
  // Pulled here purely for the "View my profile" dropdown link. The
  // profile.username slug isn't stored on the auth User object — useAuth
  // gives us auth.users only. Defaults to undefined while loading; the
  // menu item disables itself in that state.
  const { profile } = useUserProfile();
  const profileUsername = (profile as { username?: string | null } | null | undefined)?.username ?? null;

  // PR55: surface the viewer's own clubs in the avatar dropdown so they
  // can jump straight to /clb/<slug>/quan-ly. Limit 3 because that's
  // also the self-service cap; if a user has more (e.g. admin-created)
  // we still cap the menu to keep it scannable.
  const { data: myClubs } = useQuery<{ slug: string; name: string }[]>({
    queryKey: ["my-clubs", user?.id ?? null],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("clubs")
        .select("slug, name")
        .eq("created_by", user.id)
        // Codex review: hide archived clubs from the avatar dropdown so
        // an owner who archives a CLB doesn't keep seeing it as an
        // active jump target. /clb/<slug> still loads via direct link.
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) {
        console.error("TheLineLayout: my-clubs error", error);
        return [];
      }
      return (data as { slug: string; name: string }[]) ?? [];
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
    if (!avatarOpen) return;
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
    if (openNavKey === null) return;
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
    const initialMode = stored === "light" ? "light" : "dark";
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

  // Escape closes drawer
  useEffect(() => {
    if (!menuOpen) return;
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
      <DynamicMeta title={title} description={description} noindex={noindex} url={`${window.location.origin}${location.pathname}`} />

      <div className="tl-scroll">
      <nav className="tl-nav">
        {/* PR63 — back affordance. Only shown when there's somewhere
            to go back to and we're not on a root listing page. */}
        {showBackButton && (
          <button
            type="button"
            className="tl-icon-btn tl-back-btn"
            aria-label={language === "vi" ? "Quay lại" : "Back"}
            title={language === "vi" ? "Quay lại" : "Back"}
            onClick={() => navigate(-1)}
          >
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
          </button>
        )}
        <Link to={language === "vi" ? "/vi" : "/"} className="tl-brand" aria-label="The PickleHub home">
          <span className="tl-brand-mark" aria-hidden="true" />
          <span className="tl-brand-text">
            The <em>Pickle</em>Hub
          </span>
        </Link>

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
            aria-label="Search"
            onClick={() => navigate("/search")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Search players, events…</span>
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
              onClick={() => setLanguage("en")}
              aria-pressed={language === "en"}
              aria-label="English"
            >
              EN
            </button>
            <span className="sep" aria-hidden="true">|</span>
            <button
              type="button"
              className={language === "vi" ? "active" : ""}
              onClick={() => setLanguage("vi")}
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
                    <Link to="/account" onClick={() => setAvatarOpen(false)}>Account</Link>
                    <Link to="/creator" onClick={() => setAvatarOpen(false)}>Creator dashboard</Link>
                    <Link to="/admin" onClick={() => setAvatarOpen(false)}>Admin</Link>
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
                        >
                          {c.name}
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
            <Link to="/login" className="tl-nav-btn">
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
          <aside className="tl-drawer" role="dialog" aria-label="Navigation menu">
            <div className="tl-drawer-head">
              <span className="tl-drawer-title">Menu</span>
              <button
                type="button"
                className="tl-drawer-close"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
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
                <Link to="/login" onClick={() => setMenuOpen(false)}>
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
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
                <span className="sep">|</span>
                <button
                  type="button"
                  className={language === "vi" ? "active" : ""}
                  onClick={() => setLanguage("vi")}
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
                The <em style={{ fontFamily: "inherit" }}>Pickle</em>Hub
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
          </div>
          <div className="tl-foot-bottom">
            <span>© 2026 The PickleHub · Ho Chi Minh City</span>
            <div
              className="tl-social"
              role="group"
              aria-label={language === "vi" ? "Mạng xã hội" : "Social channels"}
            >
              <a
                href="https://www.facebook.com/ThePickleHub"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={language === "vi" ? "ThePickleHub trên Facebook" : "ThePickleHub on Facebook"}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M13.5 21v-8h2.7l.4-3.13H13.5V7.9c0-.9.25-1.52 1.55-1.52h1.66V3.57c-.29-.04-1.27-.12-2.42-.12-2.4 0-4.04 1.46-4.04 4.15v2.31H7.55V13h2.7v8h3.25z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/thepicklehub"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={language === "vi" ? "ThePickleHub trên Instagram" : "ThePickleHub on Instagram"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@thepicklehub"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={language === "vi" ? "ThePickleHub trên YouTube" : "ThePickleHub on YouTube"}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M21.58 7.2a2.5 2.5 0 0 0-1.77-1.77C18.2 5 12 5 12 5s-6.2 0-7.81.43A2.5 2.5 0 0 0 2.42 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .42 4.8 2.5 2.5 0 0 0 1.77 1.77C5.8 19 12 19 12 19s6.2 0 7.81-.43a2.5 2.5 0 0 0 1.77-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.42-4.8zM10 15V9l5.2 3L10 15z" />
                </svg>
              </a>
            </div>
            <span>
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

export const formatDate = (iso: string | null | undefined): { d: string; m: string; full: string } => {
  if (!iso) return { d: "—", m: "—", full: "" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { d: "—", m: "—", full: "" };
  return {
    d: dt.getDate().toString().padStart(2, "0"),
    m: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    full: dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "";
  const diff = dt - Date.now();
  const absMin = Math.abs(Math.round(diff / 60000));
  if (absMin < 1) return "now";
  if (absMin < 60) return diff > 0 ? `in ${absMin}m` : `${absMin}m ago`;
  const hrs = Math.round(absMin / 60);
  if (hrs < 24) return diff > 0 ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
};
