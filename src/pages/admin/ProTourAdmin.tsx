import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Navigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
// Single source of truth for the URL shape — same regex the Worker
// uses to gatekeep /scrape. Future bracket hosts (APP / MLP / new PPA
// URL convention) only need the change in the adapter, never duplicated
// in the admin UI.
import { PRO_TOUR_HOST_PATTERN } from "@/lib/pro-tour/adapters/rsc-scraper";

/**
 * /admin/pro-tour — Sprint 6 admin surface for the pro tour ingestion
 * pipeline. Three tabs:
 *   1. Manual trigger — paste a brackets.pickleballtournaments.com URL
 *      and POST to the pro-tour-trigger-scrape edge function (which
 *      verifies admin role internally, signs HMAC, forwards to the
 *      Cloudflare Worker, returns the Worker response). The Worker is
 *      never called from the browser so no CORS workaround is needed.
 *   2. Watchlist — full CRUD for cron-tracked tournaments. Add / edit /
 *      pause / resume / delete / scrape now.
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

/* ─── Shared trigger helper ────────────────────────────────────────────── */
//
// Both the manual-trigger tab and the watchlist row "Scrape now" action
// hit the same edge function — pull the call into a helper so the two
// surfaces stay behavior-identical (auth + signing flow + error shape).

interface TriggerResponse {
  ok: boolean;
  log_id?: string;
  matches_extracted?: number;
  players_extracted?: number;
  error?: string;
}

async function triggerScrapeViaEdge(args: {
  tournament_url: string;
  watchlist_id?: string;
}): Promise<TriggerResponse> {
  const { data, error } = await supabase.functions.invoke<TriggerResponse>(
    "pro-tour-trigger-scrape",
    {
      body: {
        tournament_url: args.tournament_url,
        watchlist_id: args.watchlist_id,
      },
    },
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return data ?? { ok: false, error: "Empty response" };
}

/* ─── Tab 1: Manual trigger ────────────────────────────────────────────── */

function ManualTriggerTab({ language }: { language: "vi" | "en" }) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TriggerResponse | null>(null);

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
      const json = await triggerScrapeViaEdge({ tournament_url: url });
      setResult(json);
      if (json.ok) {
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
      {result && <ResultBanner result={result} language={language} />}
    </div>
  );
}

