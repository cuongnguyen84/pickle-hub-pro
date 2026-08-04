import { Link } from "react-router-dom";
import type { NewsItem } from "@/hooks/useNewsItems";
import { homepageThumbnailUrl } from "@/lib/image-utils";

interface HomeNewsFeedProps {
  language: "en" | "vi";
  limit?: number;
  news: NewsItem[];
  isLoading?: boolean;
}

/**
 * "Tin mới" block on the home feed — reuses the published news_items the
 * Bảng tin (/news) page reads from, newest first, capped at `limit`.
 *
 * Each row links to the internal article (/news/:slug or /vi/news/:slug),
 * so items without a slug (external-only aggregations) are filtered out to
 * guarantee every tap lands on a detail page. We over-fetch a little to
 * still fill `limit` rows after that filter.
 */
const relativeTime = (iso: string, language: "en" | "vi"): string => {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  const isVi = language === "vi";
  if (diffMin < 1) return isVi ? "vừa xong" : "just now";
  if (diffMin < 60) return isVi ? `${diffMin} phút trước` : `${diffMin}m ago`;
  const hrs = Math.round(diffMin / 60);
  if (hrs < 24) return isVi ? `${hrs} giờ trước` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return isVi ? "Hôm qua" : "Yesterday";
  if (days < 7) return isVi ? `${days} ngày trước` : `${days}d ago`;
  return new Date(ts).toLocaleDateString(isVi ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
  });
};

export function HomeNewsFeed({ language, limit = 4, news, isLoading = false }: HomeNewsFeedProps) {
  const items = news.filter((item) => item.slug).slice(0, limit);
  if (items.length === 0 && !isLoading) return null;

  const allHref = language === "vi" ? "/vi/news" : "/news";
  const detailHref = (slug: string) =>
    language === "vi" ? `/vi/news/${slug}` : `/news/${slug}`;

  return (
    <section className="tl-section tl-news-sec tl-deferred-section" aria-labelledby="home-news-heading">
      <div className="tl-shell">
        <div className="tl-sec-head">
          <h2 id="home-news-heading">
            {language === "vi" ? (
              <>
                Tin <em className="tl-serif">mới.</em>
              </>
            ) : (
              <>
                Latest <em className="tl-serif">news.</em>
              </>
            )}
          </h2>
          <Link to={allHref} className="tl-news-all">
            {language === "vi" ? "Bảng tin →" : "All news →"}
          </Link>
        </div>

        <div className="tl-news-list" aria-busy={isLoading || undefined}>
          {isLoading
            ? Array.from({ length: limit }, (_, index) => (
                <div className="tl-news-item tl-news-item--skeleton" key={index} aria-hidden="true">
                  <div className="tl-news-body">
                    <span className="tl-feed-skeleton tl-feed-skeleton--eyebrow" />
                    <span className="tl-feed-skeleton tl-feed-skeleton--title" />
                    <span className="tl-feed-skeleton tl-feed-skeleton--meta" />
                  </div>
                  <div className="tl-news-thumb tl-feed-skeleton" />
                </div>
              ))
            : items.map((item) => {
            const thumbnail = homepageThumbnailUrl(item.image_url, {
              width: 168,
              height: 168,
              quality: 70,
            });
            return (
              <Link
                key={item.id}
                to={detailHref(item.slug as string)}
                className="tl-news-item"
              >
                <div className="tl-news-body">
                  {item.source && (
                    <span className="tl-news-cat">{item.source}</span>
                  )}
                  <h3 className="tl-news-title">{item.title}</h3>
                  <span className="tl-news-time">
                    {relativeTime(item.published_at, language)}
                  </span>
                </div>
                <div className="tl-news-thumb">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      width={84}
                      height={84}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                </div>
              </Link>
            );
              })}
        </div>
      </div>
    </section>
  );
}
