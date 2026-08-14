// ============================================================================
// Admin side of the seller application queue.
// ----------------------------------------------------------------------------
// Reads go through RLS (is_admin() already requires AAL2 — migration
// 20260730090000). The decision is an RPC because it is a multi-row
// transaction: application status + shop creation + owner membership + event
// log + audit row, all or nothing, with the row locked so two moderators
// cannot both approve.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import type { ShopApplicationRow } from "@/integrations/supabase/shop-schema";
import type { ApplicationStatus, Decision } from "@/lib/shop/applicationState";

const QUEUE_KEY = ["shop", "admin", "applications"] as const;

export const useShopApplicationQueue = (status: ApplicationStatus | "all") =>
  useQuery({
    queryKey: [...QUEUE_KEY, status],
    queryFn: async (): Promise<ShopApplicationRow[]> => {
      let q = shopFrom<ShopApplicationRow>("shop_applications_admin")
        .select("*")
        .order("submitted_at", { ascending: true, nullsFirst: false });
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export const useShopApplication = (id: string | null) =>
  useQuery({
    queryKey: [...QUEUE_KEY, "one", id],
    enabled: !!id,
    queryFn: async (): Promise<ShopApplicationRow | null> => {
      const { data, error } = await shopFrom<ShopApplicationRow>("shop_applications_admin")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

export interface DecidePayload {
  applicationId: string;
  decision: Decision;
  applicantNote: string;
  internalNote: string;
  requestedFields: string[];
}

export const useDecideApplication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: DecidePayload) => {
      // shop id when approved, null otherwise
      return await shopRpc<string | null>("shop_application_decide", {
        _application_id: p.applicationId,
        _decision: p.decision,
        _applicant_note: p.applicantNote || null,
        _internal_note: p.internalNote || null,
        _requested_fields: p.requestedFields,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUEUE_KEY });
    },
  });
};

/** Server-side guard failures, in the moderator's words. */
export const decisionErrorMessage = (err: unknown): string => {
  const message = (err as { message?: string })?.message ?? "";
  if (message.includes("admin_required")) {
    return "Phiên đăng nhập chưa đủ quyền. Đăng nhập lại bằng 2FA rồi thử lại.";
  }
  if (message.includes("applicant_note_required")) {
    return "Cần viết ghi chú gửi người nộp — đây là thứ duy nhất họ nhận được.";
  }
  if (message.includes("requested_fields_required")) {
    return "Cần tick ít nhất một ô cần sửa.";
  }
  if (message.includes("application_not_decidable")) {
    return "Hồ sơ này đã được xử lý ở nơi khác. Tải lại để xem trạng thái mới.";
  }
  return "Chưa gửi được quyết định. Ghi chú anh vừa gõ vẫn còn — người nộp CHƯA nhận được gì.";
};
