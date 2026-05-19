// ============================================================================
// MatchHeader — Sprint 2 Phase 3B.1
// Date · venue (link to /san/:slug) · format · match_type
//
// Bilingual page-level strings (PR #13 follow-up): format chip badge,
// match-type chip badge, venue fallback. Internal strings ("Tập luyện"
// label, etc.) untouched here — Sprint 2 child-component sweep handles
// the remaining edges in a follow-up PR.
// ============================================================================

import { Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import type { MatchDetail } from "@/hooks/social";

const FORMAT_LABEL_VI: Record<MatchDetail["format"], string> = {
  singles: "Đơn",
  doubles: "Đôi",
  mixed: "Đôi nam-nữ",
};
const FORMAT_LABEL_EN: Record<MatchDetail["format"], string> = {
  singles: "Singles",
  doubles: "Doubles",
  mixed: "Mixed",
};

const MATCH_TYPE_LABEL_VI: Record<string, string> = {
  rec: "Giao lưu",
  open_play: "Open play",
  tournament: "Giải đấu",
  league: "League",
  practice: "Tập luyện",
};
const MATCH_TYPE_LABEL_EN: Record<string, string> = {
  rec: "Casual",
  open_play: "Open play",
  tournament: "Tournament",
  league: "League",
  practice: "Practice",
};

const fmtDate = (iso: string, language: "vi" | "en") => {
  try {
    return new Date(iso).toLocaleString(language === "vi" ? "vi-VN" : "en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export const MatchHeader = ({ match }: { match: MatchDetail }) => {
  const { language } = useI18n();
  const FORMAT_LABEL =
    language === "vi" ? FORMAT_LABEL_VI : FORMAT_LABEL_EN;
  const MATCH_TYPE_LABEL =
    language === "vi" ? MATCH_TYPE_LABEL_VI : MATCH_TYPE_LABEL_EN;
  const venueFallback =
    language === "vi" ? "(Sân không xác định)" : "(Venue not specified)";
  const venueName = match.venue_name ?? venueFallback;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge className="bg-social-primary text-white hover:bg-social-primary-dark">
          {FORMAT_LABEL[match.format]}
        </Badge>
        <Badge variant="outline">
          {MATCH_TYPE_LABEL[match.match_type] ?? match.match_type}
        </Badge>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>{fmtDate(match.played_at, language)}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          {match.venue_slug ? (
            <Link
              to={`/san/${match.venue_slug}`}
              className="text-foreground hover:text-social-primary hover:underline"
            >
              {venueName}
              {match.venue_city && (
                <span className="text-muted-foreground"> · {match.venue_city}</span>
              )}
            </Link>
          ) : (
            <span className="text-foreground">{venueName}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchHeader;
