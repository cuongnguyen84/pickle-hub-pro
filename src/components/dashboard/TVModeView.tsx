import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
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

export const TVModeView = ({ tournamentName, courts, liveMatches, nextMatches, onExit }: TVModeViewProps) => {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  // Build slides
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

  const totalSlides = slides.length || 1;

  // Auto rotate
  useEffect(() => {
    if (!autoRotate || totalSlides <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRotate, totalSlides]);

  const goNext = useCallback(() => setCurrentIndex((p) => (p + 1) % totalSlides), [totalSlides]);
  const goPrev = useCallback(() => setCurrentIndex((p) => (p - 1 + totalSlides) % totalSlides), [totalSlides]);

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

  const slide = slides[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/50">
        <h1 className="text-2xl md:text-4xl font-bold truncate">{tournamentName}</h1>
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
          <span className="text-sm text-white/60">
            {currentIndex + 1} / {totalSlides}
          </span>
          <Button variant="ghost" size="icon" onClick={onExit} className="text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-8">
        {slide?.type === "court" && slide.courtData && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-3xl md:text-5xl font-bold">
                {t.dashboard.court} {slide.courtData.courtNumber}
              </h2>
              {slide.courtData.liveMatch && (
                <Badge variant="destructive" className="animate-pulse text-base px-3 py-1">LIVE</Badge>
              )}
            </div>

            {slide.courtData.liveMatch ? (
              <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                <div className="text-sm text-white/50 mb-4">{t.dashboard.nowPlaying}</div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-2xl md:text-4xl font-bold flex-1">{slide.courtData.liveMatch.teamA}</span>
                  <div className="flex items-center gap-3 text-4xl md:text-6xl font-bold tabular-nums">
                    <span>{slide.courtData.liveMatch.scoreA ?? 0}</span>
                    <span className="text-white/30">:</span>
                    <span>{slide.courtData.liveMatch.scoreB ?? 0}</span>
                  </div>
                  <span className="text-2xl md:text-4xl font-bold flex-1 text-right">{slide.courtData.liveMatch.teamB}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-2xl text-white/30">{t.dashboard.available}</div>
            )}

            {slide.courtData.nextMatch && (
              <div className="mt-6 bg-white/5 rounded-xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/50">{t.dashboard.nextMatch}</span>
                  {slide.courtData.nextMatch.startTime && (
                    <span className="text-sm text-white/50">{slide.courtData.nextMatch.startTime}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xl font-semibold">{slide.courtData.nextMatch.teamA}</span>
                  <span className="text-white/30">{t.dashboard.vs}</span>
                  <span className="text-xl font-semibold text-right">{slide.courtData.nextMatch.teamB}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {slide?.type === "match" && slide.matchData && (
          <div className="w-full max-w-2xl">
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              {slide.matchData.status === "live" || slide.matchData.status === "in_progress" ? (
                <Badge variant="destructive" className="animate-pulse text-base px-3 py-1 mb-4">LIVE</Badge>
              ) : (
                <span className="text-sm text-white/50 mb-4 block">{t.dashboard.upNext}</span>
              )}
              <div className="flex items-center justify-between gap-4">
                <span className="text-2xl md:text-4xl font-bold flex-1">{slide.matchData.teamA}</span>
                <div className="flex items-center gap-3 text-4xl md:text-6xl font-bold tabular-nums">
                  <span>{slide.matchData.scoreA ?? 0}</span>
                  <span className="text-white/30">:</span>
                  <span>{slide.matchData.scoreB ?? 0}</span>
                </div>
                <span className="text-2xl md:text-4xl font-bold flex-1 text-right">{slide.matchData.teamB}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      {totalSlides > 1 && (
        <>
          <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dots */}
      {totalSlides > 1 && (
        <div className="flex justify-center gap-2 pb-6">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${i === currentIndex ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
