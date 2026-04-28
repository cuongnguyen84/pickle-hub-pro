import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Extract the storage path (e.g. "org/<uuid>/videos/<id>.mp4") from a
 * Supabase Storage public URL. Returns null if the URL doesn't match the
 * expected pattern (e.g. external URL passed in by mistake).
 *
 *   Input:  https://<ref>.supabase.co/storage/v1/object/public/videos/org/abc/videos/def.mp4
 *   Output: "org/abc/videos/def.mp4"
 */
const extractVideoStoragePath = (videoUrl: string): string | null => {
  const match = videoUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/videos\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

interface ThumbnailState {
  isGenerating: boolean;
  thumbnailUrl: string | null;
  error: string | null;
}

/* ---------------------------------------------------------------------------
 * Robust auto-thumbnail generator. Caller signature unchanged:
 *   generateThumbnail(videoUrl, videoId): Promise<string | null>
 *
 * Failure modes addressed (vs the original implementation):
 *   A. CORS canvas taint — Supabase Storage edge nodes occasionally don't
 *      emit Access-Control-Allow-Origin, so a cross-origin <video src=...>
 *      taints the canvas and toBlob() throws SecurityError. Fix: fetch the
 *      video bytes via supabase client, blob-ify, use a same-origin
 *      object URL. (Skipped for files > 150MB — too much memory pressure.)
 *   B. Mobile Safari onloadeddata not always firing — wait on
 *      loadedmetadata + loadeddata with explicit timeouts.
 *   C. Black intro frame — sample 5%/25%/50% timestamps, pick the
 *      brightest one (skip mostly-black frames).
 *   D. CDN propagation race — 3-attempt retry with exponential backoff
 *      (1.5s, 3s, 6s) so freshly-uploaded videos get a chance to land
 *      on edge nodes before we give up.
 * ------------------------------------------------------------------------- */

const MAX_BLOB_FETCH_MB = 150;          // skip blob fallback above this size
const PER_ATTEMPT_TIMEOUT_MS = 8_000;
const FRAME_BRIGHTNESS_THRESHOLD = 30;  // 0–255, anything darker = "too dark"
const SAMPLE_PIXELS = 100;
const RETRY_DELAYS_MS = [1_500, 3_000, 6_000];

const waitForEvent = (el: HTMLMediaElement, event: string, timeoutMs: number) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new Error(`Timeout waiting for "${event}"`)),
      timeoutMs,
    );
    el.addEventListener(
      event,
      () => {
        window.clearTimeout(t);
        resolve();
      },
      { once: true },
    );
    el.addEventListener(
      "error",
      () => {
        window.clearTimeout(t);
        reject(new Error(`<video> error during "${event}"`));
      },
      { once: true },
    );
  });

const seekTo = (video: HTMLVideoElement, seconds: number) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new Error(`Timeout seeking to ${seconds}s`)),
      4_000,
    );
    video.addEventListener(
      "seeked",
      () => {
        window.clearTimeout(t);
        resolve();
      },
      { once: true },
    );
    try {
      video.currentTime = seconds;
    } catch (err) {
      window.clearTimeout(t);
      reject(err as Error);
    }
  });

const drawFrameToCanvas = (video: HTMLVideoElement): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d canvas context");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const frameBrightness = (canvas: HTMLCanvasElement): number => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  let total = 0;
  for (let i = 0; i < SAMPLE_PIXELS; i++) {
    const x = Math.floor(Math.random() * canvas.width);
    const y = Math.floor(Math.random() * canvas.height);
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    // Rec. 601 luma — close enough for "is this frame mostly black"
    total += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return total / SAMPLE_PIXELS;
};

const canvasToJpegBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      0.85,
    );
  });

