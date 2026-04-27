import { useState, useMemo } from "react";
import { useTopBlogPosts } from "@/hooks/useTopBlogPosts";
import { useQuery } from "@tanstack/react-query";
import { subDays, format, eachDayOfInterval, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Eye,
  TrendingUp,
  Wifi,
  Video,
  Trophy,
  Radio,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

interface UserStats {
  new_users: number;
  total_users: number;
  active_users: number;
}

interface ContentStats {
  tournaments: number;
  livestreams: number;
  videos: number;
  forum_posts: number;
}

interface EngagementStats {
  total_views: number;
  unique_viewers: number;
  video_views: number;
  livestream_views: number;
}

interface DailyRow {
  day: string;
  count: number;
}

interface TopContentRow {
  target_id: string;
  target_type: string;
  view_count: number;
}

// ─── Date range presets ─────────────────────────────────────────────────────

const PRESETS = [
  { label: "7 ngày", days: 7 },
  { label: "30 ngày", days: 30 },
  { label: "90 ngày", days: 90 },
] as const;

// ─── Metric card ───────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  accent?: string;
}

function MetricCard({ title, value, icon, loading, accent = "text-primary" }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">
                {value?.toLocaleString("vi-VN") ?? "—"}
              </p>
            )}
          </div>
          <div className={cn("mt-0.5 opacity-80", accent)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Online now badge ───────────────────────────────────────────────────────

function OnlineNow() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "online-now"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_online_now");
      if (error) throw error;
      return data as number;
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="font-medium">{data ?? 0} online ngay bây giờ</span>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [days, setDays] = useState(7);

  const { startDate, endDate, startISO, endISO } = useMemo(() => {
    const end = new Date();
    const start = subDays(end, days - 1);
    return {
      startDate: start,
      endDate: end,
      startISO: format(start, "yyyy-MM-dd"),
      endISO: format(end, "yyyy-MM-dd"),
    };
  }, [days]);

  // User stats
  const { data: userStats, isLoading: loadingUsers, refetch: refetchUsers } = useQuery<UserStats>({
    queryKey: ["admin", "user-stats", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_stats", {
        p_start: startISO,
        p_end: endISO,
      });
      if (error) throw error;
      return data as UserStats;
    },
    refetchInterval: 30_000,
  });

  // Content stats
  const { data: contentStats, isLoading: loadingContent } = useQuery<ContentStats>({
    queryKey: ["admin", "content-stats", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_content_stats", {
        p_start: startISO,
        p_end: endISO,
      });
      if (error) throw error;
      return data as ContentStats;
    },
    refetchInterval: 30_000,
  });

  // Engagement stats
  const { data: engagementStats, isLoading: loadingEngagement } = useQuery<EngagementStats>({
    queryKey: ["admin", "engagement-stats", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_engagement_stats", {
        p_start: startISO,
        p_end: endISO,
      });
      if (error) throw error;
      return data as EngagementStats;
    },
    refetchInterval: 30_000,
  });

  // Daily new users for chart
  const { data: dailyRaw, isLoading: loadingDaily } = useQuery<DailyRow[]>({
    queryKey: ["admin", "daily-users", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_new_users_daily", {
        p_start: startISO,
        p_end: endISO,
      });
      if (error) throw error;
      return data as DailyRow[];
    },
    refetchInterval: 30_000,
  });

  // Fill gaps so every day appears in chart even if count=0
  const chartData = useMemo(() => {
    const map = new Map((dailyRaw ?? []).map((r) => [r.day.slice(0, 10), r.count]));
    return eachDayOfInterval({ start: startDate, end: endDate }).map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return {
        day: format(d, days <= 7 ? "EEE" : "dd/MM"),
        count: map.get(key) ?? 0,
      };
    });
  }, [dailyRaw, startDate, endDate, days]);

  // Top blog posts
  const { data: topBlogPosts, isLoading: loadingTopBlog } = useTopBlogPosts(days);

  // Top content
  const { data: topContent, isLoading: loadingTop } = useQuery<TopContentRow[]>({
    queryKey: ["admin", "top-content", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_content", {
        p_start: startISO,
        p_end: endISO,
      });
      if (error) throw error;
      return data as TopContentRow[];
    },
    refetchInterval: 30_000,
  });

  const handleRefresh = () => {
    refetchUsers();
  };

  const typeLabel: Record<string, string> = {
    video: "Video",
    livestream: "Livestream",
    tournament: "Giải đấu",
  };

  const typeIcon: Record<string, React.ReactNode> = {
    video: <Video className="w-3.5 h-3.5" />,
    livestream: <Radio className="w-3.5 h-3.5" />,
    tournament: <Trophy className="w-3.5 h-3.5" />,
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dữ liệu thống kê platform
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <OnlineNow />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="h-8 w-8 ml-1"
              title="Làm mới"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Date range presets */}
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.days}
              variant={days === p.days ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(p.days)}
              className="h-7 text-xs px-3"
            >
              {p.label}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground self-center ml-1">
            {format(startDate, "dd/MM")} – {format(endDate, "dd/MM/yyyy")}
          </span>
        </div>

        {/* Users section */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Người dùng
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              title="Mới trong kỳ"
              value={userStats?.new_users}
              icon={<Users className="w-5 h-5" />}
              loading={loadingUsers}
              accent="text-blue-500"
            />
            <MetricCard
              title="Tổng users"
              value={userStats?.total_users}
              icon={<Users className="w-5 h-5" />}
              loading={loadingUsers}
              accent="text-indigo-500"
            />
            <MetricCard
              title="Active (xem nội dung)"
              value={userStats?.active_users}
              icon={<TrendingUp className="w-5 h-5" />}
              loading={loadingUsers}
              accent="text-violet-500"
            />
          </div>
        </section>

        {/* Daily new users chart */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium">
              Người dùng mới theo ngày
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loadingDaily ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(v: number) => [v, "users mới"]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Content section */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Nội dung tạo trong kỳ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              title="Giải đấu"
              value={contentStats?.tournaments}
              icon={<Trophy className="w-5 h-5" />}
              loading={loadingContent}
              accent="text-yellow-500"
            />
            <MetricCard
              title="Livestream"
              value={contentStats?.livestreams}
              icon={<Radio className="w-5 h-5" />}
              loading={loadingContent}
              accent="text-red-500"
            />
            <MetricCard
              title="Video"
              value={contentStats?.videos}
              icon={<Video className="w-5 h-5" />}
              loading={loadingContent}
              accent="text-orange-500"
            />
            <MetricCard
              title="Bài forum"
              value={contentStats?.forum_posts}
              icon={<MessageSquare className="w-5 h-5" />}
              loading={loadingContent}
              accent="text-teal-500"
            />
          </div>
        </section>

        {/* Engagement section */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Engagement
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              title="Tổng lượt xem"
              value={engagementStats?.total_views}
              icon={<Eye className="w-5 h-5" />}
              loading={loadingEngagement}
              accent="text-cyan-500"
            />
            <MetricCard
              title="Người xem unique"
              value={engagementStats?.unique_viewers}
              icon={<Users className="w-5 h-5" />}
              loading={loadingEngagement}
              accent="text-sky-500"
            />
            <MetricCard
              title="Lượt xem video"
              value={engagementStats?.video_views}
              icon={<Video className="w-5 h-5" />}
              loading={loadingEngagement}
              accent="text-orange-400"
            />
            <MetricCard
              title="Lượt xem live"
              value={engagementStats?.livestream_views}
              icon={<Radio className="w-5 h-5" />}
              loading={loadingEngagement}
              accent="text-rose-400"
            />
          </div>
        </section>

        {/* Top content table */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium">
              Nội dung xem nhiều nhất
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {loadingTop ? (
              <div className="px-5 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : !topContent || topContent.length === 0 ? (
              <p className="text-sm text-muted-foreground px-5 py-4 text-center">
                Chưa có dữ liệu trong kỳ này
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left text-xs text-muted-foreground font-medium px-5 py-2">#</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2">Loại</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2">ID</th>
                      <th className="text-right text-xs text-muted-foreground font-medium px-5 py-2">Lượt xem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topContent.map((row, idx) => (
                      <tr key={row.target_id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-2.5 text-muted-foreground tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded px-2 py-0.5">
                            {typeIcon[row.target_type] ?? <Eye className="w-3.5 h-3.5" />}
                            {typeLabel[row.target_type] ?? row.target_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground max-w-[160px] truncate">
                          {row.target_id}
                        </td>
                        <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                          {row.view_count.toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top blog posts table */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium">
              Bài blog xem nhiều nhất
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {loadingTopBlog ? (
              <div className="px-5 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : !topBlogPosts || topBlogPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground px-5 py-4 text-center">
                Chưa có dữ liệu trong kỳ này
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left text-xs text-muted-foreground font-medium px-5 py-2">#</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2">Lang</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2">Slug</th>
                      <th className="text-right text-xs text-muted-foreground font-medium px-3 py-2">Lượt xem</th>
                      <th className="text-right text-xs text-muted-foreground font-medium px-5 py-2">Unique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBlogPosts.map((row, idx) => (
                      <tr key={`${row.lang}-${row.slug}`} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-2.5 text-muted-foreground tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 uppercase font-medium">
                            {row.lang}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground max-w-[220px] truncate">
                          {row.slug}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                          {Number(row.total_views).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                          {Number(row.unique_viewers).toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground pb-4">
          Tự động làm mới mỗi 30 giây · Lần cuối: {format(new Date(), "HH:mm:ss")}
        </p>
      </div>
    </AdminLayout>
  );
}
