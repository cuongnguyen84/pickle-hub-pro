import { invokeWithBlobRetry } from "@/lib/edgeInvoke";

export interface SePayCheckoutResponse {
  checkout_url: string;
  fields: Record<string, string | number>;
  invoice_number: string;
  environment: "sandbox" | "production";
}

const CHECKOUT_HOSTS = new Set(["pay-sandbox.sepay.vn", "pay.sepay.vn"]);
const FIELD_ALLOWLIST = new Set([
  "operation", "payment_method", "order_invoice_number", "order_amount", "currency",
  "order_description", "success_url", "error_url", "cancel_url", "merchant", "signature",
]);

export function postToSePay(checkout: SePayCheckoutResponse): void {
  const url = new URL(checkout.checkout_url);
  if (url.protocol !== "https:" || !CHECKOUT_HOSTS.has(url.hostname) || url.pathname !== "/v1/checkout/init") {
    throw new Error("SePay trả về địa chỉ thanh toán không hợp lệ.");
  }

  const entries = Object.entries(checkout.fields);
  if (!entries.length || entries.some(([name, value]) =>
    !FIELD_ALLOWLIST.has(name) || (typeof value !== "string" && typeof value !== "number")
  )) {
    throw new Error("SePay trả về biểu mẫu thanh toán không hợp lệ.");
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = url.toString();
  form.hidden = true;
  for (const [name, value] of entries) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export async function startSePayCheckout(code: string): Promise<SePayCheckoutResponse> {
  const { data, error } = await invokeWithBlobRetry<SePayCheckoutResponse>(
    "shop-sepay-checkout",
    { body: { code } },
  );
  if (error || !data) {
    const response = (error as { context?: Response } | null)?.context;
    let message = "Chưa mở được cổng SePay. Thử lại giúp em.";
    if (response && typeof response.clone === "function") {
      try {
        const body = await response.clone().json() as { error?: unknown };
        if (typeof body.error === "string") message = body.error;
      } catch {
        // Keep the safe fallback; SDK error bodies are not guaranteed JSON.
      }
    }
    throw new Error(message);
  }
  postToSePay(data);
  return data;
}
