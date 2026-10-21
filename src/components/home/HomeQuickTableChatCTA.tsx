import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * Thẻ nổi bật trên trang chủ dẫn thẳng vào "Tạo giải bằng chat AI"
 * (/tools/quick-tables/chat). Viền gradient chạy chậm, tắt khi reduced-motion.
 */
export function HomeQuickTableChatCTA() {
  const { language } = useI18n();
  const vi = language === "vi";
  return (
    <div className="tl-shell" style={{ marginTop: 40 }}>
      <Link
        to={vi ? "/vi/tools/quick-tables/chat" : "/tools/quick-tables/chat"}
        className="tl-ai-cta"
        aria-label={vi ? "Tạo bảng đấu bằng chat với AI" : "Create a bracket by chatting with AI"}
      >
        <span className="tl-ai-cta-icon" aria-hidden="true">
          <Sparkles className="w-6 h-6" />
        </span>
        <span className="tl-ai-cta-body">
          <span className="tl-ai-cta-kicker">{vi ? "Mới · Trợ lý AI" : "New · AI assistant"}</span>
          <span className="tl-ai-cta-title">{vi ? "Tạo bảng đấu bằng chat với AI" : "Create a bracket by chatting with AI"}</span>
          <span className="tl-ai-cta-sub">
            {vi
              ? "Dán danh sách VĐV, ảnh chụp hay file Excel — AI chia bảng, chia nhánh Vàng/Bạc và xếp sân, giờ cho bạn."
              : "Paste a player list, a photo or a spreadsheet — the AI splits groups, sets up Gold/Silver brackets and assigns courts and times."}
          </span>
        </span>
        <span className="tl-ai-cta-go">
          {vi ? "Tạo giải ngay" : "Start now"}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
