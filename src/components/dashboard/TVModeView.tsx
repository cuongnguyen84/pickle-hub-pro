import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, RotateCw } from "lucide-react";
import type { CourtData } from "@/hooks/useDashboardData";

interface TVSlide {
  type: "court" | "match";
  courtData?: CourtData;
  matchData?: { teamA: string; teamB: string; scoreA: number | null; scoreB: number | null; status: string };
}

interface TVModeViewProps {
  tournamentName: string;
  courts: CourtData[];
  liveMatches?: Array<{ teamA: string; teamB: string; scoreA: number | null; scoreB: number | null; status: string }>;
  nextMatches?: Array<{ teamA: string; teamB: string; scoreA: number | null; scoreB: number | null; status: string }>;
  onExit: () => void;
}

const ITEMS_PER_PAGE = 6;

export const TVModeView = ({ tournamentName, courts, liveMatches, nextMatches, onExit }: TVModeViewProps) => {
  const { t } = useI18n();
  const [currentPage, setCurrentPage] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  // Build all slides
  const slides: TVSlide[] = [];
  if (courts.length > 0) {
    courts.forEach((c) => slides.push({ type: "court", courtData: c }));
  }
  if (liveMatches) {
    liveMatches.forEach((m) => slides.push({ type: "match", matchData: m }));
  }
  if (nextMatches) {
    nextMatches.forEach((m) => slides.push({ type: "match", matchData: m }));
  }

  // Paginate into groups
  const totalPages = Math.max(1, Math.ceil(slides.length / ITEMS_PER_PAGE));

  // Auto rotate pages
  useEffect(() => {
    if (!autoRotate || totalPages <= 1) return;
    const timer = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRotate, totalPages]);

  const goNext = useCallback(() => setCurrentPage((p) => (p + 1) % totalPages), [totalPages]);
  const goPrev = useCallback(() => setCurrentPage((p) => (p - 1 + totalPages) % totalPages), [totalPages]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === " ") { e.preventDefault(); setAutoRotate((p) => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit, goNext, goPrev]);

  const pageSlides = slides.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  // Determine grid cols based on item count
  const gridCols = pageSlides.length <= 2 ? "grid-cols-1 sm:grid-cols-2" 
    : pageSlides.length <= 4 ? "grid-cols-2" 
    : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/50 shrink-0">
        <h1 className="text-xl md:text-3xl font-bold truncate">{tournamentName}</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRotate((p) => !p)}
            className="text-white hover:bg-white/10"
          >
            <RotateCw className={`w-4 h-4 mr-1 ${autoRotate ? "animate-spin" : ""}`} />
            {t.dashboard.autoRotate}
          </Button>
          {totalPages > 1 && (
            <span className="text-sm text-white/60">
              {currentPage + 1} / {totalPages}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={onExit} className="text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4">
        {slides.length === 0 ? (
          <div className="flex items-center justify-center h-full text-2xl text-white/30">
            {t.dashboard.noActiveTournaments}
          </div>
        ) : (
          <div className={`grid ${gridCols} gap-4 h-full auto-rows-fr`}>
            {pageSlides.map((slide, i) => (
              <TVCard key={`${currentPage}-${i}`} slide={slide} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Dots */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pb-4 shrink-0">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${i === currentPage ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function TVCard({ slide, t }: { slide: TVSlide; t: any }) {
  if (slide.type === "court" && slide.courtData) {
    const court = slide.courtData;
    return (
      <div className="bg-white/5 rounded-2xl p-6 md:p-8 border border-white/10 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl md:text-3xl font-bold">
            {t.dashboard.court} {court.courtNumber}
          </h2>
          {court.liveMatch && (
            <Badge variant="destructive" className="animate-pulse text-sm px-3 py-1">LIVE</Badge>
          )}
        </div>

        {court.liveMatch ? (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-sm text-white/50 mb-3">{t.dashboard.nowPlaying}</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xl md:text-3xl font-bold flex-1 truncate">{court.liveMatch.teamA}</span>
              <div className="flex items-center gap-3 text-4xl md:text-6xl font-bold tabular-nums">
                <span>{court.liveMatch.scoreA ?? 0}</span>
                <span className="text-white/30">:</span>
                <span>{court.liveMatch.scoreB ?? 0}</span>
              </div>
              <span className="text-xl md:text-3xl font-bold flex-1 text-right truncate">{court.liveMatch.teamB}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xl text-white/30">
            {t.dashboard.available}
          </div>
        )}

        {court.nextMatch && (
          <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white/50">{t.dashboard.nextMatch}</span>
              {court.nextMatch.startTime && (
                <span className="text-sm text-white/50">{court.nextMatch.startTime}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-base md:text-lg font-semibold truncate">{court.nextMatch.teamA}</span>
              <span className="text-white/30 text-sm">{t.dashboard.vs}</span>
              <span className="text-base md:text-lg font-semibold text-right truncate">{court.nextMatch.teamB}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (slide.type === "match" && slide.matchData) {
    const match = slide.matchData;
    const isLive = match.status === "live" || match.status === "in_progress";
    return (
      <div className="bg-white/5 rounded-2xl p-6 md:p-8 border border-white/10 flex flex-col justify-center">
        {isLive ? (
          <Badge variant="destructive" className="animate-pulse text-sm px-3 py-1 w-fit mb-4">LIVE</Badge>
        ) : (
          <span className="text-sm text-white/50 mb-4 block">{t.dashboard.upNext}</span>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl md:text-3xl font-bold flex-1 truncate">{match.teamA}</span>
          <div className="flex items-center gap-3 text-4xl md:text-6xl font-bold tabular-nums">
            <span>{match.scoreA ?? 0}</span>
            <span className="text-white/30">:</span>
            <span>{match.scoreB ?? 0}</span>
          </div>
          <span className="text-xl md:text-3xl font-bold flex-1 text-right truncate">{match.teamB}</span>
        </div>
      </div>
    );
  }

  return null;
}
