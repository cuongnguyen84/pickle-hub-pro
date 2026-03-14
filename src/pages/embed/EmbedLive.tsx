import { useParams, useSearchParams } from "react-router-dom";
import { useLivestream } from "@/hooks/useSupabaseData";
import { MuxPlayer, HlsPlayer, AdaptiveVideoPlayer } from "@/components/video";
import { supabase } from "@/integrations/supabase/client";
import { useIntervalViewCounter } from "@/hooks/useIntervalViewCounter";
import { Loader2 } from "lucide-react";
import { useGeoBlock } from "@/hooks/useGeoBlock";
import { GeoBlockOverlay } from "@/components/video/GeoBlockOverlay";

const EmbedLive = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isBlocked } = useGeoBlock();

  const showTitle = searchParams.get("title") !== "0";
  const autoplay = searchParams.get("autoplay") === "1";

  const { data: livestream, isLoading } = useLivestream(id!);

  // Record view events every 3 seconds with embed source
  useIntervalViewCounter({
    targetType: "livestream",
    targetId: id,
    viewerUserId: null,
    organizationId: livestream?.organization_id ?? null,
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
        <p className="text-white/70 text-sm">Stream not available</p>
      </div>
    );
  }

  const isLive = livestream.status === "live";
  const isEnded = livestream.status === "ended";

  // Determine player type based on streaming_provider
  const streamingProvider = (livestream as any).streaming_provider as string | null;
  const useHls = streamingProvider === "antmedia" || streamingProvider === "red5";
  const hlsUrl = (livestream as any).hls_url as string | null;
  const vodUrl = (livestream as any).vod_url as string | null;
  const antMediaReplayUrl = isEnded && vodUrl ? vodUrl : null;
  
  // Use asset playback ID for ended streams (replay), otherwise use live playback ID
  const playbackId = isEnded && livestream.mux_asset_playback_id 
    ? livestream.mux_asset_playback_id 
    : livestream.mux_playback_id;
    
  const hasPlayback = useHls ? (isEnded ? !!antMediaReplayUrl : !!hlsUrl) : !!playbackId;
  const streamType = isLive ? "live" : "on-demand";

  if (!hasPlayback) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/70 text-sm">Stream not available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen bg-black flex flex-col">
      {/* Video Player - Full screen */}
      <div className="flex-1 relative">
        {isBlocked && <GeoBlockOverlay />}
        {useHls ? (
          antMediaReplayUrl ? (
            <AdaptiveVideoPlayer
              src={antMediaReplayUrl}
              poster={livestream.thumbnail_url ?? undefined}
              className="w-full h-full absolute inset-0"
            />
          ) : hlsUrl ? (
            <HlsPlayer
              hlsUrl={hlsUrl}
              title={livestream.title}
              poster={livestream.thumbnail_url ?? undefined}
              type="livestream"
              isLive={isLive}
              className="w-full h-full absolute inset-0"
            />
          ) : null
        ) : (
          <MuxPlayer
            playbackId={playbackId!}
            title={livestream.title}
            poster={livestream.thumbnail_url ?? undefined}
            streamType={streamType}
            type="livestream"
            isLive={isLive}
            className="w-full h-full absolute inset-0"
          />
        )}
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
            Watch on The Pickle Hub
          </a>
        </div>
      )}
    </div>
  );
};

export default EmbedLive;
