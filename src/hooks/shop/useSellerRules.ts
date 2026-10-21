// ============================================================================
// Seller rules — read the effective version, and record acceptance.
// ----------------------------------------------------------------------------
// Product Owner decision 2026-08-12 #5. Nothing here is a security control:
// shop_application_submit() re-checks acceptance in Postgres, so a caller who
// skips this file entirely is refused all the same. What these hooks buy is a
// seller being told the truth about what they are agreeing to, and a submit
// button that is not offered before there is anything to submit.
//
// The client never computes a hash and never sends a timestamp. It reads the
// document, shows it, and echoes the version and hash back so the server can
// refuse a form that was open across a version change.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopRpc } from "@/integrations/supabase/shop-client";
import type {
  SellerRulesDocument,
  SellerRulesReceipt,
  SellerRulesReceiptView,
} from "@/integrations/supabase/shop-schema";
import { useAuth } from "@/hooks/useAuth";

export const SELLER_RULES_KEY = "seller-rules";

const KEY = {
  document: ["shop", "seller-rules", "document"] as const,
  receipt: (uid: string | null) => ["shop", "seller-rules", "receipt", uid] as const,
};

/**
 * The version currently in force, or null when nothing is published.
 *
 * `null` is a real answer, not an error: until the Product Owner publishes
 * "Quy chế người bán v1" there is no document, and the honest screen says so
 * rather than showing an enabled checkbox over nothing.
 */
export const useSellerRulesDocument = () =>
  useQuery({
    queryKey: KEY.document,
    // A legal document does not change while somebody is reading it — but it
    // CAN change between sessions, so this is short enough that a stale copy
    // does not outlive the form. The server refuses a stale version anyway.
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<SellerRulesDocument | null> => {
      const rows = await shopRpc<SellerRulesDocument[]>("legal_current_document", {
        _document_key: SELLER_RULES_KEY,
      });
      return (rows ?? [])[0] ?? null;
    },
  });

/**
 * Has this applicant accepted the version in force?
 *
 * Deliberately keyed on the EFFECTIVE version rather than "have they ever
 * signed anything": someone who accepted v1 and never came back after v2 took
 * effect has a signature that no longer counts, and a green tick over it would
 * be a lie the moderator repeats.
 */
export const useSellerRulesReceipt = (applicationId: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY.receipt(user?.id ?? null), applicationId],
    enabled: !!user && !!applicationId,
    queryFn: async (): Promise<SellerRulesReceiptView> =>
      await shopRpc<SellerRulesReceiptView>("shop_application_rules_receipt", {
        _application_id: applicationId!,
      }),
  });
};

/**
 * Record acceptance. Idempotent on the client token, so a retry after a dropped
 * response returns the first receipt instead of a second signature.
 */
export const useAcceptSellerRules = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: SellerRulesDocument): Promise<SellerRulesReceipt> =>
      await shopRpc<SellerRulesReceipt>("legal_accept", {
        _document_key: doc.document_key,
        _version: doc.version,
        // Echoed back for the server to compare against its own copy. It is
        // never stored from here — the row keeps the server's hash.
        _content_hash: doc.content_hash,
        // Stable per (user, version): a retry is the same token, so it replays
        // rather than racing.
        _client_token: `rules-${user?.id ?? "anon"}-${doc.document_key}-${doc.version}`,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.receipt(user?.id ?? null) });
    },
  });
};

/** Codes legal_accept() / the submit raise, in words a seller can act on. */
export const sellerRulesErrorMessage = (err: unknown): string => {
  const message = (err as { message?: string })?.message ?? "";
  if (message.includes("seller_rules_not_published") || message.includes("chưa có phiên bản nào"))
    return "Quy chế người bán chưa được ban hành. Chưa gửi hồ sơ được — ThePickleHub sẽ báo khi có.";
  if (message.includes("seller_rules_version_changed") || message.includes("phiên bản đã đổi"))
    return "Quy chế vừa có bản mới. Anh/chị đọc lại và đồng ý bản mới giúp em.";
  if (message.includes("không khớp"))
    return "Nội dung quy chế vừa thay đổi. Tải lại trang để đọc bản đang áp dụng.";
  if (message.includes("seller_rules_not_accepted"))
    return "Chưa ghi nhận được việc anh/chị đồng ý quy chế. Tích lại ô đồng ý giúp em.";
  if (message.includes("phải đăng nhập")) return "Phiên đăng nhập đã hết. Đăng nhập lại giúp em.";
  return "Chưa ghi nhận được. Thử lại giúp em — chưa có gì bị mất.";
};
