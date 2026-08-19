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

// ─── Activation (the step after approve) ────────────────────────────────────

const SHOP_STATE_KEY = ["shop", "admin", "shop-state"] as const;

export interface AdminShopStateRow {
  id: string;
  slug: string;
  name: string;
  state: string;
  verified_method: string | null;
}

/** The approved shop's live state — read via shops_select_member + is_admin(). */
export const useShopState = (shopId: string | null) =>
  useQuery({
    queryKey: [...SHOP_STATE_KEY, shopId],
    enabled: !!shopId,
    queryFn: async (): Promise<AdminShopStateRow | null> => {
      const { data, error } = await shopFrom<AdminShopStateRow>("shops")
        .select("id, slug, name, state, verified_method")
        .eq("id", shopId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

/**
 * An RPC, not a PATCH: shops_guard_privileged_columns reverts a non-admin's
 * state write WITHOUT erroring, so a table update from a stale session would
 * report success and change nothing. shop_activate fails loudly instead.
 */
export const useActivateShop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { shopId: string; verifiedMethod: string | null }) =>
      await shopRpc<string>("shop_activate", {
        _shop_id: p.shopId,
        _verified_method: p.verifiedMethod || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOP_STATE_KEY });
    },
  });
};

/** shop_activate guard failures, in the moderator's words. */
export const activateErrorMessage = (err: unknown): string => {
  const message = (err as { message?: string })?.message ?? "";
  if (message.includes("admin_required")) {
    return "Phiên đăng nhập chưa đủ quyền. Đăng nhập lại bằng 2FA rồi thử lại.";
  }
  if (message.includes("shop_not_activatable")) {
    return "Shop không còn ở trạng thái chờ kích hoạt — có thể đã đổi ở nơi khác. Tải lại trang để xem trạng thái mới.";
  }
  // shop_not_found, invalid_verified_method và lỗi mạng đều rơi về đây: với
  // moderator cả ba nghĩa là "chưa có gì đổi, thử lại".
  return "Chưa kích hoạt được. Shop vẫn ở trạng thái cũ, chưa có gì công khai. Thử lại hoặc kiểm tra kết nối.";
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
