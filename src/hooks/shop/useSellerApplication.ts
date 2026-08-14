// ============================================================================
// Seller application — data hooks.
// ----------------------------------------------------------------------------
// architecture-boundaries.md §3: Supabase calls live in hooks, never in JSX
// handlers. Every state transition goes through an RPC — the client never
// writes `status`, and the trigger in migration 20260811090000 pins it even if
// someone tries.
//
// Errors are thrown, not swallowed (DS-04 convention): a network failure must
// not render as an empty form, which the applicant would read as "my draft is
// gone".
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import type {
  MyShopApplicationRow,
  ShopApplicationEventRow,
  ShopRow,
} from "@/integrations/supabase/shop-schema";
import { useAuth } from "@/hooks/useAuth";
import type { ApplicationDraft } from "@/lib/shop/applicationState";

const KEY = {
  pilot: ["shop", "pilot-access"] as const,
  application: (uid: string | null) => ["shop", "my-application", uid] as const,
  events: (id: string | null) => ["shop", "application-events", id] as const,
  myShop: (uid: string | null) => ["shop", "my-shop", uid] as const,
};

/** Server-authoritative pilot gate. A client flag is not access control. */
export const useShopPilotAccess = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY.pilot, user?.id ?? null],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      return (await shopRpc<boolean>("shop_pilot_has_access")) === true;
    },
  });
};

export const useMyApplication = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY.application(user?.id ?? null),
    enabled: !!user,
    queryFn: async (): Promise<MyShopApplicationRow | null> => {
      // The view, not the table — it has no internal_note column at all, so a
      // future `select('*')` cannot leak a moderator note.
      const { data, error } = await shopFrom<MyShopApplicationRow>("my_shop_application")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });
};

export const useApplicationEvents = (applicationId: string | null) =>
  useQuery({
    queryKey: KEY.events(applicationId),
    enabled: !!applicationId,
    queryFn: async (): Promise<ShopApplicationEventRow[]> => {
      const { data, error } = await shopFrom<ShopApplicationEventRow>("shop_application_events")
        .select("*")
        .eq("application_id", applicationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

/** The shop the current user owns, once an application has been approved. */
export const useMyShop = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY.myShop(user?.id ?? null),
    enabled: !!user,
    queryFn: async (): Promise<ShopRow | null> => {
      const { data, error } = await shopFrom<ShopRow>("shops")
        .select("*")
        .eq("owner_user_id", user!.id)
        .limit(1);
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });
};

/**
 * Create-or-update the applicant's own draft.
 *
 * Deliberately a plain table write rather than an RPC: the row is the
 * applicant's own, the columns are theirs to edit, and RLS + the guard trigger
 * already confine it. An RPC here would add a hop without adding a guarantee.
 */
export const useSaveApplicationDraft = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ApplicationDraft & { id?: string }) => {
      const payload = {
        seller_type: draft.seller_type ?? null,
        full_name: draft.full_name ?? null,
        phone: draft.phone ?? null,
        shop_name: draft.shop_name ?? null,
        shop_intro: draft.shop_intro ?? null,
        pickup_address: draft.pickup_address ?? null,
        city: draft.city ?? null,
      };

      if (draft.id) {
        const { error } = await shopFrom<MyShopApplicationRow>("shop_applications")
          .update(payload)
          .eq("id", draft.id);
        if (error) throw error;
        return draft.id;
      }

      const { data, error } = await shopFrom<{ id: string }>("shop_applications")
        // applicant_user_id is set explicitly AND checked by the INSERT policy;
        // a client cannot claim someone else's id.
        .insert({ ...payload, applicant_user_id: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.application(user?.id ?? null) });
    },
  });
};

/**
 * Submit, telling the server which seller-rules version the form displayed.
 *
 * The version is not authorization — the server checks the acceptance itself —
 * it is how a form left open across a version change gets refused instead of
 * quietly submitting under text the applicant never read.
 */
export const useSubmitApplication = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rulesVersion?: string | null) => {
      return await shopRpc<string>("shop_application_submit", {
        _expected_rules_version: rulesVersion ?? null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.application(user?.id ?? null) });
      void qc.invalidateQueries({ queryKey: ["shop", "application-events"] });
    },
  });
};

export const useWithdrawApplication = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await shopRpc<string>("shop_application_withdraw");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.application(user?.id ?? null) });
    },
  });
};

/**
 * Postgres error codes the RPCs raise, mapped to the message the applicant
 * should read. Anything unmapped falls through to a generic recovery line —
 * never a raw Postgres string, which tells a seller nothing.
 */
export const applicationErrorMessage = (err: unknown): string => {
  const message = (err as { message?: string })?.message ?? "";
  const table: Record<string, string> = {
    shop_pilot_access_required: "Tài khoản của anh/chị chưa nằm trong nhóm thử nghiệm. Liên hệ ThePickleHub để được thêm vào.",
    no_editable_application: "Hồ sơ này không còn ở trạng thái sửa được.",
    no_open_application: "Không có hồ sơ nào đang mở để rút.",
    missing_seller_type: "Chưa chọn loại người bán.",
    missing_full_name: "Chưa điền họ tên.",
    invalid_phone: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0.",
    missing_shop_name: "Tên shop cần ít nhất 3 ký tự.",
    missing_city: "Chưa điền tỉnh/thành gửi hàng.",
    // Migration 20260814090000. These three can only be reached by a client
    // that skipped the acceptance step — the UI disables the button — so the
    // wording tells the seller what to do rather than what went wrong.
    seller_rules_not_published:
      "Quy chế người bán chưa được ban hành, nên chưa gửi hồ sơ được. ThePickleHub sẽ báo khi có.",
    seller_rules_not_accepted:
      "Anh/chị cần đọc và đồng ý Quy chế người bán ở bước cuối trước khi gửi.",
    seller_rules_version_changed:
      "Quy chế vừa có bản mới. Đọc lại và đồng ý bản mới rồi gửi lại giúp em.",
  };
  for (const [code, text] of Object.entries(table)) {
    if (message.includes(code)) return text;
  }
  return "Chưa gửi được. Bản nháp của anh/chị vẫn còn nguyên — thử lại sau vài giây giúp.";
};
