// ============================================================================
// /seller/products/import — Bulk product import with AI enrichment.
// ----------------------------------------------------------------------------
// Step 1: Upload .xlsx / .csv (client-side SheetJS parse)
// Step 2: AI enrich each row sequentially via product-import-enrich
// Step 3: Preview grid → select rows → publish as draft
//
// Uses SellerShell for consistent seller-center chrome.
// All Supabase calls live in the useBulkProductImport hook (ARCH-01 §3).
// ============================================================================

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import { ShopScrollShell, SellerShell } from "@/components/shop/ShopShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useBulkProductImport } from "@/hooks/shop/useBulkProductImport";

export default function BulkImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [enriching, setEnriching] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const {
    rows,
    uploading,
    publishing,
    parseExcel,
    enrichOne,
    publishBatch,
    downloadTemplate,
    reset,
    updateRow,
    shopId,
  } = useBulkProductImport();

  const handleFile = async (file: File) => {
    setPublishResult(null);
    await parseExcel(file);
  };

  const handleEnrichAll = async () => {
    setEnriching(true);
    try {
      for (const row of rows) {
        if (row.status !== "idle") continue;
        await enrichOne(row.rowId, row.name);
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }
    } finally {
      setEnriching(false);
    }
  };

  const handlePublish = async () => {
    const count = await publishBatch();
    if (count !== null) {
      setPublishResult(`Đã thêm ${count} sản phẩm vào danh mục.`);
    }
  };

  const idleCount = rows.filter((r) => r.status === "idle").length;
  const doneCount = rows.filter((r) => r.selected && r.status === "done").length;

  return (
    <ShopScrollShell>
      <SellerShell active="products" title="Nhập sản phẩm hàng loạt">
        <div className="tl-shop-page space-y-6">
          {/* Step 1: Upload */}
          {rows.length === 0 && (
            <section className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">
                  {uploading ? "Đang đọc file…" : "Nhấn để chọn file Excel hoặc CSV"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cột bắt buộc: <strong>Tên sản phẩm</strong>. Các cột khác là tùy chọn.
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Tải mẫu Excel
              </Button>
            </section>
          )}

          {/* Step 2: Enrichment results */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {rows.length} sản phẩm · {doneCount} sẵn sàng xuất bản
                </p>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Xóa tất cả
                </Button>
              </div>

              <div className="space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.rowId}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Checkbox
                      checked={row.selected}
                      disabled={row.status !== "done"}
                      onCheckedChange={(v) => updateRow(row.rowId, { selected: !!v })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{row.name}</p>
                      {row.aiData && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {[row.aiData.brand, row.aiData.category, formatPrice(row.priceOverride ?? row.aiData.price_estimate_vnd)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {row.aiData?.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.aiData.description}</p>
                      )}
                    </div>
                    <StatusBadge status={row.status} confidence={row.aiConfidence} />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                {idleCount > 0 && !enriching && (
                  <Button onClick={() => void handleEnrichAll()} disabled={!shopId}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI điền thông tin ({idleCount})
                  </Button>
                )}
                {enriching && (
                  <Button disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang xử lý…
                  </Button>
                )}
                {doneCount > 0 && !enriching && (
                  <Button onClick={() => void handlePublish()} disabled={publishing}>
                    {publishing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang lưu…
                      </>
                    ) : (
                      `Xuất bản ${doneCount} sản phẩm`
                    )}
                  </Button>
                )}
              </div>

              {publishResult && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 pt-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {publishResult}
                </div>
              )}
            </>
          )}

          {!shopId && rows.length > 0 && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Bạn cần có shop đang hoạt động để nhập sản phẩm.{" "}
              <Link to="/seller" className="underline">Về tổng quan</Link>
            </p>
          )}
        </div>
      </SellerShell>
    </ShopScrollShell>
  );
}

function StatusBadge({ status, confidence }: { status: string; confidence: number }) {
  switch (status) {
    case "enriching":
      return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin inline" />Xử lý…</Badge>;
    case "done":
      return <Badge variant="default">{Math.round(confidence * 100)}%</Badge>;
    case "low_confidence":
      return <Badge variant="destructive">Kiểm tra</Badge>;
    case "failed":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1 inline" />Lỗi</Badge>;
    default:
      return null;
  }
}

function formatPrice(vnd: number | null | undefined): string {
  if (!vnd || vnd <= 0) return "";
  return `${vnd.toLocaleString("vi-VN")}₫`;
}
