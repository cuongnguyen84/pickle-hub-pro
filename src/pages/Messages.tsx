// ============================================================================
// Messages (`/tin-nhan`) — in-app direct messages for Find Players.
// Auth-gated, noindex. Inbox (my_conversations RPC) + thread (messages) + send
// (send_message RPC). Refetch-based (4s in an open thread, 15s inbox).
// Conversations are created via get_or_create_dm from a player card / request.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, ArrowLeft, MessageCircle } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { sbFindPlayers as supabase } from "@/lib/find-players";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { useNoindex } from "@/hooks/useNoindex";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { type Conversation, type Message, playerInitial } from "@/lib/find-players";

function timeLabel(iso: string, vi: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(vi ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  useNoindex();
  const { language } = useI18n();
  const vi = language === "vi";
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const convId = params.get("c");
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedConvId = useRef<string | null>(null);

  const { data: convos, isLoading: inboxLoading } = useQuery<Conversation[]>({
    queryKey: ["my-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_conversations");
      if (error) {
        console.error("Messages: inbox", error);
        return [];
      }
      return (data as Conversation[]) ?? [];
    },
    enabled: Boolean(user),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["messages", convId],
    queryFn: async () => {
      if (!convId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) {
        console.error("Messages: thread", error);
        return [];
      }
      return (data as Message[]) ?? [];
    },
    enabled: Boolean(user && convId),
    refetchInterval: convId ? 4_000 : false,
  });

  const msgCount = messages?.length ?? 0;
  useEffect(() => {
    if (convId) {
      supabase.rpc("mark_conversation_read", { p_conv: convId });
      queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
    }
  }, [convId, msgCount, queryClient]);
  // Keep the thread pinned to the latest message WITHOUT scrolling the whole
  // page (the old scrollIntoView yanked the window for both sender + receiver).
  // Move only the thread container's own scrollTop: jump to bottom when opening
  // a chat, and for new messages only if the reader is already near the bottom
  // — so an incoming poll never yanks someone reading older history.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !convId) return;
    const justOpened = pinnedConvId.current !== convId;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (justOpened) {
      if (msgCount > 0) pinnedConvId.current = convId;
      el.scrollTop = el.scrollHeight;
    } else if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [convId, msgCount]);

  if (authLoading) {
    return (
      <TheLineLayout title={vi ? "Tin nhắn" : "Messages"} active="players" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (!user) return <Navigate to={buildLoginRedirect("/tin-nhan")} replace />;

  const current = (convos ?? []).find((c) => c.conversation_id === convId) ?? null;
  const headerName = current?.other_name || current?.other_username || (vi ? "Trò chuyện" : "Chat");

  async function send() {
    if (!convId || body.trim().length === 0 || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("send_message", { p_conv: convId, p_body: body.trim() });
      if (error) {
        toast({ title: vi ? "Gửi thất bại" : "Send failed", description: error.message, variant: "destructive" });
        return;
      }
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["messages", convId] });
      queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
    } finally {
      setSending(false);
    }
  }

  const Inbox = (
    <div className={`${convId ? "hidden md:block" : "block"} rounded-md border border-border`}>
      <div className="border-b border-border px-4 py-3 text-sm font-medium">{vi ? "Tin nhắn" : "Messages"}</div>
      {inboxLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (convos ?? []).length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {vi ? "Chưa có cuộc trò chuyện. Vào " : "No conversations yet. Go to "}
          <Link to="/tim-ban-choi" className="text-primary hover:underline">{vi ? "Tìm bạn chơi" : "Find players"}</Link>
          {vi ? " để bắt đầu." : " to start."}
        </div>
      ) : (
        <ul>
          {(convos ?? []).map((c) => {
            const nm = c.other_name || c.other_username || "—";
            const active = c.conversation_id === convId;
            return (
              <li key={c.conversation_id}>
                <button
                  type="button"
                  onClick={() => setParams({ c: c.conversation_id })}
                  className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-muted/40 ${active ? "bg-muted/60" : ""}`}
                >
                  {c.other_avatar ? (
                    <img src={c.other_avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{playerInitial(nm)}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{nm}</span>
                      {c.unread_count > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{c.unread_count}</span>}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">{c.last_body ?? ""}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const Thread = (
    <div className={`${convId ? "flex" : "hidden md:flex"} min-h-[60vh] flex-col rounded-md border border-border`}>
      {!convId ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          <span><MessageCircle className="mx-auto mb-2 h-6 w-6" />{vi ? "Chọn một cuộc trò chuyện" : "Select a conversation"}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <button type="button" className="md:hidden" onClick={() => setParams({})} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
            {current && (current.other_username || current.other_id) && (
              <Link to={`/nguoi-choi/${current.other_username ?? ""}`} className="text-sm font-medium hover:underline">{headerName}</Link>
            )}
            {!current && <span className="text-sm font-medium">{headerName}</span>}
          </div>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4" style={{ maxHeight: "55vh" }}>
            {(messages ?? []).map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`mt-0.5 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{timeLabel(m.created_at, vi)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={vi ? "Nhập tin nhắn…" : "Type a message…"}
              maxLength={1000}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button type="button" onClick={send} disabled={sending || body.trim().length === 0} className="tl-btn green" style={{ opacity: sending || body.trim().length === 0 ? 0.5 : 1 }}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <TheLineLayout title={vi ? "Tin nhắn | ThePickleHub" : "Messages | ThePickleHub"} active="players" noindex>
      <div className="tl-shell" style={{ paddingBottom: 40, maxWidth: 1000, margin: "0 auto" }}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
          {Inbox}
          {Thread}
        </div>
      </div>
    </TheLineLayout>
  );
}
