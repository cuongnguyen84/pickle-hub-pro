import { Link } from "react-router-dom";
import {
  CalendarPlus,
  Compass,
  MapPin,
  Newspaper,
  Radio,
  Store,
  Trophy,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { MORE_ITEMS } from "./moreItems";

/**
 * Tấm trượt "Thêm" — ô thứ năm của thanh dưới.
 *
 * Dùng lại `ui/sheet.tsx` (Radix Dialog) chứ không tự dựng: bẫy tiêu điểm,
 * phím Esc, khoá cuộn nền và lớp phủ đều đã đúng ở đó, và
 * `@radix-ui/react-dialog` vốn đã nằm trong chunk `vendor-ui` nên gần như
 * không tốn thêm byte nào. Một tấm trượt tự viết là ba lỗi a11y phải tự sửa.
 *
 * Danh sách mục KHÔNG nằm ở đây — nó dẫn xuất từ `NAV_ITEMS` qua
 * `moreItems.ts`, nên thêm một bề mặt vào nav là nó tự có mặt trong này.
 */

/** Biểu tượng tra theo đường dẫn. Để ở đây chứ không nhét vào `navItems.ts`:
 *  file đó là dữ liệu thuần, không import React, và đó là lý do nó test được
 *  mà không kéo cả cây component vào mẫu số coverage. */
const ICONS: Record<string, LucideIcon> = {
  "/social": CalendarPlus,
  "/live": Radio,
  "/tournaments": Trophy,
  "/san": MapPin,
  "/tim-ban-choi": Users,
  "/clubs": Users,
  "/tools": Wrench,
  "/rankings": Trophy,
  "/blog": Newspaper,
  "/shop": Store,
};

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { language } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideCloseButton
        // Radix cảnh báo khi thiếu mô tả; ở đây tiêu đề đã nói hết, và một
        // đoạn mô tả thừa là một đoạn trình đọc màn hình phải nghe mỗi lần mở.
        aria-describedby={undefined}
        className="md:hidden border-t p-0"
        style={{
          background: "var(--tl-bg, #08090a)",
          borderColor: "var(--tl-border, #22252a)",
          // Vùng an toàn đáy: iPhone có thanh gạt về nhà, và một lưới nút
          // chạm sát mép dưới là một lưới nút bấm trượt.
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
        }}
      >
        <div style={{ padding: "12px 14px 14px" }}>
          <span
            aria-hidden="true"
            style={{
              display: "block",
              width: 34,
              height: 3,
              borderRadius: 2,
              margin: "0 auto 14px",
              background: "var(--tl-border, #22252a)",
            }}
          />
          <SheetTitle
            style={{
              fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--tl-fg-3, #86837d)",
              margin: "0 0 12px",
            }}
          >
            {language === "vi" ? "Tất cả mục" : "Everything else"}
          </SheetTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {MORE_ITEMS.map((item) => {
              const Icon = ICONS[item.to] ?? Compass;
              const label = language === "vi" ? (item.labelVi ?? item.label) : item.label;
              return (
                <Link
                  key={item.to}
                  to={language === "vi" && item.to !== "/" ? `/vi${item.to}` : item.to}
                  onClick={() => onOpenChange(false)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    // 72px: trên ngưỡng chạm 44px của A11Y-02 kể cả khi nhãn
                    // xuống hai dòng.
                    minHeight: 72,
                    padding: "12px 6px",
                    borderRadius: 3,
                    background: "var(--tl-surface-2, #141618)",
                    color: "var(--tl-fg-2, #b8b4ac)",
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  <span
                    style={{
                      fontFamily:
                        '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      lineHeight: 1.35,
                    }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MoreSheet;
