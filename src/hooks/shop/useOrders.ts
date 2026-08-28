// ============================================================================
// Orders — read one, create one, move one.
// ----------------------------------------------------------------------------
// The two writes are RPCs (shop_order_create / shop_order_transition) because
// money and stock move inside them. The read is NOT: there is no
// shop_order_by_code() granted to `authenticated` — shop_order_json() exists
// but is service_role only — so the buyer's own order is read straight off the
// tables, which RLS already narrows to the parties of the order.
//
// Columns are listed one by one. `select("*")` answers 42501 here and that is
// the point: buyer_user_id and client_token are NOT granted, so a star select
// asks for two columns nobody may hold and the whole read fails.
//
// The shape assembled here is deliberately identical to what the two RPCs hand
// back, so a transition's return value can be written straight into the cache
// without a second round trip.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopFrom, shopRpc } from "@/integrations/supabase/shop-client";
import type {
  OrderAction,
  OrderStatus,
  PaymentMethod,
  ShopOrderDetail,
} from "@/integrations/supabase/shop-schema";

export const orderKeys = {
  all: ["shop", "order"] as const,
  one: (code: string | null) => ["shop", "order", code] as const,
};

/** Aliased embeds, so the row comes back in the same shape shop_order_json
 *  produces: `shop`, `items`, `events`. */
const ORDER_SELECT =
  "id,code,status,payment_method,recipient_name,recipient_phone,shipping_address," +
  "delivery_note,items_total_vnd,shipping_fee_vnd,total_vnd,confirm_due_at," +
  "tracking_code,cancel_reason,payment_claimed_at,payment_confirmed_at," +
  "created_at,updated_at," +
  "shop:shops(slug,name,state)," +
  "items:shop_order_items(id,product_id,variant_id,qty,product_title,variant_label,sku,unit_price_vnd,line_total_vnd)," +
  "events:shop_order_events(id,action,from_status,to_status,metadata,created_at)";

/** A code that does not exist and a code belonging to somebody else are the
 *  same answer — `null`. The screen prints one sentence for both. */
export const useOrder = (code: string | null) =>
  useQuery({
    queryKey: orderKeys.one(code),
    enabled: !!code,
    // An order changes when the seller acts, which is minutes to days away.
    staleTime: 30_000,
    queryFn: async (): Promise<ShopOrderDetail | null> => {
      const { data, error } = await shopFrom<ShopOrderDetail>("shop_orders")
        .select(ORDER_SELECT)
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Sorting the embeds is not worth a second round trip: an order has a
      // handful of lines and at most five events.
      return {
        ...data,
        items: [...(data.items ?? [])],
        events: [...(data.events ?? [])].sort(
          (a, b) => a.created_at.localeCompare(b.created_at),
        ),
      };
    },
  });

// ─── Lists ──────────────────────────────────────────────────────────────────
// Two lists, two sources, and the difference is not an optimisation.
//
//   · /shop/orders reads the VIEW my_shop_orders, which applies auth.uid()
//     itself. Reading shop_orders here would obey the same policy the detail
//     page does — buyer OR shop member — and hand a shop owner their own
//     customers' names and addresses under the heading "Đơn của tôi".
//   · /seller/orders reads shop_orders filtered by shop_id, which is exactly
//     what a member is entitled to.
//
// Both fetch the whole (capped) set in ONE request and do tabs, counts, search
// and paging in memory. Four count queries plus a page query is five round
// trips for a screen whose numbers must agree with each other.

/** One row of either order list. `events` is here only for the cancel event's
 *  actor_kind — `actor_user_id` is not granted and never will be. */
export interface OrderListRow {
  id: string;
  code: string;
  shop_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  recipient_name: string;
  total_vnd: number;
  confirm_due_at: string;
  cancel_reason: string | null;
  created_at: string;
  shop: { slug: string; name: string } | null;
  items: { id: string; product_title: string; qty: number }[];
  events: { action: string; metadata: Record<string, unknown> | null; created_at: string }[];
}

const LIST_SELECT =
  "id,code,shop_id,status,payment_method,recipient_name,total_vnd,confirm_due_at," +
  "cancel_reason,created_at," +
  "shop:shops(slug,name)," +
  "items:shop_order_items(id,product_title,qty)," +
  "events:shop_order_events(action,metadata,created_at)";

/** ponytail: one page of 200, newest first. A pilot buyer has a handful of
 *  orders and a pilot shop has tens; when a shop passes 200 this becomes a
 *  server-side filter with counts to match, not a bigger number. */
export const ORDER_LIST_CAP = 200;

export const useMyOrders = () =>
  useQuery({
    queryKey: ["shop", "orders", "mine"] as const,
    staleTime: 30_000,
    queryFn: async (): Promise<OrderListRow[]> => {
      const { data, error } = await shopFrom<OrderListRow>("my_shop_orders")
        .select(LIST_SELECT)
        .order("created_at", { ascending: false })
        .limit(ORDER_LIST_CAP);
      if (error) throw error;
      return data ?? [];
    },
  });

/** The shop's own orders. Sorting is NOT done here — `sortSellerOrders` puts
 *  the ones about to run out of time first, and that rule is a pure function
 *  with a test, not an ORDER BY nobody can see. */
