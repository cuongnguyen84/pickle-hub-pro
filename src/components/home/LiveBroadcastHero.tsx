import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Livestream } from "@/hooks/useSupabaseData";
import { useLivePresence } from "@/hooks/useLivePresence";

/**
 * Bold broadcast-style hero card for the homepage live/upcoming match.
 *
 * Two visual states, both rendered as dark inverted cards on the cream
 * page background to maximize contrast against the rest of the editorial
 * layout. The card is the second-most-important visual on the homepage
 * after the typographic hero title — and on mobile it should feel like a
 * mini stadium scoreboard, not a list row.
 *
 *   LIVE      → red pulse, on-air timecode ticker, scanline sweep,
 *               full-width green WATCH NOW CTA.
 *   SCHEDULED → outlined dot, big italic-serif HH:MM:SS countdown,
 *               "Notify me" outlined CTA.
 *   ENDED     → muted, replay CTA. (Not the primary use case but
 *               supported because `featured` may surface ended broadcasts
 *               when nothing is live or scheduled.)
 *
 * Title parsing: most match titles in the DB follow the convention
 * "Round | Player A, Player B | Tournament" — we split on " | " to give
 * the players their own larger line. Falls back to the raw title if the
 * split doesn't yield 2+ parts.
 */

interface Props {
  featured: Livestream | null;
  language: "en" | "vi";
  tournamentName: string | null;
  isLoading?: boolean;
}

interface ParsedTitle {
  round: string | null;
  players: string;
  /** secondary line — e.g. "Quarterfinal" or tournament short name */
  context: string | null;
}

const parseTitle = (raw: string | null | undefined): ParsedTitle => {
  if (!raw) return { round: null, players: "", context: null };
  const cleaned = raw.replace(/^[<\[].+?[>\]]\s*/, "").trim();
  const parts = cleaned.split(/\s*\|\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return { round: parts[0], players: parts[1], context: parts[2] ?? null };
  }
  return { round: null, players: cleaned, context: null };
};

const formatHMS = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatEndedLabel = (endedAt: string | null | undefined, lang: "en" | "vi"): string => {
  if (!endedAt) return lang === "vi" ? "ĐÃ KẾT THÚC" : "ENDED";
  const diff = Date.now() - new Date(endedAt).getTime();
  if (Number.isNaN(diff) || diff < 0) return lang === "vi" ? "ĐÃ KẾT THÚC" : "ENDED";
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3600_000);
  const days = Math.floor(diff / 86400_000);
  const isVi = lang === "vi";
  if (mins < 1) return isVi ? "VỪA KẾT THÚC" : "JUST ENDED";
  if (mins < 60) return isVi ? `VỪA KẾT THÚC · ${mins} PHÚT` : `JUST ENDED · ${mins}M AGO`;
  if (hrs < 24) return isVi ? `KẾT THÚC · ${hrs} GIỜ TRƯỚC` : `ENDED · ${hrs}H AGO`;
  return isVi ? `KẾT THÚC · ${days} NGÀY TRƯỚC` : `ENDED · ${days}D AGO`;
};

/* ──────────────── ON-AIR TIMECODE (counts up from started_at) ──────────────── */
const OnAirTicker = ({ startedAt }: { startedAt: string | null | undefined }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!startedAt) return <span>LIVE</span>;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return <span>LIVE</span>;
  return <span>{formatHMS((now - start) / 1000)}</span>;
};

