// ============================================================================
// Variants and inventory — data hooks (P2a step 5).
// ----------------------------------------------------------------------------
// Two writes, both server-authoritative:
//
//   * the matrix reconcile, which is the ONLY way the option structure or the
//     variant set changes. A bulk price arrives inside it, as the rows the
//     seller ended up with — not as an instruction the server would have to
//     trust and re-derive.
//   * a stock adjustment, which is an explicit action with a reason, never an
//     autosaved text field. Moving stock is a claim about the physical world.
// ============================================================================

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shopRpc } from "@/integrations/supabase/shop-client";
import { productKeys } from "@/hooks/shop/useSellerProducts";
import type { ProductVariantRow } from "@/integrations/supabase/shop-schema";
import type { OptionGroup, VariantRow } from "@/lib/shop/variantMatrix";
import { toReconcilePayload } from "@/lib/shop/variantMatrix";

/** Why stock moved. The list is the CHECK on inventory_movements.reason — a
 *  reason the database would refuse is not worth offering. */
export const STOCK_REASONS = [
  { value: "restock", label: "Nhập thêm hàng" },
  { value: "correction", label: "Sửa lại cho đúng thực tế" },
  { value: "damage", label: "Hàng hỏng" },
  { value: "lost", label: "Thất lạc" },
  { value: "return", label: "Khách trả lại" },
  { value: "manual", label: "Lý do khác" },
] as const;

export const useReconcileVariants = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expectedVersion: number;
      groups: OptionGroup[];
      rows: VariantRow[];
      /** Minted once per save attempt and replayed on retry. */
      clientToken: string;
      /** Required by the server when collapsing a matrix back to one variant. */
      keepVariantId?: string | null;
    }) => {
      const multi = input.groups.length > 0;
      return await shopRpc<ProductVariantRow[]>("product_variants_reconcile", {
        _product_id: productId,
        _expected_version: input.expectedVersion,
        _option_groups: multi
          ? input.groups.map((g) => ({
              name: g.name.trim(),
              values: g.values.map((v) => v.trim()).filter(Boolean),
            }))
          : [],
        _rows: toReconcilePayload(input.rows, multi),
        _client_token: input.clientToken,
        _keep_variant_id: input.keepVariantId ?? null,
      });
    },
    onSuccess: () => {
      // Refetch rather than patch: the reconcile decided which rows kept their
      // ids, and guessing that in the client is how the editor and the
      // database start disagreeing about what a row is.
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

export const useAdjustStock = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      variantId: string;
      delta: number;
      reason: string;
      note?: string;
      clientToken: string;
    }) =>
      await shopRpc<ProductVariantRow>("product_variant_adjust_stock", {
        _variant_id: input.variantId,
        _delta: input.delta,
        _reason: input.reason,
        _note: input.note ?? null,
        _client_token: input.clientToken,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};
