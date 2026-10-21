import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useLivestreams } from "@/hooks/useSupabaseData";
import type { Livestream } from "@/hooks/useSupabaseData";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { ErrorState } from "@/components/states/PageStates";
import { formatTime, formatRelative } from "@/lib/format-datetime";
import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { WorldCupLiveBoard } from "@/components/live/WorldCupLiveBoard";
import { ProTourEventsStrip } from "@/components/live/ProTourEventsStrip";
import { wcResultsPath, wcResultsLabel } from "@/lib/wc-results";

// Replays are hidden from the hub on purpose (16/09) — the ended streams
// still play at /live/<id>, they are just no longer listed or counted here.
type Filter = "all" | "live" | "scheduled";

interface MatchCardProps {
  stream: Livestream;
  language: "en" | "vi";
}

/* Inner card so each row gets its own onError fallback state without
   leaking imgFailed into the page-level component. */
const MatchCard = ({ stream, language }: MatchCardProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = stream.thumbnail_url && !imgFailed;

  const overlay =
    stream.status === "live" ? (
      <span className="tl-match-thumb-overlay live">{language === "vi" ? "Trực tiếp" : "Live"}</span>
    ) : stream.status === "scheduled" ? (
      <span className="tl-match-thumb-overlay upcoming">
        ● {language === "vi" ? "Sắp diễn ra" : "Scheduled"}
      </span>
    ) : (
      <span className="tl-match-thumb-overlay replay">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        {language === "vi" ? "Replay" : "Replay"}
      </span>
    );

  const head =
    stream.status === "live" ? (
      <div className="tl-match-head">
        <span className="stat live">{language === "vi" ? "Trực tiếp" : "Live"}</span>
        <span className="ctx">
          {stream.started_at ? formatTime(stream.started_at) : language === "vi" ? "Đang sóng" : "On air"}
        </span>
      </div>
    ) : stream.status === "scheduled" ? (
      <div className="tl-match-head">
        <span className="stat upcoming">● {language === "vi" ? "Sắp diễn ra" : "Scheduled"}</span>
        <span className="ctx">{formatRelative(stream.scheduled_start_at, language)}</span>
      </div>
    ) : (
      <div className="tl-match-head">
        <span className="stat final">{language === "vi" ? "Replay" : "Replay"}</span>
        <span className="ctx">
          {stream.ended_at ? formatRelative(stream.ended_at, language) : language === "vi" ? "Đã kết thúc" : "Ended"}
        </span>
      </div>
    );

  return (
    <Link to={`/live/${stream.id}`} className="tl-match">
      <div className="tl-match-thumb">
        {showImg ? (
          <img
            src={stream.thumbnail_url!}
            alt={stream.title ?? ""}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="tl-match-thumb-placeholder" aria-hidden="true" />
        )}
        {overlay}
      </div>
      <div className="tl-match-body">
        {head}
        <h3 className="tl-match-title">
          {stream.title ?? (language === "vi" ? "Trận chưa có tên" : "Untitled match")}
        </h3>
        <div className="tl-match-foot">
          <span className="org">{stream.organization?.name ?? (language === "vi" ? "Phát sóng" : "Broadcast")}</span>
          <span className="v">
            {stream.status === "live"
              ? language === "vi" ? "Xem →" : "Watch →"
              : stream.status === "scheduled"
              ? language === "vi" ? "Nhắc tôi →" : "Notify →"
              : language === "vi" ? "Replay →" : "Replay →"}
          </span>
        </div>
      </div>
    </Link>
  );
};

