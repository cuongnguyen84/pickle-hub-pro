import { ReactNode, useEffect, useState, useCallback, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import "@/styles/the-line.css";

/* ---------------------------------------------------------------------------
 * Shared chrome for all /preview/the-line/* routes.
 *
 * - Pins data-theme="the-line" on <html> while mounted (cleans up on unmount)
 * - Restores previous data-mode (light/dark) preference from localStorage
 * - Provides: preview banner, nav, footer, DynamicMeta (noindex)
 * - Mobile drawer with search, nav, mode toggle
 * - Children render INSIDE the chrome
 * ------------------------------------------------------------------------- */

type Active = "live" | "tournaments" | "rankings" | "stories" | "stats" | "home";

export interface PreviewShellProps {
  title: string;
  description?: string;
  active?: Active;
  children: ReactNode;
}

const STORAGE_KEY = "tl-theme-mode";

const NAV_ITEMS: { label: string; to: string; key: Active }[] = [
  { label: "Live", to: "/preview/the-line/live", key: "live" },
  { label: "Tournaments", to: "/preview/the-line/tournaments", key: "tournaments" },
  { label: "Rankings", to: "/preview/the-line/rankings", key: "rankings" },
  { label: "Stories", to: "/preview/the-line/blog", key: "stories" },
];

export const PreviewShell = ({ title, description, active, children }: PreviewShellProps) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [search, setSearch] = useState("");

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
    navigate(`/preview/the-line/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="tl-root">
      <DynamicMeta title={title} description={description} noindex />

      <div className="tl-scroll">
        <div className="tl-preview-banner">
          ◆ Preview · Direction IV · The Line &nbsp;·&nbsp;
          <Link to="/">Back to current design →</Link>
        </div>

      <nav className="tl-nav">
        <Link to="/preview/the-line" className="tl-brand">
          <span className="tl-brand-mark" aria-hidden="true" />
          <span>
            <em>Pickle</em> Hub
          </span>
        </Link>

        <div className="tl-nav-links">
          {NAV_ITEMS.map((item) => (
            <Link key={item.key} to={item.to} className={active === item.key ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="tl-nav-right">
          <button
            className="tl-nav-search"
            type="button"
            aria-label="Search"
            onClick={() => navigate("/preview/the-line/search")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Search players, events…</span>
            <kbd>⌘K</kbd>
          </button>

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

          <Link to="/login" className="tl-nav-btn">Sign in</Link>

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
                  placeholder="Search players, events…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </form>

            <div className="tl-drawer-nav">
              <Link
                to="/preview/the-line"
                onClick={() => setMenuOpen(false)}
                className={active === "home" ? "active" : ""}
              >
                <span>Home</span>
                <span className="arr">→</span>
              </Link>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={active === item.key ? "active" : ""}
                >
                  <span>{item.label}</span>
                  <span className="arr">→</span>
                </Link>
              ))}
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                <span>Sign in</span>
                <span className="arr">→</span>
              </Link>
            </div>

            <div className="tl-drawer-foot">
              <span className="tl-drawer-foot-label">Appearance</span>
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
          </aside>
        </>
      )}

      {children}

      <footer className="tl-footer">
        <div className="tl-shell">
          <div className="tl-foot-grid">
            <div className="tl-foot-brand">
              <h3>
                <em style={{ fontFamily: "inherit" }}>Pickle</em> Hub
              </h3>
              <p>
                Global coverage of professional pickleball. Headquartered in Ho Chi Minh City,
                reporting from Austin, Naples, Barcelona, Singapore and elsewhere.
              </p>
            </div>
            <div className="tl-foot-col">
              <h4>Watch</h4>
              <ul>
                <li><Link to="/preview/the-line/live">Live courts</Link></li>
                <li><Link to="/preview/the-line/tournaments">Schedule</Link></li>
              </ul>
            </div>
            <div className="tl-foot-col">
              <h4>Compete</h4>
              <ul>
                <li><Link to="/preview/the-line/tournaments">Tournaments</Link></li>
                <li><Link to="/preview/the-line/rankings">Rankings</Link></li>
                <li><Link to="/tools">Bracket tools</Link></li>
              </ul>
            </div>
            <div className="tl-foot-col">
              <h4>Read</h4>
              <ul>
                <li><Link to="/preview/the-line/blog">Stories</Link></li>
                <li><Link to="/news">News</Link></li>
              </ul>
            </div>
          </div>
          <div className="tl-foot-bottom">
            <span>© 2026 The Pickle Hub · Ho Chi Minh City</span>
            <span>Preview · Direction IV · Not final design</span>
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
