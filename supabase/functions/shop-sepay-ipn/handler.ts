export interface SePayIpnInput {
  notification_type: string;
  invoice_number: string;
  provider_order_id: string;
  order_status: string;
  order_amount_vnd: number;
  order_currency: string;
  provider_transaction_id: string;
  transaction_status: string;
  transaction_amount_vnd: number;
  transaction_currency: string;
  payment_method: string;
  sent_at: string;
}

export interface SePayIpnStore {
  apply(input: SePayIpnInput): Promise<{ row: Record<string, unknown> | null; error: string | null }>;
}

export interface IpnResult {
  status: number;
  body: Record<string, unknown>;
}

export function secretMatches(presented: string, expected: string): boolean {
  const a = new TextEncoder().encode(presented);
  const b = new TextEncoder().encode(expected);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0 && expected.length > 0;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function money(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  if (!/^[0-9]+(?:\.0+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : null;
}

export function parseSePayIpn(payload: unknown): SePayIpnInput | null {
  const root = object(payload);
  const order = object(root?.order);
  const transaction = object(root?.transaction);
  const timestamp = root?.timestamp;
  const orderAmount = money(order?.order_amount);
  const transactionAmount = money(transaction?.transaction_amount);
  if (
    !root || !order || !transaction || typeof timestamp !== "number" || !Number.isSafeInteger(timestamp)
    || timestamp <= 0 || orderAmount === null || transactionAmount === null
  ) return null;

  const required = [
    root.notification_type, order.order_invoice_number, order.id, order.order_status,
    order.order_currency, transaction.transaction_id, transaction.transaction_status,
    transaction.transaction_currency, transaction.payment_method,
  ];
  if (!required.every((value) => typeof value === "string" && value.length > 0)) return null;

  return {
    notification_type: root.notification_type as string,
    invoice_number: order.order_invoice_number as string,
    provider_order_id: order.id as string,
    order_status: order.order_status as string,
    order_amount_vnd: orderAmount,
    order_currency: order.order_currency as string,
    provider_transaction_id: transaction.transaction_id as string,
    transaction_status: transaction.transaction_status as string,
    transaction_amount_vnd: transactionAmount,
    transaction_currency: transaction.transaction_currency as string,
    payment_method: transaction.payment_method as string,
    sent_at: new Date(timestamp * 1000).toISOString(),
  };
}

export async function processSePayIpn(
  payload: unknown,
  presentedSecret: string,
  expectedSecret: string,
  store: SePayIpnStore,
): Promise<IpnResult> {
  if (!secretMatches(presentedSecret, expectedSecret)) {
    return { status: 401, body: { error: "unauthorized", code: "unauthorized" } };
  }

  // SePay's dashboard sends this undocumented notification when the merchant
  // clicks "Gửi test". It is only a connectivity probe: acknowledge it after
  // authenticating the merchant secret, but never let it touch payment state.
  if (object(payload)?.notification_type === "PAYMENT_SUCCESS") {
    return { status: 200, body: { success: true, result: "connectivity_test" } };
  }

  const input = parseSePayIpn(payload);
  if (!input || !["ORDER_PAID", "TRANSACTION_VOID"].includes(input.notification_type)) {
    return { status: 400, body: { error: "invalid_payload", code: "invalid_payload" } };
  }
  const applied = await store.apply(input);
  if (applied.error || !applied.row) {
    const unknown = applied.error?.toLowerCase().includes("unknown invoice");
    return {
      status: unknown ? 404 : 422,
      body: { error: unknown ? "unknown_invoice" : "reconciliation_failed", code: unknown ? "unknown_invoice" : "reconciliation_failed" },
    };
  }
  return { status: 200, body: { success: true, ...applied.row } };
}
