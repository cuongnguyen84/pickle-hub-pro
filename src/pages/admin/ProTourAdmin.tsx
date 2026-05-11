import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PlayCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Navigate } from "react-router-dom";
// Single source of truth for the URL shape — same regex the Worker
// uses to gatekeep /scrape. Importing it here means a future bracket
// host (APP / MLP / new PPA URL convention) only needs the change in
// the adapter, never duplicated in the admin UI. The previous local
// regex required hex-only chars in the tournaments segment, which
// rejected the current PPA slug form (e.g. ppa-tour-2026-ppa-finals)
// even though the Worker accepted it.
import { PRO_TOUR_HOST_PATTERN } from "@/lib/pro-tour/adapters/rsc-scraper";

/**
 * /admin/pro-tour — Sprint 6 admin surface for the pro tour ingestion
 * pipeline. Three tabs:
 *   1. Manual trigger — paste a brackets.pickleballtournaments.com URL
 *      and POST to the pro-tour-scraper Worker. Surfaces success/failure
 *      inline.
 *   2. Watchlist — list + add tournaments tracked on the cron schedule.
 *      CRUD is minimal-but-functional; advanced edit (frequency change,
 *      pause toggle) acceptable as inline buttons; defer richer UI Sprint 7.
 *   3. Logs — paginated pro_tour_ingestion_logs ordered by started_at
 *      DESC with status badges (queued/running/success/failed/partial).
 *
 * Per existing admin convention (src/components/admin/AdminLayout) this
 * page uses AdminLayout, not TheLineLayout. The TheLineLayout directive
 * (memory feedback_theline_layout_default) applies to user-facing pages;
 * admin pages stay on AdminLayout for nav consistency with the rest of
 * /admin/*.
 */

