import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Flag, CheckCircle, XCircle, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";

function useReports(statusFilter: string) {
  return useQuery({
    queryKey: ["admin-reports", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("content_reports" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export default function AdminReports() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewingReport, setReviewingReport] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: reports, isLoading } = useReports(statusFilter);

  const updateReport = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from("content_reports" as any)
        .update({
          status,
          admin_notes: notes,
          resolved_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "Đã cập nhật báo cáo" });
      setReviewingReport(null);
      setAdminNotes("");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Chờ xử lý</Badge>;
      case "reviewed":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Đang xem xét</Badge>;
      case "resolved":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Đã xử lý</Badge>;
      case "dismissed":
        return <Badge variant="secondary">Bỏ qua</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      livestream: "Livestream",
      tournament: "Giải đấu",
      profile: "Hồ sơ",
      forum_post: "Bài viết",
    };
    return labels[type] || type;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Báo cáo vi phạm</h1>
          <p className="text-foreground-muted mt-1">Quản lý các báo cáo nội dung từ người dùng</p>
        </div>

        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="pending">Chờ xử lý</SelectItem>
              <SelectItem value="reviewed">Đang xem xét</SelectItem>
              <SelectItem value="resolved">Đã xử lý</SelectItem>
              <SelectItem value="dismissed">Bỏ qua</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="space-y-4">
            {reports.map((report: any) => (
              <Card key={report.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Flag className="w-4 h-4 text-destructive" />
                        <span className="font-medium">{getContentTypeLabel(report.content_type)}</span>
                        {getStatusBadge(report.status)}
                      </div>
                      <p className="text-sm text-foreground-secondary mb-1">{report.reason}</p>
                      <p className="text-xs text-foreground-muted">
                        ID: {report.content_id.slice(0, 8)}... •{" "}
                        {format(new Date(report.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                      {report.admin_notes && (
                        <p className="text-xs text-foreground-muted mt-1 italic">
                          Admin: {report.admin_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {report.status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReviewingReport(report);
                              setAdminNotes("");
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateReport.mutate({ id: report.id, status: "resolved", notes: "" })}
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateReport.mutate({ id: report.id, status: "dismissed", notes: "" })}
                          >
                            <XCircle className="w-4 h-4 text-foreground-muted" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Flag className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
              <p className="text-foreground-muted">Không có báo cáo nào</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Review Dialog */}
      <AlertDialog open={!!reviewingReport} onOpenChange={(open) => !open && setReviewingReport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xem xét báo cáo</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2 mt-2">
                <p><strong>Loại:</strong> {reviewingReport && getContentTypeLabel(reviewingReport.content_type)}</p>
                <p><strong>Lý do:</strong> {reviewingReport?.reason}</p>
                <p><strong>ID nội dung:</strong> {reviewingReport?.content_id}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Ghi chú admin..."
              rows={3}
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (reviewingReport) {
                  updateReport.mutate({ id: reviewingReport.id, status: "dismissed", notes: adminNotes });
                }
              }}
              disabled={updateReport.isPending}
            >
              Bỏ qua
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (reviewingReport) {
                  updateReport.mutate({ id: reviewingReport.id, status: "resolved", notes: adminNotes });
                }
              }}
              disabled={updateReport.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {updateReport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xử lý & Xóa nội dung
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
