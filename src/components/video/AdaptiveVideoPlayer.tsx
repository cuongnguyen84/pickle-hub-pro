import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AdaptiveVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
}

const AdaptiveVideoPlayer = ({
  src,
  poster,
  className,
  autoPlay = false,
  muted = false,
}: AdaptiveVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const { videoWidth, videoHeight } = video;
    if (videoWidth && videoHeight) {
      const ratio = videoWidth / videoHeight;
      setAspectRatio(ratio);
      setIsPortrait(ratio < 1);
    }
  }, []);

  return (
    <div
      className={cn(
        "relative bg-black flex items-center justify-center",
        // Portrait: limit height, center horizontally
        isPortrait ? "w-full max-h-[80vh]" : "w-full",
        className
      )}
      style={{
        aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        onLoadedMetadata={handleLoadedMetadata}
        className={cn(
          "bg-black",
          isPortrait
            ? "h-full max-h-[80vh] w-auto mx-auto"
            : "w-full h-auto"
        )}
        style={{
          objectFit: "contain",
        }}
      />
    </div>
  );
};

export default AdaptiveVideoPlayer;
