import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ThumbnailState {
  isGenerating: boolean;
  thumbnailUrl: string | null;
  error: string | null;
}

export function useThumbnailGenerator(organizationId: string | null) {
  const [state, setState] = useState<ThumbnailState>({
    isGenerating: false,
    thumbnailUrl: null,
    error: null,
  });

  const generateThumbnail = async (
    videoUrl: string,
    videoId: string
  ): Promise<string | null> => {
    if (!organizationId) {
      setState((prev) => ({ ...prev, error: "No organization ID" }));
      return null;
    }

    setState({ isGenerating: true, thumbnailUrl: null, error: null });

    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
        video.onloadeddata = async () => {
          try {
            const seekTime = Math.min(1, video.duration * 0.1);
            video.currentTime = seekTime;
          } catch (err) {
            reject(err);
          }
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Could not get canvas context"));
              return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error("Failed to create thumbnail blob"));
                }
              },
              "image/jpeg",
              0.85
            );
          } catch (err) {
            reject(err);
          }
        };

        video.onerror = () => {
          reject(new Error("Failed to load video for thumbnail generation"));
        };

        video.src = videoUrl;
        video.load();
      });

      const timestamp = Date.now();
      const storagePath = `org/${organizationId}/videos/${videoId}/thumb_${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(storagePath, thumbnailBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(storagePath);

      setState({
        isGenerating: false,
        thumbnailUrl: urlData.publicUrl,
        error: null,
      });

      return urlData.publicUrl;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate thumbnail";
      setState({ isGenerating: false, thumbnailUrl: null, error: errorMessage });
      return null;
    }
  };

  const reset = () => {
    setState({ isGenerating: false, thumbnailUrl: null, error: null });
  };

  return {
    ...state,
    generateThumbnail,
    reset,
  };
}
