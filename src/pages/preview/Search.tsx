import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useLivestreams, useTournaments, useVideos, useOrganizations } from "@/hooks/useSupabaseData";
import { blogMetadata } from "@/content/blog";
import { PreviewShell, formatDate, formatRelative } from "./_shell";

const Search = () => {
  const { language } = useI18n();
  const [params, setParams] = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);

  // Debounce URL update so we don't spam history
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (query.trim()) setParams({ q: query.trim() }, { replace: true });
      else setParams({}, { replace: true });
    }, 200);
    return () => window.clearTimeout(id);
  }, [query, setParams]);

  const q = query.trim().toLowerCase();

  // Source data — fetch everything; we'll filter client-side
  const { data: live = [] } = useLivestreams("live");
  const { data: scheduled = [] } = useLivestreams("scheduled");
  const { data: ended = [] } = useLivestreams("ended");
  const { data: tournaments = [] } = useTournaments();
  const { data: videos = [] } = useVideos({ limit: 60 });
  const { data: organizations = [] } = useOrganizations();

  const results = useMemo(() => {
    if (!q) return null;

    const streamsAll = [...live, ...scheduled, ...ended];
    const streams = streamsAll.filter((s) =>
      s.title?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.organization?.name?.toLowerCase().includes(q)
    ).slice(0, 20);

    const tourns = tournaments.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q)
    ).slice(0, 20);

    const vids = videos.filter((v) =>
      v.title.toLowerCase().includes(q) ||
      v.description?.toLowerCase().includes(q) ||
      v.organization?.name?.toLowerCase().includes(q) ||
      v.tags?.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 20);

    const stories = blogMetadata.filter((p) =>
      p.titleEn.toLowerCase().includes(q) ||
      p.titleVi.toLowerCase().includes(q) ||
      p.metaDescriptionEn.toLowerCase().includes(q) ||
      p.metaDescriptionVi.toLowerCase().includes(q) ||
      p.tags.some((tag) => tag.toLowerCase().includes(q))
    ).slice(0, 20);

    const orgs = organizations.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.slug.toLowerCase().includes(q)
    ).slice(0, 20);

    return { streams, tourns, vids, stories, orgs };
  }, [q, live, scheduled, ended, tournaments, videos, organizations]);

  const totalResults = results
    ? results.streams.length + results.tourns.length + results.vids.length + results.stories.length + results.orgs.length
    : 0;

  return (
    <PreviewShell title={q ? `Search · ${q}` : "Search · Preview"}>
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <span className="current">Search{q ? ` · "${q.slice(0, 32)}"` : ""}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ Search the entire index</div>
          <h1>
            Find a <em className="tl-serif">match,</em> <br />
            a <span className="dim">player,</span> <span className="sans">a story.</span>
          </h1>
          <p>
            One search across livestreams, tournaments, videos, organizations and stories.
            Filters match title, description, tags and player names.
          </p>
        </header>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="tl-search-input"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--tl-fg-3)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search players, tournaments, matches, stories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="tl-icon-btn"
              aria-label="Clear"
              onClick={() => setQuery("")}
              style={{ border: 0, width: 24, height: 24 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          )}
        </form>

        <div style={{ paddingBottom: 80 }}>
          {!q ? (
            <div className="tl-empty">
              <h3>Start typing.</h3>
              <p>Try something like "PPA", "Waters", "Sài Gòn", "bracket" or a tournament slug.</p>
            </div>
          ) : !results || totalResults === 0 ? (
            <div className="tl-empty">
              <h3>No results for "{q}".</h3>
              <p>Try fewer words or check spelling. Search is client-side and matches exact substrings.</p>
            </div>
          ) : (
            <>
              <div className="tl-mono" style={{ fontSize: 12, color: "var(--tl-fg-3)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 32 }}>
                {totalResults} result{totalResults === 1 ? "" : "s"} across 5 categories
              </div>

              {/* Livestreams */}
              {results.streams.length > 0 && (
                <section className="tl-search-group">
                  <div className="tl-search-group-head">
                    <h3>Livestreams</h3>
                    <span className="count">{results.streams.length}</span>
                  </div>
                  <div className="tl-match-grid">
                    {results.streams.map((s) => (
                      <Link key={s.id} to={`/preview/the-line/live/${s.id}`} className="tl-match">
                        <div className="tl-match-head">
                          <span className={`stat ${s.status === "live" ? "live" : s.status === "scheduled" ? "upcoming" : "final"}`}>
                            {s.status === "live" ? "Live" : s.status === "scheduled" ? "Upcoming" : "Replay"}
                          </span>
                          <span className="ctx">{s.organization?.name ?? ""}</span>
                        </div>
                        <h3 className="tl-match-title">{s.title ?? "Match"}</h3>
                        <div className="tl-match-foot">
                          <span className="v">Open →</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Tournaments */}
              {results.tourns.length > 0 && (
                <section className="tl-search-group">
                  <div className="tl-search-group-head">
                    <h3>Tournaments</h3>
                    <span className="count">{results.tourns.length}</span>
                  </div>
                  <div className="tl-list">
                    {results.tourns.map((t) => {
                      const d = formatDate(t.start_date);
                      return (
                        <Link key={t.id} to={`/preview/the-line/tournament/${t.slug}`} className="tl-list-item">
                          <div className="tl-li-date">
                            <span className="d">{d.d}</span>
                            <span className="m">{d.m}</span>
                          </div>
                          <div className="tl-li-body">
                            <h3>{t.name}</h3>
                            <div className="meta">
                              <span>{t.status}</span>
                            </div>
                          </div>
                          <div className="tl-li-right">
                            <span style={{ color: t.status === "ongoing" ? "var(--tl-live)" : "var(--tl-fg-3)" }}>
                              {t.status}
                            </span>
                          </div>
                          <span className="tl-li-arrow">→</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Videos */}
              {results.vids.length > 0 && (
                <section className="tl-search-group">
                  <div className="tl-search-group-head">
                    <h3>Videos</h3>
                    <span className="count">{results.vids.length}</span>
                  </div>
                  <div className="tl-match-grid">
                    {results.vids.map((v) => (
                      <Link key={v.id} to={`/preview/the-line/watch/${v.id}`} className="tl-match">
                        <div className="tl-match-head">
                          <span className="stat final">{v.type?.toUpperCase()}</span>
                          <span className="ctx">{v.organization?.name ?? ""}</span>
                        </div>
                        <h3 className="tl-match-title">{v.title}</h3>
                        <div className="tl-match-foot">
                          <span className="v">Watch →</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Stories */}
              {results.stories.length > 0 && (
                <section className="tl-search-group">
                  <div className="tl-search-group-head">
                    <h3>Stories</h3>
                    <span className="count">{results.stories.length}</span>
                  </div>
                  <div className="tl-blog-grid">
                    {results.stories.map((post) => (
                      <Link key={post.slug} to={`/preview/the-line/blog/${post.slug}`} className="tl-blog-card">
                        <div className="kicker">◆ {post.tags[0] ?? "Story"}</div>
                        <h3>{language === "vi" ? post.titleVi : post.titleEn}</h3>
                        <p>{language === "vi" ? post.metaDescriptionVi : post.metaDescriptionEn}</p>
                        <div className="foot">
                          <b>{post.author}</b>
                          <span>·</span>
                          <span>{formatRelative(post.publishedDate)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Organizations */}
              {results.orgs.length > 0 && (
                <section className="tl-search-group">
                  <div className="tl-search-group-head">
                    <h3>Organizations</h3>
                    <span className="count">{results.orgs.length}</span>
                  </div>
                  <div className="tl-list">
                    {results.orgs.map((o) => (
                      <Link key={o.id} to={`/preview/the-line/org/${o.slug}`} className="tl-list-item">
                        <div className="tl-li-date" style={{ width: 40, height: 40, padding: 0, borderRight: 0 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--tl-surface)", border: "1px solid var(--tl-border)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 18, color: "var(--tl-green)" }}>
                            {o.logo_url ? (
                              <img src={o.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                            ) : (
                              o.name.charAt(0).toUpperCase()
                            )}
                          </div>
                        </div>
                        <div className="tl-li-body">
                          <h3 style={{ fontFamily: "Geist", fontStyle: "normal", fontSize: 17, fontWeight: 500 }}>{o.name}</h3>
                          <div className="meta">
                            {o.description ? <span>{o.description.slice(0, 80)}{o.description.length > 80 ? "…" : ""}</span> : <span>Organization</span>}
                          </div>
                        </div>
                        <span className="tl-li-arrow">→</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </PreviewShell>
  );
};

export default Search;
