import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminStats, useRecentLivestreams, useRecentVideos } from "@/hooks/useAdminData";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Video, Radio, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function AdminOverview() {
  const { t } = useI18n();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: liveStreams, isLoading: liveLoading } = useRecentLivestreams(5);
  const { data: recentVideos, isLoading: videosLoading } = useRecentVideos(5);

  const statCards = [
    {
      title: t.admin.stats.totalOrganizations,
      value: stats?.totalOrganizations ?? 0,
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: t.admin.stats.totalVideos,
      value: stats?.totalPublishedVideos ?? 0,
      icon: Video,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: t.admin.stats.totalLivestreams,
      value: stats?.totalLiveStreams ?? 0,
      icon: Radio,
      color: "text-live",
      bgColor: "bg-live/10",
    },
    {
      title: "Lượt xem 7 ngày",
      value: stats?.weeklyViews ?? 0,
      icon: Eye,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">{t.admin.overview}</h1>
          <p className="text-foreground-muted mt-1">Tổng quan hệ thống Pickleball Hub</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="bg-card border-border">
              <CardContent className="p-6">
                {statsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <>
                    <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center mb-3`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <p className="text-3xl font-semibold">{stat.value.toLocaleString()}</p>
                    <p className="text-sm text-foreground-muted mt-1">{stat.title}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Streams */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radio className="w-5 h-5 text-live" />
                Đang phát trực tiếp
              </CardTitle>
            </CardHeader>
            <CardContent>
              {liveLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : liveStreams && liveStreams.length > 0 ? (
                <div className="space-y-3">
                  {liveStreams.map((stream: any) => (
                    <div
                      key={stream.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-background-surface"
                    >
                      <div className="w-2 h-2 rounded-full bg-live animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{stream.title}</p>
                        <p className="text-sm text-foreground-muted">
                          {stream.organizations?.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-foreground-muted text-center py-8">
                  Không có livestream nào đang phát
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Videos */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="w-5 h-5 text-green-500" />
                Video mới nhất
              </CardTitle>
            </CardHeader>
            <CardContent>
              {videosLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentVideos && recentVideos.length > 0 ? (
                <div className="space-y-3">
                  {recentVideos.map((video: any) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-background-surface"
                    >
                      <div className="w-12 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                        {video.thumbnail_url && (
                          <img
                            src={video.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{video.title}</p>
                        <p className="text-sm text-foreground-muted">
                          {video.organizations?.name} •{" "}
                          {video.published_at && format(new Date(video.published_at), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-foreground-muted text-center py-8">Chưa có video nào</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
