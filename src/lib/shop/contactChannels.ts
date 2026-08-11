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

const VN_MOBILE = /^(?:\+?84|0)([35789]\d{8})$/;

export interface ChannelValidation {
  ok: boolean;
  /** The value the server is expected to store. Preview only — never sent. */
  normalized?: string;
  /** Vietnamese, and actionable: what to do, not what went wrong. */
  error?: string;
}

const invalid = (error: string): ChannelValidation => ({ ok: false, error });

function normalizePhone(raw: string): ChannelValidation {
  const digits = raw.replace(/[^0-9+]/g, "");
  const m = VN_MOBILE.exec(digits);
  if (!m) return invalid("Số điện thoại không hợp lệ — nhập dạng 09xxxxxxxx");
  return { ok: true, normalized: `+84${m[1]}` };
}

function handleFrom(raw: string, hosts: RegExp): string {
  const withoutHost = raw.replace(hosts, "");
  return withoutHost.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
}

export function validateChannel(type: ShopContactType, rawInput: string): ChannelValidation {
  const raw = rawInput.trim();
  if (!raw) return invalid("Chưa nhập thông tin liên hệ");
  if (DANGEROUS_SCHEME.test(raw)) return invalid("Liên kết không hợp lệ");

  if (type === "phone") return normalizePhone(raw);

  if (type === "zalo") {
    if (/^(https?:\/\/)?(www\.)?zalo\.me\//i.test(raw)) {
      const handle = handleFrom(raw, /^.*zalo\.me\//i);
      if (!/^[A-Za-z0-9._-]{3,60}$/.test(handle)) return invalid("Liên kết Zalo không hợp lệ");
      return { ok: true, normalized: `https://zalo.me/${handle}` };
    }
    // Zalo is reachable by phone number too — the commonest case for a pilot
    // seller who has never made a zalo.me link.
    const phone = normalizePhone(raw);
    if (!phone.ok) return invalid("Nhập số Zalo (09xxxxxxxx) hoặc liên kết zalo.me/…");
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
  phone: "0901234567",
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
