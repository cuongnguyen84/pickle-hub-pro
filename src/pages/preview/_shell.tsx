import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import "@/styles/the-line.css";

/* ---------------------------------------------------------------------------
 * Shared chrome for all /preview/the-line/* routes.
 *
 * - Pins data-theme="the-line" on <html> while mounted (cleans up on unmount)
 * - Provides: preview banner, nav, footer, DynamicMeta (noindex)
 * - Children render INSIDE the chrome
 * ------------------------------------------------------------------------- */

export interface PreviewShellProps {
  title: string;
  description?: string;
  active?: "live" | "tournaments" | "rankings" | "stories" | "stats" | "home";
  children: ReactNode;
}

export const PreviewShell = ({ title, description, active, children }: PreviewShellProps) => {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "the-line");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, []);

  return (
    <>
      <DynamicMeta title={title} description={description} noindex />

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
          <Link to="/preview/the-line/live" className={active === "live" ? "active" : ""}>Live</Link>
          <Link to="/preview/the-line/tournaments" className={active === "tournaments" ? "active" : ""}>Tournaments</Link>
          <a className={active === "rankings" ? "active" : ""}>Rankings</a>
          <Link to="/preview/the-line/blog" className={active === "stories" ? "active" : ""}>Stories</Link>
          <a className={active === "stats" ? "active" : ""}>Stats</a>
        </div>

        <div className="tl-nav-right">
          <button className="tl-nav-search" type="button" aria-label="Search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Search players, events…</span>
            <kbd>⌘K</kbd>
          </button>
          <Link to="/login" className="tl-nav-btn">Sign in</Link>
        </div>
      </nav>

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
    </>
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
