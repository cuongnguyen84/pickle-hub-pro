import { useState, useEffect, useCallback } from "react";
import { UserAvatar } from "@/components/user";
import { cn } from "@/lib/utils";

export interface MentionUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface MentionSuggestionsProps {
  query: string;
  users: MentionUser[];
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  selectedIndex: number;
}

export function MentionSuggestions({
  query,
  users,
  onSelect,
  onClose,
  selectedIndex,
}: MentionSuggestionsProps) {
  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
      {filtered.map((user, index) => (
        <button
          key={user.user_id}
          type="button"
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/70 transition-colors",
            index === selectedIndex && "bg-muted"
          )}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent input blur
            onSelect(user);
          }}
        >
          <UserAvatar
            avatarUrl={user.avatar_url}
            displayName={user.display_name}
            size="sm"
            showBadge={false}
          />
          <span className="truncate">{user.display_name}</span>
        </button>
      ))}
    </div>
  );
}

// Helper: parse message text and highlight @mentions
export function renderMessageWithMentions(text: string) {
  // Match @displayName patterns - handles names with spaces by matching until end of mention
  const mentionRegex = /@([^\s@][^@]*?)(?=\s@|\s{2}|$)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add highlighted mention
    parts.push(
      <span key={match.index} className="text-primary font-semibold">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
