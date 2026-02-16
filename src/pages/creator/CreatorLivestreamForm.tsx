import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import {
  useCreatorLivestream,
  useLivestreamMutations,
  useCreatorTournaments,
} from "@/hooks/useCreatorData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Save, Loader2, Copy, Radio, ExternalLink, Eye, EyeOff, Zap, AlertCircle } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export default function CreatorLivestreamForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId } = useCreatorAuth();
  const isEditing = !!id;

  const { data: livestream, isLoading: livestreamLoading } = useCreatorLivestream(id, organizationId);
  const { data: tournaments } = useCreatorTournaments();
  const { createLivestream, updateLivestream } = useLivestreamMutations(organizationId);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tournament_id: "",
    scheduled_start_at: "",
    status: "scheduled" as Enums<"livestream_status">,
    mux_live_stream_id: "",
    mux_playback_id: "",
    mux_stream_key: "",
    thumbnail_url: "",
    streaming_provider: "red5" as string,
  });

  const [showStreamKey, setShowStreamKey] = useState(false);
  const [isCreatingMux, setIsCreatingMux] = useState(false);
  const [muxError, setMuxError] = useState<string | null>(null);
  const [isCreatingRed5, setIsCreatingRed5] = useState(false);
  const [red5Error, setRed5Error] = useState<string | null>(null);
  const [red5Info, setRed5Info] = useState<{ rtmp_url: string; stream_name: string; hls_url: string } | null>(null);

  // Helper to format date to local datetime-local input format (YYYY-MM-DDTHH:mm)
  const formatToLocalDatetime = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (livestream) {
      const provider = (livestream as any).streaming_provider || "mux";
      setFormData({
        title: livestream.title,
        description: livestream.description ?? "",
        tournament_id: livestream.tournament_id ?? "",
        scheduled_start_at: livestream.scheduled_start_at
          ? formatToLocalDatetime(livestream.scheduled_start_at)
          : "",
        status: livestream.status,
        mux_live_stream_id: livestream.mux_live_stream_id ?? "",
        mux_playback_id: livestream.mux_playback_id ?? "",
        mux_stream_key: livestream.mux_stream_key ?? "",
        thumbnail_url: livestream.thumbnail_url ?? "",
        streaming_provider: provider,
      });
      // If Red5 stream already provisioned, restore info
      if (provider === "red5" && (livestream as any).red5_server_url) {
        setRed5Info({
          rtmp_url: (livestream as any).red5_server_url,
          stream_name: (livestream as any).red5_stream_name || "",
          hls_url: (livestream as any).hls_url || "",
        });
      }
    }
  }, [livestream]);

  const handleCreateMuxLivestream = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title before creating a Mux livestream",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingMux(true);
    setMuxError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("mux-create-livestream", {
        body: { title: formData.title, playback_policy: "public" },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create Mux livestream");
      }

      const data = response.data;
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      setFormData(prev => ({
        ...prev,
        mux_live_stream_id: data.mux_live_stream_id || "",
        mux_playback_id: data.mux_playback_id || "",
        mux_stream_key: data.mux_stream_key || "",
      }));

      toast({
        title: "Mux Livestream Created",
        description: "Your streaming credentials are ready. Configure OBS with the details below.",
      });
    } catch (error) {
      console.error("Mux creation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create Mux livestream";
      setMuxError(errorMessage);
      toast({
        title: "Error Creating Livestream",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingMux(false);
    }
  };

  const handleCreateRed5Livestream = async (livestreamId: string) => {
    setIsCreatingRed5(true);
    setRed5Error(null);
    try {
      const response = await supabase.functions.invoke("red5-create-livestream", {
        body: { livestream_id: livestreamId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      setRed5Info(response.data);
      toast({ title: "Red5 Livestream Created", description: "Thông tin stream đã sẵn sàng cho OBS." });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create Red5 livestream";
      setRed5Error(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsCreatingRed5(false);
    }
  };

  const handleSubmit = async () => {
    const payload: any = {
      title: formData.title,
      description: formData.description || null,
      tournament_id: formData.tournament_id || null,
      scheduled_start_at: formData.scheduled_start_at
        ? new Date(formData.scheduled_start_at).toISOString()
        : null,
      status: formData.status,
      thumbnail_url: formData.thumbnail_url || null,
      started_at: formData.status === "live" ? new Date().toISOString() : (isEditing ? livestream?.started_at : null),
      ended_at: formData.status === "ended" ? new Date().toISOString() : null,
      streaming_provider: formData.streaming_provider,
    };

    // Only include Mux fields if provider is mux
    if (formData.streaming_provider === "mux") {
      payload.mux_live_stream_id = formData.mux_live_stream_id || null;
      payload.mux_playback_id = formData.mux_playback_id || null;
      payload.mux_stream_key = formData.mux_stream_key || null;
    }

    let createdId: string | null = null;
    if (isEditing && id) {
      await updateLivestream.mutateAsync({ id, ...payload });
    } else {
      const result = await createLivestream.mutateAsync(payload);
      createdId = (result as any)?.id;
    }

    // For new Red5 livestreams, provision the stream
    if (!isEditing && formData.streaming_provider === "red5" && createdId) {
      await handleCreateRed5Livestream(createdId);
    }

    navigate("/creator/livestreams");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const isSubmitting = createLivestream.isPending || updateLivestream.isPending;
  const hasMuxCredentials = formData.mux_stream_key && formData.mux_playback_id;

  if (isEditing && livestreamLoading) {
    return (
      <CreatorLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </CreatorLayout>
    );
  }

  return (
    <CreatorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/creator/livestreams")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? "Edit Livestream" : "New Livestream"}
            </h1>
            <p className="text-foreground-secondary mt-1">
              {isEditing ? "Update your livestream details" : "Schedule a new livestream"}
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle>Livestream Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Tiêu đề *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nhập tiêu đề livestream"
              />
              <p className="text-xs text-muted-foreground">
                💡 Gợi ý: Tiêu đề rõ ràng + tên sự kiện giúp nhiều người dễ tìm thấy livestream hơn. 
                Ví dụ: "Chung kết Đôi Nam – Giải Pickleball Mùa Xuân 2026"
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Nhập mô tả nội dung livestream"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                💡 Gợi ý: Mô tả ngắn nội dung chính, giải đấu hoặc sự kiện sẽ được phát trong livestream. 
                Điều này giúp người xem hiểu nhanh nội dung trước khi xem.
              </p>
            </div>

            {/* Tournament */}
            <div className="space-y-2">
              <Label htmlFor="tournament">Tournament (optional)</Label>
              <Select
                value={formData.tournament_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, tournament_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tournament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tournaments?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scheduled Start */}
            <div className="space-y-2">
              <Label htmlFor="scheduled_start_at">Scheduled Start</Label>
              <Input
                id="scheduled_start_at"
                type="datetime-local"
                value={formData.scheduled_start_at}
                onChange={(e) =>
                  setFormData({ ...formData, scheduled_start_at: e.target.value })
                }
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as Enums<"livestream_status"> })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Thumbnail URL */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
              <Input
                id="thumbnail_url"
                value={formData.thumbnail_url}
                onChange={(e) => {
                  const url = e.target.value.trim();
                  // Convert Google Drive share links to direct image URL
                  let directUrl = url;
                  
                  // Google Drive: https://drive.google.com/file/d/{FILE_ID}/view
                  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                  if (driveMatch) {
                    // Use lh3.googleusercontent.com format - bypasses CORS
                    directUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
                  }
                  
                  // Google Drive: https://drive.google.com/open?id={FILE_ID}
                  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
                  if (driveOpenMatch) {
                    directUrl = `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}`;
                  }

                  // Google Drive: Already converted uc?export format - also convert
                  const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
                  if (driveUcMatch) {
                    directUrl = `https://lh3.googleusercontent.com/d/${driveUcMatch[1]}`;
                  }
                  
                  setFormData({ ...formData, thumbnail_url: directUrl });
                }}
                placeholder="Dán link ảnh (Google Drive, hoặc link ảnh trực tiếp)"
              />
              <p className="text-xs text-muted-foreground">
                Hỗ trợ: Link ảnh trực tiếp (.jpg, .png), Google Drive (phải chia sẻ công khai)
              </p>
              
              {/* Thumbnail Preview */}
              {formData.thumbnail_url && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm text-muted-foreground">Preview</Label>
                  <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden border border-border bg-muted">
                    <img
                      src={formData.thumbnail_url}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const errorDiv = target.nextElementSibling;
                        if (errorDiv) errorDiv.classList.remove('hidden');
                      }}
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'block';
                        const errorDiv = target.nextElementSibling;
                        if (errorDiv) errorDiv.classList.add('hidden');
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm hidden">
                      <div className="text-center p-4">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Không thể tải ảnh preview</p>
                        <p className="text-xs mt-1">Kiểm tra ảnh đã được chia sẻ công khai chưa</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    URL đã chuyển đổi: <code className="bg-muted px-1 rounded text-xs break-all">{formData.thumbnail_url}</code>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Streaming Provider Selection */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Dịch vụ phát trực tiếp
            </CardTitle>
            <CardDescription>
              Chọn dịch vụ streaming cho livestream này.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Streaming Provider</Label>
              <Select
                value={formData.streaming_provider}
                onValueChange={(value) =>
                  setFormData({ ...formData, streaming_provider: value })
                }
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="red5">Red5 Cloud (Mặc định)</SelectItem>
                  <SelectItem value="mux">Mux</SelectItem>
                </SelectContent>
              </Select>
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  Không thể thay đổi provider sau khi tạo.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mux Integration - only show for mux provider */}
        {formData.streaming_provider === "mux" && (
          <Card className="bg-surface border-border-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Mux Livestream
              </CardTitle>
              <CardDescription>
                Create a real Mux livestream to broadcast via OBS or other streaming software.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasMuxCredentials ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    onClick={handleCreateMuxLivestream}
                    disabled={isCreatingMux || !formData.title.trim()}
                    className="w-full sm:w-auto"
                  >
                    {isCreatingMux && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Zap className="w-4 h-4 mr-2" />
                    Create Mux Livestream
                  </Button>
                  
                  {!formData.title.trim() && (
                    <p className="text-sm text-foreground-secondary">
                      Enter a title first to create a Mux livestream.
                    </p>
                  )}

                  {muxError && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div className="text-sm text-destructive">{muxError}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-primary font-medium">
                      ✓ Mux livestream ready! Configure your streaming software with the details below.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground-secondary">Live Stream ID</Label>
                      <Input value={formData.mux_live_stream_id} readOnly className="font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground-secondary">Playback ID</Label>
                      <Input value={formData.mux_playback_id} readOnly className="font-mono text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mux Streaming Guide */}
        {formData.streaming_provider === "mux" && hasMuxCredentials && (
          <Card className="bg-surface border-border-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                Streaming Guide (OBS) - Mux
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>RTMP Server URL</Label>
                <div className="flex items-center gap-2">
                  <Input value="rtmps://global-live.mux.com:443/app" readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard("rtmps://global-live.mux.com:443/app", "RTMP URL")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Stream Key
                  <span className="text-xs text-destructive font-normal">SENSITIVE</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input type={showStreamKey ? "text" : "password"} value={formData.mux_stream_key} readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowStreamKey(!showStreamKey)}>
                    {showStreamKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(formData.mux_stream_key, "Stream Key")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Playback URL (HLS)</Label>
                <div className="flex items-center gap-2">
                  <Input value={`https://stream.mux.com/${formData.mux_playback_id}.m3u8`} readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(`https://stream.mux.com/${formData.mux_playback_id}.m3u8`, "Playback URL")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Red5 Streaming Guide - show when red5 is provisioned */}
        {formData.streaming_provider === "red5" && red5Info && (
          <Card className="bg-surface border-border-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                Streaming Guide (OBS) - Red5 Cloud
              </CardTitle>
              <CardDescription>
                Nhập thông tin này vào OBS hoặc phần mềm stream của bạn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary font-medium">
                  ✓ Red5 livestream đã sẵn sàng!
                </p>
              </div>
              <div className="space-y-2">
                <Label>RTMP Server URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={red5Info.rtmp_url} readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(red5Info.rtmp_url, "RTMP URL")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stream Key (Name)</Label>
                <div className="flex items-center gap-2">
                  <Input value={red5Info.stream_name} readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(red5Info.stream_name, "Stream Key")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>HLS Playback URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={red5Info.hls_url} readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(red5Info.hls_url, "HLS URL")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" asChild>
                    <a href={red5Info.hls_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>

              {red5Error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm text-destructive">{red5Error}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Red5 info message for new (not yet saved) livestreams */}
        {formData.streaming_provider === "red5" && !red5Info && !isEditing && (
          <Card className="bg-surface border-border-subtle">
            <CardContent className="py-6">
              <p className="text-sm text-foreground-secondary text-center">
                💡 Thông tin RTMP sẽ được tạo tự động sau khi bạn nhấn "Create Livestream".
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? "Save Changes" : "Create Livestream"}
          </Button>
        </div>
      </div>
    </CreatorLayout>
  );
}
