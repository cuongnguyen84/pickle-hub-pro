import { useState } from "react";
import { Link } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import { useCreatorLivestreams } from "@/hooks/useCreatorData";
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
import { Plus, Radio, Edit } from "lucide-react";
import { format } from "date-fns";

export default function CreatorLivestreams() {
  const { organizationId } = useCreatorAuth();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: livestreams, isLoading } = useCreatorLivestreams(organizationId, {
    status: statusFilter,
  });

  return (
    <CreatorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Livestreams</h1>
            <p className="text-foreground-secondary mt-1">
              Manage your live broadcasts
            </p>
          </div>
          <Button asChild>
            <Link to="/creator/livestreams/new">
              <Plus className="w-4 h-4 mr-2" />
              New Livestream
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
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

        {/* Livestreams Table */}
        <div className="rounded-lg border border-border-subtle bg-surface overflow-hidden">
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
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/creator/livestreams/${stream.id}/edit`}>
                          <Edit className="w-4 h-4" />
                        </Link>
                      </Button>
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
