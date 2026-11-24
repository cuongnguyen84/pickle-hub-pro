/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useModerationVideos,
  useModerationLivestreams,
  useUpdateVideoStatus,
  useUpdateLivestreamStatus,
  useUpdateLivestream,
  useDeleteLivestream,
  useAdminOrganizations,
  useAdminTournaments,
} from "@/hooks/useAdminData";
import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditLivestreamDialog } from "@/components/admin/EditLivestreamDialog";
import {
  useModerationPosts,
  useReportedPosts,
  useResolvePostReport,
  useUpdatePostStatus,
  type ModerationPost,
  type SocialPostStatus,
} from "@/hooks/usePostModeration";
import { SOCIAL_POST_TOPICS } from "@/hooks/social/useSocialPosts";
import { Video, Radio, Eye, EyeOff, StopCircle, Pencil, Trash2, Images, Check, X, Flag, CheckCircle, BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

export default function AdminModeration() {
  const { t } = useI18n();
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [editingLivestream, setEditingLivestream] = useState<any>(null);
  const [deletingLivestreamId, setDeletingLivestreamId] = useState<string | null>(null);

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
  const updateLivestream = useUpdateLivestream();
  const deleteLivestream = useDeleteLivestream();

  // Community photo posts (UGC PR-B): pending queue, reported posts and
  // decision history. Status changes go through the admin's own session -
  // RLS (social_posts_update_admin) plus the status-guard trigger are
  // what authorize them.
  const { data: pendingPosts, isLoading: pendingPostsLoading } = useModerationPosts("pending");
  const { data: historyPosts, isLoading: historyPostsLoading } = useModerationPosts("history");
  const { data: reportedPosts, isLoading: reportedPostsLoading } = useReportedPosts();
  const updatePostStatus = useUpdatePostStatus();
  const resolvePostReport = useResolvePostReport();

  const handlePostStatus = async (postId: string, status: SocialPostStatus) => {
    try {
      await updatePostStatus.mutateAsync({ id: postId, status });
      toast.success(
        status === "approved"
          ? "Đã duyệt bài"
          : status === "rejected"
            ? "Đã từ chối bài"
            : "Đã ẩn bài",
      );
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await resolvePostReport.mutateAsync(reportId);
      toast.success("Đã đánh dấu xử lý báo cáo");
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const getPostStatusBadge = (status: SocialPostStatus) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Đã duyệt</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Đã từ chối</Badge>;
      case "hidden":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Đã ẩn</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Chờ duyệt</Badge>;
    }
  };

  const topicLabel = (topic: string | null) =>
    SOCIAL_POST_TOPICS.find((t) => t.key === topic)?.vi ?? null;

  const renderPostActions = (post: ModerationPost) => (
    <div className="flex items-center gap-2 flex-shrink-0">
      {post.status !== "approved" && (
        <Button
          size="sm"
          onClick={() => handlePostStatus(post.id, "approved")}
          disabled={updatePostStatus.isPending}
        >
          <Check className="w-4 h-4 mr-2" />
          Duyệt
        </Button>
      )}
      {post.status === "pending" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePostStatus(post.id, "rejected")}
          disabled={updatePostStatus.isPending}
          className="text-destructive hover:text-destructive"
        >
          <X className="w-4 h-4 mr-2" />
          Từ chối
        </Button>
      )}
      {post.status !== "hidden" && post.status !== "rejected" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePostStatus(post.id, "hidden")}
          disabled={updatePostStatus.isPending}
        >
          <EyeOff className="w-4 h-4 mr-2" />
          Ẩn
        </Button>
      )}
    </div>
  );

  const renderPostCard = (post: ModerationPost) => (
    <Card key={post.id} className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-28 h-28 rounded-lg bg-muted overflow-hidden flex-shrink-0">
            <img
              src={post.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage
                    src={post.author_avatar_url ?? undefined}
                    alt={post.author_name}
                  />
                  <AvatarFallback className="text-[10px]">
                    {initials(post.author_name)}
                  </AvatarFallback>
                </Avatar>
                {post.author_username && post.author_profile_linkable ? (
                  <Link
                    to={`/nguoi-choi/${post.author_username}`}
                    className="font-medium hover:underline inline-flex items-center gap-1.5"
                  >
                    {post.author_name}
                    {post.author_is_verified && (
                      <BadgeCheck className="h-4 w-4 text-green-500" aria-label="Đã xác thực" />
                    )}
                  </Link>
                ) : (
                  <h3 className="font-medium inline-flex items-center gap-1.5">
                    {post.author_name}
                    {post.author_is_verified && (
                      <BadgeCheck className="h-4 w-4 text-green-500" aria-label="Đã xác thực" />
                    )}
                  </h3>
                )}
              </span>
              {getPostStatusBadge(post.status)}
              {topicLabel(post.topic) && (
                <Badge variant="secondary">{topicLabel(post.topic)}</Badge>
              )}
              {post.report_count > 0 && (
                <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                  <Flag className="w-3 h-3 mr-1" />
                  {post.report_count} báo cáo
                </Badge>
              )}
            </div>
            {post.body && (
              <p className="text-sm mt-1 whitespace-pre-wrap">{post.body}</p>
            )}
            <p className="text-sm text-foreground-muted mt-1">
              {format(new Date(post.created_at), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
          {renderPostActions(post)}
        </div>
      </CardContent>
    </Card>
  );

  const handleToggleVideoStatus = async (videoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "published" ? "hidden" : "published";
    try {
      await updateVideoStatus.mutateAsync({ id: videoId, status: newStatus });
      toast.success(newStatus === "hidden" ? "Đã ẩn video" : "Đã hiển thị video");
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const handleEndLivestream = async (livestreamId: string) => {
    try {
      await updateLivestreamStatus.mutateAsync({ id: livestreamId, status: "ended" });
      toast.success("Đã kết thúc livestream");
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const handleSaveLivestream = async (data: { id: string; title: string; description: string; thumbnail_url: string; tournament_id: string | null }) => {
    try {
      await updateLivestream.mutateAsync(data);
      toast.success("Đã cập nhật livestream");
      setEditingLivestream(null);
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const handleDeleteLivestream = async () => {
    if (!deletingLivestreamId) return;
    try {
      await deleteLivestream.mutateAsync(deletingLivestreamId);
      toast.success("Đã xóa livestream");
      setDeletingLivestreamId(null);
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
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
          <p className="text-foreground-muted mt-1">Kiểm duyệt video, livestream và bài người dùng</p>
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
            <TabsTrigger value="posts" className="gap-2">
              <Images className="w-4 h-4" />
              Bài người dùng ({pendingPosts?.length || 0})
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
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingLivestream(stream)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingLivestreamId(stream.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

          {/* Community posts Tab (UGC PR-B) */}
          <TabsContent value="posts" className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Chờ duyệt</h3>
              {pendingPostsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : pendingPosts && pendingPosts.length > 0 ? (
                <div className="space-y-4">
                  {pendingPosts.map((post) => renderPostCard(post))}
                </div>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <Images className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
                    <p className="text-foreground-muted">Không có bài nào đang chờ duyệt</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-semibold">Bị báo cáo</h3>
              {reportedPostsLoading ? (
                <div className="space-y-4">
                  {[1].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : reportedPosts && reportedPosts.length > 0 ? (
                <div className="space-y-4">
                  {reportedPosts.map((report) => (
                    <div key={report.id} className="space-y-2">
                      {report.post ? (
                        renderPostCard(report.post)
                      ) : (
                        <Card className="bg-card border-border">
                          <CardContent className="p-4">
                            <p className="text-sm text-foreground-muted">Bài không còn tồn tại</p>
                          </CardContent>
                        </Card>
                      )}
                      <div className="flex items-center gap-2 flex-wrap px-1">
                        <span className="text-sm text-foreground-muted inline-flex items-center gap-1.5">
                          <Flag className="w-3.5 h-3.5" />
                          Lý do: {report.reason} • {format(new Date(report.created_at), "dd/MM/yyyy HH:mm")}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveReport(report.id)}
                          disabled={resolvePostReport.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Đã xử lý báo cáo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <Flag className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
                    <p className="text-foreground-muted">Không có bài nào bị báo cáo</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-semibold">Lịch sử duyệt</h3>
              {historyPostsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : historyPosts && historyPosts.length > 0 ? (
                <div className="space-y-4">
                  {historyPosts.map((post) => renderPostCard(post))}
                </div>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
                    <p className="text-foreground-muted">Chưa có bài nào được xử lý</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Livestream Dialog */}
      <EditLivestreamDialog
        open={!!editingLivestream}
        onOpenChange={(open) => !open && setEditingLivestream(null)}
        livestream={editingLivestream}
        tournaments={tournaments || []}
        onSave={handleSaveLivestream}
        isPending={updateLivestream.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingLivestreamId} onOpenChange={(open) => !open && setDeletingLivestreamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa livestream này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLivestream}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLivestream.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
