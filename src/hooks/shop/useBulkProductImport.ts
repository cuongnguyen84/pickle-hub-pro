// ============================================================================
// Bulk product import — Excel parsing + AI enrichment + batch insert.
// ----------------------------------------------------------------------------
// architecture-boundaries.md §3: Supabase calls live in hooks, never in JSX.
// The page composes these mutations; all edge-function invocations go through
// invokeWithBlobRetry (blob-loss resilience).
//
// Flow:
//   1. parseExcel → ProductRow[] (client-side, no server call)
//   2. enrichOne → calls product-import-enrich edge function
//   3. publishBatch → atomically inserts approved rows into products via shopFrom
// ============================================================================

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/useAuth";
import { useMyShop } from "@/hooks/shop/useSellerApplication";
import { invokeWithBlobRetry } from "@/lib/edgeInvoke";
import { shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow as ShopProductRow } from "@/integrations/supabase/shop-schema";
import { invokePublishProduct } from "@/hooks/shop/useProductModeration";
import { cleanSpecs } from "@/lib/shop/productSpecs";
import { cartesian } from "@/lib/shop/variantMatrix";

export interface EnrichedData {
  name: string;
  category: string | null;
  brand: string | null;
  description: string | null;
  specs: Record<string, string> | null;
  price_estimate_vnd: number | null;
  tags: string[] | null;
  versions: string[] | null;
  colors: string[] | null;
  confidence: number;
  slug: string;
  image_candidates: ProductImageCandidate[];
}

export interface ProductImageCandidate {
  url: string;
  source_url: string;
  alt: string;
}

export type RowStatus = "idle" | "enriching" | "done" | "low_confidence" | "failed";

export interface ProductRow {
  rowId: string;
  name: string;
  priceOverride: number | undefined;
  categoryOverride: string | undefined;
  versionOptions: string[];
  colorOptions: string[];
  aiEnriched: boolean;
  aiConfidence: number;
  aiData: EnrichedData | null;
  selectedImageUrls: string[];
  manualImageUrl: string | null;
  selectedImageFile: File | null;
  imagePreviewUrl: string | null;
  selected: boolean;
  status: RowStatus;
  errorMessage: string | null;
}

export interface PublishResult {
  count: number;
  batchId: string;
}

interface SubmitResult {
  ok: boolean;
  needs_publish?: boolean;
  problems?: Array<{ code?: string }>;
}

const COLUMN_NAME = "Tên sản phẩm";
const COLUMN_PRICE = "Giá bán";
const COLUMN_CATEGORY = "Danh mục";
const COLUMN_VERSION = "Phiên bản";
const COLUMN_COLOR = "Màu sắc";

