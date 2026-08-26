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
  Pencil,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { ShopScrollShell, SellerShell } from "@/components/shop/ShopShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBulkProductImport } from "@/hooks/shop/useBulkProductImport";

export default function BulkImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [enriching, setEnriching] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
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
    setPublishError(null);
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
    setPublishError(null);
    try {
      const result = await publishBatch();
      setPublishResult(`Đã xuất bản ${result.count} sản phẩm lên Shop.`);
    } catch (error) {
      setPublishError(publishErrorMessage(error));
    }
  };

  const setImageFile = (rowId: string, file: File | null) => {
    const row = rows.find((item) => item.rowId === rowId);
    if (!row) return;
    if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl);
    updateRow(rowId, {
      selectedImageFile: file,
      imagePreviewUrl: file ? URL.createObjectURL(file) : null,
      selectedImageUrl: file ? null : row.selectedImageUrl,
    });
  };

  const updateAiField = <K extends "name" | "category" | "brand" | "description">(
    rowId: string,
    field: K,
    value: string,
  ) => {
    const row = rows.find((item) => item.rowId === rowId);
    if (!row?.aiData) return;
    updateRow(rowId, {
      aiData: { ...row.aiData, [field]: value || null },
    });
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

              <div className="space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.rowId}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`select-${row.rowId}`}
                        checked={row.selected}
                        disabled={row.status !== "done"}
                        onCheckedChange={(v) => updateRow(row.rowId, { selected: !!v })}
                        className="mt-0.5"
                        aria-label={`Chọn ${row.aiData?.name || row.name} để xuất bản`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.aiData?.name || row.name}</p>
                        {!row.aiData && <p className="mt-1 text-xs text-muted-foreground">Dữ liệu gốc từ file</p>}
                        {row.status === "failed" && row.errorMessage && (
                          <p className="mt-1 text-xs text-destructive" role="alert">{row.errorMessage}</p>
                        )}
                      </div>
                      <StatusBadge status={row.status} confidence={row.aiConfidence} />
                    </div>

                    {row.aiData && (
                      <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`name-${row.rowId}`}>Tên sản phẩm</Label>
                          <Input
                            id={`name-${row.rowId}`}
                            value={row.aiData.name}
                            onChange={(event) => updateAiField(row.rowId, "name", event.target.value)}
                            minLength={2}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`category-${row.rowId}`}>Danh mục</Label>
                          <select
                            id={`category-${row.rowId}`}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={row.categoryOverride ?? row.aiData.category ?? ""}
                            onChange={(event) => updateRow(row.rowId, { categoryOverride: event.target.value })}
                            required
                          >
                            <option value="">Chọn danh mục</option>
                            {PRODUCT_CATEGORIES.map((category) => (
                              <option key={category.value} value={category.value}>{category.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`brand-${row.rowId}`}>Thương hiệu</Label>
                          <Input
                            id={`brand-${row.rowId}`}
                            value={row.aiData.brand ?? ""}
                            onChange={(event) => updateAiField(row.rowId, "brand", event.target.value)}
                            placeholder="Không bắt buộc"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`price-${row.rowId}`}>Giá bán (₫)</Label>
                          <Input
                            id={`price-${row.rowId}`}
                            inputMode="numeric"
                            value={row.priceOverride ?? row.aiData.price_estimate_vnd ?? ""}
                            onChange={(event) => {
                              const digits = event.target.value.replace(/\D/g, "");
                              updateRow(row.rowId, { priceOverride: digits ? Number(digits) : undefined });
                            }}
                            placeholder="Bắt buộc"
                            required
                          />
                          {(row.priceOverride ?? row.aiData.price_estimate_vnd) ? (
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(row.priceOverride ?? row.aiData.price_estimate_vnd)}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`description-${row.rowId}`}>Mô tả</Label>
                          <Textarea
                            id={`description-${row.rowId}`}
                            value={row.aiData.description ?? ""}
                            onChange={(event) => updateAiField(row.rowId, "description", event.target.value)}
                            rows={3}
                          />
                        </div>
                        <fieldset className="space-y-2 sm:col-span-2">
                          <legend className="text-sm font-medium">Ảnh sản phẩm</legend>
                          {row.aiData.image_candidates.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              {row.aiData.image_candidates.map((candidate) => {
                                const selected = row.selectedImageUrl === candidate.url;
                                return (
                                  <label
                                    key={candidate.url}
                                    className={`cursor-pointer overflow-hidden rounded-lg border-2 bg-muted ${selected ? "border-primary" : "border-transparent"}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`image-${row.rowId}`}
                                      className="sr-only"
                                      checked={selected}
                                      onChange={() => {
                                        if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl);
                                        updateRow(row.rowId, {
                                          selectedImageUrl: candidate.url,
                                          selectedImageFile: null,
                                          imagePreviewUrl: null,
                                        });
                                      }}
                                    />
                                    <img
                                      src={candidate.url}
                                      alt={candidate.alt || row.aiData!.name}
                                      className="aspect-square w-full object-contain"
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                    />
                                    <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">
                                      {new URL(candidate.source_url).hostname.replace(/^www\./, "")}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Chưa tìm thấy ảnh đáng tin cậy. Anh/chị có thể dán URL ảnh bên dưới.
                            </p>
                          )}
                          {row.imagePreviewUrl && (
                            <div className="relative w-36 overflow-hidden rounded-lg border-2 border-primary bg-muted">
                              <img
                                src={row.imagePreviewUrl}
                                alt={`Ảnh tải lên cho ${row.aiData.name}`}
                                className="aspect-square w-full object-contain"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute right-1 top-1 h-7 w-7"
                                onClick={() => setImageFile(row.rowId, null)}
                                aria-label="Bỏ ảnh đã tải lên"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <Label
                              htmlFor={`image-file-${row.rowId}`}
                              className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                            >
                              <ImagePlus className="mr-2 h-4 w-4" />
                              {row.selectedImageFile ? "Thay ảnh tải lên" : "Tải ảnh từ thiết bị"}
                            </Label>
                            <input
                              id={`image-file-${row.rowId}`}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                if (file) setImageFile(row.rowId, file);
                                event.target.value = "";
                              }}
                            />
                            <span className="text-xs text-muted-foreground">JPG, PNG hoặc WebP · tối đa 8 MB</span>
                          </div>
                          <Label className="sr-only" htmlFor={`image-url-${row.rowId}`}>URL ảnh sản phẩm</Label>
                          <Input
                            id={`image-url-${row.rowId}`}
                            type="url"
                            value={row.selectedImageUrl ?? ""}
                            onChange={(event) => {
                              if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl);
                              updateRow(row.rowId, {
                                selectedImageUrl: event.target.value || null,
                                selectedImageFile: null,
                                imagePreviewUrl: null,
                              });
                            }}
                            placeholder="https://…/anh-san-pham.jpg"
                          />
                        </fieldset>
                        {row.status === "low_confidence" && (
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateRow(row.rowId, { status: "done", selected: true })}
                              disabled={!(row.aiData.name.trim() && (row.categoryOverride ?? row.aiData.category)?.trim())}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Tôi đã kiểm tra thông tin này
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {row.status === "failed" && (
                      <div className="mt-3 border-t pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void enrichOne(row.rowId, row.name)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Thử lại sản phẩm này
                        </Button>
                      </div>
                    )}
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
                        Đang xuất bản…
                      </>
                    ) : (
                      `Xuất bản ${doneCount} sản phẩm`
                    )}
                  </Button>
                )}
              </div>

              {publishResult && (
                <div className="flex items-center gap-2 pt-2 text-sm text-green-600 dark:text-green-400" role="status">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {publishResult}
                </div>
              )}
              {publishError && (
                <div className="flex items-center gap-2 pt-2 text-sm text-destructive" role="alert">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {publishError}
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

const PRODUCT_CATEGORIES = [
  { value: "vot", label: "Vợt" },
  { value: "bong", label: "Bóng" },
  { value: "tui-balo", label: "Túi & balo" },
  { value: "giay", label: "Giày" },
  { value: "trang-phuc", label: "Trang phục" },
  { value: "grip-phu-kien", label: "Grip & phụ kiện" },
] as const;

function publishErrorMessage(error: unknown): string {
  const detail = error as { message?: string; code?: string; details?: string; hint?: string };
  const message = detail.message ?? "";
  if (message.includes("shop_unavailable")) return "Không tìm thấy shop đang hoạt động.";
  if (message.includes("no_products_selected")) return "Chọn ít nhất một sản phẩm đã sẵn sàng.";
  if (message.includes("invalid_product_data")) return "Tên sản phẩm, danh mục và giá bán là bắt buộc.";
  if (message.includes("product_image_required")) return "Cần một ảnh sản phẩm hợp lệ. Ảnh tìm tự động không tải được; hãy tải ảnh từ thiết bị rồi thử lại.";
  if (message.includes("product_preflight_failed")) return `Sản phẩm chưa đạt điều kiện xuất bản (${message.split(":")[1] || "dữ liệu chưa đủ"}).`;
  if (message.includes("duplicate") || message.includes("unique")) return "Có sản phẩm bị trùng. Hãy đổi tên rồi thử lại.";
  if (message.includes("row-level security") || message.includes("42501")) return "Tài khoản chưa có quyền thêm sản phẩm cho shop này.";
  if (message.includes("products_specs_shape")) return "Thông số AI có dữ liệu không hợp lệ. Hãy chạy AI lại hoặc thử xuất bản lần nữa.";
  if (message.includes("products_category_slug_fkey")) return "Danh mục sản phẩm không tồn tại trong hệ thống.";
  const diagnostic = [detail.code, message, detail.details].filter(Boolean).join(" · ");
  return diagnostic
    ? `Chưa lưu được sản phẩm: ${diagnostic}`
    : "Chưa lưu được sản phẩm. Dữ liệu chỉnh sửa vẫn còn nguyên — thử lại sau vài giây.";
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
