import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuditLogs, AuditLogEntry } from "@/hooks/useAuditLog";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronLeft, ChevronRight, ScrollText, Filter } from "lucide-react";
import { format } from "date-fns";

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  critical: "bg-red-500/10 text-red-600 border-red-500/20",
};

const CATEGORY_COLORS: Record<string, string> = {
  auth: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  stream: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  tournament: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  admin: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const PAGE_SIZE = 50;

export default function AdminAuditLog() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [eventCategory, setEventCategory] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useAuditLogs({
    eventCategory: eventCategory || undefined,
    severity: severity || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / PAGE_SIZE);

  const resetFilters = () => {
    setEventCategory("");
    setSeverity("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t.admin.auditLog?.title || "Audit Log"}</h1>
            <p className="text-sm text-muted-foreground">{t.admin.auditLog?.description || "Lịch sử hoạt động hệ thống"}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Category</label>
            <Select value={eventCategory} onValueChange={(v) => { setEventCategory(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="stream">Stream</SelectItem>
                <SelectItem value="tournament">Tournament</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Severity</label>
            <Select value={severity} onValueChange={(v) => { setSeverity(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Từ ngày</label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Đến ngày</label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>

          {(eventCategory || severity || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <Filter className="w-4 h-4 mr-1" />
              Xoá bộ lọc
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Thời gian</TableHead>
                <TableHead className="w-[160px]">Actor</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="w-[100px]">Category</TableHead>
                <TableHead className="w-[90px]">Severity</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : data?.entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Không có log nào
                  </TableCell>
                </TableRow>
              ) : (
                data?.entries.map((entry) => (
                  <AuditLogRow key={entry.id} entry={entry} />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Trang {page}/{totalPages} • {data?.totalCount} kết quả
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  const actorLabel = entry.actor_profile
    ? entry.actor_profile.display_name || entry.actor_profile.email
    : entry.actor_type === "system" ? "System" : entry.actor_type === "webhook" ? "Webhook" : "—";

  return (
    <Collapsible asChild>
      <>
        <CollapsibleTrigger asChild>
          <TableRow className={hasMetadata ? "cursor-pointer hover:bg-muted/50" : ""}>
            <TableCell className="text-xs text-muted-foreground font-mono">
              {format(new Date(entry.created_at), "dd/MM/yy HH:mm:ss")}
            </TableCell>
            <TableCell className="text-sm truncate max-w-[160px]" title={actorLabel}>
              {actorLabel}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {entry.event_type}
                </code>
                {entry.resource_type && (
                  <span className="text-xs text-muted-foreground">
                    {entry.resource_type}:{entry.resource_id?.slice(0, 8)}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[entry.event_category] || ""}`}>
                {entry.event_category}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[entry.severity] || ""}`}>
                {entry.severity}
              </Badge>
            </TableCell>
            <TableCell>
              {hasMetadata && <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        {hasMetadata && (
          <CollapsibleContent asChild>
            <TableRow className="bg-muted/30">
              <TableCell colSpan={6} className="p-4">
                <pre className="text-xs font-mono bg-background p-3 rounded border overflow-x-auto max-h-48">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </TableCell>
            </TableRow>
          </CollapsibleContent>
        )}
      </>
    </Collapsible>
  );
}
