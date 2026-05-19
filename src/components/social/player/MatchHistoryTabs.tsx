import { useState } from "react";
import { Loader2 } from "lucide-react";
import { MatchRow } from "./MatchRow";
import { useI18n } from "@/i18n";
import type { UseInfiniteQueryResult, InfiniteData } from "@tanstack/react-query";
import type { PlayerMatchHistoryRow } from "@/hooks/social/usePlayerMatchHistory";

interface MatchHistoryTabsProps {
  playerId: string;
  followersCount: number;
  followingCount: number;
  matchesQuery: UseInfiniteQueryResult<
    InfiniteData<PlayerMatchHistoryRow[]>,
    Error
  >;
}

type Tab = "matches" | "clips" | "tournaments" | "follows";

const TAB_LABELS_VI: { key: Tab; label: string }[] = [
  { key: "matches", label: "TRẬN ĐẤU" },
  { key: "clips", label: "CLIP" },
  { key: "tournaments", label: "GIẢI" },
  { key: "follows", label: "THEO DÕI" },
];
const TAB_LABELS_EN: { key: Tab; label: string }[] = [
  { key: "matches", label: "MATCHES" },
  { key: "clips", label: "CLIPS" },
  { key: "tournaments", label: "TOURNAMENTS" },
  { key: "follows", label: "FOLLOWS" },
];

/**
 * Editorial tabs — minimal underline indicator, no background fill, mono
 * caps labels. Replaces the shadcn Tabs primitive (which used pill-style
 * fill that fought TheLine theme).
 */
export function MatchHistoryTabs({
  playerId,
  followersCount,
  followingCount,
  matchesQuery,
}: MatchHistoryTabsProps) {
  const { language } = useI18n();
  const [tab, setTab] = useState<Tab>("matches");
  const TAB_LABELS = language === "vi" ? TAB_LABELS_VI : TAB_LABELS_EN;

  return (
    <section
      style={{
        padding: "32px 0",
        borderTop: "1px solid var(--tl-border)",
      }}
    >
      <div className="tl-eyebrow" aria-hidden="true">
        <span className="pip" />
        <span>{language === "vi" ? "HOẠT ĐỘNG" : "ACTIVITY"}</span>
      </div>

      <nav
        role="tablist"
        style={{
          display: "flex",
          gap: 24,
          borderBottom: "1px solid var(--tl-border)",
          marginBottom: 16,
        }}
      >
        {TAB_LABELS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active ? "var(--tl-fg)" : "var(--tl-fg-3)",
                background: "transparent",
                border: "none",
                padding: "12px 0",
                borderBottom: active
                  ? "2px solid var(--tl-green)"
                  : "2px solid transparent",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "matches" && (
        <MatchesList playerId={playerId} matchesQuery={matchesQuery} />
      )}
      {tab === "clips" && (
        <Placeholder
          text={
            language === "vi"
              ? "Sắp ra mắt — clip highlight per trận đấu (Sprint 4)."
              : "Coming soon — match highlight clips (Sprint 4)."
          }
        />
      )}
      {tab === "tournaments" && (
        <Placeholder
          text={
            language === "vi"
              ? "Sắp ra mắt — lịch sử giải đấu đã tham gia (Sprint 4)."
              : "Coming soon — tournaments played history (Sprint 4)."
          }
        />
      )}
      {tab === "follows" && (
        <FollowsTab
          followersCount={followersCount}
          followingCount={followingCount}
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
          <button
            type="button"
            className="tl-btn"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {language === "vi" ? "Xem thêm" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

interface FollowsTabProps {
  followersCount: number;
  followingCount: number;
}
function FollowsTab({ followersCount, followingCount }: FollowsTabProps) {
  const { language } = useI18n();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        padding: "16px 0",
      }}
    >
      <FollowStatCell
        label={language === "vi" ? "NGƯỜI THEO DÕI" : "FOLLOWERS"}
        value={followersCount}
      />
      <FollowStatCell
        label={language === "vi" ? "ĐANG THEO DÕI" : "FOLLOWING"}
        value={followingCount}
      />
      <p
        style={{
          gridColumn: "1 / -1",
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 16,
          color: "var(--tl-fg-3)",
          margin: 0,
        }}
      >
        {language === "vi"
          ? "Danh sách người theo dõi sẽ hiển thị ở Phase 3C."
          : "Followers list will be available in Phase 3C."}
      </p>
    </div>
  );
}

function FollowStatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--tl-fg-3)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 36,
          color: "var(--tl-fg)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
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
