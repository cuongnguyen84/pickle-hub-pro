// ============================================================================
// MatchHeader — Sprint 2 Phase 3B.1
// Date · venue (link to /san/:slug) · format · match_type
// ============================================================================

import { Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { MatchDetail } from "@/hooks/social";

const FORMAT_LABEL: Record<MatchDetail["format"], string> = {
  singles: "Đơn",
  doubles: "Đôi",
  mixed: "Đôi nam-nữ",
};

const MATCH_TYPE_LABEL: Record<string, string> = {
  rec: "Giao lưu",
  open_play: "Open play",
  tournament: "Giải đấu",
  league: "League",
  practice: "Tập luyện",
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export const MatchHeader = ({ match }: { match: MatchDetail }) => {
  const venueName = match.venue_name ?? "(Sân không xác định)";
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
          <span>{fmtDate(match.played_at)}</span>
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
