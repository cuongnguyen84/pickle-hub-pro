// ============================================================================
// payment / vietqr — render-only VietQR.io URL helper
// ----------------------------------------------------------------------------
// VietQR exposes a public image endpoint that renders a dynamic Vietnam
// Napas/Quick QR (the one banking apps scan to prefill an in-app
// transfer). We use it directly from an <img src> on the client — no
// server-side rendering, no API key required.
//
// URL shape:
//   https://img.vietqr.io/image/{BANK}-{ACCOUNT}-{template}.png
//     ?amount={amount}&addInfo={memo}&accountName={name}
//
// `template`:
//   - "compact2"  → vertical with the amount printed (preferred for the
//                   in-app step — players see the amount on the screen)
//   - "qr_only"   → just the matrix
//
// Pure helper. No fetch. Caller wraps the URL in an <img> tag.
// ============================================================================

export interface VietQROptions {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  memo: string;
  template?: "compact2" | "compact" | "qr_only" | "print";
}

const VIETQR_BASE = "https://img.vietqr.io/image";

/**
 * Build the image URL VietQR.io will serve a PNG from. Caller validates
 * inputs upstream (the helper assumes bankCode + accountNumber are valid;
 * non-finite or negative amounts are clamped to 0).
 *
 * The path components themselves are NOT URL-encoded because they're
 * constrained alphanumeric. Query-string values (accountName, memo) ARE
 * encoded via encodeURIComponent — VN names contain diacritics, memos
 * can contain ASCII punctuation.
 */
export function generateVietQRUrl(opts: VietQROptions): string {
  const template = opts.template ?? "compact2";
  const amount = Number.isFinite(opts.amount) && opts.amount >= 0
    ? Math.floor(opts.amount)
    : 0;
  const params = new URLSearchParams();
  params.set("amount", String(amount));
  params.set("addInfo", opts.memo);
  params.set("accountName", opts.accountName);
  return (
    `${VIETQR_BASE}/${encodeURIComponent(opts.bankCode)}-` +
    `${encodeURIComponent(opts.accountNumber)}-${template}.png?` +
    params.toString()
  );
}
