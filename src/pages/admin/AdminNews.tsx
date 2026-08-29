import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Eye, EyeOff, AlertCircle, CheckCircle2, Languages, ExternalLink, Play, Facebook } from "lucide-react";
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

type NewsOriginAdmin = {
  id: string;
  source_name: string;
  source_url: string;
  raw_title: string;
  content_kind: "full" | "brief";
  pipeline_status: "pending" | "extracting" | "rewriting" | "published" | "failed";
  attempts: number;
  last_error: string | null;
  created_at: string;
};

type FacebookPostStatus = "queued" | "pending" | "posted" | "failed" | "skipped";

type FacebookQueueItem = {
  id: string;
  title: string;
  slug: string | null;
  published_at: string;
  importance: number;
  pages: Record<string, {
    status: FacebookPostStatus;
    error: string | null;
    permalink: string | null;
    updated_at: string | null;
  }>;
};

const FACEBOOK_PAGES = [
  { key: "thepicklehub", label: "thepicklehub.net", startAt: null },
  { key: "ta-pickleball", label: "TA Pickleball", startAt: "2026-07-31T10:04:31Z" },
] as const;

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

function usePipelineStats() {
  return useQuery({
    queryKey: ["admin-news-pipeline-stats"],
    queryFn: async () => {
      const statuses = ["pending", "extracting", "rewriting", "published", "failed"] as const;
      const counts: Record<string, number> = {};
      for (const s of statuses) {
        const { count } = await supabase
          .from("news_origins")
          .select("id", { count: "exact", head: true })
          .eq("pipeline_status", s);
        counts[s] = count ?? 0;
      }
      return counts;
    },
    refetchInterval: 15_000,
  });
}

