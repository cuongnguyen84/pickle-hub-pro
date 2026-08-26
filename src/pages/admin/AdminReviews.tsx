import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { EyeOff, Eye, Trash2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

// Admin moderation for venue_reviews (P3). Model A: reviews publish immediately;
// this is the reactive hide/delete surface. RLS already grants admin update/delete
// + select of hidden rows, so the normal (aal2) client is enough here.

type ReviewStatus = "published" | "hidden";
type StatusFilter = "all" | ReviewStatus;

interface AdminReviewRow {
  id: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  created_at: string;
  created_by: string;
  venue: { slug: string; name: string; name_vi: string | null } | null;
  authorName: string;
}

const PAGE_LIMIT = 100;

async function fetchReviews(statusFilter: StatusFilter): Promise<AdminReviewRow[]> {
  let q = supabase
    .from("venue_reviews")
    .select("id, rating, body, status, created_at, created_by, venue:venues(slug, name, name_vi)")
    .order("created_at", { ascending: false })
    .limit(PAGE_LIMIT);
  if (statusFilter !== "all") q = q.eq("status", statusFilter);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Omit<AdminReviewRow, "authorName">[];
  if (rows.length === 0) return [];

  const ids = Array.from(new Set(rows.map((r) => r.created_by)));
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? ""]));
  return rows.map((r) => ({ ...r, authorName: nameById.get(r.created_by) || "" }));
}

export default function AdminReviews() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const queryKey = useMemo(() => ["admin-venue-reviews", statusFilter], [statusFilter]);

  const { data: reviews = [], isLoading } = useQuery<AdminReviewRow[]>({
    queryKey,
    queryFn: () => fetchReviews(statusFilter),
    staleTime: 15_000,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReviewStatus }) => {
      const { error } = await supabase
        .from("venue_reviews")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { status }) => {
      toast.success(status === "hidden" ? "Đã ẩn đánh giá" : "Đã hiện lại đánh giá");
      qc.invalidateQueries({ queryKey: ["admin-venue-reviews"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Không cập nhật được"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("venue_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xoá đánh giá");
      qc.invalidateQueries({ queryKey: ["admin-venue-reviews"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Không xoá được"),
  });

  const busy = setStatus.isPending || remove.isPending;
  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "published", label: "Đang hiện" },
    { key: "hidden", label: "Đã ẩn" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Đánh giá sân</h1>
          <p className="text-muted-foreground">Kiểm duyệt đánh giá sân từ cộng đồng — ẩn hoặc xoá nội dung vi phạm.</p>
        </div>

        <div className="flex gap-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? "default" : "outline"}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-muted-foreground">Chưa có đánh giá nào.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const clamped = Math.max(1, Math.min(5, r.rating));
              const venueName = r.venue?.name_vi || r.venue?.name || "—";
              return (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-amber-400">
                        {"★".repeat(clamped)}
                        <span className="text-muted-foreground">{"★".repeat(5 - clamped)}</span>
                      </span>
                      {r.venue ? (
                        <Link to={`/san/${r.venue.slug}`} className="font-medium inline-flex items-center gap-1 hover:underline">
                          {venueName} <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="font-medium">{venueName}</span>
                      )}
                      <span className="text-muted-foreground">· {r.authorName || "Người chơi"}</span>
                      <span className="text-muted-foreground">
                        · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: vi })}
                      </span>
                      <Badge variant={r.status === "hidden" ? "destructive" : "secondary"}>
                        {r.status === "hidden" ? "Đã ẩn" : "Đang hiện"}
                      </Badge>
                    </div>
                    {r.body && <p className="mt-2 text-sm">{r.body}</p>}
                    <div className="mt-3 flex gap-2">
                      {r.status === "published" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setStatus.mutate({ id: r.id, status: "hidden" })}
                        >
                          <EyeOff className="h-4 w-4 mr-1" /> Ẩn
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setStatus.mutate({ id: r.id, status: "published" })}
                        >
                          <Eye className="h-4 w-4 mr-1" /> Hiện lại
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => {
                          if (confirm("Xoá vĩnh viễn đánh giá này?")) remove.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Xoá
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
