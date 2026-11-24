import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchRow } from "./MatchRow";
import { ProfilePosts } from "./ProfilePosts";
import { useI18n } from "@/i18n";
import { useProfilePosts } from "@/hooks/social/useProfilePosts";
import type { UseInfiniteQueryResult, InfiniteData } from "@tanstack/react-query";
import type { PlayerMatchHistoryRow } from "@/hooks/social/usePlayerMatchHistory";
import type { Language } from "@/lib/social/feed-formatters";

type TabKey = "posts" | "matches" | "achievements" | "tournaments";

const LABELS: Record<TabKey, { vi: string; en: string }> = {
  posts: { vi: "Bài viết", en: "Posts" },
  matches: { vi: "Trận đấu", en: "Matches" },
  achievements: { vi: "Thành tích", en: "Achievements" },
  tournaments: { vi: "Giải đấu", en: "Tournaments" },
};

interface ProfileTabsProps {
  playerId: string;
  language: Language;
  isOwn?: boolean;
  /** Athlete data present (DUPR or played matches) - shows the
   *  Achievements tab and makes Matches the smart default. */
  hasAthlete: boolean;
  matchesQuery: UseInfiniteQueryResult<
    InfiniteData<PlayerMatchHistoryRow[]>,
    Error
  >;
  /** RatingCard + PlayerStats + DuprRatingChart, composed by the page. */
  achievements: ReactNode;
}

/**
 * Pill tab system for the profile page (2026-11-24 redesign PR-2):
 * Posts / Matches / Achievements / Tournaments. All athlete data from
 * the previous stacked layout lives on, moved into its tab; empty
 * tabs are hidden for sparse profiles; the default tab follows the
 * profile's role (athlete -> Matches, otherwise -> Posts).
 */
export function ProfileTabs({
  playerId,
  language,
  isOwn,
  hasAthlete,
  matchesQuery,
  achievements,
}: ProfileTabsProps) {
  const { language: uiLanguage } = useI18n();
  const postsQuery = useProfilePosts(playerId);
  const postsTotal = postsQuery.data?.total;
  const [picked, setPicked] = useState<TabKey | null>(null);

  const showPosts = isOwn || postsTotal === undefined || postsTotal > 0;
  const tabs: TabKey[] = [
    ...(showPosts ? (["posts"] as TabKey[]) : []),
    "matches",
    ...(hasAthlete ? (["achievements"] as TabKey[]) : []),
    "tournaments",
  ];
  const defaultTab: TabKey = hasAthlete
    ? "matches"
    : showPosts
      ? "posts"
      : "matches";
  const active: TabKey =
    picked && tabs.includes(picked) ? picked : defaultTab;

  return (
    <section style={{ padding: "28px 0 8px" }}>
      <nav
        role="tablist"
        aria-label={uiLanguage === "vi" ? "Nội dung hồ sơ" : "Profile content"}
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          gap: 4,
          padding: 4,
          border: "1px solid var(--tl-border)",
          borderRadius: 999,
          marginBottom: 20,
        }}
      >
        {tabs.map((key) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setPicked(key)}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                background: isActive ? "var(--tl-fg)" : "transparent",
                color: isActive ? "var(--tl-bg)" : "var(--tl-fg-3)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {LABELS[key][uiLanguage === "vi" ? "vi" : "en"]}
              {key === "posts" && postsTotal ? ` (${postsTotal})` : ""}
            </button>
          );
        })}
      </nav>

      {active === "posts" &&
        (postsTotal && postsTotal > 0 ? (
          <ProfilePosts userId={playerId} language={language} bare />
        ) : (
          <Placeholder
            text={
              uiLanguage === "vi"
                ? isOwn
                  ? "Bạn chưa có bài viết cộng đồng nào - đăng bài đầu tiên từ nút + ở feed nhé."
                  : "Chưa có bài viết cộng đồng nào."
                : isOwn
                  ? "No community posts yet - publish your first from the + button on the feed."
                  : "No community posts yet."
            }
          />
        ))}
      {active === "matches" && (
        <MatchesList playerId={playerId} matchesQuery={matchesQuery} />
      )}
      {active === "achievements" && <div>{achievements}</div>}
      {active === "tournaments" && (
        <Placeholder
          text={
            uiLanguage === "vi"
              ? "Sắp ra mắt - lịch sử giải đấu đã tham gia (Sprint 4)."
              : "Coming soon - tournaments played history (Sprint 4)."
          }
        />
      )}
    </section>
  );
}

interface MatchesListProps {
  playerId: string;
  matchesQuery: UseInfiniteQueryResult<
    InfiniteData<PlayerMatchHistoryRow[]>,
    Error
  >;
}

function MatchesList({ playerId, matchesQuery }: MatchesListProps) {
  const { language } = useI18n();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    matchesQuery;

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Loader2
          className="h-5 w-5 animate-spin"
          style={{ color: "var(--tl-fg-3)" }}
        />
      </div>
    );
  }

  const allMatches = data?.pages.flat() ?? [];
  if (allMatches.length === 0) {
    return (
      <p
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 18,
          color: "var(--tl-fg-3)",
          padding: "24px 0",
        }}
      >
        {language === "vi" ? "Chưa có trận đấu nào." : "No matches yet."}
      </p>
    );
  }

  return (
    <div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {allMatches.map((m, i) => (
          <li
            key={m.match_id}
            style={{
              borderTop: i === 0 ? "none" : "1px solid var(--tl-border)",
            }}
          >
            <MatchRow match={m} viewerPlayerId={playerId} />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {language === "vi" ? "Xem thêm" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <p
      style={{
        fontFamily: "'Instrument Serif', serif",
        fontStyle: "italic",
        fontSize: 18,
        color: "var(--tl-fg-3)",
        padding: "24px 0",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}
