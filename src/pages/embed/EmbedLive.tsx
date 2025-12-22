import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useLivestream } from "@/hooks/useSupabaseData";
import { MuxPlayer } from "@/components/video";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const EmbedLive = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const viewRecorded = useRef(false);

  const showTitle = searchParams.get("title") !== "0";
  const autoplay = searchParams.get("autoplay") === "1";

  const { data: livestream, isLoading } = useLivestream(id!);

  // Record view event with embed source
  useEffect(() => {
    if (!id || viewRecorded.current) return;

    const recordView = async () => {
      await supabase.from("view_events").insert({
        target_type: "livestream",
        target_id: id,
        viewer_user_id: null, // Embed viewers are anonymous
        organization_id: livestream?.organization_id ?? null,
        source: "embed",
      });
      viewRecorded.current = true;
    };

    const timer = setTimeout(recordView, 5000);
    return () => clearTimeout(timer);
  }, [id, livestream?.organization_id]);

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!livestream || !livestream.mux_playback_id) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/70 text-sm">Stream not available</p>
      </div>
    );
  }

  const isLive = livestream.status === "live";

  return (
    <div className="w-full h-full min-h-screen bg-black flex flex-col">
      {/* Video Player - Full screen */}
      <div className="flex-1 relative">
        <MuxPlayer
          playbackId={livestream.mux_playback_id}
          title={livestream.title}
          poster={livestream.thumbnail_url ?? undefined}
          streamType={isLive ? "live" : "on-demand"}
          type="livestream"
          isLive={isLive}
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
            Watch on The Pickle Hub
          </a>
        </div>
      )}
    </div>
  );
};

export default EmbedLive;
