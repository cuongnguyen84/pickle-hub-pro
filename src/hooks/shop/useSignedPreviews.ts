// ============================================================================
// Signed previews for the private draft bucket — lifted from MediaEditor so
// the seller product list can reuse it without duplicating the mint.
// ----------------------------------------------------------------------------
// Nothing signed is written to storage, logged, or put in a query key.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DRAFT_BUCKET = "shop-product-media-draft";

/**
 * Signed previews, in memory only.
 *
 * The draft bucket is private, so a preview needs a signed URL. They live five
 * minutes, are never persisted, and are re-minted when the media list changes.
 *
 * A path that settled WITHOUT a URL (mint failed, or the row came back empty)
 * lands in the map as "" — still falsy for the existing `urls[path] ?`
 * call sites, but it lets the product list tell "mint xong mà không có URL"
 * (→ ImageOff) apart from "chưa về" (→ shimmer).
 */
export function useSignedPreviews(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join("|");

  useEffect(() => {
    let cancelled = false;
    if (!paths.length) {
      setUrls({});
      return;
    }
    void supabase.storage
      .from(DRAFT_BUCKET)
      .createSignedUrls(paths, 300)
      .then(({ data }) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const row of data ?? []) if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
        for (const p of paths) if (!(p in next)) next[p] = "";
        setUrls(next);
      })
      .catch(() => {
        if (!cancelled) setUrls(Object.fromEntries(paths.map((p) => [p, ""])));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
