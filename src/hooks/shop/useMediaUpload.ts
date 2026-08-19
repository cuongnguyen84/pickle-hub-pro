// ============================================================================
// Upload state machine — one per file, shared by product media and shop
// logo/cover (P2a step 6).
// ----------------------------------------------------------------------------
// The two surfaces differ in three strings — which RPC to init, which RPC to
// finalize, and what to invalidate — and agree on everything else, so they
// share this machine. Two copies of a four-phase upload is two places for a
// half-uploaded photo to be reported as done.
//
// PROGRESS, honestly: supabase-js's storage upload gives no byte progress
// event. So this reports PHASES — đang xử lý / đang tải ảnh gốc / đang tải ảnh
// đã nén / đang xác minh — and never a percentage. A percentage driven by a
// timer is a lie that costs the seller their trust the first time it sits at
// 90% for a minute.
//
// Each file carries a client token minted once and REUSED on every retry, so
// a retry after a timeout the browser never saw the answer to reattaches to
// the same media row instead of leaving an orphan behind.
// ============================================================================

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shopRpc } from "@/integrations/supabase/shop-client";
import { shopErrorMessage } from "@/lib/shop/errors";
import { ImageRejected, IMAGE_LIMITS, processImage, runQueue } from "@/lib/shop/imagePipeline";

const DRAFT_BUCKET = "shop-product-media-draft";

export type UploadPhase =
  | "queued"
  | "processing"
  | "uploading_original"
  | "uploading_rendition"
  | "finalizing"
  | "complete"
  | "failed"
  | "cancelled";

/** Vietnamese, and specific about what is happening now — never a bare
 *  spinner, which tells the seller nothing about whether to wait or retry. */
export const PHASE_LABEL: Record<UploadPhase, string> = {
  queued: "Đang chờ",
  processing: "Đang xử lý ảnh",
  uploading_original: "Đang tải ảnh gốc",
  uploading_rendition: "Đang tải ảnh đã nén",
  finalizing: "Đang xác minh",
  complete: "Xong",
  failed: "Chưa xong",
  cancelled: "Đã huỷ",
};

export const isBusy = (phase: UploadPhase) =>
  phase === "processing" ||
  phase === "uploading_original" ||
  phase === "uploading_rendition" ||
  phase === "finalizing";

export interface UploadItem {
  /** Stable for the life of this file, including across retries: it IS the
   *  client token the server deduplicates on. */
  token: string;
  file: File;
  name: string;
  phase: UploadPhase;
  error?: string;
  mediaId?: string;
  /** Object URL for the local preview. Revoked when the item goes. */
  previewUrl?: string;
}

/** What differs between product media and shop logo/cover. */
export interface UploadTarget {
  init: (input: {
    contentType: string;
    byteSize: number;
    filename: string;
    token: string;
  }) => Promise<{ media_id: string; draft_path: string; rendition_path: string }>;
  finalize: (input: { mediaId: string; width: number; height: number }) => Promise<unknown>;
  onSettled: () => void;
  /** Logos do not need 2048px. */
  cap?: number;
}

