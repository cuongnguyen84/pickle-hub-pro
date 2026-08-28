// ============================================================================
// Shop payment projection — manual VietQR plus optional SePay gateway.
// ----------------------------------------------------------------------------
// Separate from useOrders because the shape it reads is not on the order at
// all. `shops.bank_account_number` reaches nobody through a grant or a
// projection: shop_order_payment_info is a SECURITY DEFINER door that answers
// only for somebody already a party to THIS order, and answers a missing code
// and a stranger's code identically so it cannot be used to probe which order
// codes exist.
//
// Manual mode renders the existing seller VietQR. Gateway mode exposes only
// provider + state; merchant credentials and IPN reconciliation stay in Edge
// Functions/Postgres and never enter this client.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopRpc } from "@/integrations/supabase/shop-client";
import { startSePayCheckout } from "@/lib/payment/sepay";
import { orderKeys } from "./useOrders";

export interface OrderPaymentInfo {
  found: boolean;
  method?: "cod" | "bank_transfer";
  amount_vnd?: number;
  /** The order code, and nothing appended. It is the only string tying a line
   *  in the seller's bank statement to an order — a friendly
   *  "Thanh toán đơn PH-…" prefix breaks their search. */
  memo?: string;
  claimed_at?: string | null;
  confirmed_at?: string | null;
  gateway?: {
    enabled: boolean;
    provider: "sepay";
    status: "not_started" | "initiated" | "paid" | "voided";
  } | null;
  bank?: { code: string; account_number: string; account_name: string } | null;
}

export interface PaymentMarks {
  code: string;
  claimed_at: string | null;
  confirmed_at: string | null;
}

export const paymentKeys = {
  one: (code: string | null) => ["shop", "order", code, "payment"] as const,
};

export const useOrderPaymentInfo = (code: string | null, enabled = true) =>
  useQuery({
    queryKey: paymentKeys.one(code),
    enabled: !!code && enabled,
    // Bank details change when a seller edits their profile — days apart, not
    // minutes. The two timestamps travel on the order itself.
    staleTime: 5 * 60_000,
    queryFn: () => shopRpc<OrderPaymentInfo>("shop_order_payment_info", { _code: code }),
    // The redirect can beat the IPN by a few seconds. Poll only while an
    // initiated gateway payment is waiting; manual VietQR never polls.
    refetchInterval: (query) => {
      const info = query.state.data;
      return info?.gateway?.enabled && info.gateway.status === "initiated" && !info.confirmed_at
        ? 3_000
        : false;
    },
  });

export const useSePayCheckout = () => {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: startSePayCheckout,
    onSuccess: (_payment, code) => {
      void qc.invalidateQueries({ queryKey: paymentKeys.one(code) });
    },
  });
};

/**
 * Both mutations are `retry: false`, for the reason recorded on
 * useOrderCreate: a retryer that is about to retry sleeps, then asks
 * focusManager.isFocused(), and a tab that is not visible gets PAUSED rather
 * than rejected — so mutateAsync never settles and the button sits at
 * "Đang gửi…" for ever with the server having already answered. App.tsx's
 * global default is `retry: 1`, so this line is what keeps these out of it.
 *
 * Retrying by hand is safe: both RPCs are idempotent, and a second press
 * returns the first timestamp rather than moving it.
 */
const useMarkPayment = (rpc: "shop_order_claim_payment" | "shop_order_confirm_payment") => {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (code: string) => shopRpc<PaymentMarks>(rpc, { _code: code }),
    onSuccess: (marks) => {
      // Patch both caches rather than invalidating: the order detail screen is
      // already showing this row, and a refetch would blank the payment card
      // for a beat right after the buyer pressed the button.
      qc.setQueryData(paymentKeys.one(marks.code), (prev: OrderPaymentInfo | undefined) =>
        prev ? { ...prev, claimed_at: marks.claimed_at, confirmed_at: marks.confirmed_at } : prev,
      );
      qc.setQueryData(orderKeys.one(marks.code), (prev: Record<string, unknown> | undefined) =>
        prev
          ? { ...prev, payment_claimed_at: marks.claimed_at, payment_confirmed_at: marks.confirmed_at }
          : prev,
      );
      // The two lists show a payment badge, and they are cheap to refresh.
      void qc.invalidateQueries({ queryKey: ["shop", "orders"] });
    },
  });
};

/** Buyer only. The server refuses a seller pressing this — "khách đã chuyển
 *  rồi" is not the seller's sentence to say. */
export const useClaimPayment = () => useMarkPayment("shop_order_claim_payment");

/** owner | manager | fulfillment | admin. `support` can read an order and can
 *  move neither it nor its money. */
export const useConfirmPayment = () => useMarkPayment("shop_order_confirm_payment");
