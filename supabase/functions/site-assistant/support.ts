// Phần thuần (không Deno) của luồng "Liên hệ admin" trong site-assistant:
// kiểm + cắt form, hạn mức, tin nhắn Telegram. Test: __tests__/support.test.ts.
import { isPageType } from "./shared.ts";

export const SUPPORT_MAX = { message: 1000, name: 80, phone: 20, email: 120, zalo: 60, route: 200, label: 200, turns: 6, turnText: 300 };
export const ADMIN_SUPPORT_URL = "https://www.thepicklehub.net/admin/support";

export interface SupportInput {
  message: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  zalo: string | null;
  page_type: string;
  route: string | null;
  page_label: string | null;
  lang: "vi" | "en";
  transcript: { role: "user" | "bot"; text: string }[];
  /** ô bẫy bot (ẩn với người thật) đã bị điền */
  honeypot: boolean;
}

// Bỏ ký tự điều khiển (giữ xuống dòng), gộp khoảng trắng thừa, cắt độ dài.
const clean = (v: unknown, max: number, multiline = false): string => {
  if (typeof v !== "string") return "";
  const s = multiline
    ? v.replace(/[^\P{Cc}\n]/gu, " ").replace(/\n{3,}/g, "\n\n")
    : v.replace(/\p{Cc}+/gu, " ").replace(/\s+/g, " ");
  return s.trim().slice(0, max).trim();
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** SĐT: chỉ giữ chữ số và dấu + đầu; 8–15 số. Không hợp lệ → null. */
export function normPhone(v: string): string | null {
  const s = v.replace(/[\s().-]/g, "");
  return /^\+?\d{8,15}$/.test(s) ? s : null;
}

export type SupportError = "message_required" | "invalid_email" | "invalid_phone" | "contact_required";

/** Khách (chưa đăng nhập) phải để lại ít nhất một cách liên hệ — không thì admin không trả lời được. */
export function needsContact(r: SupportInput, userId: string | null): boolean {
  return !userId && !r.phone && !r.email && !r.zalo;
}

/** Kiểm form từ client. Client không gửi user_id — server lấy từ JWT. */
export function readSupport(raw: unknown): { ok: true; value: SupportInput } | { ok: false; error: SupportError } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const message = clean(b.message, SUPPORT_MAX.message, true);
  if (message.length < 2) return { ok: false, error: "message_required" };
  const email = clean(b.email, SUPPORT_MAX.email);
  if (email && !EMAIL.test(email)) return { ok: false, error: "invalid_email" };
  const phoneRaw = clean(b.phone, 40);
  const phone = phoneRaw ? normPhone(phoneRaw) : null;
  if (phoneRaw && !phone) return { ok: false, error: "invalid_phone" };
  const transcript = (Array.isArray(b.transcript) ? b.transcript : []).slice(-SUPPORT_MAX.turns).flatMap((m) => {
    const r = (m ?? {}) as Record<string, unknown>;
    const text = clean(r.text, SUPPORT_MAX.turnText, true);
    return (r.role === "user" || r.role === "bot") && text ? [{ role: r.role, text }] : [];
  });
  return {
    ok: true,
    value: {
      message,
      name: clean(b.name, SUPPORT_MAX.name) || null,
      phone,
      email: email || null,
      zalo: clean(b.zalo, SUPPORT_MAX.zalo) || null,
      page_type: isPageType(b.page_type) ? b.page_type : "general",
      route: clean(b.route, SUPPORT_MAX.route) || null,
      page_label: clean(b.page_label, SUPPORT_MAX.label) || null,
      lang: b.lang === "en" ? "en" : "vi",
      transcript,
      honeypot: typeof b.website === "string" && b.website.trim() !== "",
    },
  };
}

export interface SupportLimits { hourly: number; daily: number }

/** Hạn mức gửi yêu cầu (env, kẹp biên — env sai không mở toang). Mặc định 3/giờ, 10/ngày. */
export function supportLimitsFrom(get: (k: string) => string | undefined): SupportLimits {
  const n = (k: string, def: number, max: number) => {
    const v = Number(get(k));
    return Number.isInteger(v) && v >= 0 ? Math.min(v, max) : def;
  };
  return { hourly: n("SUPPORT_REQUEST_HOURLY", 3, 20), daily: n("SUPPORT_REQUEST_DAILY", 10, 50) };
}

/** RPC consume_support_request_quota → quyết định; lỗi/thiếu RPC = chặn (không ghi, không bắn Telegram). */
export function supportQuotaOutcome(rpc: { data: unknown; error: unknown }): "ok" | "rate_limited" | "error" {
  if (rpc.error) return "error";
  return rpc.data === "ok" || rpc.data === "rate_limited" ? rpc.data : "error";
}

/** Câu xác nhận / báo lỗi cho người gửi (server trả để web + iOS dùng chung). */
export function supportReply(lang: "vi" | "en", outcome: "sent" | "rate_limited" | "error" | SupportError): string {
  const vi = lang === "vi";
  switch (outcome) {
    case "sent": return vi
      ? "Đã gửi cho admin ThePickleHub. Bọn mình sẽ liên hệ lại sớm qua thông tin bạn để lại."
      : "Sent to the ThePickleHub admin. We'll get back to you soon using the contact details you left.";
    case "rate_limited": return vi
      ? "Bạn vừa gửi khá nhiều yêu cầu. Admin đã nhận các yêu cầu trước — thử lại sau ít phút nhé."
      : "You've sent several requests already. The admin has your earlier ones — please try again later.";
    case "message_required": return vi ? "Bạn nhập nội dung cần hỗ trợ nhé." : "Please describe what you need help with.";
    case "invalid_email": return vi ? "Email chưa đúng định dạng." : "That email doesn't look right.";
    case "invalid_phone": return vi ? "Số điện thoại chưa đúng (8–15 chữ số)." : "That phone number doesn't look right (8–15 digits).";
    case "contact_required": return vi ? "Bạn để lại SĐT, email hoặc Zalo để admin liên hệ lại nhé." : "Please leave a phone number, email or Zalo so the admin can reach you.";
    default: return vi ? "Chưa gửi được, bạn thử lại sau nhé." : "Couldn't send it. Please try again later.";
  }
}

const one = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Tin Telegram cho chủ site — văn bản thuần (không parse_mode) nên không cần
 * escape; mọi trường đã qua clean() ở readSupport. Không chứa khoá/secret nào.
 */
export function telegramText(r: SupportInput, id: string, userId: string | null): string {
  const contact = [
    r.phone && `SĐT ${r.phone}`, r.zalo && `Zalo ${r.zalo}`, r.email && `Email ${r.email}`,
  ].filter(Boolean).join(" · ") || "(không để lại liên hệ)";
  const lines = [
    `🆘 Yêu cầu hỗ trợ mới #${id.slice(0, 8)}`,
    `Người gửi: ${r.name ?? "(không tên)"} · ${userId ? "đã đăng nhập" : "khách"} · ${r.lang.toUpperCase()}`,
    `Liên hệ: ${contact}`,
    `Trang: ${r.page_type}${r.route ? ` ${r.route}` : ""}${r.page_label ? ` — ${one(r.page_label, 80)}` : ""}`,
    "",
    one(r.message, 800),
    "",
    `Xử lý: ${ADMIN_SUPPORT_URL}`,
  ];
  return lines.join("\n").slice(0, 3500);
}
