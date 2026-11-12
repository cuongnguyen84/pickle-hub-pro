/**
 * Khung chat trợ lý AI nổi — nút mở nằm ở AssistantGate (tải sau idle), file
 * này chỉ tải khi người dùng bấm. Hai chế độ:
 *
 * - "tournament" (brief docs/floating-ai-chat-brief-2026-10-27.md): trang giải,
 *   edge fn tournament-assistant, cần đăng nhập, có thẻ hành động như dưới.
 * - "site" (12/11/2026): mọi trang khác, edge fn site-assistant, khách dùng
 *   được; chỉ hỏi–đáp + tối đa 3 link nội bộ (lọc lại bằng safeLink).
 *
 * - Một thread duy nhất, liền mạch khi chuyển trang; thread id + tin nhắn lưu
 *   localStorage theo user nên đóng/mở hay reload vẫn còn.
 * - Mỗi tin nhắn mang nhãn ngữ cảnh lúc gửi ("Đang xem: Giải X — Bảng B").
 * - Hành động: server (edge fn tournament-assistant) trả thẻ xác nhận đã kiểm
 *   quyền + trạng thái; chỉ khi bấm Xác nhận mới ghi, qua đúng hàm UI cũ
 *   (tournament-assistant-exec). Sửa thông tin có nút Hoàn tác trong phiên.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Send, Sparkles, Undo2, X, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useQuickTable } from "@/hooks/useQuickTable";
import { supabase } from "@/integrations/supabase/client";
import { localePath } from "@/lib/locale-path";
import { isIOS } from "@/lib/platform";
import {
  ASSISTANT_APPLIED_EVENT, suggestionsFor, useCurrentAssistantContext,
  type AssistantContext, type AssistantScreen, type SitePage, type Suggestion,
} from "@/lib/assistant-context";
import { safeLink } from "../../../supabase/functions/site-assistant/shared";
import { executeCard, type ExecResult } from "@/lib/tournament-assistant-exec";

type Lang = "vi" | "en";
interface Alternative { label: string; prompt: string; fill?: boolean; href?: string }
interface Card {
  type: string;
  args: Record<string, unknown>;
  lines: string[];
  warnings: string[];
  danger: boolean;
  undo?: { type: string; args: Record<string, unknown> } | null;
  blocked?: { reason: string; alternatives: Alternative[] };
}
type CardState = "pending" | "running" | "applied" | "partial" | "failed" | "cancelled" | "undone";
interface Msg {
  id: string;
  role: "user" | "bot";
  text: string;
  /** nhãn ngữ cảnh màn hình lúc gửi */
  ctx?: string;
  card?: Card;
  cardState?: CardState;
  shareId?: string;
  result?: string;
  /** ngôn ngữ server trả lời lượt này — câu chốt sau áp dụng theo nó, không theo giao diện */
  lang?: Lang;
  /** chế độ site: link nội bộ server gợi ý */
  links?: { href: string; label: string }[];
}

const STORAGE_PREFIX = { tournament: "tl-assistant:v1:", site: "tl-site-assistant:v1:" };
const uid = () => Math.random().toString(36).slice(2, 10);

