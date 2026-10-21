export interface SePayCheckoutConfig {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface PreparedPayment {
  code: string;
  invoice_number: string;
  amount_vnd: number;
  status: "initiated" | "paid" | "voided";
}

export interface SePayCheckoutStore {
  prepare(code: string): Promise<{ row: PreparedPayment | null; error: string | null }>;
}

export interface CheckoutResult {
  status: number;
  body: Record<string, unknown>;
}

const CODE_RE = /^PH-[0-9]{4}-[A-F0-9]{4}$/;
const BANK_RE = /^[A-Za-z0-9_-]{2,32}$/;
const ACCOUNT_RE = /^[A-Za-z0-9]{4,34}$/;

/**
 * Inline VietQR flow. Unlike SePay Payment Gateway checkout, this never sends
 * the buyer to a hosted page. The linked platform bank account receives the
 * transfer directly; SePay's bank webhook reconciles the memo afterwards.
 */
export async function processSePayCheckout(
  input: unknown,
  store: SePayCheckoutStore,
  config: SePayCheckoutConfig,
): Promise<CheckoutResult> {
  const code = typeof input === "object" && input !== null
    ? (input as Record<string, unknown>).code
    : null;
  if (typeof code !== "string" || !CODE_RE.test(code)) {
    return { status: 400, body: { error: "Mã đơn không hợp lệ.", code: "invalid_order_code" } };
  }

  const bankCode = config.bankCode.trim();
  const accountNumber = config.accountNumber.replace(/\s+/g, "");
  const accountName = config.accountName.trim();
  if (!BANK_RE.test(bankCode) || !ACCOUNT_RE.test(accountNumber) || !accountName) {
    return {
      status: 503,
      body: { error: "Thanh toán chuyển khoản đang được cấu hình.", code: "payment_not_configured" },
    };
  }

  const prepared = await store.prepare(code);
  if (prepared.error || !prepared.row) {
    const disabled = prepared.error?.toLowerCase().includes("chưa được bật");
    return {
      status: disabled ? 503 : 409,
      body: {
        error: disabled
          ? "Thanh toán chuyển khoản chưa được bật."
          : "Không thể tạo yêu cầu thanh toán cho đơn này.",
        code: disabled ? "payment_disabled" : "checkout_not_available",
      },
    };
  }
  if (prepared.row.status === "paid") {
    return { status: 409, body: { error: "Đơn đã thanh toán.", code: "already_paid" } };
  }
  if (!Number.isSafeInteger(prepared.row.amount_vnd) || prepared.row.amount_vnd <= 0) {
    return { status: 500, body: { error: "Số tiền đơn không hợp lệ.", code: "invalid_amount" } };
  }

  const query = new URLSearchParams({
    acc: accountNumber,
    bank: bankCode,
    amount: String(prepared.row.amount_vnd),
    des: prepared.row.invoice_number,
    template: "compact",
    showinfo: "true",
    fullacc: "true",
    holder: accountName,
    store: "ThePickleHub",
  });

  return {
    status: 200,
    body: {
      qr_url: `https://vietqr.app/img?${query.toString()}`,
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: accountName,
      amount_vnd: prepared.row.amount_vnd,
      memo: prepared.row.invoice_number,
      status: prepared.row.status,
    },
  };
}
