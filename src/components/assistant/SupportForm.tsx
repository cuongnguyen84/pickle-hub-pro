/**
 * Form "Liên hệ admin" nằm trong khung trợ lý (cả chế độ site lẫn giải).
 * Gửi tới site-assistant { support }: server kiểm lại, gắn user_id từ JWT,
 * lưu support_requests và báo Telegram cho admin. Ô `website` là bẫy bot —
 * ẩn khỏi người dùng và trình đọc màn hình.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { supportClientError, supportPayload, type SupportFields, type SupportTurn } from "@/lib/assistant-support";

type Lang = "vi" | "en";

const COPY = {
  vi: {
    title: "Gửi cho admin ThePickleHub",
    hint: "Admin là người thật, sẽ liên hệ lại qua thông tin bạn để lại.",
    message: "Bạn cần hỗ trợ gì?", name: "Tên (không bắt buộc)", phone: "Số điện thoại", email: "Email", zalo: "Zalo",
    contactHint: "Để lại ít nhất một cách liên hệ để admin trả lời bạn.",
    contactHintUser: "Admin thấy tài khoản của bạn; thêm SĐT/Zalo nếu muốn được gọi lại nhanh hơn.",
    send: "Gửi cho admin", cancel: "Thôi",
    errors: {
      message_required: "Bạn nhập nội dung cần hỗ trợ nhé.",
      invalid_email: "Email chưa đúng định dạng.",
      invalid_phone: "Số điện thoại chưa đúng (8–15 chữ số).",
      contact_required: "Bạn để lại SĐT, email hoặc Zalo để admin liên hệ lại nhé.",
      network: "Chưa gửi được, bạn thử lại sau nhé.",
    },
  },
  en: {
    title: "Send to the ThePickleHub admin",
    hint: "A real person will get back to you using the details you leave.",
    message: "What do you need help with?", name: "Name (optional)", phone: "Phone", email: "Email", zalo: "Zalo",
    contactHint: "Leave at least one way to reach you so the admin can reply.",
    contactHintUser: "The admin can see your account; add a phone/Zalo for a faster reply.",
    send: "Send to admin", cancel: "Not now",
    errors: {
      message_required: "Please describe what you need help with.",
      invalid_email: "That email doesn't look right.",
      invalid_phone: "That phone number doesn't look right (8–15 digits).",
      contact_required: "Please leave a phone number, email or Zalo so the admin can reach you.",
      network: "Couldn't send it. Please try again later.",
    },
  },
};

interface Props {
  lang: Lang;
  pageType: string;
  pageLabel: string;
  turns: SupportTurn[];
  initialMessage: string;
  initialEmail?: string;
  loggedIn: boolean;
  onSent: (reply: string) => void;
  onCancel: () => void;
}

const SupportForm = ({ lang, pageType, pageLabel, turns, initialMessage, initialEmail = "", loggedIn, onSent, onCancel }: Props) => {
  const c = COPY[lang];
  const [f, setF] = useState<SupportFields>({ message: initialMessage, name: "", phone: "", email: initialEmail, zalo: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof SupportFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = supportClientError(f, loggedIn);
    if (bad) { setErr(c.errors[bad]); return; }
    setBusy(true);
    setErr("");
    type Res = { ok?: boolean; reply?: string } | null;
    let res = null as Res;
    try {
      const r = await supabase.functions.invoke("site-assistant", {
        body: supportPayload(f, { page_type: pageType, route: window.location.pathname, page_label: pageLabel, lang }, turns),
        timeout: 20_000,
      });
      res = r.error ? null : (r.data as Res);
    } catch { /* báo lỗi bên dưới */ }
    setBusy(false);
    if (res?.ok && res.reply) onSent(res.reply);
    else setErr(res?.reply || c.errors.network);
  };

  const field = (k: "name" | "phone" | "email" | "zalo", type: string, autoComplete: string, max: number) => (
    <input
      type={type}
      value={f[k]}
      onChange={set(k)}
      placeholder={c[k]}
      aria-label={c[k]}
      autoComplete={autoComplete}
      maxLength={max}
      className="tl-asst-input"
    />
  );

  return (
    <form className="tl-asst-card" onSubmit={submit} aria-label={c.title} noValidate>
      <div className="tl-asst-line">{c.title}</div>
      <div className="tl-asst-result">{c.hint}</div>
      <textarea value={f.message} onChange={set("message")} placeholder={c.message} aria-label={c.message} maxLength={1000} rows={3} required className="tl-asst-input" />
      {field("name", "text", "name", 80)}
      <div className="tl-asst-result">{loggedIn ? c.contactHintUser : c.contactHint}</div>
      {field("phone", "tel", "tel", 20)}
      {field("email", "email", "email", 120)}
      {field("zalo", "text", "off", 60)}
      {/* bẫy bot: người thật không thấy, không tab tới */}
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      {err && <div className="tl-asst-warn" role="alert">{err}</div>}
      <div className="tl-asst-actions">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}{c.send}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>{c.cancel}</Button>
      </div>
    </form>
  );
};

export default SupportForm;
