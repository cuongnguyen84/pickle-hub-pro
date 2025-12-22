import { useState, useCallback, useRef, useEffect } from "react";
import { Smile, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Emoji categories with common emojis
const EMOJI_DATA = {
  smileys: {
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋",
      "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🤫", "🤔",
      "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄",
      "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕",
      "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳",
      "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮",
      "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥",
      "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱"
    ]
  },
  gestures: {
    icon: "👍",
    emojis: [
      "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖",
      "👋", "🤏", "👌", "🤌", "🤳", "💪", "🦾", "🙏", "🤝", "✍️",
      "💅", "🙌", "👏", "🫶", "❤️", "🧡", "💛", "💚", "💙", "💜",
      "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "♥️", "🔥", "✨", "⭐", "🌟", "💫", "💥"
    ]
  },
  sports: {
    icon: "🏓",
    emojis: [
      "🏓", "🎾", "🏸", "🎯", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️",
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎳", "🏐", "🏉", "🎱", "🏒",
      "🏑", "🏏", "🥍", "🥏", "⛳", "🪁", "🛝", "🎿", "⛷️", "🏂",
      "🏋️", "🤼", "🤸", "🤺", "⛹️", "🤾", "🏌️", "🏇", "🧘", "🏄",
      "🏊", "🤽", "🚣", "🧗", "🚴", "🚵", "🎽", "🎪", "🎭", "🎨"
    ]
  },
  objects: {
    icon: "🎉",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🎀", "🎗️", "🏷️", "📣", "📢", "🔔",
      "🎵", "🎶", "🎤", "🎧", "📱", "💻", "🖥️", "📺", "📷", "🎬",
      "🎥", "📹", "💡", "🔦", "📡", "🔧", "🔨", "⚙️", "🛠️", "🔑",
      "📝", "📋", "📌", "📍", "🗓️", "📆", "📅", "🗒️", "🗄️", "📁"
    ]
  }
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export const EmojiPicker = ({ onEmojiSelect, disabled }: EmojiPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_DATA>("smileys");

  const handleEmojiClick = useCallback((emoji: string) => {
    onEmojiSelect(emoji);
    // Don't close on emoji click to allow multiple selections
  }, [onEmojiSelect]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Filter emojis by search
  const filteredEmojis = search.trim()
    ? Object.values(EMOJI_DATA).flatMap(cat => cat.emojis).filter(emoji => 
        emoji.includes(search) || emoji.toLowerCase().includes(search.toLowerCase())
      )
    : EMOJI_DATA[activeCategory].emojis;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 bg-surface border-border" 
        align="end"
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emoji..."
              className="h-8 pl-7 pr-7 text-sm"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-8 w-8"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="flex p-1 border-b border-border gap-0.5">
            {(Object.keys(EMOJI_DATA) as Array<keyof typeof EMOJI_DATA>).map((category) => (
              <Button
                key={category}
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 text-lg",
                  activeCategory === category && "bg-muted"
                )}
                onClick={() => setActiveCategory(category)}
              >
                {EMOJI_DATA[category].icon}
              </Button>
            ))}
          </div>
        )}

        {/* Emoji grid */}
        <div className="p-2 h-[200px] overflow-y-auto">
          <div className="grid grid-cols-8 gap-0.5">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                className="h-8 w-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                onClick={() => handleEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          {filteredEmojis.length === 0 && (
            <div className="text-center text-sm text-foreground-muted py-4">
              No emojis found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
