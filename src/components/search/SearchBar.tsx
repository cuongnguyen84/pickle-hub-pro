import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar = ({ value, onChange, placeholder, className }: SearchBarProps) => {
  const { t } = useI18n();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  return (
    <div
      className={cn(
        "relative flex items-center transition-all duration-200",
        isFocused && "ring-2 ring-primary/20",
        "rounded-lg",
        className
      )}
    >
      <Search className="absolute left-3 w-4 h-4 text-foreground-muted pointer-events-none" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder ?? t.search.placeholder}
        className="pl-9 pr-9 bg-background-surface border-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 p-0.5 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-foreground-muted" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
