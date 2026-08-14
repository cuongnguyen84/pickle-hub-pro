// ============================================================================
// Seller shop profile — data hooks (P2a step 3).
// ----------------------------------------------------------------------------
// architecture-boundaries.md §3: Supabase calls live here, never in JSX.
//
// Every write goes through an RPC, and every RPC is guarded in Postgres. The
// form disables what the seller may not change; the database is what actually
// stops them.
//
// Errors are thrown, not swallowed: a failed save that renders as an empty
// field reads to the seller as "my text is gone".
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import { useAuth } from "@/hooks/useAuth";
import type {
  ProductCategoryRow,
  ShopContactChannelRow,
  ShopContactType,
  ShopRow,
} from "@/integrations/supabase/shop-schema";

/** My membership row for the shop I belong to, with the role that decides
 *  whether this session may edit anything. Resolved from shop_members rather
 *  than shops.owner_user_id, because a manager is not the owner and must still
 *  reach their own shop. */
export interface MyMembership {
  shop_id: string;
  role: "owner" | "manager" | "fulfillment" | "support";
}

const KEY = {
  membership: (uid: string | null) => ["shop", "my-membership", uid] as const,
  shop: (id: string | null) => ["shop", "profile", id] as const,
  contacts: (id: string | null) => ["shop", "contacts", id] as const,
  categories: ["shop", "categories"] as const,
};

// Moved to lib/shop/errors.ts when the product editor needed the same mapping.
// Re-exported so step 3's call sites keep importing it from where they always
// have — two copies of an error table is how one of them stops being true.
export { shopErrorMessage } from "@/lib/shop/errors";

export const useMyShopMembership = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY.membership(user?.id ?? null),
    enabled: !!user,
    queryFn: async (): Promise<MyMembership | null> => {
      // RLS on shop_members also returns the OTHER members of my shops, so the
      // filter is mine specifically — otherwise a shop with two staff would
      // resolve to whichever row came back first.
      const { data, error } = await shopFrom<MyMembership & { user_id: string }>("shop_members")
        .select("shop_id,user_id,role");
      if (error) throw error;
      const mine = (data ?? []).find((row) => row.user_id === user!.id);
      return mine ? { shop_id: mine.shop_id, role: mine.role } : null;
    },
  });
};

export const useShopCategories = () =>
  useQuery({
    queryKey: KEY.categories,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<ProductCategoryRow[]> => {
      const { data, error } = await shopFrom<ProductCategoryRow>("product_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useShopProfile = (shopId: string | null) =>
  useQuery({
    queryKey: KEY.shop(shopId),
    enabled: !!shopId,
    queryFn: async (): Promise<ShopRow | null> => {
      const { data, error } = await shopFrom<ShopRow>("shops")
        .select("*")
        .eq("id", shopId!)
        .limit(1);
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });

export const useShopContacts = (shopId: string | null) =>
  useQuery({
    queryKey: KEY.contacts(shopId),
    enabled: !!shopId,
    queryFn: async (): Promise<ShopContactChannelRow[]> => {
      const { data, error } = await shopFrom<ShopContactChannelRow>("shop_contact_channels")
        .select("*")
        .eq("shop_id", shopId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export interface ProfilePatch {
  name?: string;
  intro?: string;
  city?: string;
  region?: string;
  primary_category_slug?: string;
  shipping_note?: string;
  return_note?: string;
}

/**
 * The expected version travels with the write. The server compares it under a
 * row lock and refuses a stale one, so two tabs cannot silently overwrite each
 * other — the loser gets 40001 and a message, not a surprise.
 */
export const useUpdateShopProfile = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { expectedVersion: number; patch: ProfilePatch }) => {
      return await shopRpc<ShopRow>("shop_profile_update", {
        _shop_id: shopId,
        _expected_version: input.expectedVersion,
        _patch: input.patch,
      });
    },
    onSuccess: (row) => {
      qc.setQueryData(KEY.shop(shopId), row);
    },
  });
};

/** Separate from the profile save on purpose — see the migration header. */
export const useUpdateShopSlug = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) =>
      await shopRpc<string>("shop_slug_update", { _shop_id: shopId, _slug: slug }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.shop(shopId) });
    },
  });
};

export const useUpsertContact = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      type: ShopContactType;
      value: string;
      label?: string;
      isPublic: boolean;
    }) =>
      await shopRpc<ShopContactChannelRow>("shop_contact_upsert", {
        _shop_id: shopId,
        _type: input.type,
        _value: input.value,
        _label: input.label ?? null,
        _is_public: input.isPublic,
        _id: input.id ?? null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.contacts(shopId) });
    },
  });
};

export const useDeleteContact = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => await shopRpc<boolean>("shop_contact_delete", { _id: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.contacts(shopId) });
    },
  });
};