const COPY = {
  vi: {
    close: "Đóng trợ lý", title: "Trợ lý giải đấu",
    hello: "Chào bạn 👋 Mình hiểu trang giải bạn đang xem. Hỏi về bảng, lịch, kết quả — hoặc bảo mình sửa giải (chủ giải mới sửa được, luôn hỏi lại trước khi ghi).",
    login: "Đăng nhập để dùng trợ lý giải đấu.", loginBtn: "Đăng nhập",
    placeholder: "Hỏi hoặc bảo mình sửa giải…", send: "Gửi",
    viewing: (l: string) => `Đang xem: ${l}`,
    confirm: "Xác nhận", confirmDanger: "Vẫn làm", cancel: "Hủy", undo: "Hoàn tác",
    running: "Đang ghi…",
    applied: "Đã áp dụng.", cancelled: "Đã hủy — không có gì thay đổi.", undone: "Đã hoàn tác.",
    partial: (done: string[], failed: string) => `Mới xong một phần: ${done.join(", ")}. Chưa xong: ${failed}. Kiểm tra lại trang giải trước khi thử lại.`,
    failed: (failed: string) => `Chưa thay đổi gì — lỗi ở bước: ${failed}.`,
    error: "Mạng hoặc trợ lý đang chậm. Thử lại nhé.",
    clear: "Cuộc trò chuyện mới",
    siteTitle: "Trợ lý ThePickleHub",
    siteHello: "Chào bạn 👋 Mình là trợ lý của ThePickleHub. Hỏi mình về trang bạn đang xem, cách dùng tính năng (tạo giải, tìm sân, xem live, xếp hạng…) — mình sẽ chỉ đường cho bạn.",
    sitePlaceholder: "Hỏi mình bất cứ điều gì về ThePickleHub…",
    pages: {
      home: "Trang chủ", tournament: "Giải đấu", tools: "Công cụ giải", live_video: "Live & video", blog_news: "Bài viết",
      venues: "Sân pickleball", players: "Người chơi & xếp hạng", shop: "Chợ", community: "Cộng đồng", account: "Tài khoản", general: "ThePickleHub",
    } as Record<SitePage, string>,
    screens: {
      tournament_hub: "Danh sách giải", tournament_detail: "Trang giải", quick_table_hub: "Giải chia bảng của tôi",
      quick_table_detail: "Trang giải", quick_table_groups: "Bảng đấu", quick_table_results: "Kết quả",
      quick_table_registration: "Đăng ký giải", quick_table_setup: "Nhập danh sách", quick_table_parent: "Giải tổng",
    } as Record<AssistantScreen, string>,
  },
  en: {
    close: "Close assistant", title: "Tournament assistant",
    hello: "Hi 👋 I know which tournament page you're on. Ask about groups, schedule, results — or ask me to change the tournament (organizers only; I always confirm before saving).",
    login: "Sign in to use the tournament assistant.", loginBtn: "Sign in",
    placeholder: "Ask, or tell me what to change…", send: "Send",
    viewing: (l: string) => `Viewing: ${l}`,
    confirm: "Confirm", confirmDanger: "Do it anyway", cancel: "Cancel", undo: "Undo",
    running: "Saving…",
    applied: "Applied.", cancelled: "Cancelled — nothing changed.", undone: "Undone.",
    partial: (done: string[], failed: string) => `Only partly done: ${done.join(", ")}. Not done: ${failed}. Check the tournament page before retrying.`,
    failed: (failed: string) => `Nothing changed — failed at: ${failed}.`,
    error: "The network or assistant is slow. Please try again.",
    clear: "New conversation",
    siteTitle: "ThePickleHub assistant",
    siteHello: "Hi 👋 I'm the ThePickleHub assistant. Ask about the page you're on or how to use a feature (create a tournament, find courts, watch live, rankings…) and I'll point you there.",
    sitePlaceholder: "Ask me anything about ThePickleHub…",
    pages: {
      home: "Home", tournament: "Tournaments", tools: "Tournament tools", live_video: "Live & video", blog_news: "Articles",
      venues: "Courts", players: "Players & rankings", shop: "Shop", community: "Community", account: "Account", general: "ThePickleHub",
    } as Record<SitePage, string>,
    screens: {
      tournament_hub: "Tournaments", tournament_detail: "Tournament page", quick_table_hub: "My round robins",
      quick_table_detail: "Tournament page", quick_table_groups: "Groups", quick_table_results: "Results",
      quick_table_registration: "Registration", quick_table_setup: "List entry", quick_table_parent: "Parent tournament",
    } as Record<AssistantScreen, string>,
  },
};

function contextLabel(ctx: AssistantContext | null, screen: AssistantScreen | null, page: SitePage, lang: Lang): string {
  const s = ctx?.screen ?? screen;
  return ctx?.label || (s ? COPY[lang].screens[s] : COPY[lang].pages[page]);
}

