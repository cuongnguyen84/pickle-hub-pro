import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadState {
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  storagePath: string | null;
  videoUrl: string | null;
}

export function useVideoUpload(organizationId: string | null) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: null,
    error: null,
    storagePath: null,
    videoUrl: null,
  });

  const upload = useCallback(
    async (file: File, videoId?: string) => {
      if (!organizationId) {
        setState((s) => ({ ...s, error: "No organization ID" }));
        return null;
      }

      setState({
        isUploading: true,
        progress: { loaded: 0, total: file.size, percentage: 0 },
        error: null,
        storagePath: null,
        videoUrl: null,
      });

      try {
        // Generate a unique path
        const id = videoId || crypto.randomUUID();
        const ext = file.name.split(".").pop() || "mp4";
        const path = `org/${organizationId}/videos/${id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("videos")
          .getPublicUrl(path);

        const videoUrl = urlData.publicUrl;

        setState({
          isUploading: false,
          progress: { loaded: file.size, total: file.size, percentage: 100 },
          error: null,
          storagePath: path,
          videoUrl,
        });

        return { storagePath: path, videoUrl };
      } catch (err: any) {
        setState((s) => ({
          ...s,
          isUploading: false,
          error: err.message || "Upload failed",
        }));
        return null;
      }
    },
    [organizationId]
  );

  const deleteFile = useCallback(async (storagePath: string) => {
    try {
      await supabase.storage.from("videos").remove([storagePath]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: null,
      error: null,
      storagePath: null,
      videoUrl: null,
    });
  }, []);

  return {
    ...state,
    upload,
    deleteFile,
    reset,
  };
}
