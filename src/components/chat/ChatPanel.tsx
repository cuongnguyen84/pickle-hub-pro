import { useState, useRef, useEffect, useCallback, forwardRef, KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Send, Settings, Trash2, VolumeX, MessageCircle, Clock, AlertCircle, 
  MoreHorizontal, Copy, Flag, RefreshCw, ChevronDown, ChevronUp, BadgeCheck, Edit3,
  Pin, X as XIcon
} from "lucide-react";
import { NicknameInput } from "./NicknameInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user";
import { useLiveChat, ChatMessage } from "@/hooks/useLiveChat";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "./EmojiPicker";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import { getLoginUrl } from "@/lib/auth-config";

interface ChatPanelProps {
  livestreamId: string;
  className?: string;
  hideHeader?: boolean;
}

interface ChatMessageItemProps {
  message: ChatMessage;
  isModerator: boolean;
  isCreator: boolean;
  avatarUrl: string | null;
  onDelete: (id: string) => void;
  onMute: (userId: string, duration: number) => void;
  onRetry?: (tempId: string, message: string) => void;
  onCopy: (text: string) => void;
  onPin?: (messageId: string) => void;
}

const ChatMessageItem = forwardRef<HTMLDivElement, ChatMessageItemProps>(({
  message,
  isModerator,
  isCreator,
  avatarUrl,
  onDelete,
  onMute,
  onRetry,
  onCopy,
  onPin,
}, ref) => {
  const { t } = useI18n();
  const isPending = message._pending;
  const isFailed = message._failed;

  return (
    <div
      ref={ref}
      className={cn(
        "group flex gap-2 px-3 py-1.5 hover:bg-muted/50 rounded transition-colors",
        isPending && "opacity-70",
        isFailed && "opacity-80 bg-destructive/5"
      )}
    >
      {/* Avatar */}
      <UserAvatar
        avatarUrl={avatarUrl || message.avatar_url}
        displayName={message.display_name}
        isCreator={isCreator}
        size="sm"
        showBadge={false}
        className="shrink-0 mt-0.5"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm text-primary truncate max-w-[120px] inline-flex items-center gap-1">
            {message.display_name}
            {isCreator && (
              <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </span>
          <span className="text-[10px] text-foreground-muted">
            {format(new Date(message.created_at), "HH:mm")}
          </span>
          {isPending && (
            <span className="text-[10px] text-foreground-muted italic flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              {t.chat.sending}
            </span>
          )}
          {isFailed && (
            <span className="text-[10px] text-destructive flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" />
              {t.chat.sendFailed}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground break-words whitespace-pre-wrap">{message.message}</p>
        
        {/* Retry button for failed messages */}
        {isFailed && onRetry && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 mt-1 text-xs text-primary hover:text-primary"
            onClick={() => onRetry(message._tempId || message.id, message.message)}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t.chat.retry}
          </Button>
        )}
      </div>
      
      {/* Actions dropdown - only for confirmed messages */}
      {!isPending && !isFailed && (
        <div className="flex items-start shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              <DropdownMenuItem onClick={() => onCopy(message.message)}>
                <Copy className="h-3 w-3 mr-2" />
                {t.chat.copy}
              </DropdownMenuItem>
              
              {isModerator && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onPin?.(message.id)}>
                    <Pin className="h-3 w-3 mr-2" />
                    {t.chat.pin}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">{t.chat.mute}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onMute(message.user_id, 10)}>
                    10 {t.chat.minutes}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMute(message.user_id, 60)}>
                    1 {t.chat.hour}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMute(message.user_id, 1440)}>
                    24 {t.chat.hours}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(message.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    {t.chat.delete}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
});
ChatMessageItem.displayName = "ChatMessageItem";

export const ChatPanel = ({ livestreamId, className, hideHeader = false }: ChatPanelProps) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const {
    messages,
    settings,
    userMute,
    isLoading,
    isModerator,
    hasOlderMessages,
    sendMessage,
    retryMessage,
    deleteMessage,
    updateSettings,
    muteUser,
    loadOlderMessages,
  } = useLiveChat(livestreamId);

  const [inputValue, setInputValue] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [creatorCache, setCreatorCache] = useState<Record<string, boolean>>({});
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  // Track last fetch time to debounce user data fetching (for 1000+ viewers optimization)
  const lastFetchTimeRef = useRef<number>(0);
  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch creator status and avatar for users in messages (optimized batch fetch)
  useEffect(() => {
    const userIds = [...new Set(messages.map(m => m.user_id))];
    const uncachedIds = userIds.filter(id => !(id in creatorCache));
    
    if (uncachedIds.length === 0) return;
    
    // Debounce fetching to avoid too many requests during high traffic
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const minFetchInterval = 2000; // Min 2 seconds between batch fetches
    
    if (fetchDebounceRef.current) {
      clearTimeout(fetchDebounceRef.current);
    }
    
    const delay = timeSinceLastFetch < minFetchInterval 
      ? minFetchInterval - timeSinceLastFetch 
      : 0;

    fetchDebounceRef.current = setTimeout(async () => {
      lastFetchTimeRef.current = Date.now();
      
      // Limit batch size to prevent excessive requests
      const batchIds = uncachedIds.slice(0, 20);
      
      const creatorResults: Record<string, boolean> = {};
      const avatarResults: Record<string, string | null> = {};
      
      try {
        // Batch fetch profiles in a single query (use public_profiles view)
        const { data: profiles } = await supabase
          .from("public_profiles")
          .select("id, avatar_url")
          .in("id", batchIds);
        
        // Create a lookup map for profiles
        const profileMap = new Map(profiles?.map(p => [p.id, p.avatar_url]) ?? []);
        
        // Fetch creator status in parallel but with batching
        await Promise.all(
          batchIds.map(async (userId) => {
            try {
              const { data } = await supabase.rpc("is_user_creator", { _user_id: userId });
              creatorResults[userId] = !!data;
              avatarResults[userId] = profileMap.get(userId) ?? null;
            } catch {
              creatorResults[userId] = false;
              avatarResults[userId] = profileMap.get(userId) ?? null;
            }
          })
        );
        
        setCreatorCache(prev => ({ ...prev, ...creatorResults }));
        setAvatarCache(prev => ({ ...prev, ...avatarResults }));
      } catch (err) {
        console.error('[ChatPanel] Error fetching user data:', err);
      }
    }, delay);

    return () => {
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current);
      }
    };
  }, [messages, creatorCache]);

  // Check if user is near bottom of scroll
  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  }, []);

  // Scroll to bottom smoothly
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior
      });
    }
  }, []);

  // Handle new messages
  useEffect(() => {
    const newCount = messages.length - prevMessagesLengthRef.current;
    
    if (newCount > 0) {
      if (autoScroll || isNearBottom()) {
        // User is at bottom, scroll to new message
        requestAnimationFrame(() => scrollToBottom());
        setNewMessagesCount(0);
      } else {
        // User scrolled up, show badge
        setNewMessagesCount(prev => prev + newCount);
      }
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, autoScroll, isNearBottom, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom("instant");
    }
  }, [isLoading]);

  // Detect scroll position
  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    setAutoScroll(nearBottom);
    if (nearBottom) {
      setNewMessagesCount(0);
    }
  }, [isNearBottom]);

  // Prevent double-submit with ref
  const isSubmittingRef = useRef(false);

  // Handle form submit
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Prevent double submission
    if (isSubmittingRef.current) return;
    
    const value = inputValue.trim();
    if (!value) return;

    isSubmittingRef.current = true;

    // Clear input immediately (optimistic)
    setInputValue("");
    setAutoScroll(true);
    
    // Scroll to bottom when user sends
    requestAnimationFrame(() => scrollToBottom());
    
    await sendMessage(value);
    
    // Refocus input
    inputRef.current?.focus();
    
    // Reset after a short delay to allow for next message
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 100);
  }, [inputValue, sendMessage, scrollToBottom]);

  // Handle keyboard shortcuts - IME safe
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Don't send during IME composition (e.g., Vietnamese, Chinese, Japanese input)
      if (isComposing || e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      handleSubmit();
    }
  };

  // IME composition handlers
  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  // Insert emoji at cursor position
  const handleEmojiSelect = useCallback((emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setInputValue(prev => prev + emoji);
      return;
    }

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = inputValue.slice(0, start) + emoji + inputValue.slice(end);
    
    setInputValue(newValue);
    
    // Set cursor position after emoji
    requestAnimationFrame(() => {
      const newPos = start + emoji.length;
      input.setSelectionRange(newPos, newPos);
      input.focus();
    });
  }, [inputValue]);

  // Copy message to clipboard
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t.common.copied });
    } catch {
      toast({ title: t.common.error, variant: "destructive" });
    }
  }, [toast, t]);

  // === Pinned message logic ===
  useEffect(() => {
    // Load pinned message
    const loadPinned = async () => {
      const { data } = await supabase
        .from("chat_pinned_messages")
        .select("*, chat_messages(*)")
        .eq("livestream_id", livestreamId)
        .maybeSingle();
      if (data?.chat_messages) {
        setPinnedMessage(data.chat_messages as unknown as ChatMessage);
      } else {
        setPinnedMessage(null);
      }
    };
    loadPinned();

    // Subscribe to realtime changes
    const pinChannel = supabase
      .channel(`chat_pin:${livestreamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_pinned_messages", filter: `livestream_id=eq.${livestreamId}` },
        () => { loadPinned(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(pinChannel); };
  }, [livestreamId]);

  const handlePinMessage = useCallback(async (messageId: string) => {
    if (!user?.id) {
      toast({ title: t.common.error, variant: "destructive" });
      return;
    }

    // Resolve real DB message ID if this is a broadcast message
    let resolvedId = messageId;
    if (messageId.startsWith("broadcast-")) {
      // Find the actual message from the messages list - it may have been reconciled
      const msg = messages.find(m => m.id === messageId);
      if (msg?.client_message_id) {
        // Look up the real DB message by client_message_id
        const { data } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("client_message_id", msg.client_message_id)
          .eq("livestream_id", livestreamId)
          .maybeSingle();
        if (data?.id) {
          resolvedId = data.id;
        } else {
          toast({ title: t.common.error, description: "Tin nhắn chưa được gửi xong, vui lòng thử lại.", variant: "destructive" });
          return;
        }
      } else {
        toast({ title: t.common.error, description: "Tin nhắn chưa được gửi xong, vui lòng thử lại.", variant: "destructive" });
        return;
      }
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resolvedId)) {
      toast({ title: t.common.error, description: "Tin nhắn chưa được gửi xong, vui lòng thử lại.", variant: "destructive" });
      return;
    }

    // Optimistically update pinned message UI
    const pinnedMsg = messages.find(m => m.id === messageId);
    if (pinnedMsg) {
      setPinnedMessage(pinnedMsg);
    }

    // Delete existing pin first, then insert - use await to avoid race condition
    const { error: deleteError } = await supabase.from("chat_pinned_messages").delete().eq("livestream_id", livestreamId);
    if (deleteError) {
      console.error('[ChatPanel] Pin delete error:', deleteError);
    }
    
    const { error } = await supabase.from("chat_pinned_messages").insert({
      livestream_id: livestreamId,
      message_id: resolvedId,
      pinned_by: user.id,
    });
    if (error) {
      console.error('[ChatPanel] Pin error:', error);
      toast({ title: t.common.error, variant: "destructive" });
      // Revert optimistic update
      setPinnedMessage(null);
    }
  }, [livestreamId, user, toast, t, messages]);

  const handleUnpinMessage = useCallback(async () => {
    setPinnedMessage(null); // Optimistic update
    await supabase.from("chat_pinned_messages").delete().eq("livestream_id", livestreamId);
  }, [livestreamId]);

  // Load older messages
  const handleLoadOlder = useCallback(async () => {
    setIsLoadingOlder(true);
    await loadOlderMessages();
    setIsLoadingOlder(false);
  }, [loadOlderMessages]);

  // Click new messages badge
  const handleNewMessagesBadgeClick = () => {
    scrollToBottom();
    setNewMessagesCount(0);
    setAutoScroll(true);
  };

  const isMuted = userMute && new Date(userMute.muted_until) > new Date();
  const chatDisabled = settings && !settings.is_chat_enabled;
  const inputDisabled = !!chatDisabled || !!isMuted;

  if (isLoading) {
    return (
      <div className={cn("flex flex-col h-full bg-surface rounded-xl border border-border", className)}>
        <div className="p-3 border-b border-border">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex-1 p-3 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-surface rounded-xl border border-border overflow-hidden", className)}>
      {/* Header - full or compact gear-only */}
      {hideHeader ? (
        isModerator && (
          <div className="flex items-center justify-end px-3 py-1.5 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted">{messages.filter(m => !m._pending && !m._failed).length}</span>
              {settings?.slow_mode_seconds && settings.slow_mode_seconds > 0 && (
                <span className="text-xs text-foreground-muted flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {settings.slow_mode_seconds}s
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t.chat.settings}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => updateSettings({ is_chat_enabled: !settings?.is_chat_enabled })}>
                    {settings?.is_chat_enabled ? t.chat.disableChat : t.chat.enableChat}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t.chat.slowMode}</DropdownMenuLabel>
                  {[0, 3, 5, 10, 30].map((seconds) => (
                    <DropdownMenuItem
                      key={seconds}
                      onClick={() => updateSettings({ slow_mode_seconds: seconds })}
                      className={cn(settings?.slow_mode_seconds === seconds && "bg-muted")}
                    >
                      {seconds === 0 ? t.chat.off : `${seconds}s`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{t.chat.title}</span>
            <span className="text-xs text-foreground-muted">{messages.filter(m => !m._pending && !m._failed).length}</span>
            {settings?.slow_mode_seconds && settings.slow_mode_seconds > 0 && (
              <span className="text-xs text-foreground-muted flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {settings.slow_mode_seconds}s
              </span>
            )}
          </div>
          
          {isModerator && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t.chat.settings}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => updateSettings({ is_chat_enabled: !settings?.is_chat_enabled })}>
                  {settings?.is_chat_enabled ? t.chat.disableChat : t.chat.enableChat}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t.chat.slowMode}</DropdownMenuLabel>
                {[0, 3, 5, 10, 30].map((seconds) => (
                  <DropdownMenuItem
                    key={seconds}
                    onClick={() => updateSettings({ slow_mode_seconds: seconds })}
                    className={cn(settings?.slow_mode_seconds === seconds && "bg-muted")}
                  >
                    {seconds === 0 ? t.chat.off : `${seconds}s`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Status Messages */}
      {chatDisabled && (
        <div className="px-3 py-2 bg-muted/50 text-sm text-foreground-muted flex items-center gap-2 shrink-0">
          <AlertCircle className="h-4 w-4" />
          {t.chat.chatDisabled}
        </div>
      )}
      
      {isMuted && (
        <div className="px-3 py-2 bg-destructive/10 text-sm text-destructive flex items-center gap-2 shrink-0">
          <VolumeX className="h-4 w-4" />
          {t.chat.youAreMuted} ({format(new Date(userMute!.muted_until), "HH:mm")})
        </div>
      )}

      {/* Pinned message */}
      {pinnedMessage && (
        <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Pin className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary">{t.chat.pinnedMessage}</span>
            {isModerator && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-auto"
                onClick={handleUnpinMessage}
              >
                <XIcon className="h-3 w-3" />
              </Button>
            )}
          </div>
          <p className="text-xs text-foreground line-clamp-2">
            <span className="font-medium text-primary">{pinnedMessage.display_name}: </span>
            {pinnedMessage.message}
          </p>
        </div>
      )}

      {/* Messages container - fixed height with internal scroll */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className="absolute inset-0 overflow-y-auto overscroll-contain"
          onScroll={handleScroll}
        >
          <div className="py-2">
            {/* Load older button */}
            {hasOlderMessages && (
              <div className="px-3 py-2 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleLoadOlder}
                  disabled={isLoadingOlder}
                >
                  {isLoadingOlder ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <ChevronUp className="h-3 w-3 mr-1" />
                  )}
                  {t.chat.loadOlder}
                </Button>
              </div>
            )}
            
            {messages.length === 0 ? (
              <div className="text-center text-sm text-foreground-muted py-8">
                {t.chat.noMessages}
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  isModerator={isModerator}
                  isCreator={creatorCache[message.user_id] ?? false}
                  avatarUrl={avatarCache[message.user_id] ?? message.avatar_url}
                  onDelete={deleteMessage}
                  onMute={muteUser}
                  onRetry={retryMessage}
                  onCopy={handleCopy}
                  onPin={isModerator ? handlePinMessage : undefined}
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* New messages badge */}
        {newMessagesCount > 0 && (
          <Button
            type="button"
            size="sm"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 h-7 text-xs shadow-lg z-10"
            onClick={handleNewMessagesBadgeClick}
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            {newMessagesCount} {t.chat.newMessages}
          </Button>
        )}
      </div>

      {/* Nickname & Input */}
      {user && <NicknameInput />}
      
      <div className="p-3 border-t border-border shrink-0">
        {!user ? (
          <Link
            to="/login"
            className="block text-center text-sm text-primary hover:underline py-2"
          >
            {t.chat.signInToChat}
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <EmojiPicker 
              onEmojiSelect={handleEmojiSelect} 
              disabled={inputDisabled}
            />
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={t.chat.placeholder}
              disabled={inputDisabled}
              maxLength={500}
              className="flex-1 h-9 text-sm"
              autoComplete="off"
            />
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!inputValue.trim() || inputDisabled}
              onClick={() => handleSubmit()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
