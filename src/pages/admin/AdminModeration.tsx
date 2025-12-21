import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useModerationVideos,
  useModerationLivestreams,
  useUpdateVideoStatus,
  useUpdateLivestreamStatus,
  useAdminOrganizations,
  useAdminTournaments,
} from "@/hooks/useAdminData";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, Radio, Eye, EyeOff, StopCircle, Shield } from "lucide-react";
import { format } from "date-fns";

export default function AdminModeration() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");

  const filters = {
    organizationId: orgFilter !== "all" ? orgFilter : undefined,
    tournamentId: tournamentFilter !== "all" ? tournamentFilter : undefined,
  };

  const { data: videos, isLoading: videosLoading } = useModerationVideos(filters);
  const { data: livestreams, isLoading: livestreamsLoading } = useModerationLivestreams(filters);
  const { data: organizations } = useAdminOrganizations();
  const { data: tournaments } = useAdminTournaments();
  const updateVideoStatus = useUpdateVideoStatus();
  const updateLivestreamStatus = useUpdateLivestreamStatus();

  const handleToggleVideoStatus = async (videoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "published" ? "hidden" : "published";
    try {
      await updateVideoStatus.mutateAsync({ id: videoId, status: newStatus });
      toast({ title: newStatus === "hidden" ? "Đã ẩn video" : "Đã hiển thị video" });
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Có lỗi xảy ra" });
    }
  };

  const handleEndLivestream = async (livestreamId: string) => {
    try {
      await updateLivestreamStatus.mutateAsync({ id: livestreamId, status: "ended" });
      toast({ title: "Đã kết thúc livestream" });
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Có lỗi xảy ra" });
    }
  };

  const getVideoStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Đã xuất bản</Badge>;
      case "hidden":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Đã ẩn</Badge>;
      default:
        return <Badge variant="secondary">Bản nháp</Badge>;
    }
  };

  const getLivestreamStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-live/10 text-live border-live/20">
            <span className="w-1.5 h-1.5 rounded-full bg-live mr-1.5 animate-pulse" />
            Đang phát
          </Badge>
        );
      case "ended":
        return <Badge variant="secondary">Đã kết thúc</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Đã lên lịch</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.admin.moderation.title}</h1>
          <p className="text-foreground-muted mt-1">Kiểm duyệt video và livestream</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tổ chức" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả tổ chức</SelectItem>
                {organizations?.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={tournamentFilter} onValueChange={setTournamentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Giải đấu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả giải đấu</SelectItem>
                {tournaments?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="videos" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="videos" className="gap-2">
              <Video className="w-4 h-4" />
              Video ({videos?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="livestreams" className="gap-2">
              <Radio className="w-4 h-4" />
              Livestream ({livestreams?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Videos Tab */}
          <TabsContent value="videos" className="space-y-4">
            {videosLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : videos && videos.length > 0 ? (
              <div className="space-y-4">
                {videos.map((video: any) => (
                  <Card key={video.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-6 h-6 text-foreground-muted" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{video.title}</h3>
                            {getVideoStatusBadge(video.status)}
                          </div>
                          <p className="text-sm text-foreground-muted">
                            {video.organizations?.name}
                            {video.tournaments?.name && ` • ${video.tournaments.name}`}
                          </p>
                          <p className="text-sm text-foreground-muted">
                            {video.created_at && format(new Date(video.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleVideoStatus(video.id, video.status)}
                          disabled={updateVideoStatus.isPending}
                        >
                          {video.status === "published" ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              {t.admin.moderation.hide}
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Hiện
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Video className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
                  <p className="text-foreground-muted">Không có video nào</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Livestreams Tab */}
          <TabsContent value="livestreams" className="space-y-4">
            {livestreamsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : livestreams && livestreams.length > 0 ? (
              <div className="space-y-4">
                {livestreams.map((stream: any) => (
                  <Card key={stream.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {stream.thumbnail_url ? (
                            <img
                              src={stream.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Radio className="w-6 h-6 text-foreground-muted" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{stream.title}</h3>
                            {getLivestreamStatusBadge(stream.status)}
                          </div>
                          <p className="text-sm text-foreground-muted">
                            {stream.organizations?.name}
                            {stream.tournaments?.name && ` • ${stream.tournaments.name}`}
                          </p>
                          <p className="text-sm text-foreground-muted">
                            {stream.created_at && format(new Date(stream.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                        {stream.status === "live" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleEndLivestream(stream.id)}
                            disabled={updateLivestreamStatus.isPending}
                          >
                            <StopCircle className="w-4 h-4 mr-2" />
                            Kết thúc
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Radio className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
                  <p className="text-foreground-muted">Không có livestream nào</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
