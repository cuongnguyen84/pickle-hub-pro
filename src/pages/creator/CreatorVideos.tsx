import { useState } from "react";
import { Link } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useCreatorVideos, useVideoMutations } from "@/hooks/useCreatorData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Video, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function CreatorVideos() {
  const { organizationId } = useCreatorAuth();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: videos, isLoading } = useCreatorVideos(organizationId, {
    type: typeFilter,
    status: statusFilter,
    search: search || undefined,
  });

  const { deleteVideo } = useVideoMutations(organizationId);

  const handleDelete = (id: string) => {
    deleteVideo.mutate(id);
  };

  return (
    <CreatorLayout>
      <div className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Videos</h1>
            <p className="text-foreground-secondary mt-1 text-sm lg:text-base">
              Manage your video content
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/creator/videos/new">
              <Plus className="w-4 h-4 mr-2" />
              New Video
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input
              placeholder="Search by title or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1 sm:w-32 sm:flex-none">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-32 sm:flex-none">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Videos - Mobile Cards / Desktop Table */}
        {/* Mobile View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))
          ) : videos && videos.length > 0 ? (
            videos.map((video) => (
              <Link
                key={video.id}
                to={`/creator/videos/${video.id}/edit`}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle hover:bg-muted transition-colors"
              >
                <div className="w-20 h-14 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                  <p className="font-medium text-foreground text-sm truncate">
                    {video.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {video.type}
                    </Badge>
                    <Badge
                      variant={
                        video.status === "published"
                          ? "default"
                          : video.status === "hidden"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {video.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground-secondary mt-1">
                    {video.published_at
                      ? format(new Date(video.published_at), "MMM d, yyyy")
                      : "Draft"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Edit className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => e.preventDefault()}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xóa video?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này không thể hoàn tác. Video sẽ bị xóa vĩnh viễn.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(video.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Xóa
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-8 bg-surface rounded-lg border border-border-subtle">
              <p className="text-foreground-secondary">No videos found</p>
              <Button asChild variant="link" className="mt-2">
                <Link to="/creator/videos/new">Create your first video</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block rounded-lg border border-border-subtle bg-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px]">Video</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-16 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : videos && videos.length > 0 ? (
                videos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {video.title}
                          </p>
                          {video.tags && video.tags.length > 0 && (
                            <p className="text-xs text-foreground-secondary truncate">
                              {video.tags.slice(0, 3).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {video.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          video.status === "published"
                            ? "default"
                            : video.status === "hidden"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {video.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground-secondary text-sm">
                      {video.published_at
                        ? format(new Date(video.published_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/creator/videos/${video.id}/edit`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa video?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Hành động này không thể hoàn tác. Video sẽ bị xóa vĩnh viễn.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(video.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <p className="text-foreground-secondary">No videos found</p>
                    <Button asChild variant="link" className="mt-2">
                      <Link to="/creator/videos/new">Create your first video</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </CreatorLayout>
  );
}
