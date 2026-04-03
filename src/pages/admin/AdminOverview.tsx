import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminStats, useRecentLivestreams, useRecentVideos } from "@/hooks/useAdminData";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Video, Radio, Eye, Settings, Globe, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useSystemSettings, useUpdateSystemSetting } from "@/hooks/useSystemSettings";
import { useToast } from "@/hooks/use-toast";

export default function AdminOverview() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: liveStreams, isLoading: liveLoading } = useRecentLivestreams(5);
  const { data: recentVideos, isLoading: videosLoading } = useRecentVideos(5);
  const { data: settings, isLoading: settingsLoading } = useSystemSettings();
  const updateSetting = useUpdateSystemSetting();

  const handleSettingChange = (key: string, value: any) => {
    updateSetting.mutate({ key, value }, {
      onSuccess: () => toast({ title: t.admin.settings.savedSuccess }),
    });
  };

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
          <p className="text-foreground-muted mt-1">Tổng quan hệ thống The Pickle Hub</p>
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

        {/* System Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-primary" />
              {t.admin.settings.livestreamGate}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {settingsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                {/* Toggle require login */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t.admin.settings.requireLogin}</Label>
                    <p className="text-xs text-foreground-muted">{t.admin.settings.requireLoginDesc}</p>
                  </div>
                  <Switch
                    checked={settings?.require_login_livestream ?? true}
                    onCheckedChange={(checked) => handleSettingChange("require_login_livestream", checked)}
                  />
                </div>

                {/* Preview duration */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t.admin.settings.previewDuration}</Label>
                  <p className="text-xs text-foreground-muted">{t.admin.settings.previewDurationDesc}</p>
                  <Select
                    value={String(settings?.livestream_preview_seconds ?? 30)}
                    onValueChange={(val) => handleSettingChange("livestream_preview_seconds", Number(val))}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15s</SelectItem>
                      <SelectItem value="30">30s</SelectItem>
                      <SelectItem value="60">60s</SelectItem>
                      <SelectItem value="120">120s</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Applies to */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t.admin.settings.appliesTo}</Label>
                  <Select
                    value={settings?.livestream_gate_applies_to ?? "all"}
                    onValueChange={(val) => handleSettingChange("livestream_gate_applies_to", val)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.admin.settings.appliesToAll}</SelectItem>
                      <SelectItem value="live">{t.admin.settings.appliesToLive}</SelectItem>
                      <SelectItem value="replay">{t.admin.settings.appliesToReplay}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Geo Blocking Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-primary" />
              {t.admin.settings.geoBlock}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {settingsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                {/* Toggle geo blocking */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t.admin.settings.geoBlockEnabled}</Label>
                    <p className="text-xs text-foreground-muted">{t.admin.settings.geoBlockEnabledDesc}</p>
                  </div>
                  <Switch
                    checked={settings?.geo_block_enabled ?? true}
                    onCheckedChange={(checked) => handleSettingChange("geo_block_enabled", checked)}
                  />
                </div>

                {/* Blocked countries */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t.admin.settings.blockedCountries}</Label>
                  <p className="text-xs text-foreground-muted">{t.admin.settings.blockedCountriesDesc}</p>
                  <Input
                    value={(settings?.blocked_countries ?? ["US"]).join(", ")}
                    onChange={(e) => {
                      const countries = e.target.value
                        .split(",")
                        .map((c) => c.trim().toUpperCase())
                        .filter(Boolean);
                      handleSettingChange("blocked_countries", countries);
                    }}
                    placeholder="US, CA, GB"
                    className="w-[300px]"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