export const useShopOrders = (shopId: string | null) =>
  useQuery({
    queryKey: ["shop", "orders", "shop", shopId] as const,
    enabled: !!shopId,
    staleTime: 30_000,
    // A seller leaves this tab open while they pack. Coming back to it is the
    // moment a new order matters, and it is the only refetch trigger there is:
    // polling a management screen every 30s is a request every 30s for ever.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<OrderListRow[]> => {
      const { data, error } = await shopFrom<OrderListRow>("shop_orders")
        .select(LIST_SELECT)
        .eq("shop_id", shopId!)
        .order("created_at", { ascending: false })
        .limit(ORDER_LIST_CAP);
      if (error) throw error;
      return data ?? [];
    },
  });

/** What shop_last_shipping_address() hands back, or null when this account has
 *  never ordered. */
export interface LastShippingAddress {
  recipient_name: string;
  recipient_phone: string;
  shipping_address: string;
}

/**
 * The address this buyer used last time, for prefilling checkout.
 *
 * An RPC and not a table read, and that is not a preference. shop_orders'
 * SELECT policy admits every PARTY to an order, so "the newest order I can
 * read" is, for anybody who also sells, their own CUSTOMER's order — and
 * `buyer_user_id` is not granted, so the client cannot filter it back out.
 * The comparison has to happen where auth.uid() is, which is inside
 * shop_last_shipping_address() (migration 20260818120000).
 */
export const useLastShippingAddress = () =>
  useQuery({
    queryKey: ["shop", "orders", "last-address"] as const,
    // An address changes when somebody moves house. Nothing on this screen is
    // worth refetching it for.
    staleTime: 10 * 60_000,
    queryFn: () => shopRpc<LastShippingAddress | null>("shop_last_shipping_address"),
  });

export interface OrderCreateInput {
  /** Minted once per checkout attempt and replayed on retry — the same token
   *  returns the FIRST order rather than making a second one. */
  clientToken: string;
  paymentMethod: PaymentMethod;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  deliveryNote: string | null;
  expectedShippingFeeVnd: number;
  items: { variant_id: string; qty: number; expected_unit_price_vnd: number }[];
}

/**
 * Place the order.
 *
 * All eight arguments go every time. shop_order_create() gives none of them a
 * DEFAULT — deliberately, to keep a second overload from ever becoming
 * ambiguous — so omitting `_delivery_note` is a 42883, not a null.
 */
export const useOrderCreate = () => {
  const qc = useQueryClient();
  return useMutation({
    // NEVER retry. Two reasons, and the second one is the bug this closes:
    //
    //  · PT409 / 42501 / 22023 are answers, not blips. Sending the same order
    //    again cannot change a price that moved.
    //  · a retryer that is about to retry SLEEPS, and before it wakes it asks
    //    focusManager.isFocused(). A tab that is not visible pauses it instead
    //    of failing it, and mutateAsync then never settles — which is how the
    //    order button sat at "Đang gửi đơn…" for ever with the 409 already
    //    answered (round 2, TC10). App.tsx's global default is `retry: 1`, so
    //    this line is what keeps this mutation out of that path.
    //
    // Retrying by hand is safe and is what the buyer gets instead: the
    // idempotency token is unchanged, so a replay returns the FIRST order.
    retry: false,
    mutationFn: (input: OrderCreateInput) =>
      shopRpc<ShopOrderDetail>("shop_order_create", {
        _client_token: input.clientToken,
        _payment_method: input.paymentMethod,
        _recipient_name: input.recipientName,
        _recipient_phone: input.recipientPhone,
        _shipping_address: input.shippingAddress,
        _delivery_note: input.deliveryNote,
        _expected_shipping_fee_vnd: input.expectedShippingFeeVnd,
        _items: input.items,
      }),
    onSuccess: (order) => {
      // The screen navigates to /shop/order/:code straight away; seeding the
      // cache means it renders from this payload instead of flashing a
      // skeleton for a row it already has.
      qc.setQueryData(orderKeys.one(order.code), order);
      void qc.invalidateQueries({ queryKey: ["shop", "cart"] });
    },
  });
};

export interface OrderTransitionInput {
  orderId: string;
  action: OrderAction;
  /** The status the screen was showing. Postgres refuses PT409/stale_status if
   *  it is not the status the row actually has — which is the whole guard
   *  against two people acting on one order. */
  expectedStatus: OrderStatus;
  reason?: string | null;
  trackingCode?: string | null;
}

export const useOrderTransition = () => {
  const qc = useQueryClient();
  return useMutation({
    // Same reason as useOrderCreate: stale_status is a final answer, and a
    // paused retryer is a button that never comes back.
    retry: false,
    mutationFn: (input: OrderTransitionInput) =>
      shopRpc<ShopOrderDetail>("shop_order_transition", {
        _order_id: input.orderId,
        _action: input.action,
        _expected_status: input.expectedStatus,
        _reason: input.reason ?? null,
        _tracking_code: input.trackingCode ?? null,
      }),
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.one(order.code), order);
      // The buyer may return through "Đơn của tôi" immediately after marking
      // a parcel received. Keep that list (and the seller's tabs) from showing
      // the old action/status until its 30-second stale window expires.
      void qc.invalidateQueries({ queryKey: ["shop", "orders"] });
    },
  });
};
