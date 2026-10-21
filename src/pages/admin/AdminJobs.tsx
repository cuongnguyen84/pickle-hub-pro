import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock3, ExternalLink, Loader2, Play, RefreshCw, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type HealthState = "healthy" | "warning" | "failed" | "pending";

interface JobRun {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  summary: string | null;
  metrics: Record<string, unknown>;
  error_message: string | null;
}

interface JobHealth {
  job_key: string;
  display_name: string;
  category: string;
  executor: string;
  schedule_label: string;
  health_state: HealthState;
  last_activity_at: string | null;
  summary: string | null;
  metrics: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  details_path: string | null;
  details_url: string | null;
  runs: JobRun[];
}

interface JobSnapshot {
  generated_at: string;
  counts: Record<HealthState, number>;
  jobs: JobHealth[];
  latest_digest: {
    report_date: string;
    status: string;
    sent_at: string | null;
    last_error: string | null;
  } | null;
}

interface EdgeFunctionHealth {
  function_slug: string;
  display_name: string;
  job_key: string | null;
  state: "available" | "missing_blob" | "http_error" | "timeout" | "pending";
  http_status: number | null;
  response_ms: number | null;
  reason: string | null;
  consecutive_failures: number;
  checked_at: string | null;
}

interface EdgeHealthSnapshot {
  generated_at: string;
  counts: { available: number; failed: number; pending: number };
  functions: EdgeFunctionHealth[];
}

const stateMeta: Record<HealthState, { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" },
  warning: { label: "Warning", className: "border-amber-500/30 bg-amber-500/10 text-amber-600" },
  failed: { label: "Failed", className: "border-red-500/30 bg-red-500/10 text-red-600" },
  pending: { label: "Pending", className: "border-slate-500/30 bg-slate-500/10 text-slate-500" },
};

