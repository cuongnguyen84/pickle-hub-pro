import { useState } from "react";
import { Link } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useCreatorLivestreams, useLivestreamMutations } from "@/hooks/useCreatorData";
import { Button } from "@/components/ui/button";
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
import { Plus, Radio, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function CreatorLivestreams() {
  const { organizationId } = useCreatorAuth();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: livestreams, isLoading } = useCreatorLivestreams(organizationId, {
    status: statusFilter,
  });
  
  const { deleteLivestream } = useLivestreamMutations(organizationId);

  const handleDelete = (id: string) => {
    deleteLivestream.mutate(id);
  };

  return (
    <CreatorLayout>
      <div className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Livestreams</h1>
            <p className="text-foreground-secondary mt-1 text-sm lg:text-base">
              Manage your live broadcasts
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/creator/livestreams/new">
              <Plus className="w-4 h-4 mr-2" />
              New Livestream
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))
          ) : livestreams && livestreams.length > 0 ? (
            livestreams.map((stream) => (
              <Link
                key={stream.id}
                to={`/creator/livestreams/${stream.id}/edit`}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle hover:bg-muted transition-colors"
              >
                <div className="w-20 h-14 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                  <p className="font-medium text-foreground text-sm truncate">
                    {stream.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={
                        stream.status === "live"
                          ? "destructive"
                          : stream.status === "scheduled"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {stream.status === "live" && (
                        <span className="w-1.5 h-1.5 bg-current rounded-full mr-1 animate-pulse" />
                      )}
                      {stream.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground-secondary mt-1">
                    {stream.scheduled_start_at
                      ? format(new Date(stream.scheduled_start_at), "MMM d, HH:mm")
                      : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <Edit className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xóa livestream?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này không thể hoàn tác. Livestream sẽ bị xóa vĩnh viễn.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(stream.id);
                          }}
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
              <p className="text-foreground-secondary">No livestreams found</p>
              <Button asChild variant="link" className="mt-2">
                <Link to="/creator/livestreams/new">Schedule your first livestream</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block rounded-lg border border-border-subtle bg-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px]">Livestream</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Started</TableHead>
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
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-16 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : livestreams && livestreams.length > 0 ? (
                livestreams.map((stream) => (
                  <TableRow key={stream.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {stream.title}
                          </p>
                          {stream.tournaments && (
                            <p className="text-xs text-foreground-secondary truncate">
                              {(stream.tournaments as { name: string }).name}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
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
                        {stream.status === "live" && (
                          <span className="w-2 h-2 bg-current rounded-full mr-1.5 animate-pulse" />
                        )}
                        {stream.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground-secondary text-sm">
                      {stream.scheduled_start_at
                        ? format(new Date(stream.scheduled_start_at), "MMM d, HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-foreground-secondary text-sm">
                      {stream.started_at
                        ? format(new Date(stream.started_at), "MMM d, HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/creator/livestreams/${stream.id}/edit`}>
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
                              <AlertDialogTitle>Xóa livestream?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Hành động này không thể hoàn tác. Livestream sẽ bị xóa vĩnh viễn.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(stream.id)}
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
                    <p className="text-foreground-secondary">No livestreams found</p>
                    <Button asChild variant="link" className="mt-2">
                      <Link to="/creator/livestreams/new">Schedule your first livestream</Link>
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
