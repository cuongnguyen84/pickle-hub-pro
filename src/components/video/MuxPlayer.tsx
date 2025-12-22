import MuxPlayerReact from "@mux/mux-player-react";

interface MuxPlayerProps {
  playbackId: string;
  title?: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  streamType?: "on-demand" | "live" | "ll-live";
}

export function MuxPlayer({
  playbackId,
  title,
  poster,
  autoPlay = false,
  muted = false,
  className = "",
  streamType = "on-demand",
}: MuxPlayerProps) {
  if (!playbackId) {
    return (
      <div className={`aspect-video bg-muted flex items-center justify-center rounded-xl ${className}`}>
        <p className="text-foreground-muted text-sm">No video available</p>
      </div>
    );
  }

  return (
    <MuxPlayerReact
      playbackId={playbackId}
      metadata={{
        video_title: title,
      }}
      poster={poster}
      autoPlay={autoPlay}
      muted={muted}
      streamType={streamType}
      className={`aspect-video rounded-xl overflow-hidden ${className}`}
      primaryColor="#22c55e"
      accentColor="#16a34a"
    />
  );
}
