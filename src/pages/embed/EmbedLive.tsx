import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useLivestream } from "@/hooks/useSupabaseData";
import { MuxPlayer } from "@/components/video";
import { useIntervalViewCounter } from "@/hooks/useIntervalViewCounter";
import { Loader2 } from "lucide-react";
import { useGeoBlock } from "@/hooks/useGeoBlock";
import { GeoBlockOverlay } from "@/components/video/GeoBlockOverlay";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLivestreamGate } from "@/hooks/useLivestreamGate";
import { PreviewCountdown } from "@/components/video/PreviewCountdown";
import { LivestreamGateOverlay } from "@/components/video/LivestreamGateOverlay";
import { useI18n } from "@/i18n";

const EmbedLive = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isBlocked } = useGeoBlock();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { data: systemSettings } = useSystemSettings();
  const [isPlaying, setIsPlaying] = useState(false);

  const showTitle = searchParams.get("title") !== "0";

  const { data: livestream, isLoading } = useLivestream(id!);

  const isLive = livestream?.status === "live";
  const isEnded = livestream?.status === "ended";

  // Same gate rules as /live/:id — the embed is not a side door. Mirrors the
  // full applies_to branching so a replay stays open when the gate is
  // configured live-only.
  const gateAppliesTo = systemSettings?.livestream_gate_applies_to ?? "all";
  const gateEnabled = !!(
    systemSettings?.require_login_livestream &&
    (gateAppliesTo === "all" ||
      (gateAppliesTo === "live" && isLive) ||
      (gateAppliesTo === "replay" && isEnded))
  );

  const { isGated, secondsRemaining, progress, showCountdown, sessionSeconds } = useLivestreamGate({
    livestreamId: id!,
    surface: "embed",
    previewSeconds: systemSettings?.livestream_preview_seconds ?? 30,
    // Note: inside a third-party iframe Safari partitions storage, so a
    // logged-in first-party session may not be visible here — those viewers
    // see the gate and continue on the first-party tab the CTA opens.
    isEnabled: gateEnabled && !authLoading,
    isAuthenticated: !!user,
    isPlaying,
  });

  // Record view events every 30s, max 20/session (~10 min), embed source —
  // only while actually playing and not gated.
  useIntervalViewCounter({
    targetType: "livestream",
    targetId: id,
    active: isPlaying && !isGated,
    source: "embed",
  });

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!livestream) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/70 text-sm">{t.live.streamNotAvailable}</p>
      </div>
    );
  }

  // Use asset playback ID for ended streams (replay), otherwise use live playback ID
  const playbackId = isEnded && livestream.mux_asset_playback_id
    ? livestream.mux_asset_playback_id
    : livestream.mux_playback_id;

  const hasPlayback = !!playbackId;
  const streamType = isLive ? "live" : "on-demand";

  if (!hasPlayback) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/70 text-sm">{t.live.streamNotAvailable}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen bg-black flex flex-col">
      {/* Video Player - Full screen */}
      <div className="flex-1 relative">
        {showCountdown && <PreviewCountdown secondsRemaining={secondsRemaining} progress={progress} />}
        {isBlocked && <GeoBlockOverlay />}
        {isGated && <LivestreamGateOverlay livestreamId={id!} surface="embed" sessionSeconds={sessionSeconds} />}
        <MuxPlayer
          playbackId={playbackId!}
          title={livestream.title ?? undefined}
          poster={livestream.thumbnail_url ?? undefined}
          streamType={streamType}
          type="livestream"
          isLive={isLive}
          gated={isGated}
          onPlayStateChange={setIsPlaying}
          className="w-full h-full absolute inset-0"
        />
      </div>

      {/* Title bar - optional */}
      {showTitle && (
        <div className="bg-black/90 px-4 py-3 flex items-center gap-3 border-t border-white/10">
          {isLive && (
            <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-semibold rounded uppercase">
              Live
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {livestream.title}
            </p>
            {livestream.organization && (
              <p className="text-white/60 text-xs truncate">
                {livestream.organization.name}
              </p>
            )}
          </div>
          <a
            href={`${window.location.origin}/live/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white text-xs underline"
          >
            Watch on ThePickleHub
          </a>
        </div>
      )}
    </div>
  );
};

export default EmbedLive;
