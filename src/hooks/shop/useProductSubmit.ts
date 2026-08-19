// ============================================================================
// Preview, preflight and submit (P2a step 7).
// ----------------------------------------------------------------------------
// All three read the same server rules. The preview reads the canonical
// projection — the one the public PDP will read in P2b — and the checklist
// reads the same preflight the submit runs, so the screen cannot promise a
// submit that the server is about to refuse.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopRpc } from "@/integrations/supabase/shop-client";
import { productKeys } from "@/hooks/shop/useSellerProducts";
import type { SubmitProblem } from "@/lib/shop/submitProblems";
import type { ProductProjection } from "@/integrations/supabase/shop-schema";

export const submitKeys = {
  preview: (productId: string | null) => ["shop", "products", "preview", productId] as const,
  preflight: (productId: string | null) => ["shop", "products", "preflight", productId] as const,
};

/** The product as somebody looking at it sees it. Same function the public PDP
 *  will call; only the flag differs. */
export const useProductPreview = (productId: string | null, enabled = true) =>
  useQuery({
    queryKey: submitKeys.preview(productId),
    enabled: !!productId && enabled,
    queryFn: async (): Promise<ProductProjection> =>
      await shopRpc<ProductProjection>("product_public_projection", {
        _product_id: productId,
        _as_seller: true,
      }),
  });

/** What still stands between this product and the review queue. */
export const useSubmitPreflight = (productId: string | null, enabled = true) =>
  useQuery({
    queryKey: submitKeys.preflight(productId),
    enabled: !!productId && enabled,
    queryFn: async (): Promise<SubmitProblem[]> =>
      (await shopRpc<SubmitProblem[]>("product_submit_preflight", { _product_id: productId })) ?? [],
  });

export interface SubmitResult {
  ok: boolean;
  status: string;
  event?: string;
  replayed?: boolean;
  problems?: SubmitProblem[];
  /** Server says the row reached `approved` but the photos are not in the
   *  public bucket yet. Set by product_submit since 20260818170000. */
  needs_publish?: boolean;
  /** Set by the client once the publish leg has actually run. */
  published?: boolean;
}

/**
 * Submit or resubmit.
 *
 * The token is the caller's, minted once per attempt and replayed on retry, so
 * a double tap or a lost response returns the first answer rather than writing
 * a second audit event.
 *
 * A validation failure is a RESULT here, not a thrown error: the server hands
 * back the whole problem list and the screen renders it. Only permission,
 * state and conflict actually throw.
 */
export const useSubmitProduct = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    // NEVER retry — same reason as useOrderCreate: a paused retryer on a
    // hidden tab never settles, and this mutation has a side effect (bytes
    // copied into a public bucket) that must not run twice by accident.
    retry: false,
    mutationFn: async (input: { expectedVersion: number; clientToken: string }) => {
      const result = await shopRpc<SubmitResult>("product_submit", {
        _product_id: productId,
        _expected_version: input.expectedVersion,
        _client_token: input.clientToken,
      });
      // The RPC only moves the ROW. Photos still sit in the private bucket, and
      // shop_public_search requires a committed public_path — so a product that
      // stops here is approved and invisible. Since 20260818170000 the seller
      // is the one who reaches `approved`, so the seller's screen is where the
      // publish leg has to run; before that it lived only on the admin review
      // screen, which the seller never opens.
      if (!result.ok || !result.needs_publish || !productId) return result;
      const { invokePublishProduct } = await import("@/hooks/shop/useProductModeration");
      await invokePublishProduct(productId);
      return { ...result, published: true };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: submitKeys.preflight(productId) });
      if (!result.ok) return;
      // The status moved, so the row, the counts and the chips are all stale.
      // Invalidating the whole product namespace is one line and cannot miss
      // one of them; the list refetches on its own.
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
      void qc.invalidateQueries({ queryKey: submitKeys.preview(productId) });
    },
  });
};

export const useWithdrawSubmission = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => await shopRpc<string>("product_withdraw_submission", { _product_id: productId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
      void qc.invalidateQueries({ queryKey: submitKeys.preflight(productId) });
    },
  });
};

/**
 * Take a live product back off the shelf to edit it.
 *
 * The counterpart to self-publishing. `product_status_is_editable()` is
 * draft|needs_changes, so before 20260818170000 an approved product could only
 * be reopened by an admin — which is fine while an admin is in the loop and
 * absurd once they are not: the seller publishes, spots a typo, and has no way
 * back. This is that way back.
 */
export const useEditAgain = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (expectedVersion?: number) =>
      await shopRpc<{ ok: boolean; status: string; renditions_revoked: number }>(
        "product_edit_again",
        { _product_id: productId, _expected_version: expectedVersion ?? null },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
      void qc.invalidateQueries({ queryKey: submitKeys.preflight(productId) });
      void qc.invalidateQueries({ queryKey: submitKeys.preview(productId) });
    },
  });
};
