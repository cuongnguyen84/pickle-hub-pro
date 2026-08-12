// ============================================================================
// Buyer-facing reads. Every one is a P2b.3 public wrapper.
// ----------------------------------------------------------------------------
// None of these functions accepts a privilege flag, and none of them is a
// table select: what a buyer may see is decided in Postgres by
// shop_product_is_publishable(), so a screen cannot widen it by asking for one
// more column.
//
// The counts, the price ranges and the availability labels all arrive derived.
// A client that computed any of them would eventually disagree with the PDP,
// and the buyer would be the one to find out.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { shopRpc } from "@/integrations/supabase/shop-client";

export type Availability = "in_stock" | "out_of_stock" | "unknown";

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  condition: "new" | "used";
  created_at: string;
  category: { slug: string; name: string };
  shop: { slug: string; name: string; verified: boolean };
  price_min: number | null;
  price_max: number | null;
  availability: Availability | null;
  cover: { public_path: string; alt_text: string | null; width: number | null; height: number | null } | null;
}

export interface SearchPage {
  rows: ProductCard[];
  total: number;
  has_more: boolean;
}

export interface SearchArgs {
  q?: string | null;
  categorySlug?: string | null;
  shopSlug?: string | null;
  condition?: "new" | "used" | null;
  inStockOnly?: boolean;
  sort?: "recent" | "price_asc" | "price_desc";
  cursorAt?: string | null;
  cursorId?: string | null;
  limit?: number;
}

const PUB = ["shop", "public"] as const;

const searchKey = (a: SearchArgs) =>
  [
    ...PUB, "search",
    a.q ?? "", a.categorySlug ?? "", a.shopSlug ?? "", a.condition ?? "",
    a.inStockOnly ? 1 : 0, a.sort ?? "recent", a.cursorAt ?? "", a.cursorId ?? "",
  ] as const;

/**
 * Discovery, category and search are the same query with different arguments —
 * deliberately, so a product cannot be visible on one of those screens and
 * missing from another.
 *
 * react-query keys on the full argument list, which is also what makes the
 * search race safe: a response for "vo" cannot be written into the cache entry
 * for "vot", so a slow earlier keystroke can never overwrite a later one.
 */
export const usePublicSearch = (a: SearchArgs, enabled = true) =>
  useQuery({
    queryKey: searchKey(a),
    enabled,
    // A buyer typing sees the previous page rather than a spinner flash on
    // every keystroke.
    placeholderData: (prev) => prev,
    queryFn: () =>
      shopRpc<SearchPage>("shop_public_search", {
        _q: a.q?.trim() || null,
        _category_slug: a.categorySlug ?? null,
        _shop_slug: a.shopSlug ?? null,
        _condition: a.condition ?? null,
        _in_stock_only: a.inStockOnly ?? false,
        _sort: a.sort ?? "recent",
        _cursor_at: a.cursorAt ?? null,
        _cursor_id: a.cursorId ?? null,
        _limit: a.limit ?? 24,
      }),
  });

export interface PublicCategory {
  slug: string;
  name: string;
  sort_order: number;
  product_count: number;
}

export const usePublicCategories = (onlyStocked = false) =>
  useQuery({
    queryKey: [...PUB, "categories", onlyStocked],
    queryFn: () => shopRpc<PublicCategory[]>("shop_public_categories", { _only_stocked: onlyStocked }),
    staleTime: 5 * 60 * 1000,
  });

export interface PublicProductResult {
  found: boolean;
  redirect_to?: string | null;
  product?: Record<string, unknown>;
  contacts?: { id: string; type: string; href: string; label: string | null }[];
}

export const usePublicProduct = (slug: string | null) =>
  useQuery({
    queryKey: [...PUB, "product", slug],
    enabled: !!slug,
    queryFn: () => shopRpc<PublicProductResult>("shop_public_product", { _slug: slug }),
  });

export interface PublicShopResult {
  found: boolean;
  shop?: {
    slug: string; name: string; intro: string | null; region: string | null;
    verified: boolean; verified_at: string | null;
    shipping_note: string | null; return_note: string | null;
    primary_category_slug: string | null; product_count: number;
  };
  contacts?: { id: string; type: string; href: string; label: string | null }[];
}

export const usePublicShopPage = (slug: string | null) =>
  useQuery({
    queryKey: [...PUB, "shop", slug],
    enabled: !!slug,
    queryFn: () => shopRpc<PublicShopResult>("shop_public_shop", { _slug: slug }),
  });
