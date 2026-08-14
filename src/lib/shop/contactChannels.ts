// ============================================================================
// Contact channels — client-side mirror of the server rules (D2).
// ----------------------------------------------------------------------------
// Postgres owns these rules: shop_contact_normalize() is what actually decides
// what gets stored, and shop_contact_upsert() calls it. This file exists only
// so the seller finds out while typing instead of after a round trip.
//
// It is a MIRROR, never an authority. If the two ever disagree the server
// wins, and the form shows the server's message — which is why every rule here
// is deliberately no stricter than the SQL. Being stricter on the client would
// block a value the database would have accepted, which is the worse failure:
// the seller has no way to find out they were wrong.
// ============================================================================

import type { ShopContactType } from "@/integrations/supabase/shop-schema";

/** Schemes that must never reach an href, whatever the seller pasted. */
const DANGEROUS_SCHEME = /^\s*(javascript|data|vbscript|file|about|blob)\s*:/i;

/**
 * The Vietnamese numbering plan, national significant number (what follows +84
 * with no trunk 0). Mirrors vn_phone_is_nsn() in migration 20260811190000.
 *
 *   mobile    [35789] + 8 digits   =  9 digits
 *   landline  2       + 9 digits   = 10 digits — every area code starts with 2,
 *                                    two-digit (24 Hà Nội) or three (225 Hải Phòng)
 */
const VN_MOBILE_NSN = /^[35789]\d{8}$/;
const VN_LANDLINE_NSN = /^2\d{9}$/;

/** 1900/1800 service lines: named rather than left to fail on digit count. */
const VN_SERVICE_LINE = /^0?1[89]00/;

export interface ChannelValidation {
  ok: boolean;
  /** The value the server is expected to store. Preview only — never sent. */
  normalized?: string;
  /** Vietnamese, and actionable: what to do, not what went wrong. */
  error?: string;
}

const invalid = (error: string): ChannelValidation => ({ ok: false, error });

const isNsn = (nsn: string, mobileOnly: boolean) =>
  VN_MOBILE_NSN.test(nsn) || (!mobileOnly && VN_LANDLINE_NSN.test(nsn));

/**
 * A business phone is a mobile OR a landline (D2). Zalo is mobile-only, because
 * a landline cannot hold a Zalo account — so the two callers pass different
 * `mobileOnly` and get different messages, rather than the phone field
 * inheriting Zalo's rule and telling a shop its own shop line is invalid.
 */
function normalizePhone(raw: string, mobileOnly: boolean): ChannelValidation {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (VN_SERVICE_LINE.test(digits)) {
    return invalid("Đầu số 1900/1800 chưa hỗ trợ — dùng số di động hoặc số bàn của shop");
  }

  // Country code, then trunk 0, then the bare national number — accepting only
  // a reading that is valid. 0847123456 is a real mobile whose national form
  // starts with the digits 84, so order alone would misread it.
  const readings = [
    digits.startsWith("84") ? digits.slice(2) : null,
    digits.startsWith("0") ? digits.slice(1) : null,
    digits,
  ];
  const nsn = readings.find((r): r is string => r !== null && isNsn(r, false));

  if (!nsn) {
    return invalid(
      mobileOnly
        ? "Số Zalo không hợp lệ — Zalo dùng số di động, ví dụ 0901234567"
        : "Số điện thoại không hợp lệ — nhập số di động (0901234567) hoặc số bàn (02838221234)",
    );
  }
  if (mobileOnly && !VN_MOBILE_NSN.test(nsn)) {
    return invalid(
      "Số Zalo không hợp lệ — số bàn không đăng ký được Zalo, nhập số di động hoặc liên kết zalo.me/…",
    );
  }
  return { ok: true, normalized: `+84${nsn}` };
}

function handleFrom(raw: string, hosts: RegExp): string {
  const withoutHost = raw.replace(hosts, "");
  return withoutHost.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
}

export function validateChannel(type: ShopContactType, rawInput: string): ChannelValidation {
  const raw = rawInput.trim();
  if (!raw) return invalid("Chưa nhập thông tin liên hệ");
  if (DANGEROUS_SCHEME.test(raw)) return invalid("Liên kết không hợp lệ");

  if (type === "phone") return normalizePhone(raw, false);

  if (type === "zalo") {
    if (/^(https?:\/\/)?(www\.)?zalo\.me\//i.test(raw)) {
      const handle = handleFrom(raw, /^.*zalo\.me\//i);
      if (!/^[A-Za-z0-9._-]{3,60}$/.test(handle)) return invalid("Liên kết Zalo không hợp lệ");
      return { ok: true, normalized: `https://zalo.me/${handle}` };
    }
    // Zalo is reachable by the mobile number the account is registered to —
    // the commonest case for a pilot seller who has never made a zalo.me link.
    // The message stays Zalo's own; borrowing the phone one is what made a
    // landline look like a typo.
    const phone = normalizePhone(raw, true);
    if (!phone.ok) return invalid(phone.error!);
    return { ok: true, normalized: `https://zalo.me/${phone.normalized!.replace(/^\+/, "")}` };
  }

  const handle = /^(https?:\/\/)?(www\.)?(m\.me|messenger\.com|facebook\.com)\//i.test(raw)
    ? handleFrom(raw, /^.*(m\.me|messenger\.com|facebook\.com)\//i)
    : raw;
  if (!/^[A-Za-z0-9.]{5,60}$/.test(handle)) {
    return invalid("Tên Messenger không hợp lệ — dùng m.me/tênshop");
  }
  return { ok: true, normalized: `https://m.me/${handle}` };
}

export const CHANNEL_LABEL: Record<ShopContactType, string> = {
  zalo: "Zalo",
  messenger: "Messenger",
  phone: "Số điện thoại",
};

export const CHANNEL_PLACEHOLDER: Record<ShopContactType, string> = {
  zalo: "0901234567 hoặc zalo.me/tênshop",
  messenger: "m.me/tênshop",
  // Says out loud that the shop's landline is welcome. The old placeholder
  // showed only a mobile, so a shop with a fixed line assumed it was not
  // accepted — and until this change it was not.
  phone: "0901234567 hoặc 02838221234",
};

/**
 * What the seller sees under a channel row. Deliberately says what is TRUE
 * right now rather than what the seller asked for — "đã bật công khai" on a
 * channel nobody approved yet is a promise the product cannot keep.
 */
export function publicityLabel(row: {
  is_public: boolean;
  state: string;
}): { text: string; tone: "ok" | "warn" | "muted" } {
  if (!row.is_public) return { text: "Chỉ mình bạn thấy", tone: "muted" };
  switch (row.state) {
    case "approved":
      return { text: "Đang hiển thị công khai", tone: "ok" };
    case "pending_review":
      return { text: "Chờ duyệt — chưa hiển thị", tone: "warn" };
    case "rejected":
      return { text: "Bị từ chối — chưa hiển thị", tone: "warn" };
    case "disabled":
      return { text: "Đã bị tắt — chưa hiển thị", tone: "warn" };
    default:
      return { text: "Chưa gửi duyệt — chưa hiển thị", tone: "muted" };
  }
}
