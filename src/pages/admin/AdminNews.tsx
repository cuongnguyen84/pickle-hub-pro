import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Eye, EyeOff, AlertCircle, CheckCircle2, Languages } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

/**
 * /admin/news — Phase 5 moderation surface for the news aggregator.
 *
 * Three panels:
 *
 *   1. Source health — one row per news_sources entry. Shows
 *      last_fetched_at, last_success_at, last_error. Lets admin toggle
 *      `active` (kill switch when a feed misbehaves) and `auto_publish`
 *      (queue everything as draft instead of going live).
 *
 *   2. Translation queue — counts by ai_translation_status with a
 *      "re-queue failed" button that resets ai_translation_status from
 *      'failed' to 'pending' so the next news-translate run retries.
 *
 *   3. Recent items — last 50 published rows with quick unpublish and
 *      a link to the live page.
 *
 * All writes go through the standard supabase client with service_role
 * NOT in use here — the admin user is RLS-authenticated via the global
 * Admin wrapper. RLS on news_items is "published = readable"; admin
 * mutations land via the existing admin role check at the route level.
 */

type Source = {
  id: string;
  name: string;
  feed_url: string | null;
  feed_type: string;
  active: boolean;
  auto_publish: boolean;
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type NewsItemAdmin = {
  id: string;
  title: string;
  language: "en" | "vi";
  status: "draft" | "scheduled" | "published";
  source: string | null;
  slug: string | null;
  published_at: string;
  ai_translation_status: string | null;
};

function useSources() {
  return useQuery({
    queryKey: ["admin-news-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_sources")
        .select("*")
        .order("id");
      if (error) throw error;
      return data as Source[];
    },
  });
}

function useTranslationStats() {
  return useQuery({
    queryKey: ["admin-news-translate-stats"],
    queryFn: async () => {
      const statuses = ["pending", "translating", "done", "failed"] as const;
      const counts: Record<string, number> = {};
      for (const s of statuses) {
        const { count } = await supabase
          .from("news_items")
          .select("id", { count: "exact", head: true })
          .eq("language", "en")
          .eq("ai_translation_status", s);
        counts[s] = count ?? 0;
      }
      return counts;
    },
    refetchInterval: 15_000,
  });
}

function useRecentNews(statusFilter: string, languageFilter: string) {
  return useQuery({
    queryKey: ["admin-news-recent", statusFilter, languageFilter],
    queryFn: async () => {
      let q = supabase
        .from("news_items")
        .select(
          "id, title, language, status, source, slug, published_at, ai_translation_status"
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as "scheduled" | "draft" | "published");
      if (languageFilter !== "all") q = q.eq("language", languageFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as NewsItemAdmin[];
    },
  });
}

export default function AdminNews() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");

  const { data: sources, isLoading: sourcesLoading } = useSources();
  const { data: translateStats } = useTranslationStats();
  const { data: items, isLoading: itemsLoading } = useRecentNews(
    statusFilter,
    languageFilter
  );

  // ----- Mutations -----
  const toggleActive = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("news_sources")
        .update({ active: vars.active })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-news-sources"] });
      toast({ title: "Đã cập nhật source" });
    },
  });

  const toggleAutoPublish = useMutation({
    mutationFn: async (vars: { id: string; auto: boolean }) => {
      const { error } = await supabase
        .from("news_sources")
        .update({ auto_publish: vars.auto })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-news-sources"] });
      toast({ title: "Đã cập nhật auto-publish" });
    },
  });

  const requeueFailed = useMutation({
    mutationFn: async () => {
      const { error, count } = await supabase
        .from("news_items")
        .update(
          {
            ai_translation_status: "pending",
            ai_translation_error: null,
          },
          { count: "exact" },
        )
        .eq("ai_translation_status", "failed");
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["admin-news-translate-stats"] });
      toast({ title: `Đã re-queue ${n} bài để dịch lại` });
    },
  });

  const setStatus = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: "draft" | "published";
    }) => {
      const { error } = await supabase
        .from("news_items")
        .update({ status: vars.status })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-news-recent"] });
      toast({ title: "Đã đổi trạng thái" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">News aggregator</h1>
          <p className="text-sm text-muted-foreground">
            Sức khoẻ feed, hàng đợi dịch AI, và moderation cho /news.
          </p>
        </div>
        {/* === Source health === */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Source health
            </h2>
            {sourcesLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-2">
                {sources?.map((s) => {
                  const ok =
                    s.last_success_at &&
                    Date.now() - new Date(s.last_success_at).getTime() <
                      6 * 3600 * 1000;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 border rounded p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {ok ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                          )}
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {s.feed_type}
                          </Badge>
                          {!s.active && (
                            <Badge variant="destructive" className="text-xs">
                              inactive
                            </Badge>
                          )}
                          {!s.auto_publish && (
                            <Badge variant="secondary" className="text-xs">
                              manual review
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {s.last_success_at
                            ? `Lần cuối thành công ${formatDistanceToNow(new Date(s.last_success_at), { addSuffix: true, locale: vi })}`
                            : "Chưa fetch lần nào"}
                          {s.last_error ? ` · lỗi: ${s.last_error.slice(0, 80)}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant={s.active ? "outline" : "default"}
                          onClick={() =>
                            toggleActive.mutate({ id: s.id, active: !s.active })
                          }
                        >
                          {s.active ? "Tắt" : "Bật"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            toggleAutoPublish.mutate({
                              id: s.id,
                              auto: !s.auto_publish,
                            })
                          }
                        >
                          {s.auto_publish ? "→ draft" : "→ auto"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* === Translation queue === */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Languages className="w-4 h-4" /> AI translation (Gemini)
            </h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {(["pending", "translating", "done", "failed"] as const).map(
                (k) => (
                  <div key={k} className="border rounded p-3">
                    <div className="text-xs text-muted-foreground uppercase">
                      {k}
                    </div>
                    <div className="text-2xl font-semibold">
                      {translateStats?.[k] ?? "—"}
                    </div>
                  </div>
                )
              )}
            </div>
            <Button
              size="sm"
              onClick={() => requeueFailed.mutate()}
              disabled={
                requeueFailed.isPending || (translateStats?.failed ?? 0) === 0
              }
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Re-queue {translateStats?.failed ?? 0} failed
            </Button>
          </CardContent>
        </Card>

        {/* === Recent items === */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent items (50)</h2>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={languageFilter}
                  onValueChange={setLanguageFilter}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cả 2 lang</SelectItem>
                    <SelectItem value="en">EN</SelectItem>
                    <SelectItem value="vi">VI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {itemsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-2">
                {items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 border rounded p-3"
                  >
                    <Badge
                      variant={item.language === "vi" ? "secondary" : "outline"}
                    >
                      {item.language}
                    </Badge>
                    <Badge
                      variant={
                        item.status === "published" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {item.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.source} ·{" "}
                        {formatDistanceToNow(new Date(item.published_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.slug && item.status === "published" && (
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={
                              item.language === "vi"
                                ? `/vi/news/${item.slug}`
                                : `/news/${item.slug}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Eye className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatus.mutate({
                            id: item.id,
                            status:
                              item.status === "published"
                                ? "draft"
                                : "published",
                          })
                        }
                      >
                        <EyeOff className="w-3 h-3 mr-1" />
                        {item.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
