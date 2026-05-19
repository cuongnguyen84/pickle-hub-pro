import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useNewsItems } from "@/hooks/useNewsItems";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { formatRelative } from "./preview/_shell";

const News = () => {
  const { language } = useI18n();
  const { data: news = [], isLoading } = useNewsItems({ limit: 60 });
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  // Derive source pill list from data — newest sources first by frequency
  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    news.forEach((n) => {
      if (n.source) counts.set(n.source, (counts.get(n.source) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([source, count]) => ({ source, count }));
  }, [news]);

  const items = useMemo(() => {
    if (!sourceFilter) return news;
    return news.filter((n) => n.source === sourceFilter);
  }, [news, sourceFilter]);

  return (
    <TheLineLayout
      title={language === "vi" ? "Tin tức" : "News"}
      description={language === "vi"
        ? "Cập nhật pickleball hàng ngày — PPA Tour, giải Châu Á, ra mắt thiết bị, ký kết của VĐV."
        : "Daily pickleball updates — PPA Tour, Asian championships, equipment launches, player signings."}
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to={language === "vi" ? "/vi" : "/"}>{language === "vi" ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">{language === "vi" ? "Tin tức" : "News"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ {language === "vi" ? "Đưa tin hàng ngày" : "Daily wire"}</div>
          <h1>
            {language === "vi" ? (
              <>
                Tin pickleball <em className="tl-serif">mỗi ngày,</em> <br />
                <span className="dim">từ mọi</span> <span className="sans">nguồn đáng tin.</span>
              </>
            ) : (
              <>
                Pickleball news, <em className="tl-serif">every day,</em> <br />
                <span className="dim">from every</span> <span className="sans">trusted source.</span>
              </>
            )}
          </h1>
          <p>
            {language === "vi"
              ? "Tổng hợp tin từ PPA Tour, APP, MLP, các giải Châu Á và nhà phát hành thiết bị. Một nơi xem hết."
              : "Aggregated coverage from PPA Tour, APP, MLP, Asian championships, and equipment publishers. One place to scan it all."}
          </p>
        </header>

        {sources.length > 1 && (
          <div className="tl-filters">
            <button
              type="button"
              className={`tl-filter ${sourceFilter === null ? "active" : ""}`}
              onClick={() => setSourceFilter(null)}
            >
              {language === "vi" ? "Tất cả" : "All"}
              <span className="count">{news.length}</span>
            </button>
            {sources.map((s) => (
              <button
                key={s.source}
                type="button"
                className={`tl-filter ${sourceFilter === s.source ? "active" : ""}`}
                onClick={() => setSourceFilter(s.source)}
              >
                {s.source}
                <span className="count">{s.count}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ paddingBottom: 80 }}>
          {isLoading ? (
            <div className="tl-empty">
              <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>
                {language === "vi" ? "Đang tải tin…" : "Loading news…"}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="tl-empty">
              <h3>{language === "vi" ? "Không có tin trong mục này." : "No news in this view."}</h3>
              <p>
                {language === "vi"
                  ? "Thử filter khác hoặc quay lại sau."
                  : "Try a different filter or check back soon."}
              </p>
            </div>
          ) : (
            <div className="tl-news-list">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tl-news-row"
                >
                  <div className="tl-news-row-body">
                    <div className="tl-news-row-kicker">◆ {item.source ?? "Wire"}</div>
                    <h3 className="tl-news-row-title">{item.title}</h3>
                    <p className="tl-news-row-summary">{item.summary}</p>
                    <div className="tl-news-row-meta">
                      <span>{formatRelative(item.published_at)}</span>
                      <span className="sep">·</span>
                      <span>{language === "vi" ? `Đọc tại ${item.source} →` : `Read at ${item.source} →`}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default News;
