// ============================================================================
// Admin moderation data layer.
// ----------------------------------------------------------------------------
// Every read is an RPC, not a table select. The queue and the review payload
// are allowlists built in Postgres (product_moderation_queue /
// product_moderation_detail), so a screen cannot accidentally widen what it
// shows by asking for one more column — and the counts on the badges are the
// server's, not a sum of whichever page happens to be in memory.
//
// is_admin() carries the AAL2 requirement, so an admin without 2FA gets 42501
// from the RPC itself. The route guard is a courtesy on top of that, never the
// thing doing the work.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { edgeError, edgeErrorMessage } from "@/lib/shop/errors";
import { shopRpc } from "@/integrations/supabase/shop-client";
import type { Decision, ModerationTarget } from "@/lib/shop/moderationDecision";

const MOD_KEY = ["shop", "admin", "moderation"] as const;

export type ModerationStatus = "pending_review" | "needs_changes" | "rejected" | "suspended" | "approved";

export interface QueueRow {
  id: string;
  title: string;
  status: ModerationStatus;
  version: number;
  submitted_at: string | null;
  waiting_seconds: number;
  shop: { id: string; slug: string; name: string; state: string };
  category: { slug: string | null; name: string | null; is_active: boolean };
  media_total: number;
  media_verified: number;
  variant_count: number;
  times_returned: number;
}

export interface QueuePage {
  rows: QueueRow[];
  has_more: boolean;
  counts: Partial<Record<ModerationStatus, number>>;
}

export interface QueueFilters {
  status: ModerationStatus;
  shopId?: string | null;
  categorySlug?: string | null;
  cursorAt?: string | null;
  cursorId?: string | null;
}

export const useModerationQueue = (f: QueueFilters) =>
  useQuery({
    queryKey: [...MOD_KEY, "queue", f.status, f.shopId ?? null, f.categorySlug ?? null, f.cursorAt ?? null],
    queryFn: () =>
      shopRpc<QueuePage>("product_moderation_queue", {
        _status: f.status,
        _shop_id: f.shopId ?? null,
        _category_slug: f.categorySlug ?? null,
        _cursor_at: f.cursorAt ?? null,
        _cursor_id: f.cursorId ?? null,
        _limit: 25,
      }),
  });

export interface ModerationDetail {
  id: string;
  version: number;
  status: ModerationStatus;
  is_published: boolean;
  submitted_at: string | null;
  moderation_state: { decided: boolean; media_published: boolean; publicly_visible: boolean };
  shop: {
    id: string; slug: string; name: string; state: string; region: string | null;
    verified: boolean; shipping_note: string | null; return_note: string | null;
    product_counts: Record<string, number>;
  };
  category: { slug: string; name: string; is_active: boolean } | null;
  buyer_preview: Record<string, unknown>;
  preflight: { code: string; section: string; variant_id?: string; media_id?: string }[];
  history: {
    id: string; decision: string; to_status: string; created_at: string;
    applicant_note: string | null; internal_note?: string | null;
    requested_targets: ModerationTarget[];
  }[];
  internal_note: string | null;
  applicant_note: string | null;
  requested_targets: ModerationTarget[];
  edit_sections: string[];
  contacts: {
    id: string; type: string; state: string; is_public: boolean; version: number;
    value_normalized: string; display_label: string | null; review_note: string | null;
  }[];
  allowed_decisions: Decision[];
}

export const useModerationDetail = (id: string | null) =>
  useQuery({
    queryKey: [...MOD_KEY, "detail", id],
    enabled: !!id,
    queryFn: () => shopRpc<ModerationDetail>("product_moderation_detail", { _product_id: id }),
  });

export interface DecidePayload {
  productId: string;
  decision: Decision;
  expectedVersion: number;
  applicantNote: string;
  internalNote: string;
  targets: ModerationTarget[];
  /** Stable per attempt. A retry of the SAME attempt must reuse it. */
  clientToken: string;
}

export interface DecideResult {
  ok: boolean;
  status?: ModerationStatus;
  replayed?: boolean;
  problems?: { code: string; section: string }[];
}

export const useDecideProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: DecidePayload) =>
      shopRpc<DecideResult>("product_decide", {
        _product_id: p.productId,
        _decision: p.decision,
        _expected_version: p.expectedVersion,
        _applicant_note: p.applicantNote || null,
        _internal_note: p.internalNote || null,
        _requested_targets: p.targets,
        _client_token: p.clientToken,
      }),
    // Invalidate the whole moderation namespace: a decision changes the row,
    // the counts, and the audit timeline, and a screen showing two of the
    // three is how a moderator decides twice.
    onSuccess: () => void qc.invalidateQueries({ queryKey: MOD_KEY }),
  });
};

/**
 * The step approve deliberately does NOT do: copy the verified renditions
 * into the public bucket and flip is_published, via the worker that holds the
 * only service-role over those buckets. Wave 0 found that NOTHING called it —
 * the state machine was complete and the shelf stayed empty. The review
 * screen calls this right after a successful approve, and offers it as a
 * button whenever an approved product is still not publicly visible.
 */
export const usePublishProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      // Imported lazily: client.ts creates the SDK client at module load and
      // THROWS without env vars — a top-level import here took the whole
      // MediaEditor test import-chain down on CI, where no .env exists.
      const { supabase } = await import("@/integrations/supabase/client");
      // Same error-reading as the profile leg — and deliberately NO timeout:
      // this one copies every rendition of a product, so a 20s cap would abort
      // work that is progressing. Observability only.
      const { data, error, response } = await supabase.functions.invoke("shop-media-lifecycle", {
        body: { action: "publish", product_id: productId },
      });
      if (error) throw edgeError(await edgeErrorMessage(error, response));
      return data as { ok?: boolean; renditions?: number };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: MOD_KEY }),
  });
};

// ─── Contact channels ───────────────────────────────────────────────────────

export type ContactState = "draft" | "pending_review" | "approved" | "rejected" | "disabled";

export interface ContactQueueRow {
  id: string;
  type: "phone" | "zalo" | "messenger";
  state: ContactState;
  is_public: boolean;
  version: number;
  value_normalized: string;
  display_label: string | null;
  updated_at: string;
  shop: { id: string; slug: string; name: string; state: string };
}

export const useContactQueue = (state: ContactState) =>
  useQuery({
    queryKey: [...MOD_KEY, "contacts", state],
    queryFn: () => shopRpc<ContactQueueRow[]>("shop_contact_moderation_queue", { _state: state }),
  });

export interface ContactHistoryRow {
  id: string;
  action: string;
  channel_type: string;
  to_state: ContactState;
  created_at: string;
  applicant_note: string | null;
  internal_note?: string | null;
}

export const useContactHistory = (channelId: string | null) =>
  useQuery({
    queryKey: [...MOD_KEY, "contact-history", channelId],
    enabled: !!channelId,
    queryFn: () =>
      shopRpc<ContactHistoryRow[]>("shop_contact_moderation_history", { _channel_id: channelId }),
  });

export interface ContactDecidePayload {
  channelId: string;
  decision: "approve" | "reject" | "disable";
  expectedVersion: number;
  note: string;
  internalNote: string;
  clientToken: string;
}

export const useDecideContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ContactDecidePayload) =>
      shopRpc<{ ok: boolean; state: ContactState; replayed: boolean }>("shop_contact_decide", {
        _id: p.channelId,
        _decision: p.decision,
        _expected_version: p.expectedVersion,
        _note: p.note || null,
        _internal_note: p.internalNote || null,
        _client_token: p.clientToken,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: MOD_KEY }),
  });
};