const ProTourAdmin = () => {
  const { language } = useI18n();
  const { isAdmin, isLoading: authLoading } = useAdminAuth();

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AdminLayout>
      <div className="container-wide py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">
            {language === "vi" ? "Pro Tour Ingestion" : "Pro Tour Ingestion"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === "vi"
              ? "Quản lý import dữ liệu trận đấu từ PPA / APP / MLP brackets vào Feed."
              : "Manage match data ingestion from PPA / APP / MLP brackets into the Feed."}
          </p>
        </div>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList>
            <TabsTrigger value="manual">
              {language === "vi" ? "Trigger thủ công" : "Manual trigger"}
            </TabsTrigger>
            <TabsTrigger value="watchlist">
              {language === "vi" ? "Watchlist" : "Watchlist"}
            </TabsTrigger>
            <TabsTrigger value="logs">
              {language === "vi" ? "Lịch sử" : "Logs"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="pt-6">
            <ManualTriggerTab language={language} />
          </TabsContent>
          <TabsContent value="watchlist" className="pt-6">
            <WatchlistTab language={language} />
          </TabsContent>
          <TabsContent value="logs" className="pt-6">
            <LogsTab language={language} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

/* ─── Tab 1: Manual trigger ────────────────────────────────────────────── */

function ManualTriggerTab({ language }: { language: "vi" | "en" }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | null
    | { ok: true; log_id: string; matches_extracted: number; players_extracted: number }
    | { ok: false; error: string }
  >(null);

  const submit = async () => {
    setResult(null);
    if (!PRO_TOUR_HOST_PATTERN.test(url)) {
      setResult({
        ok: false,
        error:
          language === "vi"
            ? "URL không hợp lệ — phải khớp pattern brackets.pickleballtournaments.com/tournaments/.../events/.../elimination/..."
            : "URL invalid — must match brackets.pickleballtournaments.com/tournaments/.../events/.../elimination/...",
      });
      return;
    }
    setSubmitting(true);
    try {
      // Calls the Cloudflare Worker via its public endpoint. The Worker
      // verifies HMAC signature against SCRAPER_AUTH_SECRET. The signing
      // logic mirrors workers/pro-tour-scraper/README.md curl example.
      // For now we hit the Supabase edge function indirectly: the Worker
      // owns auth + ingestion; this UI POSTs to the Worker.
      const workerUrl = (import.meta as { env?: { VITE_PRO_TOUR_SCRAPER_URL?: string } }).env
        ?.VITE_PRO_TOUR_SCRAPER_URL;
      if (!workerUrl) {
        throw new Error(
          "VITE_PRO_TOUR_SCRAPER_URL not set in env — see workers/pro-tour-scraper/README.md",
        );
      }
      const body = JSON.stringify({
        tournament_url: url,
        triggered_by: "manual" as const,
        user_id: user?.id ?? null,
      });
      // Signature is computed server-side by an admin-gated Supabase
      // edge function (out of scope for this initial UI; for Sprint 6
      // PR-A the admin signs offline via the curl pattern in the
      // Worker README). UI POSTs unsigned for now and surfaces the 401
      // clearly so Cuong can either set up the signing edge fn next
      // PR or call the Worker directly via curl while the UI is being
      // hardened. Production-grade signing flow lives in PR-B.
      const res = await fetch(`${workerUrl}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = (await res.json()) as
        | { ok: true; log_id: string; matches_extracted: number; players_extracted: number }
        | { ok: false; error: string };
      setResult(json);
      if ("ok" in json && json.ok) {
        toast({
          title: language === "vi" ? "Bắt đầu scrape" : "Scrape started",
          description:
            language === "vi"
              ? `Log ID: ${json.log_id} — ${json.matches_extracted} trận, ${json.players_extracted} người chơi`
              : `Log ID: ${json.log_id} — ${json.matches_extracted} matches, ${json.players_extracted} players`,
        });
      }
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          {language === "vi" ? "URL bracket tournament" : "Tournament bracket URL"}
        </label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://brackets.pickleballtournaments.com/tournaments/.../events/.../elimination/..."
          disabled={submitting}
        />
      </div>
      <Button onClick={submit} disabled={submitting || !url} className="gap-2">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        <PlayCircle className="h-4 w-4" />
        {language === "vi" ? "Trigger Ingestion" : "Trigger Ingestion"}
      </Button>
      {result && (
        <div
          className={`rounded-md border p-4 ${
            "ok" in result && result.ok
              ? "border-green-600/30 bg-green-600/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          {"ok" in result && result.ok ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div className="text-sm">
                <div className="font-semibold">
                  {language === "vi" ? "Thành công" : "Success"}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Log ID: <code>{result.log_id}</code>
                  <br />
                  {result.matches_extracted}{" "}
                  {language === "vi" ? "trận đấu, " : "matches, "}
                  {result.players_extracted}{" "}
                  {language === "vi" ? "người chơi" : "players"}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="text-sm">
                <div className="font-semibold">
                  {language === "vi" ? "Lỗi" : "Error"}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {(result as { error: string }).error}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Tab 2: Watchlist ─────────────────────────────────────────────────── */

interface WatchlistRow {
  id: string;
  tournament_url: string;
  tournament_name: string | null;
  status: "active" | "paused" | "completed";
  scrape_frequency: "daily" | "weekly" | "on_event_end" | "manual";
  last_scraped_at: string | null;
  next_scrape_at: string | null;
  created_at: string;
}

function WatchlistTab({ language }: { language: "vi" | "en" }) {
  const { data: rows = [], isLoading, refetch } = useQuery<WatchlistRow[]>({
    queryKey: ["pro-tour-watchlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_tour_watchlist")
        .select(
          "id, tournament_url, tournament_name, status, scrape_frequency, last_scraped_at, next_scrape_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WatchlistRow[];
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {language === "vi"
          ? "Tournament được theo dõi tự động (cron 6h). Thêm qua SQL trực tiếp đến khi UI form ship Sprint 6 PR-B."
          : "Tournaments tracked on the 6h cron. Add via direct SQL until the form UI lands in Sprint 6 PR-B."}
      </p>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === "vi" ? "Watchlist trống." : "Watchlist empty."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {row.tournament_name ?? row.tournament_url}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {row.tournament_url}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={row.status === "active" ? "default" : "secondary"}
                >
                  {row.status}
                </Badge>
                <Badge variant="outline">{row.scrape_frequency}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => refetch()}>
        {language === "vi" ? "Tải lại" : "Refresh"}
      </Button>
    </div>
  );
}

/* ─── Tab 3: Logs ──────────────────────────────────────────────────────── */

interface LogRow {
  id: string;
  source_provider: string;
  source_url: string;
  triggered_by: "manual" | "scheduled";
  status: "queued" | "running" | "success" | "failed" | "partial";
  matches_imported: number;
  players_created: number;
  players_matched: number;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

function LogsTab({ language }: { language: "vi" | "en" }) {
  const { data: rows = [], isLoading, refetch } = useQuery<LogRow[]>({
    queryKey: ["pro-tour-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_tour_ingestion_logs")
        .select(
          "id, source_provider, source_url, triggered_by, status, matches_imported, players_created, players_matched, duration_ms, error_message, started_at, completed_at",
        )
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => refetch()}>
        {language === "vi" ? "Tải lại" : "Refresh"}
      </Button>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === "vi" ? "Chưa có log nào." : "No logs yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-md border p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={row.status} />
                  <Badge variant="outline">{row.triggered_by}</Badge>
                  <Badge variant="outline">{row.source_provider}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.started_at).toLocaleString(
                    language === "vi" ? "vi-VN" : "en-US",
                  )}
                </span>
              </div>
              <div className="mt-2 truncate text-xs text-muted-foreground">
                {row.source_url}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {row.matches_imported}{" "}
                {language === "vi" ? "trận, " : "matches, "}
                {row.players_created}{" "}
                {language === "vi" ? "tạo / " : "created / "}
                {row.players_matched}{" "}
                {language === "vi" ? "khớp" : "matched"}
                {row.duration_ms != null && ` · ${row.duration_ms}ms`}
              </div>
              {row.error_message && (
                <div className="mt-2 rounded bg-destructive/5 p-2 text-xs text-destructive">
                  {row.error_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: LogRow["status"] }) {
  const cls =
    status === "success"
      ? "bg-green-600 text-white"
      : status === "failed"
        ? "bg-destructive text-white"
        : status === "partial"
          ? "bg-yellow-600 text-white"
          : "bg-muted text-foreground";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

export default ProTourAdmin;
