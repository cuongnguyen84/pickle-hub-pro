import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "og-images";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface OgImageUploadState {
  isUploading: boolean;
  error: string | null;
  imageUrl: string | null;
}

export function useOgImageUpload() {
  const [state, setState] = useState<OgImageUploadState>({
    isUploading: false,
    error: null,
    imageUrl: null,
  });

  const upload = useCallback(async (file: File, slug: string): Promise<string | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setState((s) => ({ ...s, error: "Chỉ chấp nhận JPG, PNG, WebP" }));
      return null;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setState((s) => ({ ...s, error: "File quá lớn — tối đa 2MB" }));
      return null;
    }

    setState({ isUploading: true, error: null, imageUrl: null });

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${slug}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      setState({ isUploading: false, error: null, imageUrl });
      return imageUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload thất bại";
      setState({ isUploading: false, error: message, imageUrl: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isUploading: false, error: null, imageUrl: null });
  }, []);

  return { ...state, upload, reset };
}
