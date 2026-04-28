import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useVideos } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { formatRelative } from "./preview/_shell";

type Filter = "all" | "long" | "short";

const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds < 0) return "";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const Videos = () => {
  const { language } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: videos = [], isLoading } = useVideos({ limit: 60 });

  const counts = useMemo(() => ({
    all: videos.length,
    long: videos.filter((v) => v.type === "long").length,
    short: videos.filter((v) => v.type === "short").length,
  }), [videos]);

  const items = useMemo(() => {
    if (filter === "all") return videos;
    return videos.filter((v) => v.type === filter);
  }, [filter, videos]);

  return (
    <TheLineLayout
      title={language === "vi" ? "Video" : "Videos"}
      description={language === "vi"
        ? "Highlights, phỏng vấn và behind-the-scenes — pickleball từ PPA Tour Asia và xa hơn."
        : "Match highlights, interviews, and behind-the-scenes coverage from PPA Tour Asia and beyond."}
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to={language === "vi" ? "/vi" : "/"}>{language === "vi" ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">{language === "vi" ? "Video" : "Videos"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ Courtside</div>
          <h1>
            {language === "vi" ? (
              <>
                Highlights, <em className="tl-serif">phỏng vấn,</em> <br />
                <span className="dim">và</span> <span className="sans">behind the scenes.</span>
              </>
            ) : (
              <>
                Highlights, <em className="tl-serif">interviews,</em> <br />
                <span className="dim">and</span> <span className="sans">behind the scenes.</span>
              </>
            )}
          </h1>
          <p>
            {language === "vi"
              ? "Mọi video pickleball trong một cuộn — từ chung kết đến phỏng vấn sau trận và clip ngắn từ sân."
              : "Every pickleball video in one feed — from finals coverage to post-match interviews and short clips from the court."}
          </p>
        </header>

        <div className="tl-filters">
          {([
            { key: "all", labelEn: "All", labelVi: "Tất cả" },
            { key: "long", labelEn: "Highlights", labelVi: "Highlights" },
            { key: "short", labelEn: "Shorts", labelVi: "Clip ngắn" },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              className={`tl-filter ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {language === "vi" ? f.labelVi : f.labelEn}
              <span className="count">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div style={{ paddingBottom: 80 }}>
          {isLoading ? (
            <div className="tl-empty">
              <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>
                {language === "vi" ? "Đang tải…" : "Loading videos…"}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="tl-empty">
              <h3>{language === "vi" ? "Chưa có video." : "No videos yet."}</h3>
              <p>
                {language === "vi"
                  ? "Quay lại sau — đội ngũ ThePickleHub đăng video mới mỗi tuần."
                  : "Check back soon — the ThePickleHub team publishes new videos every week."}
              </p>
            </div>
          ) : (
            <div className="tl-courtside-grid">
              {items.map((v) => (
                <Link key={v.id} to={`/watch/${v.id}`} className="tl-video-card">
                  <div className="tl-video-thumb">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} loading="lazy" />
                    ) : v.storage_path ? (
                      <video
                        src={supabase.storage.from("videos").getPublicUrl(v.storage_path).data.publicUrl}
                        preload="metadata"
                        muted
                        playsInline
                        aria-label={v.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : null}
                    <div className="tl-video-play-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    {v.duration_seconds ? (
                      <span className="tl-video-duration">{formatDuration(v.duration_seconds)}</span>
                    ) : null}
                  </div>
                  <div className="tl-video-body">
                    <h3 className="tl-video-title">{v.title}</h3>
                    <div className="tl-video-meta">
                      <span>{v.organization?.name ?? ""}</span>
                      {v.published_at && (
                        <>
                          <span>·</span>
                          <span>{formatRelative(v.published_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default Videos;
