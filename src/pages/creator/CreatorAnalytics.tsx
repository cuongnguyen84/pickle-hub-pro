import { useState } from "react";
import { Link } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import {
  useAnalyticsSummary,
  useViewsOverTime,
  useTopContent,
  useViewsByType,
} from "@/hooks/useCreatorAnalytics";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Video,
  Radio,
  Users,
  TrendingUp,
  Calendar,
  Play,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";

type DateRange = 7 | 30;

export default function CreatorAnalytics() {
  const { t, language } = useI18n();
  const { organizationId } = useCreatorAuth();
  const [dateRange, setDateRange] = useState<DateRange>(7);

  const dateLocale = language === "vi" ? viLocale : enUS;

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(
    organizationId,
    dateRange
  );
  const { data: viewsOverTime, isLoading: chartLoading } = useViewsOverTime(
    organizationId,
    dateRange
  );
  const { data: topContent, isLoading: topLoading } = useTopContent(
    organizationId,
    dateRange
  );
  const { data: viewsByType } = useViewsByType(organizationId, dateRange);

  const pieData = [
    { name: "Video", value: viewsByType?.video || 0, color: "hsl(var(--primary))" },
    { name: "Livestream", value: viewsByType?.livestream || 0, color: "hsl(var(--destructive))" },
  ];

  const kpiCards = [
    {
      title: t.analytics.totalViews,
      value: summary?.total_views ?? 0,
      icon: Eye,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: t.analytics.totalLivestreams,
      value: summary?.total_livestreams ?? 0,
      icon: Radio,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      title: t.analytics.totalVideos,
      value: summary?.total_videos ?? 0,
      icon: Video,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: t.analytics.followers,
      value: summary?.followers_count ?? 0,
      icon: Users,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  const hasData = (summary?.total_views ?? 0) > 0 || (topContent?.length ?? 0) > 0;

  return (
    <CreatorLayout>
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              {t.analytics.title}
            </h1>
            <p className="text-foreground-secondary mt-1 text-sm lg:text-base">
              {t.analytics.description}
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="flex gap-2">
            <Button
              variant={dateRange === 7 ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(7)}
            >
              <Calendar className="w-4 h-4 mr-1" />
              7 {t.analytics.days}
            </Button>
            <Button
              variant={dateRange === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(30)}
            >
              <Calendar className="w-4 h-4 mr-1" />
              30 {t.analytics.days}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title} className="bg-surface border-border-subtle">
              <CardContent className="p-4 lg:p-6">
                {summaryLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs lg:text-sm text-foreground-secondary">
                        {kpi.title}
                      </p>
                      <p className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
                        {kpi.value.toLocaleString()}
                      </p>
                    </div>
                    <div className={`p-2 lg:p-3 rounded-lg ${kpi.bg}`}>
                      <kpi.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${kpi.color}`} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {!hasData && !summaryLoading ? (
          /* Empty State */
          <Card className="bg-surface border-border-subtle">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-foreground-muted" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t.analytics.noData}
              </h3>
              <p className="text-foreground-secondary mb-6 max-w-md mx-auto">
                {t.analytics.noDataDesc}
              </p>
              <div className="flex justify-center gap-3">
                <Button asChild>
                  <Link to="/creator/livestreams/new">
                    <Radio className="w-4 h-4 mr-2" />
                    {t.creator.createLive}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/creator/videos/new">
                    <Video className="w-4 h-4 mr-2" />
                    {t.creator.upload}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Views Chart */}
            <Card className="bg-surface border-border-subtle">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  {t.analytics.viewsOverTime}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : viewsOverTime && viewsOverTime.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={viewsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--foreground-secondary))"
                        fontSize={12}
                        tickFormatter={(value) =>
                          format(parseISO(value), "dd/MM", { locale: dateLocale })
                        }
                      />
                      <YAxis
                        stroke="hsl(var(--foreground-secondary))"
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--surface))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        labelFormatter={(value) =>
                          format(parseISO(value as string), "dd MMM yyyy", {
                            locale: dateLocale,
                          })
                        }
                        formatter={(value: number) => [value, t.analytics.views]}
                      />
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-foreground-secondary">
                    {t.analytics.noViewData}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bottom Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top Content */}
              <Card className="bg-surface border-border-subtle">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Play className="w-5 h-5 text-accent" />
                    {t.analytics.topContent}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : topContent && topContent.length > 0 ? (
                    <div className="space-y-3">
                      {topContent.map((content, index) => (
                        <Link
                          key={content.id}
                          to={
                            content.content_type === "video"
                              ? `/watch/${content.id}`
                              : `/live/${content.id}`
                          }
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <span className="text-lg font-bold text-foreground-muted w-6">
                            {index + 1}
                          </span>
                          <div className="w-16 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                            {content.thumbnail_url ? (
                              <img
                                src={content.thumbnail_url}
                                alt={content.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {content.content_type === "video" ? (
                                  <Video className="w-5 h-5 text-foreground-muted" />
                                ) : (
                                  <Radio className="w-5 h-5 text-foreground-muted" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {content.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant={
                                  content.content_type === "livestream"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {content.content_type === "livestream"
                                  ? t.analytics.livestream
                                  : t.analytics.video}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {content.view_count.toLocaleString()}
                            </p>
                            <p className="text-xs text-foreground-secondary">
                              {t.analytics.views}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-foreground-secondary py-8">
                      {t.analytics.noContent}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Views by Type */}
              <Card className="bg-surface border-border-subtle">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="w-5 h-5 text-primary" />
                    {t.analytics.viewsByType}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewsByType && (viewsByType.video > 0 || viewsByType.livestream > 0) ? (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--surface))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: number) => [
                              value.toLocaleString(),
                              t.analytics.views,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex gap-6 mt-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                          <span className="text-sm text-foreground-secondary">
                            Video: {viewsByType.video.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-destructive" />
                          <span className="text-sm text-foreground-secondary">
                            Livestream: {viewsByType.livestream.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-foreground-secondary">
                      {t.analytics.noViewData}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </CreatorLayout>
  );
}
