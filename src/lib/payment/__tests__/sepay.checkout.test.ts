/** @vitest-environment jsdom */
// startSePayCheckout là đường tiền: nó biến một mã đơn thành bộ thông tin
// chuyển khoản mà người mua quét để trả tiền thật. Trước file này chỉ có
// validSePayCheckoutResponse được kiểm — tức là mọi nhánh HỎNG của hàm đều
// chưa ai chạy qua: lỗi từ edge function có body JSON, lỗi không phải JSON,
// và trường hợp nguy hiểm nhất là edge trả 200 kèm payload sai hình dạng.
//
// Nhánh cuối mới là lý do file này tồn tại. Nếu nó lọt, giao diện sẽ dựng mã
// QR từ dữ liệu không được kiểm chứng và người mua chuyển tiền vào một tài
// khoản nào đó. "Không có QR" là hỏng; "QR sai tài khoản" là mất tiền.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeWithBlobRetry } = vi.hoisted(() => ({ invokeWithBlobRetry: vi.fn() }));

vi.mock("@/lib/edgeInvoke", () => ({ invokeWithBlobRetry }));

import { startSePayCheckout } from "../sepay";

const PAYMENT = {
  qr_url: "https://vietqr.app/img?acc=0123456789&bank=MB&amount=125000&des=PH-2608-A1B2",
  bank_code: "MB",
  account_number: "0123456789",
  account_name: "THE PICKLE HUB",
  amount_vnd: 125000,
  memo: "PH-2608-A1B2",
  status: "initiated" as const,
};

const FALLBACK = "Chưa tải được yêu cầu thanh toán. Thử lại giúp em.";

beforeEach(() => invokeWithBlobRetry.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("startSePayCheckout", () => {
  it("gọi đúng edge function với mã đơn, và trả về payload đã kiểm", async () => {
    invokeWithBlobRetry.mockResolvedValue({ data: PAYMENT, error: null });

    await expect(startSePayCheckout("PH-2608-A1B2")).resolves.toEqual(PAYMENT);
    expect(invokeWithBlobRetry).toHaveBeenCalledWith("shop-sepay-checkout", {
      body: { code: "PH-2608-A1B2" },
    });
  });

  it("dùng câu lỗi của server khi edge function trả body JSON có .error", async () => {
    const context = {
      clone: () => ({ json: async () => ({ error: "Đơn này đã thanh toán rồi." }) }),
    };
    invokeWithBlobRetry.mockResolvedValue({ data: null, error: { context } });

    await expect(startSePayCheckout("PH-2608-A1B2")).rejects.toThrow(
      "Đơn này đã thanh toán rồi.",
    );
  });

  it("lùi về câu mặc định khi body lỗi không phải JSON", async () => {
    const context = {
      clone: () => ({ json: async () => { throw new SyntaxError("not json"); } }),
    };
    invokeWithBlobRetry.mockResolvedValue({ data: null, error: { context } });

    await expect(startSePayCheckout("PH-2608-A1B2")).rejects.toThrow(FALLBACK);
  });

  it("lùi về câu mặc định khi lỗi mạng không kèm response nào", async () => {
    invokeWithBlobRetry.mockResolvedValue({ data: null, error: new Error("fetch failed") });

    await expect(startSePayCheckout("PH-2608-A1B2")).rejects.toThrow(FALLBACK);
  });

  it("coi 'không lỗi nhưng cũng không data' là hỏng, không phải thành công rỗng", async () => {
    invokeWithBlobRetry.mockResolvedValue({ data: null, error: null });

    await expect(startSePayCheckout("PH-2608-A1B2")).rejects.toThrow(FALLBACK);
  });

  it("chặn payload 200 nhưng sai hình dạng — không để giao diện dựng QR từ dữ liệu chưa kiểm", async () => {
    for (const bad of [
      { ...PAYMENT, qr_url: "https://evil.example/img" },
      { ...PAYMENT, qr_url: "http://vietqr.app/img" },
      { ...PAYMENT, amount_vnd: -1 },
      { ...PAYMENT, account_name: "" },
      { ...PAYMENT, memo: "" },
      "not-an-object",
    ]) {
      invokeWithBlobRetry.mockResolvedValue({ data: bad, error: null });
      await expect(startSePayCheckout("PH-2608-A1B2")).rejects.toThrow(
        "Yêu cầu thanh toán không hợp lệ.",
      );
    }
  });
});
