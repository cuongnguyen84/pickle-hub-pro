// ============================================================================
// Media reads and the three writes that are not uploads (P2a step 6).
// ----------------------------------------------------------------------------
// Order, delete and variant assignment. Every one of them is an RPC — the
// client never writes product_media or shop_profile_media directly, because
// those rows carry paths and a public_path that only the server and the worker
// may decide.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { edgeError, edgeErrorMessage } from "@/lib/shop/errors";
import { shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import { productKeys } from "@/hooks/shop/useSellerProducts";
import type { ProductMediaRow, ShopProfileMediaRow } from "@/integrations/supabase/shop-schema";

export const shopMediaKeys = {
  profile: (shopId: string | null) => ["shop", "profile-media", shopId] as const,
};

/** Logo and cover for one shop. Two rows at most, so no pagination and no
 *  filtering — the whole set is the answer. */
export const useShopProfileMedia = (shopId: string | null) =>
  useQuery({
    queryKey: shopMediaKeys.profile(shopId),
    enabled: !!shopId,
    queryFn: async (): Promise<ShopProfileMediaRow[]> => {
      const { data, error } = await shopFrom<ShopProfileMediaRow>("shop_profile_media")
        .select("*")
        .eq("shop_id", shopId!);
      if (error) throw error;
      return data ?? [];
    },
  });

/**
 * Reorder.
 *
 * The whole list travels, in the order it should end up in, with the product's
 * expected version. A partial list would leave photos at stale positions and a
 * stale version is refused — so two tabs cannot each decide the order.
 */
export const useReorderProductMedia = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { expectedVersion: number; mediaIds: string[] }) =>
      await shopRpc<ProductMediaRow[]>("product_media_reorder", {
        _product_id: productId,
        _expected_version: input.expectedVersion,
        _media_ids: input.mediaIds,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

export const useDeleteProductMedia = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) =>
      await shopRpc<boolean>("product_media_delete", { _media_id: mediaId }),
    onSuccess: () => {
      // Refetch rather than splice: deleting a photo can clear a variant's
      // media_id in the same transaction, and guessing which one in the client
      // is how the screen and the database start disagreeing.
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

export const useSetVariantMedia = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { variantId: string; mediaId: string | null }) =>
      await shopRpc("product_variant_set_media", {
        _variant_id: input.variantId,
        _media_id: input.mediaId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
    },
  });
};

export const useDeleteProfileMedia = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) =>
      await shopRpc<boolean>("shop_profile_media_delete", { _media_id: mediaId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shopMediaKeys.profile(shopId) });
    },
  });
};

/**
 * Publish every verified logo/cover of the shop to the public bucket, via the
 * worker that holds the only service-role over it (pattern: usePublishProduct).
 * The plan and every path are decided in Postgres; the client only names the
 * shop. Partial success is real success: a failed cover does not roll back a
 * committed logo, so the result is inspected rather than assumed.
 */
export const usePublishProfileMedia = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Imported lazily: client.ts creates the SDK client at module load and
      // THROWS without env vars — a top-level import here took the whole
      // MediaEditor test import-chain down on CI, where no .env exists.
      const { supabase } = await import("@/integrations/supabase/client");
      // The Response comes back unread on the error path — it is the only place
      // the worker's `failed[0].error` and the RPC's Vietnamese refusal exist.
      // 20s, because the seller must never be left with a spinner and no
      // button: publish_profile copies at most two items, so a call still
      // running at 20s is not slow, it is gone.
      const { data, error, response } = await supabase.functions.invoke("shop-media-lifecycle", {
        body: { action: "publish_profile", shop_id: shopId },
        timeout: 20_000,
      });
      if (error) throw edgeError(await edgeErrorMessage(error, response));
      const result = data as {
        ok?: boolean;
        published?: { media_id: string; target: string }[];
        failed?: { media_id: string; error: string }[];
      };
      // Only reachable if the worker starts answering 200 for a partial
      // publish; today a partial is a 502 and lands above.
      if (!result?.ok) {
        throw edgeError(
          await edgeErrorMessage(null, new Response(JSON.stringify(result ?? {}), { status: 200 })),
        );
      }
      return result;
    },
    // Settled, not just success: a partial failure still committed some rows,
    // and the screen must show the server's truth either way.
    onSettled: () => void qc.invalidateQueries({ queryKey: shopMediaKeys.profile(shopId) }),
  });
};

export const useSetCoverFocal = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { mediaId: string; focalY: number }) =>
      await shopRpc("shop_profile_media_set_focal", {
        _media_id: input.mediaId,
        _focal_y: input.focalY,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shopMediaKeys.profile(shopId) });
    },
  });
};

/**
 * Move one item within a list, returning a new array.
 *
 * The whole of "reorder" on the client: the up/down buttons and any future
 * drag both produce an array, and the server decides what it means. Pure so
 * the keyboard path is testable without a browser.
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
