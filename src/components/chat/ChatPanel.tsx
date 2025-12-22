import { useState, useRef, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Send, Settings, Trash2, VolumeX, MessageCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLiveChat, ChatMessage } from "@/hooks/useLiveChat";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatPanelProps {
  livestreamId: string;
  className?: string;
}

const ChatMessageItem = ({
  message,
  isModerator,
  onDelete,
  onMute,
}: {
  message: ChatMessage;
  isModerator: boolean;
  onDelete: (id: string) => void;
  onMute: (userId: string, duration: number) => void;
}) => {
  const { t } = useI18n();
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group flex gap-2 px-3 py-1.5 hover:bg-muted/50 rounded transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm text-primary truncate max-w-[120px]">
            {message.display_name}
          </span>
          <span className="text-[10px] text-foreground-muted">
            {format(new Date(message.created_at), "HH:mm")}
          </span>
        </div>
        <p className="text-sm text-foreground break-words">{message.message}</p>
      </div>
      
      {isModerator && showActions && (
        <div className="flex items-start gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <VolumeX className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t.chat.mute}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onMute(message.user_id, 10)}>
                10 {t.chat.minutes}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMute(message.user_id, 60)}>
                1 {t.chat.hour}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMute(message.user_id, 1440)}>
                24 {t.chat.hours}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export const ChatPanel = ({ livestreamId, className }: ChatPanelProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const {
    messages,
    settings,
    userMute,
    isLoading,
    isModerator,
    sendMessage,
    deleteMessage,
    updateSettings,
    muteUser,
  } = useLiveChat(livestreamId);

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect if user scrolls up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    const success = await sendMessage(inputValue);
    if (success) {
      setInputValue("");
      setAutoScroll(true);
    }
    setIsSending(false);
  };

  const isMuted = userMute && new Date(userMute.muted_until) > new Date();
  const chatDisabled = settings && !settings.is_chat_enabled;

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
    <div className={cn("flex flex-col h-full bg-surface rounded-xl border border-border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{t.chat.title}</span>
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

      {/* Status Messages */}
      {chatDisabled && (
        <div className="px-3 py-2 bg-muted/50 text-sm text-foreground-muted flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {t.chat.chatDisabled}
        </div>
      )}
      
      {isMuted && (
        <div className="px-3 py-2 bg-destructive/10 text-sm text-destructive flex items-center gap-2">
          <VolumeX className="h-4 w-4" />
          {t.chat.youAreMuted} ({format(new Date(userMute!.muted_until), "HH:mm")})
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" onScrollCapture={handleScroll}>
        <div ref={scrollRef} className="py-2">
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
                onDelete={deleteMessage}
                onMute={muteUser}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        {!user ? (
          <Link
            to="/login"
            className="block text-center text-sm text-primary hover:underline py-2"
          >
            {t.chat.signInToChat}
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t.chat.placeholder}
              disabled={isSending || !!chatDisabled || !!isMuted}
              maxLength={500}
              className="flex-1 h-9 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!inputValue.trim() || isSending || !!chatDisabled || !!isMuted}
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