const newToken = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `u-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const productMediaTarget = (productId: string, onSettled: () => void): UploadTarget => ({
  init: (input) =>
    shopRpc("product_media_upload_init", {
      _product_id: productId,
      _content_type: input.contentType,
      _byte_size: input.byteSize,
      _original_filename: input.filename,
      _client_token: input.token,
    }),
  finalize: (input) =>
    shopRpc("product_media_finalize", {
      _media_id: input.mediaId,
      _width: input.width,
      _height: input.height,
    }),
  onSettled,
});

export const profileMediaTarget = (
  shopId: string,
  purpose: "logo" | "cover",
  onSettled: () => void,
): UploadTarget => ({
  init: (input) =>
    shopRpc("shop_profile_media_upload_init", {
      _shop_id: shopId,
      _purpose: purpose,
      _content_type: input.contentType,
      _byte_size: input.byteSize,
      _original_filename: input.filename,
      _client_token: input.token,
    }),
  finalize: (input) =>
    shopRpc("shop_profile_media_finalize", {
      _media_id: input.mediaId,
      _width: input.width,
      _height: input.height,
    }),
  onSettled,
  // A logo rendered at 96px does not need 2048px of source.
  cap: purpose === "logo" ? 512 : IMAGE_LIMITS.maxDimension,
});

export function useMediaUpload(target: UploadTarget) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const aborts = useRef(new Map<string, AbortController>());
  // Read inside run() so a retry always sees the current target (a new product
  // id after create, say) rather than the one captured when the file was added.
  const targetRef = useRef(target);
  targetRef.current = target;

  const patch = useCallback((token: string, next: Partial<UploadItem>) => {
    setItems((current) => current.map((i) => (i.token === token ? { ...i, ...next } : i)));
  }, []);

  /**
   * One file, all four phases.
   *
   * Every phase is re-entrant: init returns the same row for the same token,
   * the storage upload upserts to a server-chosen path, and finalize returns
   * the same answer once verified. So a retry resumes rather than duplicating,
   * whichever phase it died in.
   */
  const run = useCallback(
    async (item: UploadItem) => {
      const t = targetRef.current;
      const controller = new AbortController();
      aborts.current.set(item.token, controller);
      const aborted = () => controller.signal.aborted;
      /**
       * Cancelling BETWEEN phases used to leave the row where it stood.
       *
       * processImage takes the signal, so a cancel during it throws AbortError
       * and lands in the catch. But a cancel that arrives after a phase
       * resolved and before the next one started only tripped a bare
       * `if (aborted()) return`, which exited without touching the phase — so
       * the item sat on "Đang xử lý ảnh" forever, `busy` stayed true, the save
       * bar stayed disabled, and neither retry nor clearComplete could reach
       * it. A reload was the only way out.
       *
       * Now every exit says what happened. Found by the cancel test below,
       * which mocks a processImage that ignores the signal — which is exactly
       * how the window looks in production.
       */
      const stopIfAborted = () => {
        if (!aborted()) return false;
        patch(item.token, { phase: "cancelled" });
        return true;
      };

      try {
        patch(item.token, { phase: "processing", error: undefined });
        const processed = await processImage(item.file, { signal: controller.signal, cap: t.cap });
        if (stopIfAborted()) return;

        const init = await t.init({
          contentType: item.file.type || "image/jpeg",
          byteSize: item.file.size,
          filename: item.name,
          token: item.token,
        });
        if (stopIfAborted()) return;
        patch(item.token, { mediaId: init.media_id, phase: "uploading_original" });

        // The ORIGINAL, exactly as the seller chose it. It never goes public;
        // it exists so the rendition can be checked against something real.
        const original = await supabase.storage
          .from(DRAFT_BUCKET)
          .upload(init.draft_path, item.file, { upsert: true, contentType: item.file.type });
        if (original.error) throw original.error;
        if (stopIfAborted()) return;

        patch(item.token, { phase: "uploading_rendition" });
        // webp or jpeg (iOS Safari fallback), whatever the pipeline produced.
        // The path stays *.webp regardless: extension is a claim; the MIME in
        // storage.objects is the truth, and it is what finalize verifies.
        const rendition = await supabase.storage
          .from(DRAFT_BUCKET)
          .upload(init.rendition_path, processed.blob, {
            upsert: true,
            contentType: processed.blob.type,
          });
        if (rendition.error) throw rendition.error;
        if (stopIfAborted()) return;

        patch(item.token, { phase: "finalizing" });
        await t.finalize({
          mediaId: init.media_id,
          width: processed.width,
          height: processed.height,
        });

        patch(item.token, { phase: "complete" });
        t.onSettled();
      } catch (error) {
        if (aborted() || (error as Error)?.name === "AbortError") {
          patch(item.token, { phase: "cancelled" });
          return;
        }
        // ImageRejected already says what to do about it; anything else is a
        // server or network error and goes through the shared mapper.
        patch(item.token, {
          phase: "failed",
          error:
            error instanceof ImageRejected
              ? error.message
              : shopErrorMessage(error),
        });
      } finally {
        aborts.current.delete(item.token);
      }
    },
    [patch],
  );

  const add = useCallback(
    (files: File[]) => {
      const queued: UploadItem[] = files.map((file) => ({
        token: newToken(),
        file,
        name: file.name,
        phase: "queued",
        previewUrl: URL.createObjectURL(file),
      }));
      setItems((current) => [...current, ...queued]);
      // Two at a time: eight 8 MB photos decoded together is a phone tab that
      // disappears. One failing file never stops the others.
      void runQueue(queued, (item) => run(item), 2);
    },
    [run],
  );

  const retry = useCallback(
    (token: string) => {
      setItems((current) => {
        const item = current.find((i) => i.token === token);
        if (item) void run({ ...item, phase: "queued" });
        return current;
      });
    },
    [run],
  );

  const cancel = useCallback((token: string) => {
    aborts.current.get(token)?.abort();
  }, []);

  const remove = useCallback((token: string) => {
    aborts.current.get(token)?.abort();
    setItems((current) => {
      const item = current.find((i) => i.token === token);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return current.filter((i) => i.token !== token);
    });
  }, []);

  /** Drop the ones that finished, once their server rows are on screen. Keeps
   *  failures visible: a file that did not upload must not vanish quietly. */
  const clearComplete = useCallback(() => {
    setItems((current) => {
      for (const item of current) {
        if (item.phase === "complete" && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return current.filter((i) => i.phase !== "complete");
    });
  }, []);

  return { items, add, retry, cancel, remove, clearComplete, busy: items.some((i) => isBusy(i.phase)) };
}
