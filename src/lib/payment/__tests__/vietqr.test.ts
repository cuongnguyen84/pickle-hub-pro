import { describe, it, expect } from "vitest";
import { generateVietQRUrl } from "../vietqr";

describe("generateVietQRUrl", () => {
  it("builds a basic URL with default compact2 template", () => {
    const url = generateVietQRUrl({
      bankCode: "VCB",
      accountNumber: "0123456789",
      accountName: "NGUYEN VAN A",
      amount: 50000,
      memo: "PHUB-A3F2K1",
    });
    expect(url).toContain("https://img.vietqr.io/image/VCB-0123456789-compact2.png");
    expect(url).toContain("amount=50000");
    expect(url).toContain("addInfo=PHUB-A3F2K1");
    expect(url).toContain("accountName=NGUYEN+VAN+A");
  });

  it("honours an explicit template choice", () => {
    const url = generateVietQRUrl({
      bankCode: "TCB",
      accountNumber: "98765",
      accountName: "TEST",
      amount: 100000,
      memo: "X",
      template: "qr_only",
    });
    expect(url).toContain("-qr_only.png?");
  });

  it("URL-encodes diacritics in account name + memo", () => {
    const url = generateVietQRUrl({
      bankCode: "VCB",
      accountNumber: "0",
      accountName: "Nguyễn Văn Á",
      amount: 1,
      memo: "Chuyển tiền PHUB-XX",
    });
    // URLSearchParams encodes space as '+'
    expect(url).toMatch(/accountName=Nguy%E1%BB%85n\+V%C4%83n\+%C3%81/);
    expect(url).toMatch(/addInfo=Chuy%E1%BB%83n\+ti%E1%BB%81n\+PHUB-XX/);
  });

  it("floors fractional amounts to integers", () => {
    const url = generateVietQRUrl({
      bankCode: "VCB",
      accountNumber: "0",
      accountName: "X",
      amount: 99.9,
      memo: "M",
    });
    expect(url).toContain("amount=99");
    expect(url).not.toContain("amount=99.9");
  });

  it("clamps NaN / negative amounts to 0", () => {
    const nanUrl = generateVietQRUrl({
      bankCode: "VCB", accountNumber: "0", accountName: "X",
      amount: Number.NaN, memo: "M",
    });
    const negUrl = generateVietQRUrl({
      bankCode: "VCB", accountNumber: "0", accountName: "X",
      amount: -500, memo: "M",
    });
    expect(nanUrl).toContain("amount=0");
    expect(negUrl).toContain("amount=0");
  });

  it("does not double-encode pre-encoded characters in the path", () => {
    const url = generateVietQRUrl({
      bankCode: "VCB",
      accountNumber: "0",
      accountName: "X",
      amount: 0,
      memo: "M",
    });
    // The bank code + account number should appear literally in the path,
    // not double-encoded. encodeURIComponent leaves alphanumerics alone.
    expect(url).toMatch(/\/VCB-0-compact2\.png/);
  });
});
