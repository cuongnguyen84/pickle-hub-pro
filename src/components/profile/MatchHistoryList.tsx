// ============================================================================
// MatchHistoryList — paginated completed-match history on /u/:slug.
// ----------------------------------------------------------------------------
// 20 rows per page; "Xem thêm" loads the next 20. Each row shows date,
// event link, partner name, opponents, score, win/loss icon. The parent
// owns the matches array + onLoadMore callback; this component is
// purely presentation.
// ============================================================================

import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export interface HistoryMatchRow {
  id: string;
  updated_at: string;
  event_slug: string;
  event_title: string;
  round: number;
  court: number;
  team_a_score: number | null;
  team_b_score: number | null;
  winning_team: "a" | "b" | null;
  /** Which team the profile owner played on for this match. */
  my_team: "a" | "b";
  partner_name: string;
  opponent1_name: string;
  opponent2_name: string;
}

interface Props {
  matches: HistoryMatchRow[];
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
}

function ResultIcon({ row }: { row: HistoryMatchRow }) {
  if (row.winning_team == null) {
    return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  }
  const won = row.winning_team === row.my_team;
  return won ? (
    <CheckCircle2 className="h-4 w-4 text-primary" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" />
  );
}

export function MatchHistoryList({ matches, hasMore, onLoadMore, loadingMore }: Props) {
  const { t, language } = useI18n();
  const profile = t.socialEvents.profile;

  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{profile.history.empty}</p>
    );
  }

  const dateLocale = language === "vi" ? "vi-VN" : "en-GB";

  return (
    <div className="space-y-2">
      {matches.map((m) => {
        const dateStr = new Date(m.updated_at).toLocaleDateString(dateLocale, {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        });
        const myScore = m.my_team === "a" ? m.team_a_score : m.team_b_score;
        const oppScore = m.my_team === "a" ? m.team_b_score : m.team_a_score;
        return (
          <div
            key={m.id}
            className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm sm:grid-cols-[80px_1fr_auto_auto]"
          >
            <div className="font-mono text-xs text-muted-foreground">{dateStr}</div>
            <div className="min-w-0">
              <Link
                to={`/social/${m.event_slug}`}
                className="block truncate font-medium hover:underline"
              >
                {m.event_title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {profile.history.partner}: {m.partner_name} ·{" "}
                {profile.history.vs} {m.opponent1_name} & {m.opponent2_name}
              </p>
            </div>
            <div className="font-mono text-sm font-semibold">
              {myScore ?? "—"} – {oppScore ?? "—"}
            </div>
            <ResultIcon row={m} />
          </div>
        );
      })}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? profile.history.loading : profile.history.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
