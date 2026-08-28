/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { postToSePay, type SePayCheckoutResponse } from "../sepay";

const CHECKOUT: SePayCheckoutResponse = {
  checkout_url: "https://pay-sandbox.sepay.vn/v1/checkout/init",
  invoice_number: "PH-2608-A1B2",
  environment: "sandbox",
  fields: {
    operation: "PURCHASE",
    order_invoice_number: "PH-2608-A1B2",
    order_amount: "125000",
    signature: "signed",
  },
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("postToSePay", () => {
  it("builds one POST form with the server-signed controls", () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
    postToSePay(CHECKOUT);
    const form = document.querySelector("form") as HTMLFormElement;
    expect(form.method).toBe("post");
    expect(new URL(form.action).hostname).toBe("pay-sandbox.sepay.vn");
    expect((form.elements.namedItem("order_amount") as HTMLInputElement).value).toBe("125000");
    expect(submit).toHaveBeenCalledOnce();
  });

  it("refuses an unexpected host, path or injected field", () => {
    expect(() => postToSePay({ ...CHECKOUT, checkout_url: "https://evil.example/v1/checkout/init" }))
      .toThrow(/địa chỉ thanh toán/);
    expect(() => postToSePay({ ...CHECKOUT, checkout_url: "https://pay.sepay.vn/not-checkout" }))
      .toThrow(/địa chỉ thanh toán/);
    expect(() => postToSePay({ ...CHECKOUT, fields: { ...CHECKOUT.fields, secret_key: "leak" } }))
      .toThrow(/biểu mẫu thanh toán/);
    expect(document.querySelector("form")).toBeNull();
  });
});
