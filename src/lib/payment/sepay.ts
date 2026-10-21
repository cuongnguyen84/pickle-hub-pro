import { invokeWithBlobRetry } from "@/lib/edgeInvoke";

export interface SePayCheckoutResponse {
  qr_url: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  amount_vnd: number;
  memo: string;
  status: "initiated" | "voided";
}

export function validSePayCheckoutResponse(data: unknown): data is SePayCheckoutResponse {
  if (typeof data !== "object" || data === null) return false;
  const payment = data as Partial<SePayCheckoutResponse>;
  if (typeof payment.qr_url !== "string") return false;
  let qr: URL;
  try {
    qr = new URL(payment.qr_url);
  } catch {
    return false;
  }
  return qr.protocol === "https:"
    && qr.hostname === "vietqr.app"
    && qr.pathname === "/img"
    && Number.isSafeInteger(payment.amount_vnd)
    && Number(payment.amount_vnd) > 0
    && typeof payment.account_number === "string" && payment.account_number.length > 0
    && typeof payment.account_name === "string" && payment.account_name.length > 0
    && typeof payment.memo === "string" && payment.memo.length > 0;
}

export async function startSePayCheckout(code: string): Promise<SePayCheckoutResponse> {
  const { data, error } = await invokeWithBlobRetry<SePayCheckoutResponse>(
    "shop-sepay-checkout",
    { body: { code } },
  );
  if (error || !data) {
    const response = (error as { context?: Response } | null)?.context;
    let message = "Chưa tải được yêu cầu thanh toán. Thử lại giúp em.";
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

  if (!validSePayCheckoutResponse(data)) {
    throw new Error("Yêu cầu thanh toán không hợp lệ.");
  }
  return data;
}