/** Chip gợi ý của chế độ site theo loại trang. */
function siteSuggestions(page: SitePage): Suggestion[] {
  const explain = { vi: "Trang này có gì?", en: "What's on this page?" };
  const create = { vi: "Tạo giải bằng chat", en: "Create a tournament by chat", href: "/tools/quick-tables/chat" };
  switch (page) {
    case "venues": return [explain, { vi: "Tìm sân gần mình thế nào?", en: "How do I find courts near me?" }];
    case "players": return [explain, { vi: "Kết nối DUPR thế nào?", en: "How do I link DUPR?" }];
    case "live_video": return [{ vi: "Xem lại trận đấu ở đâu?", en: "Where can I watch replays?" }];
    case "blog_news": return [{ vi: "Tóm tắt bài này", en: "Summarize this article" }];
    case "shop": return [{ vi: "Mở gian hàng thế nào?", en: "How do I start selling?" }];
    case "tools": return [create, { vi: "Nên chọn thể thức nào?", en: "Which format should I use?" }];
    default: return [{ vi: "ThePickleHub có những gì?", en: "What can I do on ThePickleHub?" }, create];
  }
}

interface Props {
  mode: "tournament" | "site";
  routeScreen: AssistantScreen | null;
  page: SitePage;
  open: boolean;
  onClose: () => void;
}