function useRecentOrigins() {
  return useQuery({
    queryKey: ["admin-news-origins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_origins")
        .select("id, source_name, source_url, raw_title, content_kind, pipeline_status, attempts, last_error, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as NewsOriginAdmin[];
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

function useFacebookQueue() {
  return useQuery({
    queryKey: ["admin-news-facebook-queue"],
    queryFn: async () => {
      // Match the Worker's ordering so the first row here is the next article
      // each Page will claim. Fetch enough candidates to expose backlog that
      // used to be hidden behind the already-posted top 50.
      const { data: news, error: newsError } = await supabase
        .from("news_items")
        .select("id,title,slug,published_at,importance")
        .eq("language", "vi")
        .eq("ai_translated", true)
        .eq("status", "published")
        .order("importance", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(500);
      if (newsError) throw newsError;

      const ids = (news ?? []).map((item) => item.id);
      if (ids.length === 0) return [] as FacebookQueueItem[];
      const { data: logs, error: logsError } = await supabase
        .from("fb_post_log")
        .select("news_item_id,page_key,status,error_message,fb_permalink,updated_at")
        .in("news_item_id", ids);
      if (logsError) throw logsError;

      const byItem = new Map<string, Map<string, typeof logs[number]>>();
      for (const log of logs ?? []) {
        const pageLogs = byItem.get(log.news_item_id) ?? new Map();
        pageLogs.set(log.page_key, log);
        byItem.set(log.news_item_id, pageLogs);
      }

      return (news ?? []).map((item) => ({
        ...item,
        pages: Object.fromEntries(FACEBOOK_PAGES.map((page) => {
          const log = byItem.get(item.id)?.get(page.key);
          const beforePageStart = page.startAt !== null &&
            new Date(item.published_at).getTime() < new Date(page.startAt).getTime();
          return [page.key, {
            status: (log?.status ?? (beforePageStart ? "skipped" : "queued")) as FacebookPostStatus,
            error: log?.error_message ?? null,
            permalink: log?.fb_permalink ?? null,
            updated_at: log?.updated_at ?? null,
          }];
        })),
      })) as FacebookQueueItem[];
    },
    refetchInterval: 15_000,
  });
}

function facebookStatusLabel(status: FacebookPostStatus) {
  return ({ queued: "Chờ đăng", pending: "Đang đăng", posted: "Đã đăng", failed: "Lỗi", skipped: "Bỏ qua" })[status];
}

function facebookStatusVariant(status: FacebookPostStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "posted") return "default";
  if (status === "failed") return "destructive";
  if (status === "pending") return "secondary";
  return "outline";
}

export default function AdminNews() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");

  const { data: sources, isLoading: sourcesLoading } = useSources();
  const { data: pipelineStats } = usePipelineStats();
  const { data: origins } = useRecentOrigins();
  const { data: items, isLoading: itemsLoading } = useRecentNews(
    statusFilter,
    languageFilter
  );
  const { data: facebookQueue, isLoading: facebookQueueLoading, error: facebookQueueError } = useFacebookQueue();
  const facebookBacklog = facebookQueue?.filter((item) =>
    FACEBOOK_PAGES.some((page) => !["posted", "skipped"].includes(item.pages[page.key].status)),
  ) ?? [];

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
      toast.success("Đã cập nhật source");
    },
    onError: (e: Error) => {
      toast.error("Không cập nhật được source", { description: e.message });
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
      toast.success("Đã cập nhật auto-publish");
    },
    onError: (e: Error) => {
      toast.error("Không cập nhật được auto-publish", { description: e.message });
    },
  });

  const requeueFailed = useMutation({
    mutationFn: async () => {
      const { error, count } = await supabase
        .from("news_origins")
        .update(
          {
            pipeline_status: "pending",
            attempts: 0,
            last_error: null,
            failure_kind: null,
            retryable: false,
            next_retry_at: null,
          },
          { count: "exact" },
        )
        .eq("pipeline_status", "failed");
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["admin-news-pipeline-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-news-origins"] });
      toast.success(`Đã re-queue ${n} bài để viết lại`);
    },
    onError: (e: Error) => {
      toast.error("Không re-queue được", { description: e.message });
    },
  });

  const runRewrite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("news-rewrite", {
        body: {},
      });
      if (error) throw error;
      return data as { picked?: number; published?: number; failed?: number };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["admin-news-pipeline-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-news-origins"] });
      qc.invalidateQueries({ queryKey: ["admin-news-recent"] });
      toast.success(
        `Đã xử lý ${result.picked ?? 0} job · publish ${result.published ?? 0}`,
      );
    },
    onError: (e: Error) => {
      toast.error("Không chạy được news rewrite", { description: e.message });
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
      toast.success("Đã đổi trạng thái");
    },
    onError: (e: Error) => {
      toast.error("Không đổi được trạng thái", { description: e.message });
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
                      3 * 3600 * 1000;
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
                          disabled={toggleActive.isPending}
                          onClick={() =>
                            toggleActive.mutate({ id: s.id, active: !s.active })
                          }
                        >
                          {s.active ? "Tắt" : "Bật"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleAutoPublish.isPending}
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

        {/* === Editorial rewrite queue === */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Languages className="w-4 h-4" /> Editorial rewrite EN + VI
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
              {(["pending", "extracting", "rewriting", "published", "failed"] as const).map(
                (k) => (
                  <div key={k} className="border rounded p-3">
                    <div className="text-xs text-muted-foreground uppercase">
                      {k}
                    </div>
                    <div className="text-2xl font-semibold">
                      {pipelineStats?.[k] ?? "—"}
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => runRewrite.mutate()}
                disabled={runRewrite.isPending}
              >
                <Play className="w-3 h-3 mr-2" />
                Run now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => requeueFailed.mutate()}
                disabled={
                  requeueFailed.isPending || (pipelineStats?.failed ?? 0) === 0
                }
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                Re-queue {pipelineStats?.failed ?? 0} failed
              </Button>
            </div>

            <div className="space-y-2 mt-5">
              {origins?.map((origin) => (
                <div key={origin.id} className="flex items-center gap-3 border rounded p-3">
                  <Badge variant={origin.pipeline_status === "failed" ? "destructive" : "outline"}>
                    {origin.pipeline_status}
                  </Badge>
                  <Badge variant="secondary">{origin.content_kind}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{origin.raw_title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {origin.source_name} · lần thử {origin.attempts}
                      {origin.last_error ? ` · ${origin.last_error}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <a
                      href={origin.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Mở nguồn của "${origin.raw_title}"`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* === Facebook publishing queue === */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Facebook className="w-4 h-4" /> Hàng đợi fanpage
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Tự làm mới mỗi 15 giây · thứ tự ưu tiên giống Worker đăng bài.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {FACEBOOK_PAGES.map((page) => {
                  const queued = facebookQueue?.filter((item) =>
                    !["posted", "skipped"].includes(item.pages[page.key].status),
                  ).length ?? 0;
                  const failed = facebookQueue?.filter((item) => item.pages[page.key].status === "failed").length ?? 0;
                  return (
                    <Badge key={page.key} variant={failed ? "destructive" : "secondary"}>
                      {page.label}: {queued} chờ{failed ? ` · ${failed} lỗi` : ""}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {facebookQueueLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : facebookQueueError ? (
              <div className="rounded border border-destructive/40 p-4 text-sm text-destructive">
                Không tải được hàng đợi Facebook: {facebookQueueError.message}
              </div>
            ) : facebookBacklog.length === 0 ? (
              <div className="rounded border p-6 text-center text-sm text-muted-foreground">
                Không còn bài nào chờ đăng lên hai fanpage.
              </div>
            ) : (
              <div className="space-y-2">
                {facebookBacklog.slice(0, 50).map((item, index) => (
                  <div key={item.id} className="border rounded p-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="shrink-0">#{index + 1}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Ưu tiên {item.importance} · {formatDistanceToNow(new Date(item.published_at), { addSuffix: true, locale: vi })}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {FACEBOOK_PAGES.map((page) => {
                            const state = item.pages[page.key];
                            const badge = (
                              <Badge variant={facebookStatusVariant(state.status)}>
                                {page.label}: {facebookStatusLabel(state.status)}
                              </Badge>
                            );
                            return state.permalink ? (
                              <a key={page.key} href={state.permalink} target="_blank" rel="noopener noreferrer" title="Mở bài Facebook">
                                {badge}
                              </a>
                            ) : <span key={page.key} title={state.error ?? undefined}>{badge}</span>;
                          })}
                        </div>
                        {FACEBOOK_PAGES.map((page) => item.pages[page.key].error ? (
                          <div key={`${page.key}-error`} className="text-xs text-destructive mt-1 truncate">
                            {page.label}: {item.pages[page.key].error}
                          </div>
                        ) : null)}
                      </div>
                      {item.slug && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/vi/news/${item.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`Xem bài "${item.title}"`}>
                            <Eye className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {facebookBacklog.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Đang hiển thị 50/{facebookBacklog.length} bài chờ.
                  </p>
                )}
              </div>
            )}
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
            ) : (items?.length ?? 0) === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Không có bài nào khớp bộ lọc hiện tại.
                </p>
              </div>
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
                            aria-label={`Xem bài "${item.title}"`}
                          >
                            <Eye className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setStatus.isPending}
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
