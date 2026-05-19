import { useEffect } from "react";

interface VideoSchemaProps {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: number; // in seconds
  embedUrl?: string;
  contentUrl?: string;
}

/**
 * VideoObject structured data for Google Video indexing
 * @see https://developers.google.com/search/docs/appearance/structured-data/video
 */
export const VideoSchema = ({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  embedUrl,
  contentUrl,
}: VideoSchemaProps) => {
  useEffect(() => {
    // Create JSON-LD script
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "video-schema";

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name,
      description,
      thumbnailUrl,
      uploadDate,
    };

    // Add optional fields
    if (duration && duration > 0) {
      // Convert seconds to ISO 8601 duration format (PT#H#M#S)
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = Math.floor(duration % 60);
      
      let isoDuration = "PT";
      if (hours > 0) isoDuration += `${hours}H`;
      if (minutes > 0) isoDuration += `${minutes}M`;
      if (seconds > 0 || isoDuration === "PT") isoDuration += `${seconds}S`;
      
      schema.duration = isoDuration;
    }

    if (embedUrl) {
      schema.embedUrl = embedUrl;
    }

    if (contentUrl) {
      schema.contentUrl = contentUrl;
    }

    script.textContent = JSON.stringify(schema);

    // Remove existing schema if present
    const existingScript = document.getElementById("video-schema");
    if (existingScript) {
      existingScript.remove();
    }

    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById("video-schema");
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [name, description, thumbnailUrl, uploadDate, duration, embedUrl, contentUrl]);

  return null;
};
