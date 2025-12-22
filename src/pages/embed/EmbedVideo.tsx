import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useVideo } from "@/hooks/useSupabaseData";
import { MuxPlayer } from "@/components/video";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const EmbedVideo = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const viewRecorded = useRef(false);

  const showTitle = searchParams.get("title") !== "0";

  const { data: video, isLoading } = useVideo(id!);

  // Record view event with embed source
  useEffect(() => {
    if (!id || viewRecorded.current) return;

    const recordView = async () => {
      await supabase.from("view_events").insert({
        target_type: "video",
        target_id: id,
        viewer_user_id: null, // Embed viewers are anonymous
        organization_id: video?.organization_id ?? null,
        source: "embed",
      });
      viewRecorded.current = true;
    };

    const timer = setTimeout(recordView, 5000);
    return () => clearTimeout(timer);
  }, [id, video?.organization_id]);

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!video || !video.mux_playback_id) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/70 text-sm">Video not available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen bg-black flex flex-col">
      {/* Video Player - Full screen */}
      <div className="flex-1 relative">
        <MuxPlayer
          playbackId={video.mux_playback_id}
          title={video.title}
          poster={video.thumbnail_url ?? undefined}
          streamType="on-demand"
          type="video"
          className="w-full h-full absolute inset-0"
        />
      </div>

      {/* Title bar - optional */}
      {showTitle && (
        <div className="bg-black/90 px-4 py-3 flex items-center gap-3 border-t border-white/10">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {video.title}
            </p>
            {video.organization && (
              <p className="text-white/60 text-xs truncate">
                {video.organization.name}
              </p>
            )}
          </div>
          <a
            href={`${window.location.origin}/video/${id}`}
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

export default EmbedVideo;
