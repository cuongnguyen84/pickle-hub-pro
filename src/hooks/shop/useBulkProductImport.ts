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
//   3. publishBatch → inserts approved rows into shop_products via shopFrom
// ============================================================================

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/useAuth";
import { useMyShop } from "@/hooks/shop/useSellerApplication";
import { invokeWithBlobRetry } from "@/lib/edgeInvoke";
import { shopFrom } from "@/integrations/supabase/shop-client";
import type { ProductBulkImportInsert } from "@/integrations/supabase/shop-schema";

export interface EnrichedData {
  name: string;
  category: string | null;
  brand: string | null;
  description: string | null;
  specs: Record<string, string> | null;
  price_estimate_vnd: number | null;
  tags: string[] | null;
  confidence: number;
  slug: string;
}

export type RowStatus = "idle" | "enriching" | "done" | "low_confidence" | "failed";

export interface ProductRow {
  rowId: string;
  name: string;
  priceOverride: number | undefined;
  categoryOverride: string | undefined;
  aiEnriched: boolean;
  aiConfidence: number;
  aiData: EnrichedData | null;
  selected: boolean;
  status: RowStatus;
}

const COLUMN_NAME = "Tên sản phẩm";
const COLUMN_PRICE = "Giá bán";
const COLUMN_CATEGORY = "Danh mục";

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
        .map((row) => String(row[COLUMN_NAME] ?? "").trim())
        .filter((name) => name.length >= 2)
        .slice(0, 100)
        .map((name) => ({
          rowId: crypto.randomUUID(),
          name,
          priceOverride: Number(rowPrice(data, name)) || undefined,
          categoryOverride: rowCategory(data, name) || undefined,
          aiEnriched: false,
          aiConfidence: 0,
          aiData: null,
          selected: true,
          status: "idle" as const,
        }));

      setRows(parsed);
    } finally {
      setUploading(false);
    }
  }, []);

  const enrichOne = useCallback(async (rowId: string, productName: string) => {
    updateRow(rowId, { status: "enriching" });

    const { data, error } = await invokeWithBlobRetry<EnrichedData>(
      "product-import-enrich",
      { body: { product_name: productName } },
    );

    if (error || !data) {
      updateRow(rowId, { status: "failed" });
      return;
    }

    updateRow(rowId, {
      aiEnriched: true,
      aiConfidence: data.confidence,
      aiData: data,
      status: data.confidence < 0.5 ? "low_confidence" : "done",
    });
  }, [updateRow]);

  const publishBatch = useCallback(async (): Promise<number | null> => {
    const currentShopId = shop.data?.id;
    if (!currentShopId || !user) return null;

    const approved = rows.filter((r) => r.selected && r.status === "done" && r.aiData);
    if (approved.length === 0) return null;

    const batchId = crypto.randomUUID();

    const inserts: ProductBulkImportInsert[] = approved.map((row) => ({
      shop_id: currentShopId,
      slug: row.aiData!.slug,
      title: row.aiData!.name ?? row.name,
      description: row.aiData!.description,
      category_slug: row.categoryOverride ?? row.aiData!.category,
      specs: row.aiData!.specs ?? {},
      status: "draft" as const,
      import_batch_id: batchId,
      ai_enriched: true,
      ai_confidence: row.aiConfidence,
    }));

    setPublishing(true);
    try {
      const { error } = await shopFrom<ProductRow>("products")
        .insert(inserts[0] as unknown as Record<string, unknown>);
      if (error) return null;

      // Insert remaining rows one at a time (shop-client insert takes single row)
      for (let i = 1; i < inserts.length; i++) {
        await shopFrom<ProductRow>("products").insert(inserts[i] as unknown as Record<string, unknown>);
      }

      setRows([]);
      return inserts.length;
    } finally {
      setPublishing(false);
    }
  }, [rows, shop.data?.id, user]);

  const downloadTemplate = useCallback(() => {
    const template = [
      { [COLUMN_NAME]: "Joola Ben Johns Hyperion CAS 16mm", [COLUMN_PRICE]: 4290000, [COLUMN_CATEGORY]: "paddle" },
      { [COLUMN_NAME]: "Selkirk Vanguard Power Air Invikta", [COLUMN_PRICE]: "", [COLUMN_CATEGORY]: "" },
      { [COLUMN_NAME]: "Franklin X-40 Outdoor Pickleballs 12-pack", [COLUMN_PRICE]: "", [COLUMN_CATEGORY]: "ball" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sản phẩm");
    XLSX.writeFile(wb, "thepicklehub-product-import-template.xlsx");
  }, []);

  const reset = useCallback(() => setRows([]), []);

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

function rowPrice(data: Record<string, unknown>[], name: string): unknown {
  const match = data.find((r) => String(r[COLUMN_NAME] ?? "").trim() === name);
  return match?.[COLUMN_PRICE];
}

function rowCategory(data: Record<string, unknown>[], name: string): string | null {
  const match = data.find((r) => String(r[COLUMN_NAME] ?? "").trim() === name);
  const cat = match?.[COLUMN_CATEGORY];
  return typeof cat === "string" && cat.trim().length > 0 ? cat.trim() : null;
}
