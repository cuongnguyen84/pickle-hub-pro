/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { validSePayCheckoutResponse, type SePayCheckoutResponse } from "../sepay";

const PAYMENT: SePayCheckoutResponse = {
  qr_url: "https://vietqr.app/img?acc=0123456789&bank=MB&amount=125000&des=PH-2608-A1B2",
  bank_code: "MB",
  account_number: "0123456789",
  account_name: "THE PICKLE HUB",
  amount_vnd: 125000,
  memo: "PH-2608-A1B2",
  status: "initiated",
};

describe("inline payment response", () => {
  it("accepts the allowlisted VietQR image and complete transfer details", () => {
    expect(validSePayCheckoutResponse(PAYMENT)).toBe(true);
  });

  it("refuses another host, path, invalid amount or incomplete recipient", () => {
    expect(validSePayCheckoutResponse({ ...PAYMENT, qr_url: "https://evil.example/img" })).toBe(false);
    expect(validSePayCheckoutResponse({ ...PAYMENT, qr_url: "https://vietqr.app/not-img" })).toBe(false);
    expect(validSePayCheckoutResponse({ ...PAYMENT, amount_vnd: 0 })).toBe(false);
    expect(validSePayCheckoutResponse({ ...PAYMENT, account_number: "" })).toBe(false);
  });
});