const Live = () => {
  const { language } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");

  const liveQuery = useLivestreams("live");
  const schedQuery = useLivestreams("scheduled");

  const { data: live = [], isLoading: liveLoading } = liveQuery;
  const { data: scheduled = [], isLoading: schedLoading } = schedQuery;

  // Any of the three failing means the counts and the list are wrong, not
  // empty. Without this the `= []` defaults render "no matches in this view"
  // during an outage — telling the viewer nothing is on when the truth is we
  // could not ask (DS-04; the PGRST002 outages made this concrete).
  const isError = liveQuery.isError || schedQuery.isError;
  const refetchAll = () => {
    void liveQuery.refetch();
    void schedQuery.refetch();
  };

  const queryClient = useQueryClient();
  const ptrState = usePullToRefresh(async () => {
    await queryClient.invalidateQueries();
  });

  const counts = {
    all: live.length + scheduled.length,
    live: live.length,
    scheduled: scheduled.length,
  };

  const isLoading = liveLoading || schedLoading;

  const items = useMemo(() => {
    switch (filter) {
      case "live": return live;
      case "scheduled": return scheduled;
      default: return [...live, ...scheduled];
    }
  }, [filter, live, scheduled]);

  // Match head + thumbnail rendering moved into <MatchCard /> at top of file.

  return (
    <TheLineLayout
      title={language === "vi" ? "Sân trực tiếp" : "Live courts"}
      description={language === "vi"
        ? "Trận đấu pickleball đang phát sóng và lịch sắp tới."
        : "Pickleball matches streaming right now and upcoming within 24 hours."}
      active="live"
    >
      <PullToRefreshIndicator state={ptrState} />
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to={language === "vi" ? "/vi" : "/"}>{language === "vi" ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">{language === "vi" ? "Sân trực tiếp" : "Live courts"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ {language === "vi" ? "Mục lục phát sóng" : "Live broadcast index"}</div>
          <h1>
            {language === "vi" ? (
              <>
                Mọi sân, <br />
                <span className="dim">mọi bracket,</span> <br />
                <span className="sans">một màn hình.</span>
              </>
            ) : (
              <>
                Every court, <br />
                <span className="dim">every bracket,</span> <br />
                <span className="sans">on one screen.</span>
              </>
            )}
          </h1>
          <p>
            {language === "vi"
              ? "Trận đang phát sóng và sắp diễn ra trong 24h tới. Pull thẳng từ DB — không cache."
              : "Matches streaming right now and upcoming within the next 24 hours. Pulled live from the database — no cache."}
          </p>
        </header>

        {/* World Cup 2026 board — two-level tabs: Cá nhân Pro / Đội tuyển,
            the Pro tab split by event. Self-hides when both feeds are empty,
            self-retires after Sep 7. Above the filters because during the World
            Cup it is why most visitors are on /live. */}
        <WorldCupLiveBoard language={language} />

        {/* Pro-tour tournaments in season (registry-driven, zero requests) —
            cards linking to /live/pro/<slug>. Self-hides out of season. */}
        <ProTourEventsStrip language={language} />

        {/* Kết quả World Cup 2026 — giải đã xong nhưng đây vẫn là trang kết quả
            chính, nên link sống tiếp sau khi WorldCupLiveBoard tự rút lui. */}
        <p style={{ margin: "0 0 24px" }}>
          <Link to={wcResultsPath(language)} className="tl-btn">
            {wcResultsLabel(language)} →
          </Link>
        </p>

        {/* Counts come from the same `= []` defaults the body no longer trusts:
            rendering "Live 0 · Replays 0" directly above a network error is the
            same fabricated zero, just in smaller type. Filtering nothing is
            pointless during an outage, so the whole row goes.
            Unmounted rather than `hidden`: `.tl-filters` sets display:flex from
            the author stylesheet, which beats the UA `[hidden]` rule — the row
            would have stayed on screen while disappearing from the a11y tree
            (and from the test that checks it). */}
        {!isError && (
        <div className="tl-filters">
          {([
            { key: "all", labelEn: "All", labelVi: "Tất cả" },
            { key: "live", labelEn: "Live", labelVi: "Trực tiếp" },
            { key: "scheduled", labelEn: "Upcoming", labelVi: "Sắp tới" },
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
        )}

        <div style={{ paddingBottom: 80 }}>
          {isLoading ? (
            <div className="tl-empty">
              <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>
                {language === "vi" ? "Đang tải…" : "Loading live courts…"}
              </p>
            </div>
          ) : isError ? (
            <ErrorState onRetry={refetchAll} />
          ) : items.length === 0 ? (
            <div className="tl-empty">
              <h3>{language === "vi" ? "Không có trận trong mục này." : "No matches in this view."}</h3>
              <p>
                {language === "vi"
                  ? "Thử filter khác. Sân chỉ sáng đèn khi có giải đang diễn ra — xem lịch sắp tới."
                  : "Try a different filter. Live courts light up during active tournaments — check the schedule for what's coming up."}
              </p>
              <Link to="/tournaments" className="tl-btn">
                {language === "vi" ? "Xem lịch giải →" : "See tournament schedule →"}
              </Link>
            </div>
          ) : (
            <div className="tl-match-grid">
              {items.slice(0, 24).map((stream) => (
                <MatchCard key={stream.id} stream={stream} language={language} />
              ))}
            </div>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default Live;
