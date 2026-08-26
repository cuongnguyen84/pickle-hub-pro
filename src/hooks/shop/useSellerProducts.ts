// ============================================================================
// Seller catalog — data hooks (P2a step 4).
// ----------------------------------------------------------------------------
// architecture-boundaries.md §3: Supabase calls live here, never in JSX.
//
// Every write goes through an RPC, and every RPC is guarded in Postgres
// (migration 20260811200000). The screen disables what the seller may not
// change; the database is what actually stops them.
//
// Two things this module refuses to do, because both produce a number the
// seller will believe:
//   * count rows client-side. The list is paginated, so the length of what
//     came back is the size of the page, not the size of the catalog. The
//     total comes from PostgREST's exact count and the per-status numbers from
//     product_status_counts().
//   * sort after fetching. Ordering a page of 20 sorts twenty rows out of two
//     hundred; the seller's rejected product stays on page 4. The order is
//     products.action_rank, decided in Postgres.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { escapeLike, shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import type {
  ProductMediaRow,
  ProductRow,
  ProductStatus,
  ProductVariantRow,
  SellerProductRow,
} from "@/integrations/supabase/shop-schema";

export const PAGE_SIZE = 20;

/** The list's sort options, mapped to real columns. Anything not in here is
 *  not offered in the UI, so the seller can never sort by something the index
 *  does not cover. */
export const PRODUCT_SORTS = {
  action: { label: "Cần xử lý trước", column: "action_rank", ascending: true },
  updated: { label: "Sửa gần đây", column: "updated_at", ascending: false },
  created: { label: "Mới đăng", column: "created_at", ascending: false },
  title: { label: "Tên A→Z", column: "title", ascending: true },
} as const;

export type ProductSort = keyof typeof PRODUCT_SORTS;

export interface ProductListFilters {
  search: string;
  status: ProductStatus | "all";
  category: string | "all";
  sort: ProductSort;
  page: number;
}

export const EMPTY_FILTERS: ProductListFilters = {
  search: "",
  status: "all",
  category: "all",
  sort: "action",
  page: 0,
};

export const hasActiveFilter = (f: ProductListFilters) =>
  f.search.trim() !== "" || f.status !== "all" || f.category !== "all";

/** Query keys. The list key carries the filters so two filter states do not
 *  share a cache entry, and every product key sits under ["shop","products"]
 *  so one invalidate reaches the list without touching the shop profile. */
export const productKeys = {
  all: ["shop", "products"] as const,
  list: (shopId: string | null, f: ProductListFilters) =>
    ["shop", "products", "list", shopId, f.search.trim(), f.status, f.category, f.sort, f.page] as const,
  counts: (shopId: string | null) => ["shop", "products", "counts", shopId] as const,
  one: (productId: string | null) => ["shop", "products", "one", productId] as const,
};

// Columns, named. `select("*")` on products would pull internal_note into the
// browser for an admin session, and a seller-facing screen has no business
// carrying it even when RLS would allow it.
const PRODUCT_COLUMNS =
  "id,shop_id,slug,title,description,category_slug,condition,status,is_published," +
  "in_stock,availability_updated_at,submitted_at,decided_at,applicant_note," +
  "requested_fields,version,client_token,option_groups,specs,created_at,updated_at";

const LIST_COLUMNS =
  `${PRODUCT_COLUMNS},product_variants(id,price_vnd,stock_on_hand,position,sku,retired_at),product_media(id,position,public_path,draft_path)`;

export interface ProductListResult {
  rows: SellerProductRow[];
  /** Total matching the CURRENT filters, from the database, not the page. */
  total: number;
  pageCount: number;
}

