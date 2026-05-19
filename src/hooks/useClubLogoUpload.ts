// ============================================================================
// useClubLogoUpload — upload a club logo to the `clubs-logos` Storage bucket
// ----------------------------------------------------------------------------
// Mirrors the avatars-upload pattern in useUserProfile.ts. Validates type +
// size client-side before hitting the bucket; returns the public URL on
// success so the caller can persist it as `clubs.logo_url`.
// ============================================================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const CLUB_LOGO_BUCKET = "clubs-logos";
export const CLUB_LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface UploadResult {
  publicUrl: string;
  path: string;
}

export type UploadError =
  | "invalid_type"
  | "too_large"
  | "unauthenticated"
  | "upload_failed";

export function useClubLogoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  async function upload(file: File): Promise<UploadResult | null> {
    setError(null);

    if (!ALLOWED_MIME.has(file.type)) {
      setError("invalid_type");
      return null;
    }
    if (file.size > CLUB_LOGO_MAX_BYTES) {
      setError("too_large");
      return null;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("unauthenticated");
      return null;
    }

    // Path convention: `<auth.uid()>/<timestamp>-<random>.<ext>`. The
    // user-folder prefix matches the RLS policy on storage.objects so
    // the upload is permitted. Random suffix avoids overwrites when the
    // organizer changes their logo multiple times.
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${userId}/${Date.now()}-${rand}.${ext}`;

    setUploading(true);
    try {
      const { error: uploadErr } = await supabase.storage
        .from(CLUB_LOGO_BUCKET)
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadErr) {
        console.error("useClubLogoUpload error", uploadErr);
        setError("upload_failed");
        return null;
      }
      const { data: urlData } = supabase.storage
        .from(CLUB_LOGO_BUCKET)
        .getPublicUrl(path);
      return { publicUrl: urlData.publicUrl, path };
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error };
}