function ResultBanner({
  result,
  language,
}: {
  result: TriggerResponse;
  language: "vi" | "en";
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        result.ok
          ? "border-green-600/30 bg-green-600/5"
          : "border-destructive/30 bg-destructive/5"
      }`}
    >
      {result.ok ? (
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
          <div className="text-sm">
            <div className="font-semibold">
              {language === "vi" ? "Thành công" : "Success"}
            </div>
            <div className="mt-1 text-muted-foreground">
              Log ID: <code>{result.log_id}</code>
              <br />
              {result.matches_extracted ?? 0}{" "}
              {language === "vi" ? "trận đấu, " : "matches, "}
              {result.players_extracted ?? 0}{" "}
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
            <div className="mt-1 text-muted-foreground">{result.error}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab 2: Watchlist (full CRUD) ─────────────────────────────────────── */

type ScrapeFrequency = "daily" | "weekly" | "on_event_end" | "manual";
type WatchlistStatus = "active" | "paused" | "completed";

interface WatchlistRow {
  id: string;
  tournament_url: string;
  tournament_name: string | null;
  status: WatchlistStatus;
  scrape_frequency: ScrapeFrequency;
  last_scraped_at: string | null;
  next_scrape_at: string | null;
  created_at: string;
  // notes lives only in form state — schema doesn't have it yet, so we
  // append to tournament_name when present (free-form prefix). If a
  // dedicated notes column is added later, replace this convention.
}

interface WatchlistFormValues {
  tournament_url: string;
  tournament_name: string;
  scrape_frequency: ScrapeFrequency;
  is_active: boolean;
}

const EMPTY_FORM: WatchlistFormValues = {
  tournament_url: "",
  tournament_name: "",
  scrape_frequency: "daily",
  is_active: true,
};

function WatchlistTab({ language }: { language: "vi" | "en" }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WatchlistFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scrapingId, setScrapingId] = useState<string | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: WatchlistRow) => {
    setEditingId(row.id);
    setForm({
      tournament_url: row.tournament_url,
      tournament_name: row.tournament_name ?? "",
      scrape_frequency: row.scrape_frequency,
      is_active: row.status !== "paused",
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!PRO_TOUR_HOST_PATTERN.test(form.tournament_url)) {
      setFormError(
        language === "vi"
          ? "URL không hợp lệ — phải khớp pattern PPA/APP/MLP bracket."
          : "URL invalid — must match the PPA/APP/MLP bracket pattern.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        tournament_url: form.tournament_url.trim(),
        tournament_name: form.tournament_name.trim() || null,
        scrape_frequency: form.scrape_frequency,
        status: (form.is_active ? "active" : "paused") as WatchlistStatus,
      };
      if (editingId) {
        const { error } = await supabase
          .from("pro_tour_watchlist")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast({
          title: language === "vi" ? "Đã cập nhật" : "Updated",
        });
      } else {
        // Stamp next_scrape_at on create so the every-6h worker cron
        // picks the row up on its next tick. Without this the row sits
        // at NULL and the cron filter (`next_scrape_at <= NOW()`)
        // skips it indefinitely.
        const { error } = await supabase
          .from("pro_tour_watchlist")
          .insert({ ...payload, next_scrape_at: new Date().toISOString() });
        if (error) throw error;
        toast({
          title: language === "vi" ? "Đã thêm vào watchlist" : "Added to watchlist",
        });
      }
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["pro-tour-watchlist"] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePause = async (row: WatchlistRow) => {
    const next: WatchlistStatus = row.status === "paused" ? "active" : "paused";
    const { error } = await supabase
      .from("pro_tour_watchlist")
      .update({ status: next })
      .eq("id", row.id);
    if (error) {
      toast({
        title: language === "vi" ? "Lỗi" : "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["pro-tour-watchlist"] });
  };

  const deleteRow = async (row: WatchlistRow) => {
    const { error } = await supabase
      .from("pro_tour_watchlist")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast({
        title: language === "vi" ? "Lỗi" : "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: language === "vi" ? "Đã xoá" : "Deleted" });
    await queryClient.invalidateQueries({ queryKey: ["pro-tour-watchlist"] });
  };

  const scrapeNow = async (row: WatchlistRow) => {
    setScrapingId(row.id);
    try {
      const res = await triggerScrapeViaEdge({
        tournament_url: row.tournament_url,
        watchlist_id: row.id,
      });
      if (res.ok) {
        toast({
          title: language === "vi" ? "Scrape xong" : "Scrape complete",
          description:
            language === "vi"
              ? `${res.matches_extracted ?? 0} trận, ${res.players_extracted ?? 0} người chơi`
              : `${res.matches_extracted ?? 0} matches, ${res.players_extracted ?? 0} players`,
        });
        // refresh both watchlist (last_scraped_at) and logs
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["pro-tour-watchlist"] }),
          queryClient.invalidateQueries({ queryKey: ["pro-tour-logs"] }),
        ]);
      } else {
        toast({
          title: language === "vi" ? "Scrape lỗi" : "Scrape failed",
          description: res.error,
          variant: "destructive",
        });
      }
    } finally {
      setScrapingId(null);
    }
  };

  const dialogTitle = editingId
    ? language === "vi"
      ? "Chỉnh sửa entry"
      : "Edit entry"
    : language === "vi"
      ? "Thêm tournament mới"
      : "Add tournament";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {language === "vi"
            ? "Tournament được theo dõi tự động (cron 6h)."
            : "Tournaments tracked on the 6h cron."}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {language === "vi" ? "Tải lại" : "Refresh"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                {language === "vi" ? "Thêm" : "Add"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>
                  {language === "vi"
                    ? "Cron Worker re-scrape theo tần suất bạn chọn."
                    : "The cron Worker re-scrapes at the cadence you pick."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label htmlFor="tname">
                    {language === "vi" ? "Tên hiển thị" : "Display name"}
                  </Label>
                  <Input
                    id="tname"
                    value={form.tournament_name}
                    onChange={(e) =>
                      setForm({ ...form, tournament_name: e.target.value })
                    }
                    placeholder="PPA Tour: 2026 PPA Finals"
                  />
                </div>
                <div>
                  <Label htmlFor="turl">
                    {language === "vi" ? "URL bracket" : "Bracket URL"}
                  </Label>
                  <Textarea
                    id="turl"
                    rows={2}
                    value={form.tournament_url}
                    onChange={(e) =>
                      setForm({ ...form, tournament_url: e.target.value })
                    }
                    placeholder="https://brackets.pickleballtournaments.com/tournaments/.../events/.../elimination/..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="freq">
                      {language === "vi" ? "Tần suất" : "Frequency"}
                    </Label>
                    <Select
                      value={form.scrape_frequency}
                      onValueChange={(v) =>
                        setForm({ ...form, scrape_frequency: v as ScrapeFrequency })
                      }
                    >
                      <SelectTrigger id="freq">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">
                          {language === "vi" ? "Hàng ngày" : "Daily"}
                        </SelectItem>
                        <SelectItem value="weekly">
                          {language === "vi" ? "Hàng tuần" : "Weekly"}
                        </SelectItem>
                        <SelectItem value="on_event_end">
                          {language === "vi" ? "Sau khi giải kết thúc" : "On event end"}
                        </SelectItem>
                        <SelectItem value="manual">
                          {language === "vi" ? "Thủ công" : "Manual only"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">
                      {language === "vi" ? "Trạng thái" : "Status"}
                    </Label>
                    <Select
                      value={form.is_active ? "active" : "paused"}
                      onValueChange={(v) =>
                        setForm({ ...form, is_active: v === "active" })
                      }
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          {language === "vi" ? "Đang hoạt động" : "Active"}
                        </SelectItem>
                        <SelectItem value="paused">
                          {language === "vi" ? "Tạm dừng" : "Paused"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  {language === "vi" ? "Huỷ" : "Cancel"}
                </Button>
                <Button onClick={submit} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId
                    ? language === "vi" ? "Cập nhật" : "Update"
                    : language === "vi" ? "Thêm" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === "vi" ? "Watchlist trống." : "Watchlist empty."}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {language === "vi" ? "Tên / URL" : "Name / URL"}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {language === "vi" ? "Tần suất" : "Frequency"}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {language === "vi" ? "Lần scrape gần nhất" : "Last scrape"}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {language === "vi" ? "Lần scrape kế tiếp" : "Next scrape"}
                </TableHead>
                <TableHead>
                  {language === "vi" ? "Trạng thái" : "Status"}
                </TableHead>
                <TableHead className="text-right">
                  {language === "vi" ? "Hành động" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <WatchlistRowItem
                  key={row.id}
                  row={row}
                  language={language}
                  onEdit={openEdit}
                  onTogglePause={togglePause}
                  onDelete={deleteRow}
                  onScrapeNow={scrapeNow}
                  scraping={scrapingId === row.id}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function WatchlistRowItem({
  row,
  language,
  onEdit,
  onTogglePause,
  onDelete,
  onScrapeNow,
  scraping,
}: {
  row: WatchlistRow;
  language: "vi" | "en";
  onEdit: (row: WatchlistRow) => void;
  onTogglePause: (row: WatchlistRow) => void;
  onDelete: (row: WatchlistRow) => void;
  onScrapeNow: (row: WatchlistRow) => void;
  scraping: boolean;
}) {
  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString(language === "vi" ? "vi-VN" : "en-US") : "—";
  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <div className="truncate font-medium">
          {row.tournament_name ?? row.tournament_url}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {row.tournament_url}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant="outline">{row.scrape_frequency}</Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
        {fmtDate(row.last_scraped_at)}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
        {fmtDate(row.next_scrape_at)}
      </TableCell>
      <TableCell>
        <Badge variant={row.status === "active" ? "default" : "secondary"}>
          {row.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => onScrapeNow(row)}
            disabled={scraping}
            title={language === "vi" ? "Scrape ngay" : "Scrape now"}
          >
            {scraping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            <span className="hidden md:inline">
              {language === "vi" ? "Scrape" : "Scrape"}
            </span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onTogglePause(row)}
            title={
              row.status === "paused"
                ? language === "vi" ? "Bật lại" : "Resume"
                : language === "vi" ? "Tạm dừng" : "Pause"
            }
          >
            {row.status === "paused" ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(row)}
            title={language === "vi" ? "Sửa" : "Edit"}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                title={language === "vi" ? "Xoá" : "Delete"}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {language === "vi"
                    ? "Xoá entry này?"
                    : "Delete this entry?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {language === "vi"
                    ? "Cron worker sẽ ngừng scrape URL này. Trận đấu đã import vẫn giữ trên Feed."
                    : "The cron worker will stop scraping this URL. Already-imported matches stay on the Feed."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {language === "vi" ? "Huỷ" : "Cancel"}
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(row)}>
                  {language === "vi" ? "Xoá" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
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

  // useMemo on rows is overkill (50 rows max), but keeps the render
  // tidy if we ever add filter/search.
  const sortedRows = useMemo(() => rows, [rows]);

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => refetch()}>
        {language === "vi" ? "Tải lại" : "Refresh"}
      </Button>
      {sortedRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === "vi" ? "Chưa có log nào." : "No logs yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {sortedRows.map((row) => (
            <div key={row.id} className="rounded-md border p-3 text-sm">
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
