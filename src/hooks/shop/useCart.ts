// ============================================================================
// The cart — one read model, four writes.
// ----------------------------------------------------------------------------
// architecture-boundaries.md §3: Supabase calls live here, never in JSX.
//
// The read is `shop_cart_view()`, which takes no user id and never will: it
// reads auth.uid() itself. So there is exactly ONE cache entry per signed-in
// user, and the badge, the cart page and the checkout page all read it. That
// is deliberate — a badge with its own count query is a badge that disagrees
// with the page it links to.
//
// The writes are table verbs rather than an RPC because the grants already say
// what may be written: INSERT (variant_id, qty), UPDATE (qty), DELETE. Adding
// the same variant twice is a read-then-update, not an upsert — PostgREST's
// upsert needs the conflict target and a column list we are not granted.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import type { CartGroup, ShopCartItemRow } from "@/integrations/supabase/shop-schema";
import { useAuth } from "@/hooks/useAuth";

/** Ten is the CHECK on shop_cart_items.qty, mirrored so the screen can say so
 *  instead of surfacing 23514. */
export const CART_QTY_MAX = 10;

export const cartKeys = {
  all: ["shop", "cart"] as const,
  view: (userId: string | null) => ["shop", "cart", "view", userId] as const,
};

/**
 * Every group in the cart, shop by shop.
 *
 * `enabled` on the user id, because shop_cart_view() raises
 * insufficient_privilege for an anonymous caller — a query that always errors
 * is a red badge and a retry loop, not a signed-out state.
 */
export const useCartView = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: cartKeys.view(user?.id ?? null),
    enabled: !!user,
    // Short: a cart that shows a line the shop just took down sends the buyer
    // into a refusal at checkout.
    staleTime: 15_000,
    queryFn: () => shopRpc<CartGroup[]>("shop_cart_view"),
  });
};

/**
 * The badge number: TOTAL qty, not the number of lines.
 *
 * `null` means "render nothing" and covers three cases on purpose — signed
 * out, still loading, and the query failed. A wrong badge is worse than no
 * badge, and a skeleton for an 18px number is worse than both.
 */
export const useCartCount = (): number | null => {
  const { user } = useAuth();
  const q = useCartView();
  if (!user || q.isPending || q.isError || !q.data) return null;
  return q.data.reduce(
    (sum, g) => sum + g.lines.reduce((n, l) => n + l.qty, 0),
    0,
  );
};

/** The group for one shop, or null. Checkout reads the cart it is about to
 *  turn into an order from the same place the cart page does. */
export const cartGroupFor = (groups: CartGroup[] | undefined, shopSlug: string | undefined) =>
  groups?.find((g) => g.shop.slug === shopSlug) ?? null;

export interface CartMutations {
  add: (input: { variantId: string; qty: number }) => Promise<void>;
  setQty: (input: { cartItemId: string; qty: number }) => Promise<void>;
  remove: (input: { cartItemId: string }) => Promise<void>;
  /** Undo. The row is gone, so this re-inserts it at the qty it had. */
  restore: (input: { variantId: string; qty: number }) => Promise<void>;
}

export const useCartMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: cartKeys.all });
  };

  // Every write below is `retry: false` for the same reason useOrderCreate is:
  // App.tsx's global mutation default is `retry: 1`, and a retryer that is
  // about to retry pauses when the tab is not visible — leaving a spinner that
  // never comes back on a request the server already refused. Every awaiting
  // caller here (`onQty`, `onRemove`) shows exactly that spinner.
  const add = useMutation({
    retry: false,
    mutationFn: async ({ variantId, qty }: { variantId: string; qty: number }) => {
      // Read first: the unique index is (user_id, variant_id), so a second add
      // of the same variant is an UPDATE. RLS already narrows the read to this
      // buyer's own rows, which is why no user_id filter is sent (and why one
      // could not be: user_id is readable, not writable).
      const { data, error } = await shopFrom<ShopCartItemRow>("shop_cart_items")
        .select("id,qty")
        .eq("variant_id", variantId)
        .limit(1);
      if (error) throw error;
      const existing = (data ?? [])[0];
      if (existing) {
        const next = Math.min(CART_QTY_MAX, existing.qty + qty);
        const { error: upErr } = await shopFrom<ShopCartItemRow>("shop_cart_items")
          .update({ qty: next })
          .eq("id", existing.id);
        if (upErr) throw upErr;
        return;
      }
      const { error: insErr } = await shopFrom<ShopCartItemRow>("shop_cart_items")
        .insert({ variant_id: variantId, qty: Math.min(CART_QTY_MAX, qty) });
      if (insErr) throw insErr;
    },
    onSuccess: invalidate,
  });

  const setQty = useMutation({
    retry: false,
    mutationFn: async ({ cartItemId, qty }: { cartItemId: string; qty: number }) => {
      const { error } = await shopFrom<ShopCartItemRow>("shop_cart_items")
        .update({ qty })
        .eq("id", cartItemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    retry: false,
    mutationFn: async ({ cartItemId }: { cartItemId: string }) => {
      const { error } = await shopFrom<ShopCartItemRow>("shop_cart_items")
        .delete()
        .eq("id", cartItemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const restore = useMutation({
    retry: false,
    mutationFn: async ({ variantId, qty }: { variantId: string; qty: number }) => {
      const { error } = await shopFrom<ShopCartItemRow>("shop_cart_items")
        .insert({ variant_id: variantId, qty });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, setQty, remove, restore, invalidate };
};