export function useBulkProductImport() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { user } = useAuth();
  const shop = useMyShop();

  const updateRow = useCallback((rowId: string, patch: Partial<ProductRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }, []);

  const parseExcel = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const parsed: ProductRow[] = data
        .map((row) => ({
          name: String(row[COLUMN_NAME] ?? "").trim(),
          price: parsePrice(row[COLUMN_PRICE]),
          category: typeof row[COLUMN_CATEGORY] === "string"
            ? row[COLUMN_CATEGORY].trim()
            : "",
          versions: parseOptions(row[COLUMN_VERSION]),
          colors: parseOptions(row[COLUMN_COLOR]),
        }))
        .filter(({ name }) => name.length >= 2)
        .slice(0, 100)
        .map(({ name, price, category, versions, colors }) => ({
          rowId: crypto.randomUUID(),
          name,
          priceOverride: price,
          categoryOverride: normalizeCategory(category) || undefined,
          versionOptions: versions,
          colorOptions: colors,
          aiEnriched: false,
          aiConfidence: 0,
          aiData: null,
          selectedImageUrls: [],
          manualImageUrl: null,
          selectedImageFile: null,
          imagePreviewUrl: null,
          selected: true,
          status: "idle" as const,
          errorMessage: null,
        }));

      setRows(parsed);
    } finally {
      setUploading(false);
    }
  }, []);

  const enrichOne = useCallback(async (rowId: string, productName: string) => {
    updateRow(rowId, { status: "enriching", errorMessage: null });

    const { data, error } = await invokeWithBlobRetry<EnrichedData>(
      "product-import-enrich",
      { body: { product_name: productName } },
    );

    if (error || !data) {
      updateRow(rowId, { status: "failed", errorMessage: await enrichmentErrorMessage(error) });
      return;
    }

    const normalizedData = {
      ...data,
      image_candidates: data.image_candidates ?? [],
      versions: data.versions ?? [],
      colors: data.colors ?? [],
    };
    setRows((previous) => previous.map((row) => row.rowId === rowId ? {
      ...row,
      aiEnriched: true,
      aiConfidence: data.confidence,
      aiData: { ...normalizedData, category: normalizeCategory(normalizedData.category) },
      versionOptions: row.versionOptions.length ? row.versionOptions : normalizedData.versions,
      colorOptions: row.colorOptions.length ? row.colorOptions : normalizedData.colors,
      selectedImageUrls: normalizedData.image_candidates[0]?.url
        ? [normalizedData.image_candidates[0].url]
        : [],
      status: data.confidence < 0.5 ? "low_confidence" : "done",
      errorMessage: null,
    } : row));
  }, [updateRow]);

  const publishBatch = useCallback(async (): Promise<PublishResult> => {
    const currentShopId = shop.data?.id;
    if (!currentShopId || !user) throw new Error("shop_unavailable");

    const approved = rows.filter((r) => r.selected && r.status === "done" && r.aiData);
    if (approved.length === 0) throw new Error("no_products_selected");
    if (approved.some((r) =>
      !(r.aiData?.name || r.name).trim()
      || !(r.categoryOverride ?? r.aiData?.category)?.trim()
      || !((r.priceOverride ?? r.aiData?.price_estimate_vnd) ?? 0)
    )) {
      throw new Error("invalid_product_data");
    }

    const batchId = crypto.randomUUID();

    setPublishing(true);
    try {
      const inserted: ShopProductRow[] = [];
      // Use the canonical editor RPC: it creates the default priced variant in
      // the same transaction. A raw products insert leaves no price for the
      // seller list or storefront and is therefore not a valid shop product.
      for (const row of approved) {
        const product = await shopRpc<ShopProductRow>("product_create", {
          _shop_id: currentShopId,
          // products_client_token_len allows at most 64 characters. rowId is
          // already a stable UUID for this imported row, so it is both valid
          // and idempotent when the seller retries after a network failure.
          _client_token: row.rowId,
          _payload: {
            title: (row.aiData!.name || row.name).trim(),
            description: row.aiData!.description ?? "",
            category_slug: normalizeCategory(row.categoryOverride ?? row.aiData!.category),
            condition: "new",
            price_vnd: String(row.priceOverride ?? row.aiData!.price_estimate_vnd),
            stock_on_hand: "",
          },
        });
        const { data: updated, error } = await shopFrom<ShopProductRow>("products")
          .update({
            import_batch_id: batchId,
            ai_enriched: true,
            ai_confidence: row.aiConfidence,
            ai_source_urls: imageSources(row),
            specs: cleanSpecs({
              ...normalizeAiSpecs(row.aiData!.specs),
              ...(row.aiData!.brand ? { brand: row.aiData!.brand } : {}),
            }),
          })
          .eq("id", product.id)
          .select("*")
          .single();
        if (error) throw error;
        const current = updated ?? product;
        const groups = [
          ...(row.versionOptions.length ? [{ name: "Phiên bản", values: row.versionOptions }] : []),
          ...(row.colorOptions.length ? [{ name: "Màu sắc", values: row.colorOptions }] : []),
        ];
        if (groups.length) {
          const optionValues = cartesian(groups);
          await shopRpc("product_variants_reconcile", {
            _product_id: current.id,
            _expected_version: current.version,
            _option_groups: groups,
            _rows: optionValues.map((values, index) => ({
              option_values: values,
              price_vnd: String(row.priceOverride ?? row.aiData!.price_estimate_vnd),
              stock_on_hand: null,
              sku: null,
              position: index,
            })),
            _client_token: `variants-${row.rowId}`,
            _keep_variant_id: null,
          });
        }
        const { data: publishable, error: refreshError } = await shopFrom<ShopProductRow>("products")
          .select("*")
          .eq("id", current.id)
          .single();
        if (refreshError) throw refreshError;
        const images = await resolveProductImages(row);
        if (images.length === 0) throw new Error("product_image_required");
        for (const image of images) await uploadProductImage(current.id, image);

        const submitted = await shopRpc<SubmitResult>("product_submit", {
          _product_id: current.id,
          _expected_version: (publishable ?? current).version,
          _client_token: `publish-${row.rowId}`,
        });
        if (!submitted.ok) {
          const codes = submitted.problems?.map((problem) => problem.code).filter(Boolean).join(",");
          throw new Error(`product_preflight_failed:${codes || "unknown"}`);
        }
        if (submitted.needs_publish) await invokePublishProduct(current.id);
        inserted.push(current);
      }

      rows.forEach((row) => row.imagePreviewUrl && URL.revokeObjectURL(row.imagePreviewUrl));
      setRows([]);
      return { count: inserted.length, batchId };
    } finally {
      setPublishing(false);
    }
  }, [rows, shop.data?.id, user]);

  const downloadTemplate = useCallback(() => {
    const template = [
      { [COLUMN_NAME]: "Joola Ben Johns Hyperion CAS", [COLUMN_PRICE]: 4290000, [COLUMN_CATEGORY]: "Vợt", [COLUMN_VERSION]: "14mm, 16mm", [COLUMN_COLOR]: "Đen, Trắng" },
      { [COLUMN_NAME]: "Franklin X-40 Outdoor Pickleballs 12-pack", [COLUMN_PRICE]: 500000, [COLUMN_CATEGORY]: "Bóng", [COLUMN_VERSION]: "12 quả", [COLUMN_COLOR]: "Vàng" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws["!cols"] = [{ wch: 48 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 28 }];
    const categories = XLSX.utils.json_to_sheet(SYSTEM_CATEGORIES.map(({ label, slug }) => ({
      "Danh mục hợp lệ": label,
      "Mã hệ thống": slug,
    })));
    categories["!cols"] = [{ wch: 24 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sản phẩm");
    XLSX.utils.book_append_sheet(wb, categories, "Danh mục hợp lệ");
    XLSX.writeFile(wb, "thepicklehub-product-import-template.xlsx");
  }, []);

  const reset = useCallback(() => {
    rows.forEach((row) => row.imagePreviewUrl && URL.revokeObjectURL(row.imagePreviewUrl));
    setRows([]);
  }, [rows]);

  return {
    rows,
    uploading,
    publishing,
    parseExcel,
    enrichOne,
    publishBatch,
    downloadTemplate,
    reset,
    updateRow,
    setRows,
    shopId: shop.data?.id ?? null,
  };
}

async function resolveProductImages(row: ProductRow): Promise<File[]> {
  const files = row.selectedImageFile ? [row.selectedImageFile] : [];
  const urls = [...new Set([...row.selectedImageUrls, row.manualImageUrl].filter(Boolean) as string[])];
  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.match(/^image\/(jpeg|png|webp)$/) || blob.size > 8 * 1024 * 1024) continue;
      const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      files.push(new File([blob], `ai-product-${row.rowId}-${index + 1}.${extension}`, { type: blob.type }));
    } catch {
      // One remote host may block downloads; preserve every other selected image.
    }
  }
  return files;
}