export const useSellerProducts = (shopId: string | null, filters: ProductListFilters) =>
  useQuery({
    queryKey: productKeys.list(shopId, filters),
    enabled: !!shopId,
    // A stale list that shows a product the seller just archived is worse than
    // a spinner: they archive it twice.
    staleTime: 10_000,
    queryFn: async (): Promise<ProductListResult> => {
      const sort = PRODUCT_SORTS[filters.sort];
      let query = shopFrom<SellerProductRow>("products")
        .select(LIST_COLUMNS, { count: "exact" })
        .eq("shop_id", shopId!);

      if (filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.category !== "all") query = query.eq("category_slug", filters.category);

      const search = filters.search.trim();
      // Title only. Searching the description too sounds generous until a
      // seller cannot work out why a product they can see is not in the results
      // — the match was in a paragraph the list does not render.
      if (search) query = query.ilike("title", `%${escapeLike(search)}%`);

      query = query
        .order(sort.column, { ascending: sort.ascending })
        // Second key so a page boundary is stable: two products sharing an
        // action_rank must not swap places between page 1 and page 2.
        .order("id", { ascending: true })
        .range(filters.page * PAGE_SIZE, filters.page * PAGE_SIZE + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      const total = count ?? 0;
      return {
        rows: data ?? [],
        total,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      };
    },
  });

/** Per-status totals for the filter chips, from one GROUP BY over the whole
 *  catalog. Never derived from the loaded page. */
export const useProductStatusCounts = (shopId: string | null) =>
  useQuery({
    queryKey: productKeys.counts(shopId),
    enabled: !!shopId,
    staleTime: 10_000,
    queryFn: async (): Promise<Partial<Record<ProductStatus, number>>> =>
      (await shopRpc<Partial<Record<ProductStatus, number>>>("product_status_counts", {
        _shop_id: shopId,
      })) ?? {},
  });

export interface SellerProductDetail extends ProductRow {
  variants: ProductVariantRow[];
  media: ProductMediaRow[];
  mediaCount: number;
}

export const useSellerProduct = (productId: string | null) =>
  useQuery({
    queryKey: productKeys.one(productId),
    enabled: !!productId,
    queryFn: async (): Promise<SellerProductDetail | null> => {
      const { data, error } = await shopFrom<
        ProductRow & { product_variants: ProductVariantRow[]; product_media: ProductMediaRow[] }
      >("products")
        .select(`${PRODUCT_COLUMNS},product_variants(*),product_media(*)`)
        .eq("id", productId!)
        .limit(1);
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) return null;
      const { product_variants, product_media, ...rest } = row;
      return {
        ...rest,
        // Retired variants keep their SKU and their ledger, and are NOT on the
        // shelf. Handing them to the matrix editor would show the seller a row
        // they retired and re-save it on the next matrix write — which is how
        // the QA sweep found seven cards for a six-combination product.
        variants: (product_variants ?? [])
          .filter((v) => v.retired_at === null)
          .sort((a, b) => a.position - b.position),
        media: (product_media ?? []).slice().sort((a, b) => a.position - b.position),
        mediaCount: (product_media ?? []).length,
      };
    },
  });

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface ProductDraft {
  title: string;
  description: string;
  category_slug: string;
  condition: "new" | "used";
  /** Thông số kỹ thuật theo ngành hàng. Chỉ gửi khi SỬA — product_create
   *  không nhận specs, và màn thêm sản phẩm nói thẳng "lưu nháp trước", đúng
   *  như nó đang làm với ảnh. */
  specs: Record<string, string>;
  /** Kept as the seller typed it. Parsed and validated in Postgres, which is
   *  the only place that may decide what a price is. */
  price_vnd: string;
  stock_on_hand: string;
}

/**
 * Create.
 *
 * `clientToken` is minted by the screen once per create attempt and replayed
 * on retry, so a double tap or a timeout the browser never saw the answer to
 * returns the FIRST product instead of making a second one. The token is the
 * caller's to hold: generating it here would mint a new one per attempt and
 * buy nothing.
 */
export const useCreateProduct = (shopId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientToken: string; draft: ProductDraft }) =>
      await shopRpc<ProductRow>("product_create", {
        _shop_id: shopId,
        _client_token: input.clientToken,
        _payload: {
          title: input.draft.title,
          description: input.draft.description,
          category_slug: input.draft.category_slug,
          condition: input.draft.condition,
          price_vnd: input.draft.price_vnd,
          stock_on_hand: input.draft.stock_on_hand,
        },
      }),
    onSuccess: (row) => {
      qc.setQueryData(productKeys.one(row.id), null);
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

/**
 * Update.
 *
 * The expected version travels with the write. Postgres compares it under a
 * row lock and refuses a stale one, so two tabs cannot silently overwrite each
 * other — the loser gets 40001 and a choice, not a surprise.
 */
export const useUpdateProduct = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expectedVersion: number;
      patch: Partial<
        Pick<ProductDraft, "title" | "description" | "category_slug" | "condition" | "specs">
      >;
      // KHÔNG có `variant` ở đây, một cách có chủ ý. RPC vẫn nhận `_variant`
      // — đó là API hợp lệ của máy chủ — nhưng màn hình sửa sản phẩm không có
      // ô giá nào, nên mọi con số gửi từ đây đều là số ôi thiu ghi đè lên thứ
      // bảng phiên bản vừa lưu. Đó là lỗi đã ăn mất hai lần sửa giá thật ngày
      // 18/08, và nó sống được vì cái tham số này tồn tại để ai đó điền vào.
      // Bỏ nó đi làm cho lỗi không viết ra được nữa, thay vì chỉ không xảy ra.
    }) =>
      await shopRpc<ProductRow>("product_update", {
        _product_id: productId,
        _expected_version: input.expectedVersion,
        _patch: input.patch,
        _variant: null,
      }),
    onSuccess: () => {
      // Refetch rather than patching the cache: the variant write happened in
      // the same transaction and is not in the returned product row.
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

export const useUpdateProductSlug = (productId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) =>
      await shopRpc<string>("product_slug_update", { _product_id: productId, _slug: slug }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.one(productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

export const useArchiveProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; archived: boolean }) =>
      await shopRpc<string>(input.archived ? "product_unarchive" : "product_archive", {
        _product_id: input.productId,
      }),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: productKeys.one(input.productId) });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};
