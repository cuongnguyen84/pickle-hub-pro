import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user";
import { ChatterBadge } from "./ChatterBadge";
import { useI18n } from "@/i18n";
import type { ChatLeaderboardEntry } from "@/hooks/useChatLeaderboard";

interface ChatLeaderboardPanelProps {
  leaderboard: ChatLeaderboardEntry[];
  isLoading: boolean;
}

export function ChatLeaderboardPanel({ leaderboard, isLoading }: ChatLeaderboardPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();

  if (isLoading || leaderboard.length === 0) return null;

  const top5 = leaderboard.slice(0, 5);

  return (
    <div className="border-b border-border">
      <Button
        variant="ghost"
        size="sm"
        className="w-full flex items-center justify-between px-3 py-1.5 h-auto text-xs font-medium"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" style={{ color: "#FFD700" }} />
          {t.chat.topChatters}
        </span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {isOpen && (
        <div className="px-3 pb-2 space-y-1">
          {top5.map((entry) => (
            <div
              key={entry.user_id}
              className="flex items-center gap-2 py-1 text-xs"
            >
              <ChatterBadge rank={entry.rank} />
              <UserAvatar
                avatarUrl={entry.avatar_url}
                displayName={entry.display_name}
                size="sm"
                showBadge={false}
              />
              <span className="truncate flex-1 font-medium">{entry.display_name}</span>
              <span className="text-muted-foreground tabular-nums">
                {entry.message_count} {t.chat.messages}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
