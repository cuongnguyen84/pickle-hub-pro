import { useEffect, useRef, useState } from "react";
import { MuxPlayer } from "@/components/video";
import type { MuxPlayerHandle } from "@/components/video/MuxPlayer";
import { PreviewCountdown } from "@/components/video/PreviewCountdown";
import { LivestreamGateOverlay } from "@/components/video/LivestreamGateOverlay";
import { GeoBlockOverlay } from "@/components/video/GeoBlockOverlay";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLivestreamGate } from "@/hooks/useLivestreamGate";
import { useGeoBlock } from "@/hooks/useGeoBlock";
import { useIntervalViewCounter } from "@/hooks/useIntervalViewCounter";
import type { Livestream } from "@/hooks/useSupabaseData";

interface HomeLivePlayerProps {
  stream: Livestream;
}

/**
 * Inline live player for the home "Đang trực tiếp" hero. Mirrors the WatchLive
 * player block (Mux + login gate + geo block + preview countdown + view
 * counting) so watching from the homepage obeys the SAME rules — the
 * require_login preview→gate is NOT bypassed. Lazy-loaded from LiveSection so
 * the ~1MB video vendor chunk only loads when a stream is actually live.
 *
 * Tap-to-play (MuxPlayer's default overlay) — no autoplay, so we don't burn
 * mobile data on every homepage visit; the gate countdown only ticks once the
 * viewer chooses to play, exactly like /live.
 */
export default function HomeLivePlayer({ stream }: HomeLivePlayerProps) {
  const { user } = useAuth();
  const { isBlocked } = useGeoBlock();
  const { data: systemSettings } = useSystemSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<MuxPlayerHandle>(null);

  // public_livestreams is a VIEW → every column is typed nullable. LiveSection
  // only mounts this for a real, live row, so id/playback are present.
  const livestreamId = stream.id!;

  const gateAppliesTo = systemSettings?.livestream_gate_applies_to ?? "all";
  const gateEnabled = !!(
    systemSettings?.require_login_livestream &&
    (gateAppliesTo === "all" || gateAppliesTo === "live")
  );

  const { isGated, secondsRemaining, progress, showCountdown } = useLivestreamGate({
    livestreamId,
    previewSeconds: systemSettings?.livestream_preview_seconds ?? 15,
    isEnabled: gateEnabled,
    isAuthenticated: !!user,
    isPlaying,
  });

  // Stop playback the instant the preview window closes.
  useEffect(() => {
    if (isGated) playerRef.current?.pause();
  }, [isGated]);

  // Count homepage watch-time the same way the full page does.
  useIntervalViewCounter({
    targetType: "livestream",
    targetId: livestreamId,
    viewerUserId: user?.id ?? null,
    organizationId: stream.organization_id ?? null,
    isReplay: false,
  });

  const playbackId = stream.mux_playback_id;
  if (!playbackId) return null; // caller renders the thumbnail fallback

  return (
    <div className="tl-live-embed">
      {showCountdown && <PreviewCountdown secondsRemaining={secondsRemaining} progress={progress} />}
      {isBlocked && <GeoBlockOverlay />}
      {isGated && <LivestreamGateOverlay livestreamId={livestreamId} />}
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        title={stream.title ?? undefined}
        poster={stream.thumbnail_url ?? undefined}
        streamType="live"
        type="livestream"
        isLive
        onPlayStateChange={setIsPlaying}
      />
    </div>
  );
}
