import { Video as VideoIcon } from "lucide-react";

interface VideoThumbnailProps {
  thumbnailUrl?: string | null;
  storagePath?: string | null;
  title: string;
  className?: string;
  /** Show lucide Video icon as final fallback when both thumbnail and storage_path missing */
  showIconFallback?: boolean;
  /**
   * Allow fetching the video itself to paint its first frame. Disable on dense
   * listing/home surfaces: some MOV files require multi-megabyte metadata reads.
   */
  allowVideoFallback?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function VideoThumbnail({
  thumbnailUrl,
  storagePath,
  title,
  className = "w-full h-full object-cover",
  showIconFallback = true,
  allowVideoFallback = true,
}: VideoThumbnailProps) {
  if (thumbnailUrl) {
    return <img src={thumbnailUrl} alt={title} loading="lazy" className={className} />;
  }

  if (storagePath && allowVideoFallback) {
    const videoUrl = `${SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`;
    return (
      <video
        src={videoUrl}
        preload="metadata"
        muted
        playsInline
        aria-label={title}
        className={className}
      />
    );
  }

  if (showIconFallback) {
    return <VideoIcon className="w-5 h-5 text-foreground-muted" aria-label={title} />;
  }

  return null;
}