/* ──────────────── SCHEDULED COUNTDOWN (HH:MM:SS) ──────────────── */
const CountdownBig = ({ to, language }: { to: string; language: "en" | "vi" }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const target = new Date(to).getTime();
    if (Number.isNaN(target)) return;
    const diff = target - Date.now();
    const intervalMs = Math.abs(diff) > 3600_000 ? 1000 : 1000;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [to]);

  const target = new Date(to).getTime();
  if (Number.isNaN(target)) return null;
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins = Math.floor((diff % 3600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  const live = diff === 0;

  const labels = language === "vi"
    ? { d: "NGÀY", h: "GIỜ", m: "PHÚT", s: "GIÂY", live: "BẮT ĐẦU" }
    : { d: "DAYS", h: "HOURS", m: "MINS", s: "SECS", live: "STARTING" };

  if (live) {
    return (
      <div className="tl-lh-countdown live">
        <span className="tl-lh-cd-num">●</span>
        <span className="tl-lh-cd-lbl">{labels.live}</span>
      </div>
    );
  }

  return (
    <div className="tl-lh-countdown">
      {days > 0 && (
        <div className="tl-lh-cd-cell">
          <span className="tl-lh-cd-num">{days}</span>
          <span className="tl-lh-cd-lbl">{labels.d}</span>
        </div>
      )}
      <div className="tl-lh-cd-cell">
        <span className="tl-lh-cd-num">{hours.toString().padStart(2, "0")}</span>
        <span className="tl-lh-cd-lbl">{labels.h}</span>
      </div>
      <div className="tl-lh-cd-cell">
        <span className="tl-lh-cd-num">{mins.toString().padStart(2, "0")}</span>
        <span className="tl-lh-cd-lbl">{labels.m}</span>
      </div>
      <div className="tl-lh-cd-cell">
        <span className="tl-lh-cd-num">{secs.toString().padStart(2, "0")}</span>
        <span className="tl-lh-cd-lbl">{labels.s}</span>
      </div>
    </div>
  );
};

export function LiveBroadcastHero({ featured, language, tournamentName, isLoading }: Props) {
  // Live concurrent viewer count via Supabase Presence. Only enabled when
  // there's a live match featured — Presence spins up a Realtime channel
  // and tracks this user as a viewer, so the homepage hero participates
  // in the same count as the watch page itself.
  const { concurrentViewers } = useLivePresence(
    featured?.id ?? "",
    Boolean(featured && featured.status === "live"),
  );

  if (isLoading && !featured) {
    return (
      <div className="tl-live-hero loading" aria-busy="true">
        <div className="tl-lh-sk-bar">
          <span className="tl-lh-sk sk-status" />
          <span className="tl-lh-sk sk-tc" />
        </div>
        <span className="tl-lh-sk sk-kicker" />
        <div className="tl-lh-sk-title">
          <span className="tl-lh-sk sk-round" />
          <span className="tl-lh-sk sk-players" />
        </div>
        <span className="tl-lh-sk sk-cta" />
      </div>
    );
  }

  if (!featured) {
    // No featured live broadcast → surface the DUPR partnership card in the
    // hero slot instead of an empty "no broadcast" placeholder. The card
    // links through to /dupr for users who want to connect their account.
    // Position-wise this keeps the hero balanced on desktop (right column
    // companion to the editorial title) and stacks full-width on mobile.
    const partnerAlt =
      language === "vi"
        ? "ThePickleHub × DUPR — Đối tác chính thức"
        : "ThePickleHub × DUPR — Official Partner";
    return (
      <Link
        to="/dupr"
        aria-label={partnerAlt}
        className="tl-live-hero tl-dupr-partner-card group block overflow-hidden rounded-md ml-auto w-[58%] max-w-[260px] md:w-full md:max-w-none md:ml-0"
        style={{ padding: 0, background: "transparent", border: "none" }}
      >
        <img
          src="/images/partnerships/dupr-card.png"
          alt={partnerAlt}
          width={1200}
          height={1200}
          loading="eager"
          fetchPriority="high"
          className="block h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.015]"
        />
      </Link>
    );
  }

  const parsed = parseTitle(featured.title);
  const isLive = featured.status === "live";
  const isScheduled = featured.status === "scheduled";
  const isEnded = featured.status === "ended";

  const tournamentLabel =
    tournamentName
    ?? featured.organization?.name
    ?? (language === "vi" ? "Phát sóng" : "Live broadcast");

  return (
    <article
      className={`tl-live-hero ${isLive ? "is-live" : isScheduled ? "is-scheduled" : "is-ended"}`}
    >
      {/* TOP STATUS BAR */}
      <header className="tl-lh-bar">
        <div className="tl-lh-status">
          {isLive ? (
            <>
              <span className="tl-lh-pulse" aria-hidden="true" />
              <span className="tl-lh-status-label">{language === "vi" ? "ĐANG PHÁT" : "ON AIR"}</span>
            </>
          ) : isScheduled ? (
            <>
              <span className="tl-lh-ring" aria-hidden="true" />
              <span className="tl-lh-status-label">{language === "vi" ? "SẮP DIỄN RA" : "SCHEDULED"}</span>
            </>
          ) : (
            <>
              <span className="tl-lh-replay-ico" aria-hidden="true">▷</span>
              <span className="tl-lh-status-label">{language === "vi" ? "REPLAY" : "REPLAY"}</span>
            </>
          )}
        </div>
        <div className="tl-lh-meta">
          {isLive && concurrentViewers > 0 && (
            <span className="tl-lh-viewers" aria-label={
              language === "vi"
                ? `${concurrentViewers} người đang xem`
                : `${concurrentViewers} watching now`
            }>
              <span className="tl-lh-eye" aria-hidden="true">◉</span>
              <span className="tl-lh-viewers-num">{concurrentViewers.toLocaleString("en-US")}</span>
              <span className="tl-lh-viewers-lbl">
                {language === "vi" ? "ĐANG XEM" : "WATCHING"}
              </span>
            </span>
          )}
          <div className="tl-lh-timecode">
            {isLive && featured.started_at ? (
              <OnAirTicker startedAt={featured.started_at} />
            ) : isScheduled && featured.scheduled_start_at ? (
              <span>
                {language === "vi" ? "TRONG" : "STARTS IN"}
              </span>
            ) : isEnded ? (
              <span>{formatEndedLabel(featured.ended_at, language)}</span>
            ) : null}
          </div>
        </div>
        <span className="tl-lh-scanline" aria-hidden="true" />
      </header>

      {/* TOURNAMENT CONTEXT (small kicker) */}
      <div className="tl-lh-kicker">
        <span className="tl-lh-kicker-mark" aria-hidden="true">◆</span>
        <span>{tournamentLabel}</span>
      </div>

      {/* MATCH TITLE — players big italic serif */}
      <div className="tl-lh-title">
        {parsed.round && (
          <div className="tl-lh-round">{parsed.round}</div>
        )}
        <h2 className="tl-lh-players">
          <em>{parsed.players}</em>
        </h2>
      </div>

      {/* COUNTDOWN (scheduled only) */}
      {isScheduled && featured.scheduled_start_at && (
        <CountdownBig to={featured.scheduled_start_at} language={language} />
      )}

      {/* CTA — full-width */}
      <div className="tl-lh-cta">
        {isLive ? (
          <Link to={`/live/${featured.id}`} className="tl-lh-btn primary live">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            <span>{language === "vi" ? "XEM NGAY" : "WATCH NOW"}</span>
            <span className="tl-lh-btn-arrow" aria-hidden="true">→</span>
          </Link>
        ) : isScheduled ? (
          <Link to={`/live/${featured.id}`} className="tl-lh-btn outlined">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" />
            </svg>
            <span>{language === "vi" ? "NHẮC TÔI" : "NOTIFY ME"}</span>
          </Link>
        ) : (
          <Link to={`/live/${featured.id}`} className="tl-lh-btn outlined">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            <span>{language === "vi" ? "XEM REPLAY" : "WATCH REPLAY"}</span>
          </Link>
        )}
      </div>

      {/* AMBIENT GLOW */}
      <span className="tl-lh-glow" aria-hidden="true" />
    </article>
  );
}