const AssistantPanel = ({ mode, routeScreen, page, open, onClose }: Props) => {
  const site = mode === "site";
  const { user } = useAuth();
  const { language } = useI18n();
  const lang: Lang = language === "en" ? "en" : "vi";
  const c = COPY[lang];
  const navigate = useNavigate();
  const ctx = useCurrentAssistantContext();
  const screen = ctx?.screen ?? routeScreen;
  const deps = useQuickTable();
  const storageKey = STORAGE_PREFIX[mode] + (user?.id ?? "anon");

  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Hoàn tác chỉ trong phiên: id thẻ đã áp dụng ở phiên này.
  const undoable = useRef(new Set<string>());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? (JSON.parse(raw) as { thread_id: string; messages: Msg[] }) : null;
      setThreadId(saved?.thread_id || uid() + uid());
      // Thẻ đang chờ khi reload thì coi như huỷ — không ghi âm thầm sau reload.
      setMessages((saved?.messages ?? []).map((m) => (m.cardState === "pending" || m.cardState === "running" ? { ...m, cardState: "cancelled" } : m)));
    } catch {
      setThreadId(uid() + uid());
    }
  }, [storageKey]);

  useEffect(() => {
    if (!threadId) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ thread_id: threadId, messages: messages.slice(-60) })); } catch { /* private mode */ }
  }, [threadId, messages, storageKey]);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: "end" }); }, [open, messages, busy]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const patch = (id: string, p: Partial<Msg>) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const label = contextLabel(ctx, routeScreen, page, lang);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy || (!user && !site)) return;
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", text: t, ctx: label };
    const history = [...messages, userMsg].filter((m) => m.text).slice(-10).map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
    setMessages((ms) => [...ms, userMsg]);
    setBusy(true);
    let data: unknown = null;
    try {
      const res = await supabase.functions.invoke(site ? "site-assistant" : "tournament-assistant", {
        body: {
          assistant: site
            ? {
              thread_id: threadId, lang, page, route: window.location.pathname, label,
              summary: ctx?.summary?.slice(0, 600), messages: history.slice(-6).map((m) => ({ ...m, text: m.text.slice(0, 500) })),
            }
            : {
              thread_id: threadId,
              lang,
              messages: history,
              context: { ...ctx, screen, route: window.location.pathname, label },
            },
        },
        timeout: 30_000,
      });
      data = res.error ? null : res.data;
    } catch { /* hiện lỗi bên dưới */ }
    setBusy(false);
    const res = data as { reply?: string; card?: Card | null; lang?: Lang; links?: { href?: unknown; label?: unknown }[] } | null;
    if (!res?.reply) {
      setMessages((ms) => [...ms, { id: uid(), role: "bot", text: (/[à-ỹđ]/i.test(t) ? COPY.vi : c).error, ctx: label }]);
      return;
    }
    const card = site ? undefined : res.card ?? undefined;
    // Lọc lại phía client: chỉ link nội bộ trong allowlist, nhãn là chữ thuần.
    const links = site && Array.isArray(res.links)
      ? res.links.flatMap((l) => {
        const href = safeLink(l?.href);
        return href && typeof l.label === "string" && l.label.trim() ? [{ href, label: l.label.trim().slice(0, 40) }] : [];
      }).slice(0, 3)
      : undefined;
    const shareId = ctx?.tournament?.kind === "quick_table" ? ctx.tournament.share_id : undefined;
    setMessages((ms) => [...ms, {
      id: uid(), role: "bot", text: res.reply!, ctx: label, card, shareId, lang: res.lang === "en" || res.lang === "vi" ? res.lang : lang,
      cardState: card && !card.blocked ? "pending" : undefined, links,
    }]);
  };

  const log = (m: Msg, card: { type: string; args: Record<string, unknown>; lines?: string[]; undo?: unknown }, outcome: string, detail = "") => {
    void supabase.functions.invoke("tournament-assistant", {
      body: { assistant_log: { thread_id: threadId, lang, context_label: m.ctx, share_id: m.shareId, outcome, detail, action: card } },
    }).catch(() => undefined);
  };

  const report = (r: ExecResult, k = c): string =>
    r.outcome === "applied" ? k.applied : r.outcome === "partial" ? k.partial(r.done, r.failed ?? "") : k.failed(r.failed ?? "");

  const confirmCard = async (m: Msg) => {
    if (!m.card || !m.shareId || m.cardState !== "pending") return;
    patch(m.id, { cardState: "running" });
    const ml = m.lang ?? lang;
    const r = await executeCard(m.shareId, m.card, deps, ml);
    patch(m.id, { cardState: r.outcome, result: report(r, COPY[ml]) });
    if (r.outcome === "applied" && m.card.undo) undoable.current.add(m.id);
    if (r.done.length) window.dispatchEvent(new CustomEvent(ASSISTANT_APPLIED_EVENT, { detail: { shareId: m.shareId } }));
    log(m, m.card, r.outcome, r.failed ?? "");
  };

  const undoCard = async (m: Msg) => {
    if (!m.card?.undo || !m.shareId || !undoable.current.has(m.id)) return;
    undoable.current.delete(m.id);
    patch(m.id, { cardState: "running" });
    const ml = m.lang ?? lang;
    const r = await executeCard(m.shareId, { ...m.card.undo, danger: false }, deps, ml);
    patch(m.id, { cardState: r.outcome === "applied" ? "undone" : "applied", result: r.outcome === "applied" ? COPY[ml].undone : report(r, COPY[ml]) });
    if (r.done.length) window.dispatchEvent(new CustomEvent(ASSISTANT_APPLIED_EVENT, { detail: { shareId: m.shareId } }));
    log(m, m.card.undo, r.outcome === "applied" ? "undone" : r.outcome, r.failed ?? "");
  };

  const cancelCard = (m: Msg) => {
    if (!m.card || m.cardState !== "pending") return;
    patch(m.id, { cardState: "cancelled", result: COPY[m.lang ?? lang].cancelled });
    log(m, m.card, "cancelled");
  };

  const chips = useMemo(() => (site ? siteSuggestions(page) : suggestionsFor(screen, ctx?.stage ?? null)), [site, page, screen, ctx?.stage]);
  const title = site ? c.siteTitle : c.title;
  const bottom = isIOS() ? "calc(68px + env(safe-area-inset-bottom, 0px) + 12px)" : "calc(56px + 12px)";

  return (
    <>
      <style>{CSS}</style>
      {open && (
        <section
          className="tl-asst-panel"
          style={{ ["--asst-panel-bottom" as string]: bottom }}
          role="dialog"
          aria-label={title}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        >
          <header className="tl-asst-head">
            <Sparkles className="h-4 w-4" aria-hidden style={{ color: "var(--tl-green)" }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="tl-asst-title">{title}</div>
              <div className="tl-asst-ctx">{c.viewing(label)}</div>
            </div>
            {messages.length > 0 && (
              <button type="button" className="tl-asst-link" onClick={() => { setMessages([]); setThreadId(uid() + uid()); undoable.current.clear(); }}>
                {c.clear}
              </button>
            )}
            <button type="button" className="tl-asst-icon" aria-label={c.close} onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="tl-asst-log" aria-live="polite">
            <div className="tl-asst-msg bot">{site ? c.siteHello : c.hello}</div>
            {messages.map((m) => (
              <div key={m.id} className={`tl-asst-row ${m.role}`}>
                {m.ctx && <div className="tl-asst-tag">{c.viewing(m.ctx)}</div>}
                <div className={`tl-asst-msg ${m.role}`}>{m.text}</div>
                {m.links && m.links.length > 0 && (
                  <div className="tl-asst-chips">
                    {m.links.map((l) => (
                      <button key={l.href} type="button" className="tl-asst-chip" onClick={() => { const h = safeLink(l.href); if (h) navigate(localePath(h, lang)); }}>
                        {l.label} →
                      </button>
                    ))}
                  </div>
                )}
                {m.card && !m.card.blocked && (
                  <div className={`tl-asst-card${m.card.danger ? " danger" : ""}`}>
                    {m.card.lines.map((l) => <div key={l} className="tl-asst-line">{l}</div>)}
                    {m.card.warnings.map((w) => (
                      <div key={w} className="tl-asst-warn"><TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />{w}</div>
                    ))}
                    {m.cardState === "pending" && (
                      <div className="tl-asst-actions">
                        <Button type="button" size="sm" variant={m.card.danger ? "destructive" : "default"} onClick={() => confirmCard(m)}>
                          {m.card.danger ? COPY[m.lang ?? lang].confirmDanger : COPY[m.lang ?? lang].confirm}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => cancelCard(m)}>{COPY[m.lang ?? lang].cancel}</Button>
                      </div>
                    )}
                    {m.cardState === "running" && <div className="tl-asst-result"><Loader2 className="h-3.5 w-3.5 animate-spin" />{COPY[m.lang ?? lang].running}</div>}
                    {m.result && m.cardState !== "running" && <div className={`tl-asst-result ${m.cardState}`}>{m.result}</div>}
                    {m.cardState === "applied" && undoable.current.has(m.id) && (
                      <button type="button" className="tl-asst-link" onClick={() => undoCard(m)}>
                        <Undo2 className="h-3.5 w-3.5" aria-hidden /> {COPY[m.lang ?? lang].undo}
                      </button>
                    )}
                  </div>
                )}
                {m.card?.blocked && m.card.blocked.alternatives.length > 0 && (
                  <div className="tl-asst-chips">
                    {m.card.blocked.alternatives.map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        className="tl-asst-chip"
                        onClick={() => {
                          if (a.href) { navigate(localePath(a.href, lang)); return; }
                          if (a.fill) { setInput(a.prompt); inputRef.current?.focus(); return; }
                          void send(a.prompt);
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="tl-asst-msg bot"><Loader2 className="h-4 w-4 animate-spin" aria-label="…" /></div>}
            <div ref={endRef} />
          </div>

          {!user && !site ? (
            <div className="tl-asst-compose">
              <span style={{ flex: 1, fontSize: 13, color: "var(--tl-fg-3)" }}>{c.login}</span>
              <Button type="button" size="sm" onClick={() => navigate(`${localePath("/login", lang)}?redirect=${encodeURIComponent(window.location.pathname)}`)}>
                {c.loginBtn}
              </Button>
            </div>
          ) : (
            <>
              {chips.length > 0 && !busy && (
                <div className="tl-asst-chips" style={{ padding: "0 12px 8px" }}>
                  {chips.map((s) => (
                    <button
                      key={s.vi}
                      type="button"
                      className="tl-asst-chip"
                      onClick={() => (s.href ? navigate(localePath(s.href, lang)) : void send(lang === "vi" ? s.vi : s.en))}
                    >
                      {lang === "vi" ? s.vi : s.en}
                    </button>
                  ))}
                </div>
              )}
              <form className="tl-asst-compose" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  maxLength={site ? 500 : 2000}
                  placeholder={site ? c.sitePlaceholder : c.placeholder}
                  aria-label={site ? c.sitePlaceholder : c.placeholder}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                />
                <button type="submit" className="tl-asst-icon send" aria-label={c.send} disabled={busy || !input.trim()}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
};

// z-index dưới BottomNav (9999), cùng tầng ChatFAB (9990); panel render sau ChatFAB nên nằm trên.
const CSS = `
.tl-asst-panel { position: fixed; z-index: 9990; left: 8px; right: 8px; bottom: var(--asst-panel-bottom); height: min(72dvh, 620px);
  display: flex; flex-direction: column; background: var(--tl-bg, #08090a); color: var(--tl-fg, #f5f3ee);
  border: 1px solid var(--tl-border-strong); border-radius: 14px; overflow: hidden; }
@media (min-width: 768px) {
  .tl-asst-panel { left: auto; right: 24px; bottom: 24px; width: 400px; height: min(78dvh, 640px); }
}
.tl-asst-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--tl-border, #22252a); }
.tl-asst-title { font-weight: 600; font-size: 14px; }
.tl-asst-ctx, .tl-asst-tag { font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: .06em; color: var(--tl-fg-3, #8a8f98);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-asst-log { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.tl-asst-row { display: flex; flex-direction: column; gap: 4px; }
.tl-asst-row.user { align-items: flex-end; }
.tl-asst-msg { max-width: 88%; padding: 8px 11px; border-radius: 12px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
.tl-asst-msg.bot { background: var(--tl-surface); align-self: flex-start; }
.tl-asst-msg.user { background: var(--tl-green-glow, rgba(0,185,107,.15)); }
.tl-asst-card { align-self: stretch; border: 1px solid var(--tl-border, #22252a); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.tl-asst-card.danger { border-color: var(--tl-live); }
.tl-asst-line { font-weight: 500; }
.tl-asst-warn { display: flex; gap: 6px; align-items: flex-start; color: var(--tl-amber); font-size: 12px; }
.tl-asst-actions { display: flex; gap: 8px; margin-top: 4px; }
.tl-asst-result { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--tl-fg-3, #8a8f98); }
.tl-asst-result.applied, .tl-asst-result.undone { color: var(--tl-green, #00b96b); }
.tl-asst-result.partial, .tl-asst-result.failed { color: var(--tl-live); }
.tl-asst-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tl-asst-chip { font-size: 12px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--tl-border, #22252a); background: transparent; color: inherit; }
.tl-asst-chip:hover { border-color: var(--tl-green, #00b96b); }
.tl-asst-compose { display: flex; gap: 8px; align-items: flex-end; padding: 10px 12px; border-top: 1px solid var(--tl-border, #22252a); }
.tl-asst-compose textarea { flex: 1; resize: none; max-height: 120px; min-height: 40px; padding: 9px 11px; border-radius: 10px; font-size: 16px;
  background: var(--tl-surface); color: inherit; border: 1px solid var(--tl-border, #22252a); }
.tl-asst-icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 999px; background: transparent; color: inherit; border: 0; }
.tl-asst-icon.send { background: var(--tl-green, #00b96b); color: var(--tl-bg); width: 40px; height: 40px; }
.tl-asst-icon:disabled { opacity: .4; }
.tl-asst-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--tl-fg-3, #8a8f98); background: transparent; border: 0; padding: 4px 6px; }
.tl-asst-link:hover { color: var(--tl-fg, #f5f3ee); }
`;

export default AssistantPanel;
