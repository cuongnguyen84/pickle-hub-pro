// ============================================================================
// FormatSelector — Sprint 2 Phase 3A.2 wizard step 2
// ----------------------------------------------------------------------------
// Three vertical cards: Đơn / Đôi / Đôi nam-nữ. Tap → set format and signal
// the parent reducer to advance to step 3.
// ============================================================================

import { Users, User, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export type Format = "singles" | "doubles" | "mixed";

interface FormatSelectorProps {
  value: Format;
  onSelect: (next: Format) => void;
}

interface OptionShape {
  id: Format;
  title: string;
  subtitle: string;
  count: string;
  Icon: typeof User;
}

const OPTIONS_VI: OptionShape[] = [
  { id: "singles", title: "Đơn",        subtitle: "1 vs 1",                count: "2 người",  Icon: User },
  { id: "doubles", title: "Đôi",        subtitle: "Cùng giới hoặc tự do",  count: "4 người",  Icon: Users },
  { id: "mixed",   title: "Đôi nam-nữ", subtitle: "1 nam + 1 nữ mỗi đội",  count: "4 người",  Icon: Users2 },
];
const OPTIONS_EN: OptionShape[] = [
  { id: "singles", title: "Singles", subtitle: "1 vs 1",                                count: "2 players", Icon: User },
  { id: "doubles", title: "Doubles", subtitle: "Same-gender or open",                    count: "4 players", Icon: Users },
  { id: "mixed",   title: "Mixed",   subtitle: "1 man + 1 woman per team",               count: "4 players", Icon: Users2 },
];

export const FormatSelector = ({ value, onSelect }: FormatSelectorProps) => {
  const { language } = useI18n();
  const OPTIONS = language === "vi" ? OPTIONS_VI : OPTIONS_EN;
  return (
    <div className="space-y-3">
      {OPTIONS.map(({ id, title, subtitle, count, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors",
              "min-h-[72px]",
              active
                ? "border-social-primary bg-social-primary/5"
                : "border-border bg-card hover:border-social-primary/40 hover:bg-accent",
            )}
            aria-pressed={active}
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                active ? "bg-social-primary text-white" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-muted-foreground">{subtitle}</div>
            </div>
            <div
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                active ? "bg-social-primary text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default FormatSelector;
