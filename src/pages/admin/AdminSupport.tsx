/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Yêu cầu hỗ trợ gửi qua trợ lý AI (support_requests, 12/11/2026). Admin đọc +
 * đổi trạng thái qua RLS (is_admin()); handled_at/handled_by do trigger đóng dấu.
 * Lưu ý: người gửi đã đăng nhập đọc được dòng của chính họ, kể cả admin_note.
 */
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface SupportRequest {
  id: string;
  created_at: string;
  user_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  zalo: string | null;
  message: string;
  page_type: string | null;
  route: string | null;
  page_label: string | null;
  lang: string | null;
  transcript: { role: string; text: string }[] | null;
  status: "new" | "handled";
  handled_at: string | null;
  admin_note: string | null;
}

/** Link zalo.me chỉ dựng từ SĐT (chuẩn hoá 0xxx → 84xxx); Zalo id tự do thì chỉ hiện chữ. */
export function zaloHref(phone: string | null): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `https://zalo.me/${d.startsWith("0") ? `84${d.slice(1)}` : d}`;
}

function useSupportRequests(status: string) {
  return useQuery({
    queryKey: ["admin-support", status],
    queryFn: async () => {
      let q = supabase.from("support_requests" as any).select("*").order("created_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SupportRequest[];
    },
  });
}

const RequestCard = ({ r }: { r: SupportRequest }) => {
  const qc = useQueryClient();
  const [note, setNote] = useState(r.admin_note ?? "");
  const update = useMutation({
    mutationFn: async (p: { status?: "new" | "handled"; admin_note?: string }) => {
      const { error } = await supabase.from("support_requests" as any).update(p as any).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-support"] }); toast.success("Đã cập nhật"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const zalo = zaloHref(r.phone);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{r.name || "(không tên)"}</span>
        <span className="text-xs rounded border border-border px-1.5 py-0.5">{r.status === "new" ? "Mới" : "Đã xử lý"}</span>
        <span className="text-xs text-foreground-muted">
          {new Date(r.created_at).toLocaleString("vi-VN")} · {r.user_id ? `user ${r.user_id.slice(0, 8)}` : "khách"} · {(r.lang ?? "vi").toUpperCase()}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{r.message}</p>
      <div className="flex flex-wrap gap-3 text-sm">
        {r.phone && <a className="underline" href={`tel:${r.phone}`}>{r.phone}</a>}
        {zalo && <a className="underline" href={zalo} target="_blank" rel="noopener noreferrer">Zalo (SĐT)</a>}
        {r.zalo && <span>Zalo: {r.zalo}</span>}
        {r.email && <a className="underline" href={`mailto:${r.email}`}>{r.email}</a>}
        {!r.phone && !r.email && !r.zalo && <span className="text-foreground-muted">Không để lại liên hệ — tra theo tài khoản</span>}
      </div>
      <p className="text-xs text-foreground-muted break-words">
        Trang: {r.page_type ?? "?"} {r.route ?? ""}{r.page_label ? ` — ${r.page_label}` : ""}
      </p>
      {r.transcript && r.transcript.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-foreground-muted">Hội thoại với trợ lý ({r.transcript.length} lượt)</summary>
          {r.transcript.map((t, i) => (
            <p key={i} className="mt-1 whitespace-pre-wrap break-words"><b>{t.role === "user" ? "Người dùng" : "AI"}:</b> {t.text}</p>
          ))}
        </details>
      )}
      <textarea className="w-full rounded border border-border bg-transparent p-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú admin (người gửi đã đăng nhập có thể đọc)" maxLength={2000} rows={2} />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" disabled={update.isPending || note === (r.admin_note ?? "")} onClick={() => update.mutate({ admin_note: note })}>
          Lưu ghi chú
        </Button>
        {r.status === "new"
          ? <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ status: "handled", admin_note: note })}>Đánh dấu đã xử lý</Button>
          : <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ status: "new" })}>Mở lại</Button>}
      </div>
    </div>
  );
};

export default function AdminSupport() {
  const [status, setStatus] = useState("new");
  const { data, isLoading, error } = useSupportRequests(status);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Yêu cầu hỗ trợ</h1>
          <p className="text-foreground-muted mt-1">Người dùng gửi qua trợ lý AI — mới nhất trước</p>
        </div>
        <select className="rounded border border-border bg-transparent px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc trạng thái">
          <option value="new">Mới</option>
          <option value="handled">Đã xử lý</option>
          <option value="all">Tất cả</option>
        </select>
        {isLoading ? (
          <p className="text-foreground-muted">Đang tải…</p>
        ) : error ? (
          <p className="text-destructive text-sm">{(error as Error).message}</p>
        ) : data && data.length > 0 ? (
          <div className="space-y-4">{data.map((r) => <RequestCard key={r.id} r={r} />)}</div>
        ) : (
          <p className="text-foreground-muted">Không có yêu cầu nào.</p>
        )}
      </div>
    </AdminLayout>
  );
}
