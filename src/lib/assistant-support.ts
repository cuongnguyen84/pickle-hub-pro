/**
 * Form "Liên hệ admin" trong khung trợ lý (thay 2 nút Messenger/Zalo, 12/11/2026).
 * Chỉ dựng payload — server (site-assistant, nhánh `support`) kiểm lại mọi
 * trường và tự gắn user_id từ JWT; client không bao giờ gửi user_id.
 */
export interface SupportFields { message: string; name: string; phone: string; email: string; zalo: string; website: string }
export interface SupportTurn { role: "user" | "bot"; text: string }

/** Nội dung gợi sẵn: các câu người dùng vừa gõ (tối đa 3, mới nhất cuối), để họ sửa. */
export function prefillMessage(turns: SupportTurn[]): string {
  return turns.filter((t) => t.role === "user").slice(-3).map((t) => t.text.trim()).filter(Boolean).join("\n").slice(0, 1000);
}

/** Kiểm nhẹ phía client (server kiểm lại): trả mã lỗi đầu tiên hoặc null. Khách phải để lại ≥1 cách liên hệ. */
export function supportClientError(
  f: SupportFields, loggedIn: boolean,
): "message_required" | "invalid_email" | "invalid_phone" | "contact_required" | null {
  if (f.message.trim().length < 2) return "message_required";
  if (!loggedIn && !f.phone.trim() && !f.email.trim() && !f.zalo.trim()) return "contact_required";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return "invalid_email";
  if (f.phone.trim() && !/^\+?\d{8,15}$/.test(f.phone.replace(/[\s().-]/g, ""))) return "invalid_phone";
  return null;
}

export function supportPayload(
  f: SupportFields,
  page: { page_type: string; route: string; page_label: string; lang: "vi" | "en" },
  turns: SupportTurn[],
) {
  return {
    support: {
      message: f.message.trim().slice(0, 1000),
      name: f.name.trim().slice(0, 80),
      phone: f.phone.trim().slice(0, 40),
      email: f.email.trim().slice(0, 120),
      zalo: f.zalo.trim().slice(0, 60),
      website: f.website,
      page_type: page.page_type,
      route: page.route.slice(0, 200),
      page_label: page.page_label.slice(0, 200),
      lang: page.lang,
      transcript: turns.filter((t) => t.text).slice(-6).map((t) => ({ role: t.role, text: t.text.slice(0, 300) })),
    },
  };
}