function parsePrice(value: unknown): number | undefined {
  if (typeof value === "number") return value > 0 ? Math.round(value) : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return parsed > 0 ? parsed : undefined;
}

function parseOptions(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[,;|\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 20);
}

function normalizeAiSpecs(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (rawValue === null || rawValue === undefined) continue;
    if (!["string", "number", "boolean"].includes(typeof rawValue)) continue;
    const value = String(rawValue).trim().slice(0, 120);
    if (value) output[key] = value;
  }
  return output;
}

function imageSources(row: ProductRow): string[] {
  const sources = row.selectedImageUrls.flatMap((url) => {
    const source = row.aiData?.image_candidates.find((candidate) => candidate.url === url)?.source_url;
    return source ? [url, source] : [url];
  });
  if (row.manualImageUrl) sources.push(row.manualImageUrl);
  return [...new Set(sources)];
}

const SYSTEM_CATEGORIES = [
  { slug: "vot", label: "Vợt" },
  { slug: "bong", label: "Bóng" },
  { slug: "tui-balo", label: "Túi & balo" },
  { slug: "giay", label: "Giày" },
  { slug: "trang-phuc", label: "Trang phục" },
  { slug: "grip-phu-kien", label: "Grip & phụ kiện" },
] as const;

const CATEGORY_MAP: Record<string, string> = {
  vot: "vot",
  bong: "bong",
  "tui-balo": "tui-balo",
  "tui-va-balo": "tui-balo",
  giay: "giay",
  "trang-phuc": "trang-phuc",
  "grip-phu-kien": "grip-phu-kien",
  "grip-va-phu-kien": "grip-phu-kien",
  paddle: "vot",
  ball: "bong",
  bag: "tui-balo",
  shoe: "giay",
  apparel: "trang-phuc",
  net: "grip-phu-kien",
  accessory: "grip-phu-kien",
  other: "grip-phu-kien",
};

function normalizeCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/&/g, " va ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return CATEGORY_MAP[key] ?? null;
}

async function uploadProductImage(productId: string, file: File): Promise<void> {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 8 * 1024 * 1024) {
    throw new Error("invalid_product_image");
  }
  const init = await shopRpc<{ media_id: string; draft_path: string; rendition_path: string }>(
    "product_media_upload_init",
    {
      _product_id: productId,
      _content_type: file.type,
      _byte_size: file.size,
      _original_filename: file.name,
      _client_token: crypto.randomUUID(),
    },
  );
  const processed = await processProductImage(file);
  const original = await supabase.storage.from("shop-product-media-draft")
    .upload(init.draft_path, file, { upsert: true, contentType: file.type });
  if (original.error) throw original.error;
  const rendition = await supabase.storage.from("shop-product-media-draft")
    .upload(init.rendition_path, processed.blob, { upsert: true, contentType: processed.blob.type });
  if (rendition.error) throw rendition.error;
  await shopRpc("product_media_finalize", {
    _media_id: init.media_id,
    _width: processed.width,
    _height: processed.height,
  });
}

async function processProductImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid_product_image");
    context.drawImage(bitmap, 0, 0, width, height);
    const encode = (type: "image/webp" | "image/jpeg") => new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.78));
    let blob = await encode("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg");
    if (!blob || blob.size > 1024 * 1024) throw new Error("invalid_product_image");
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

async function enrichmentErrorMessage(error: unknown): Promise<string> {
  const response = (error as { context?: Response })?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json() as { error?: string };
      const messages: Record<string, string> = {
        ai_unavailable: "Dịch vụ AI đang tạm thời không phản hồi.",
        ai_no_response: "AI không trả về nội dung.",
        ai_invalid_json: "AI trả về dữ liệu không đúng định dạng.",
        rate_limited: "Đã vượt giới hạn 30 sản phẩm/phút. Chờ một phút rồi thử lại.",
        unauthorized: "Phiên đăng nhập đã hết hạn. Tải lại trang và đăng nhập lại.",
      };
      if (payload.error && messages[payload.error]) return messages[payload.error];
      if (payload.error) return `Không xử lý được: ${payload.error}`;
    } catch {
      // Fall through to the SDK message.
    }
  }
  const message = (error as { message?: string })?.message;
  return message || "Không kết nối được dịch vụ AI.";
}
