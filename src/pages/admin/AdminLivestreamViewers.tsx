import { AdminLayout } from "@/components/admin/AdminLayout";
import { useI18n } from "@/i18n";
import { useLiveViewerList } from "@/hooks/useLiveViewerList";
import { ViewerListTable } from "@/components/admin/ViewerListTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Users, Wifi, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLivestreamViewers() {
  const { t } = useI18n();
  const [selectedLivestreamId, setSelectedLivestreamId] = useState<string>("");

  // Fetch active (live) livestreams for the dropdown
  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["admin-live-livestreams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestreams")
        .select("id, title, status, organization:organizations(name)")
        .in("status", ["live", "scheduled"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000, // refresh every 30s
  });

  const { viewers, isConnected, viewerCount } = useLiveViewerList(
    selectedLivestreamId,
    !!selectedLivestreamId
  );

  const selectedStream = liveStreams.find((s) => s.id === selectedLivestreamId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.admin.viewers.title}</h1>
          <p className="text-foreground-muted mt-1">{t.admin.viewers.description}</p>
        </div>

        {/* Livestream selector */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="w-5 h-5 text-live" />
              {t.admin.viewers.selectLivestream}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {streamsLoading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : liveStreams.length === 0 ? (
              <p className="text-foreground-muted">{t.admin.viewers.noActiveLivestreams}</p>
            ) : (
              <Select value={selectedLivestreamId} onValueChange={setSelectedLivestreamId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={t.admin.viewers.selectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {liveStreams.map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>
                      <div className="flex items-center gap-2">
                        {stream.status === "live" && (
                          <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
                        )}
                        <span>{stream.title}</span>
                        <span className="text-foreground-muted text-xs">
                          — {(stream.organization as any)?.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Viewer list */}
        {selectedLivestreamId && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  {t.admin.viewers.viewerList}
                </span>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-sm">
                    {viewerCount} {t.admin.viewers.watching}
                  </Badge>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <Wifi className="w-3 h-3" /> {t.admin.viewers.connected}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-foreground-muted">
                      <WifiOff className="w-3 h-3" /> {t.admin.viewers.disconnected}
                    </span>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ViewerListTable viewers={viewers} isLoading={!isConnected} />
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
