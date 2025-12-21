import { Link } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import {
  useCreatorStats,
  useCreatorRecentVideos,
  useCreatorRecentLivestreams,
} from "@/hooks/useCreatorData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  FileText,
  Radio,
  Eye,
  Plus,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

export default function CreatorOverview() {
  const { organizationId } = useCreatorAuth();
  const { data: stats, isLoading: statsLoading } = useCreatorStats(organizationId);
  const { data: recentVideos, isLoading: videosLoading } = useCreatorRecentVideos(organizationId);
  const { data: recentLivestreams, isLoading: livestreamsLoading } = useCreatorRecentLivestreams(organizationId);

  const statCards = [
    {
      title: "Videos Published",
      value: stats?.videosPublished ?? 0,
      icon: Video,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Videos Draft",
      value: stats?.videosDraft ?? 0,
      icon: FileText,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      title: "Scheduled Streams",
      value: stats?.scheduledStreams ?? 0,
      icon: Radio,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "Live Now",
      value: stats?.liveStreams ?? 0,
      icon: Radio,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      title: "Views (7 days)",
      value: stats?.weeklyViews ?? 0,
      icon: Eye,
      color: "text-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <CreatorLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Creator Dashboard</h1>
            <p className="text-foreground-secondary mt-1">
              Manage your videos and livestreams
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/creator/videos/new">
                <Plus className="w-4 h-4 mr-2" />
                New Video
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/creator/livestreams/new">
                <Plus className="w-4 h-4 mr-2" />
                New Livestream
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-surface border-border-subtle">
              <CardContent className="p-4">
                {statsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-foreground-secondary">{stat.title}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Videos */}
          <Card className="bg-surface border-border-subtle">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Videos</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/creator/videos">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {videosLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentVideos && recentVideos.length > 0 ? (
                <div className="space-y-3">
                  {recentVideos.map((video) => (
                    <Link
                      key={video.id}
                      to={`/creator/videos/${video.id}/edit`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="w-16 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="w-5 h-5 text-foreground-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {video.title}
                        </p>
                        <p className="text-xs text-foreground-secondary">
                          {format(new Date(video.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge
                        variant={video.status === "published" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {video.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-foreground-secondary py-8">
                  No videos yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Livestreams */}
          <Card className="bg-surface border-border-subtle">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Livestreams</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/creator/livestreams">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {livestreamsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentLivestreams && recentLivestreams.length > 0 ? (
                <div className="space-y-3">
                  {recentLivestreams.map((stream) => (
                    <Link
                      key={stream.id}
                      to={`/creator/livestreams/${stream.id}/edit`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="w-16 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {stream.thumbnail_url ? (
                          <img
                            src={stream.thumbnail_url}
                            alt={stream.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Radio className="w-5 h-5 text-foreground-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {stream.title}
                        </p>
                        <p className="text-xs text-foreground-secondary">
                          {stream.scheduled_start_at
                            ? format(new Date(stream.scheduled_start_at), "MMM d, yyyy HH:mm")
                            : format(new Date(stream.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge
                        variant={
                          stream.status === "live"
                            ? "destructive"
                            : stream.status === "scheduled"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {stream.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-foreground-secondary py-8">
                  No livestreams yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CreatorLayout>
  );
}