function formatTime(value: string | null): string {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMetrics(metrics: Record<string, unknown>): string {
  const entries = Object.entries(metrics ?? {}).filter(([, value]) =>
    typeof value === "number" || typeof value === "string"
  );
  if (entries.length === 0) return "—";
  return entries.slice(0, 4).map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`).join(" · ");
}

function useJobHealth() {
  return useQuery({
    queryKey: ["admin-job-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ops_admin_job_health");
      if (error) throw error;
      return data as unknown as JobSnapshot;
    },
    refetchInterval: 60_000,
  });
}

function useEdgeHealth() {
  return useQuery({
    queryKey: ["admin-edge-function-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ops_admin_edge_function_health");
      if (error) throw error;
      return data as unknown as EdgeHealthSnapshot;
    },
    refetchInterval: 60_000,
  });
}

export default function AdminJobs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error, refetch, isFetching } = useJobHealth();
  const edgeHealth = useEdgeHealth();
  const [stateFilter, setStateFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const retry = useMutation({
    mutationFn: async (jobKey: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("ops_request_job_retry", {
        p_job_key: jobKey,
        p_source: "admin",
        p_requested_by: auth.user?.email ?? auth.user?.id ?? "admin",
        p_reason: "Admin Job Health retry",
      });
      if (error) throw error;
      const result = data as unknown as { ok: boolean; code?: string };
      if (!result.ok) throw new Error(result.code === "cooldown" ? "Job vừa được retry, vui lòng đợi 10 phút." : result.code || "Không thể retry job");
      return jobKey;
    },
    onSuccess: (jobKey) => {
      toast({ title: "Đã gửi retry", description: `${jobKey} đang được chạy lại.` });
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["admin-job-health"] }), 2500);
    },
    onError: (retryError: Error) => toast({ title: "Không retry được", description: retryError.message, variant: "destructive" }),
  });
  const probeEdges = useMutation({
    mutationFn: async () => {
      const { error: probeError } = await supabase.rpc("ops_admin_probe_edge_functions");
      if (probeError) throw probeError;
    },
    onSuccess: () => {
      toast({ title: "Đã bắt đầu probe", description: "Kết quả runtime sẽ cập nhật trong vài giây." });
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["admin-edge-function-health"] }), 4000);
    },
    onError: (probeError: Error) => toast({ title: "Không probe được", description: probeError.message, variant: "destructive" }),
  });

  const categories = useMemo(() => [...new Set((data?.jobs ?? []).map((job) => job.category))], [data]);
  const jobs = useMemo(() => (data?.jobs ?? []).filter((job) =>
    (stateFilter === "all" || job.health_state === stateFilter) &&
    (categoryFilter === "all" || job.category === categoryFilter)
  ), [data, stateFilter, categoryFilter]);

  const cards = [
    { key: "healthy" as const, label: "Healthy", icon: CheckCircle2, color: "text-emerald-500" },
    { key: "warning" as const, label: "Warning", icon: AlertTriangle, color: "text-amber-500" },
    { key: "failed" as const, label: "Failed", icon: XCircle, color: "text-red-500" },
    { key: "pending" as const, label: "Pending", icon: Clock3, color: "text-slate-500" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold"><Activity className="h-6 w-6" /> Job Health</h1>
            <p className="mt-1 text-sm text-foreground-muted">Trạng thái các job nghiệp vụ và báo cáo Telegram 09:15 ICT.</p>
          </div>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Làm mới
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Skeleton key={card.key} className="h-28" />)}</div>
        ) : error ? (
          <Card className="border-red-500/40"><CardContent className="p-6 text-red-600">Không tải được Job Health: {error.message}</CardContent></Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <Card key={card.key}>
                  <CardContent className="flex items-center justify-between p-5">
                    <div><p className="text-sm text-foreground-muted">{card.label}</p><p className="mt-1 text-3xl font-semibold">{data?.counts?.[card.key] ?? 0}</p></div>
                    <card.icon className={`h-8 w-8 ${card.color}`} />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>Digest gần nhất: <strong>{data?.latest_digest ? `${data.latest_digest.report_date} · ${data.latest_digest.status}` : "chưa gửi"}</strong></span>
                <span className="text-foreground-muted">Snapshot: {formatTime(data?.generated_at ?? null)}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle className="text-lg">Edge Function Runtime</CardTitle><p className="mt-1 text-sm text-foreground-muted">Probe mỗi 5 phút; phát hiện missing blob, HTTP error và timeout.</p></div>
                <Button variant="outline" size="sm" onClick={() => probeEdges.mutate()} disabled={probeEdges.isPending}>
                  {probeEdges.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Probe lại
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {edgeHealth.error ? <p className="p-5 text-sm text-red-600">Không tải được Edge Health: {edgeHealth.error.message}</p> : (
                  <div className="overflow-x-auto"><Table>
                    <TableHeader><TableRow><TableHead>Function</TableHead><TableHead>Runtime</TableHead><TableHead>HTTP</TableHead><TableHead>Latency</TableHead><TableHead>Lần probe</TableHead><TableHead>Chi tiết</TableHead></TableRow></TableHeader>
                    <TableBody>{(edgeHealth.data?.functions ?? []).map((fn) => {
                      const available = fn.state === "available";
                      return <TableRow key={fn.function_slug}>
                        <TableCell><div className="font-medium">{fn.display_name}</div><code className="text-xs text-foreground-muted">{fn.function_slug}</code></TableCell>
                        <TableCell><Badge variant="outline" className={available ? stateMeta.healthy.className : fn.state === "pending" ? stateMeta.pending.className : stateMeta.failed.className}>{available ? "Available" : fn.state}</Badge></TableCell>
                        <TableCell>{fn.http_status ?? "—"}</TableCell><TableCell>{fn.response_ms === null ? "—" : `${fn.response_ms}ms`}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatTime(fn.checked_at)}</TableCell><TableCell className="max-w-80 text-sm">{fn.reason || "Chưa probe"}</TableCell>
                      </TableRow>;
                    })}</TableBody>
                  </Table></div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Mọi trạng thái</SelectItem>{Object.entries(stateMeta).map(([key, meta]) => <SelectItem key={key} value={key}>{meta.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Nhóm" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Mọi nhóm</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <Card className="overflow-hidden">
              <CardHeader><CardTitle className="text-lg">Các job đang theo dõi</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Trạng thái</TableHead><TableHead>Lịch</TableHead><TableHead>Lần cuối</TableHead><TableHead>Kết quả</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.job_key}>
                          <TableCell><div className="font-medium">{job.display_name}</div><div className="text-xs text-foreground-muted">{job.category} · {job.executor}</div></TableCell>
                          <TableCell><Badge variant="outline" className={stateMeta[job.health_state].className}>{stateMeta[job.health_state].label}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{job.schedule_label}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatTime(job.last_activity_at)}</TableCell>
                          <TableCell className="min-w-72"><p className="text-sm">{job.error_message || job.summary || "Chưa có dữ liệu run"}</p><p className="mt-1 text-xs text-foreground-muted">{formatMetrics(job.metrics)}</p></TableCell>
                          <TableCell><div className="flex items-center gap-1">
                            {job.executor === "pg_net" && <Button size="sm" variant="ghost" title="Chạy lại job" onClick={() => retry.mutate(job.job_key)} disabled={retry.isPending}>
                              {retry.isPending && retry.variables === job.job_key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            </Button>}
                            {job.details_path && <Button asChild size="sm" variant="ghost"><Link to={job.details_path}><ExternalLink className="h-4 w-4" /></Link></Button>}
                          </div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {jobs.length === 0 && <div className="p-8 text-center text-sm text-foreground-muted">Không có job phù hợp bộ lọc.</div>}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Lịch sử 30 ngày</h2>
              {jobs.map((job) => (
                <details key={job.job_key} className="rounded-lg border border-border bg-card p-4">
                  <summary className="cursor-pointer font-medium">{job.display_name} · {job.runs.length} run</summary>
                  <div className="mt-3 space-y-2">
                    {job.runs.length === 0 ? <p className="text-sm text-foreground-muted">Chưa có run được instrument.</p> : job.runs.map((run) => (
                      <div key={run.id} className="rounded-md border border-border/70 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{run.status}</Badge><span>{formatTime(run.started_at)}</span></div>
                        <p className="mt-2">{run.error_message || run.summary || "—"}</p>
                        <p className="mt-1 text-xs text-foreground-muted">{formatMetrics(run.metrics)}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
