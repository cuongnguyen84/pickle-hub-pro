import { useI18n } from "@/i18n";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";
import { Calendar, Users, Eye, Trophy, CheckCircle, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Livestream } from "@/hooks/useSupabaseData";

interface EndedLivestreamSEOProps {
  livestream: Livestream;
  viewCount: number;
  relatedLivestreams?: Array<{
    id: string;
    title: string;
    status: string;
    thumbnail_url?: string | null;
  }>;
  tournamentSlug?: string | null;
}

export const EndedLivestreamSEO = ({
  livestream,
  viewCount,
  relatedLivestreams = [],
  tournamentSlug,
}: EndedLivestreamSEOProps) => {
  const { t, language } = useI18n();
  const dateLocale = language === "vi" ? viLocale : enUS;

  const matchDate = livestream.ended_at
    ? format(new Date(livestream.ended_at), "dd/MM/yyyy", { locale: dateLocale })
    : livestream.scheduled_start_at
      ? format(new Date(livestream.scheduled_start_at), "dd/MM/yyyy", { locale: dateLocale })
      : null;

  const formattedDateTime = livestream.ended_at
    ? format(new Date(livestream.ended_at), "EEEE, dd MMMM yyyy", { locale: dateLocale })
    : null;

  // Filter related streams (same tournament or same org, excluding current)
  const relatedStreams = relatedLivestreams
    .filter((s) => s.id !== livestream.id)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Structured Match Information Block */}
      <div className="bg-surface-elevated rounded-lg p-4 border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary" />
          {language === "vi" ? "Thông tin trận đấu" : "Match Information"}
        </h2>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          {/* Tournament */}
          {livestream.tournament_id && (
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-foreground-muted flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                {language === "vi" ? "Giải đấu" : "Tournament"}
              </dt>
              <dd className="font-medium text-foreground mt-1">
                {tournamentSlug ? (
                  <Link
                    to={`/tournament/${tournamentSlug}`}
                    className="text-primary hover:underline"
                  >
                    {livestream.title?.split(" – ")[0] || livestream.title}
                  </Link>
                ) : (
                  livestream.title?.split(" – ")[0] || livestream.title
                )}
              </dd>
            </div>
          )}

          {/* Organization */}
          {livestream.organization && (
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-foreground-muted flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {language === "vi" ? "Được phát bởi" : "Streamed by"}
              </dt>
              <dd className="font-medium text-foreground mt-1">
                <Link
                  to={`/org/${livestream.organization.slug}`}
                  className="text-primary hover:underline"
                >
                  {livestream.organization.name}
                </Link>
              </dd>
            </div>
          )}

          {/* Match Date */}
          {matchDate && (
            <div>
              <dt className="text-foreground-muted flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {language === "vi" ? "Ngày phát" : "Stream Date"}
              </dt>
              <dd className="font-medium text-foreground mt-1">{matchDate}</dd>
            </div>
          )}

          {/* Total Views */}
          <div>
            <dt className="text-foreground-muted flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {language === "vi" ? "Lượt xem" : "Total Views"}
            </dt>
            <dd className="font-medium text-foreground mt-1">
              {viewCount.toLocaleString()}
            </dd>
          </div>

          {/* Status */}
          <div className="col-span-2">
            <dt className="text-foreground-muted flex items-center gap-1.5">
              <Play className="w-4 h-4" />
              {language === "vi" ? "Trạng thái" : "Status"}
            </dt>
            <dd className="font-medium text-foreground mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-xs">
                <CheckCircle className="w-3 h-3 text-primary" />
                {language === "vi" ? "Đã kết thúc - Xem lại đầy đủ" : "Completed - Full Replay Available"}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* SEO Description Section (150-250 words) */}
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          {language === "vi" 
            ? `Xem lại: ${livestream.title}` 
            : `Watch Replay: ${livestream.title}`}
        </h2>
        
        <div className="text-foreground-secondary space-y-3">
          <p>
            {language === "vi" ? (
              <>
                Đây là bản replay đầy đủ của buổi livestream <strong>{livestream.title}</strong>
                {livestream.organization?.name && <> được phát bởi <strong>{livestream.organization.name}</strong></>}
                {formattedDateTime && <> vào {formattedDateTime}</>}.
                Video đã được lưu trữ và có thể xem lại bất cứ lúc nào.
              </>
            ) : (
              <>
                This is the complete replay of the <strong>{livestream.title}</strong> livestream
                {livestream.organization?.name && <> streamed by <strong>{livestream.organization.name}</strong></>}
                {formattedDateTime && <> on {formattedDateTime}</>}.
                The video has been archived and is available to watch anytime.
              </>
            )}
          </p>

          <p>
            {language === "vi" ? (
              <>
                ThePickleHub là nền tảng pickleball chuyên nghiệp với các buổi livestream trực tiếp, 
                giải đấu và công cụ quản lý bracket miễn phí. Tất cả các buổi phát sóng đều được lưu trữ 
                để người xem có thể xem lại những pha bóng hay nhất, những khoảnh khắc quyết định 
                và toàn bộ diễn biến trận đấu.
              </>
            ) : (
              <>
                ThePickleHub is a professional pickleball platform featuring live streams, 
                tournaments, and free bracket management tools. All broadcasts are archived 
                so viewers can revisit the best rallies, decisive moments, 
                and full match progression.
              </>
            )}
          </p>

          <p>
            {language === "vi" ? (
              <>
                Replay này bao gồm toàn bộ nội dung được phát sóng trong buổi livestream gốc.
                Sử dụng các điều khiển video để tua nhanh, chậm hoặc nhảy đến các điểm quan trọng.
                Hãy like và bình luận để chia sẻ cảm nghĩ của bạn về trận đấu!
              </>
            ) : (
              <>
                This replay includes the complete content from the original livestream broadcast.
                Use the video controls to fast forward, slow down, or jump to key moments.
                Like and comment to share your thoughts about the match!
              </>
            )}
          </p>
        </div>
      </article>

      {/* Internal Linking Section */}
      {(relatedStreams.length > 0 || livestream.organization || livestream.tournament_id) && (
        <nav className="border-t border-border pt-6">
          <h3 className="text-base font-semibold text-foreground mb-4">
            {language === "vi" ? "Nội dung liên quan" : "Related Content"}
          </h3>

          <ul className="space-y-2 text-sm">
            {/* Tournament link */}
            {tournamentSlug && (
              <li>
                <Link
                  to={`/tournament/${tournamentSlug}`}
                  className="text-primary hover:underline inline-flex items-center gap-1.5"
                >
                  <Trophy className="w-4 h-4" />
                  {language === "vi" 
                    ? "Xem tất cả nội dung giải đấu này" 
                    : "View all tournament content"}
                </Link>
              </li>
            )}

            {/* Organization link */}
            {livestream.organization && (
              <li>
                <Link
                  to={`/org/${livestream.organization.slug}`}
                  className="text-primary hover:underline inline-flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  {language === "vi" 
                    ? `Xem thêm từ ${livestream.organization.name}` 
                    : `More from ${livestream.organization.name}`}
                </Link>
              </li>
            )}

            {/* Related streams */}
            {relatedStreams.map((stream) => (
              <li key={stream.id}>
                <Link
                  to={`/live/${stream.id}`}
                  className="text-primary hover:underline inline-flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  {stream.title}
                </Link>
              </li>
            ))}

            {/* All livestreams link */}
            <li>
              <Link
                to="/livestream"
                className="text-foreground-secondary hover:text-primary hover:underline"
              >
                {language === "vi" ? "← Xem tất cả livestream" : "← View all livestreams"}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
};
