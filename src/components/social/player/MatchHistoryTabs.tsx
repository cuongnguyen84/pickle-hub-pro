import { Loader2 } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MatchRow } from "./MatchRow";
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

export function MatchHistoryTabs({
  playerId,
  followersCount,
  followingCount,
  matchesQuery,
}: MatchHistoryTabsProps) {
  return (
    <section>
      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="matches">Trận đấu</TabsTrigger>
          <TabsTrigger value="clips">Clip</TabsTrigger>
          <TabsTrigger value="tournaments">Giải</TabsTrigger>
          <TabsTrigger value="follows">Theo dõi</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-4">
          <MatchesList playerId={playerId} matchesQuery={matchesQuery} />
        </TabsContent>

        <TabsContent value="clips" className="mt-4">
          <Placeholder text="Sắp ra mắt — clip highlight per trận đấu (Sprint 4)." />
        </TabsContent>

        <TabsContent value="tournaments" className="mt-4">
          <Placeholder text="Sắp ra mắt — lịch sử giải đấu đã tham gia (Sprint 4)." />
        </TabsContent>

        <TabsContent value="follows" className="mt-4">
          <FollowsTab
            followersCount={followersCount}
            followingCount={followingCount}
          />
        </TabsContent>
      </Tabs>
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
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    matchesQuery;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allMatches = data?.pages.flat() ?? [];
  if (allMatches.length === 0) {
    return (
      <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
        Chưa có trận đấu nào.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {allMatches.map((m) => (
        <MatchRow key={m.match_id} match={m} viewerPlayerId={playerId} />
      ))}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Xem thêm
          </Button>
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
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <div className="text-2xl font-semibold">{followersCount}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Người theo dõi
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <div className="text-2xl font-semibold">{followingCount}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Đang theo dõi
        </div>
      </div>
      <div className="col-span-2 mt-2 rounded-md bg-muted p-3 text-center text-xs text-muted-foreground">
        Danh sách người theo dõi sẽ hiển thị ở Phase 3C.
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