/* Single attempt — caller wraps in retry loop. */
const captureThumbnailOnce = async (videoUrl: string): Promise<Blob> => {
  // Goal: get the video bytes into a same-origin object URL so canvas
  // drawImage doesn't taint. Strategy in priority order:
  //
  //   (1) Edge function proxy — server-side service_role download,
  //       streams back with Access-Control-Allow-Origin: *. Bypasses
  //       Supabase Storage edge CORS quirks entirely. Phase 2 fix.
  //   (2) Direct fetch from Storage URL — works when CDN edge actually
  //       emits CORS headers (most cases). Phase 1 fallback.
  //   (3) Direct <video src=cross-origin-url> with crossOrigin=anonymous —
  //       last resort, succeeds only if CDN emits CORS *. Original.
  //
  // (1) skipped above 150MB to avoid burning edge-function bandwidth on
  // huge files; (2) does the size check too.
  let videoSrc = videoUrl;
  let objectUrl: string | null = null;

  // Strategy (1) — edge function proxy
  const storagePath = extractVideoStoragePath(videoUrl);
  if (storagePath) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (accessToken) {
        const proxyUrl = `${SUPABASE_URL}/functions/v1/video-thumbnail-proxy?path=${encodeURIComponent(storagePath)}`;

        // HEAD probe size — proxy returns content-length, skip if too big
        const head = await fetch(proxyUrl, {
          method: "HEAD",
          headers: { authorization: `Bearer ${accessToken}` },
        }).catch(() => null);
        const sizeMb = head?.ok ? Number(head.headers.get("content-length") ?? 0) / 1_048_576 : 0;

        if (head?.ok && sizeMb > 0 && sizeMb <= MAX_BLOB_FETCH_MB) {
          const res = await fetch(proxyUrl, {
            headers: { authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            const blob = await res.blob();
            objectUrl = URL.createObjectURL(blob);
            videoSrc = objectUrl;
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[Thumbnail] Proxy fetch failed, falling back:", (err as Error).message);
    }
  }

  // Strategy (2) — direct fetch from Storage URL (Phase 1 fallback path)
  if (!objectUrl) {
    try {
      const head = await fetch(videoUrl, { method: "HEAD" }).catch(() => null);
      const sizeMb = head ? Number(head.headers.get("content-length") ?? 0) / 1_048_576 : 0;
      if (sizeMb > 0 && sizeMb <= MAX_BLOB_FETCH_MB) {
        const res = await fetch(videoUrl);
        if (!res.ok) throw new Error(`Video fetch ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        videoSrc = objectUrl;
      }
    } catch {
      // Strategy (3) — direct <video src=> with crossOrigin (last resort)
      videoSrc = videoUrl;
      objectUrl = null;
    }
  }

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  const cleanup = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  };

  try {
    video.src = videoSrc;
    video.load();

    await waitForEvent(video, "loadedmetadata", 5_000);
    await waitForEvent(video, "loadeddata", 3_000);

    const duration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : 1;

    // Sample 5%/25%/50% — skip dark intro frames. For very short clips
    // (<2s) all three points collapse to similar timestamps; that's fine.
    const candidates = [
      Math.min(0.5, Math.max(0.05, duration * 0.05)),
      duration * 0.25,
      duration * 0.5,
    ];

    let bestCanvas: HTMLCanvasElement | null = null;
    let bestBrightness = -1;

    for (const t of candidates) {
      try {
        await seekTo(video, t);
        // Some browsers need a paint tick after seeked before draw is valid
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const canvas = drawFrameToCanvas(video);
        const brightness = frameBrightness(canvas);
        if (brightness > bestBrightness) {
          bestCanvas = canvas;
          bestBrightness = brightness;
        }
        if (brightness > FRAME_BRIGHTNESS_THRESHOLD) {
          // Good enough — skip the rest, save time
          break;
        }
      } catch {
        // One failed seek doesn't doom the whole attempt — try next
      }
    }

    if (!bestCanvas) throw new Error("No frame could be drawn from video");

    return await canvasToJpegBlob(bestCanvas);
  } finally {
    cleanup();
  }
};

const captureWithTimeout = async (videoUrl: string): Promise<Blob> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<Blob>((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error(`Thumbnail attempt exceeded ${PER_ATTEMPT_TIMEOUT_MS}ms`)),
      PER_ATTEMPT_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([captureThumbnailOnce(videoUrl), timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export function useThumbnailGenerator(organizationId: string | null) {
  const [state, setState] = useState<ThumbnailState>({
    isGenerating: false,
    thumbnailUrl: null,
    error: null,
  });

  const generateThumbnail = async (
    videoUrl: string,
    videoId: string,
  ): Promise<string | null> => {
    if (!organizationId) {
      setState((prev) => ({ ...prev, error: "No organization ID" }));
      return null;
    }

    setState({ isGenerating: true, thumbnailUrl: null, error: null });

    let lastError: Error | null = null;
    let thumbnailBlob: Blob | null = null;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      try {
        thumbnailBlob = await captureWithTimeout(videoUrl);
        break;
      } catch (err) {
        lastError = err as Error;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        // eslint-disable-next-line no-console
        console.warn(`[Thumbnail] attempt ${attempt + 1} failed: ${lastError.message}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    if (!thumbnailBlob) {
      const errorMessage = lastError?.message ?? "Failed to generate thumbnail";
      // eslint-disable-next-line no-console
      console.error("[Thumbnail] All attempts failed:", errorMessage);
      setState({ isGenerating: false, thumbnailUrl: null, error: errorMessage });
      return null;
    }

    try {
      const timestamp = Date.now();
      const storagePath = `org/${organizationId}/videos/${videoId}/thumb_${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(storagePath, thumbnailBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (uploadError) throw uploadError;

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
      const errorMessage = err instanceof Error ? err.message : "Failed to upload thumbnail";
      // eslint-disable-next-line no-console
      console.error("[Thumbnail] Upload failed:", errorMessage);
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
