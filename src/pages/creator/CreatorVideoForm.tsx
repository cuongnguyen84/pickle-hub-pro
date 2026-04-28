import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import {
  useCreatorVideo,
  useVideoMutations,
  useCreatorTournaments,
} from "@/hooks/useCreatorData";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useThumbnailGenerator } from "@/hooks/useThumbnailGenerator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoUploader } from "@/components/video/VideoUploader";
import { ChevronLeft, Save, Upload, Loader2, ImageIcon, RefreshCw } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function CreatorVideoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organizationId } = useCreatorAuth();
  const { toast } = useToast();
  const isEditing = !!id;

  const { data: video, isLoading: videoLoading } = useCreatorVideo(id, organizationId);
  const { data: tournaments } = useCreatorTournaments();
  const { createVideo, updateVideo } = useVideoMutations(organizationId);
  const uploadHook = useVideoUpload(organizationId);
  const thumbnailHook = useThumbnailGenerator(organizationId);

  const [formData, setFormData] = useState({
    type: "long" as Enums<"video_type">,
    title: "",
    description: "",
    tags: "",
    tournament_id: "",
    thumbnail_url: "",
    status: "draft" as Enums<"content_status">,
  });

  // Track upload state from form or hook
  const [uploadedData, setUploadedData] = useState<{
    storagePath: string | null;
    videoUrl: string | null;
  }>({ storagePath: null, videoUrl: null });

  useEffect(() => {
    if (video) {
      setFormData({
        type: video.type,
        title: video.title,
        description: video.description ?? "",
        tags: video.tags?.join(", ") ?? "",
        tournament_id: video.tournament_id ?? "",
        thumbnail_url: video.thumbnail_url ?? "",
        status: video.status,
      });
    }
  }, [video]);

  // Sync upload hook results to local state and trigger thumbnail generation
  useEffect(() => {
    if (uploadHook.storagePath && uploadHook.videoUrl) {
      setUploadedData({
        storagePath: uploadHook.storagePath,
        videoUrl: uploadHook.videoUrl,
      });
      
      // Auto-generate thumbnail if not already set. Hook handles internal
      // retry / multi-frame sampling / CORS-safe blob fallback. We surface
      // success or actionable failure so the user isn't left with a black
      // card and no idea what to do next.
      if (!formData.thumbnail_url) {
        const videoId = id || uploadHook.storagePath.split("/").pop()?.split(".")[0] || Date.now().toString();
        thumbnailHook
          .generateThumbnail(uploadHook.videoUrl, videoId)
          .then((url) => {
            if (url) {
              setFormData((prev) => ({ ...prev, thumbnail_url: url }));
              toast({
                title: "Thumbnail generated",
                description: "Thumbnail đã được tạo tự động từ video",
              });
            } else {
              toast({
                title: "Auto-thumbnail failed",
                description: "Bấm \"Tạo lại thumbnail\" để thử lại, hoặc dán URL ảnh thủ công.",
                variant: "destructive",
              });
            }
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("[Thumbnail] Auto-generate threw:", err);
            toast({
              title: "Auto-thumbnail failed",
              description: err?.message || "Vui lòng thử lại bằng nút \"Tạo lại thumbnail\".",
              variant: "destructive",
            });
          });
      }
    }
  }, [uploadHook.storagePath, uploadHook.videoUrl]);

  const handleUpload = async (file: File) => {
    // Delete old file if replacing
    if (isEditing && video?.storage_path && uploadHook.deleteFile) {
      await uploadHook.deleteFile(video.storage_path);
    }
    return uploadHook.upload(file, id);
  };

  const handleDeleteUpload = async (storagePath: string) => {
    const success = await uploadHook.deleteFile(storagePath);
    if (success) {
      setUploadedData({ storagePath: null, videoUrl: null });
      uploadHook.reset();
    }
    return success;
  };

  const handleRegenerateThumbnail = async () => {
    const videoUrl = uploadedData.videoUrl || getExistingVideoUrl();
    if (!videoUrl) return;
    
    const videoId = id || uploadedData.storagePath?.split("/").pop()?.split(".")[0] || Date.now().toString();
    const url = await thumbnailHook.generateThumbnail(videoUrl, videoId);
    if (url) {
      setFormData((prev) => ({ ...prev, thumbnail_url: url }));
      toast({
        title: "Thumbnail regenerated",
        description: "Thumbnail mới đã được tạo",
      });
    }
  };

  const handleSubmit = async (publish: boolean = false) => {
    const tagsArray = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Determine source and paths
    const hasNewUpload = !!uploadedData.storagePath;
    const hasExistingStorage = isEditing && video?.source === "storage" && video?.storage_path;
    const hasExistingMux = isEditing && video?.source === "mux" && video?.mux_playback_id;

    let source: "storage" | "mux" = "storage";
    let storage_path: string | null = null;

    if (hasNewUpload) {
      source = "storage";
      storage_path = uploadedData.storagePath;
    } else if (hasExistingStorage) {
      source = "storage";
      storage_path = video.storage_path;
    } else if (hasExistingMux) {
      source = "mux";
    }

    const payload = {
      type: formData.type,
      title: formData.title,
      description: formData.description || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      tournament_id: formData.tournament_id || null,
      thumbnail_url: formData.thumbnail_url || null,
      status: publish ? ("published" as const) : formData.status,
      published_at: publish ? new Date().toISOString() : (isEditing ? video?.published_at : null),
      source,
      storage_path,
      // Clear mux fields if switching to storage
      mux_asset_id: source === "storage" ? null : video?.mux_asset_id,
      mux_playback_id: source === "storage" ? null : video?.mux_playback_id,
    };

    if (isEditing && id) {
      await updateVideo.mutateAsync({ id, ...payload });
    } else {
      await createVideo.mutateAsync(payload);
    }
    navigate("/creator/videos");
  };

  const isSubmitting = createVideo.isPending || updateVideo.isPending;
  
  // Determine if we can publish
  const hasVideo = 
    !!uploadedData.storagePath || 
    (isEditing && video?.storage_path) ||
    (isEditing && video?.mux_playback_id);
  
  const canPublish = formData.title && hasVideo && !uploadHook.isUploading;

  // Get existing video URL for preview in edit mode
  const getExistingVideoUrl = () => {
    if (!video) return undefined;
    if (video.source === "storage" && video.storage_path) {
      const { data } = supabase.storage.from("videos").getPublicUrl(video.storage_path);
      return data.publicUrl;
    }
    return undefined;
  };

  if (isEditing && videoLoading) {
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
            onClick={() => navigate("/creator/videos")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? "Edit Video" : "New Video"}
            </h1>
            <p className="text-foreground-secondary mt-1">
              {isEditing ? "Update your video details" : "Add a new video to your channel"}
            </p>
          </div>
        </div>

        {/* Video Upload Section */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle>Upload Video</CardTitle>
          </CardHeader>
          <CardContent>
            <VideoUploader
              onUpload={handleUpload}
              onDelete={handleDeleteUpload}
              isUploading={uploadHook.isUploading}
              progress={uploadHook.progress}
              error={uploadHook.error}
              storagePath={uploadedData.storagePath}
              videoUrl={uploadedData.videoUrl}
              existingUrl={getExistingVideoUrl()}
              existingSource={video?.source as "storage" | "mux" | undefined}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle>Video Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as Enums<"video_type"> })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter video title"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter video description"
                rows={4}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
              />
              <p className="text-xs text-foreground-muted">Separate tags with commas</p>
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

            {/* Thumbnail */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail_url">Thumbnail</Label>
              <div className="flex gap-2">
                <Input
                  id="thumbnail_url"
                  value={formData.thumbnail_url}
                  onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1"
                />
                {(uploadedData.videoUrl || getExistingVideoUrl()) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleRegenerateThumbnail}
                    disabled={thumbnailHook.isGenerating}
                    title="Regenerate thumbnail"
                  >
                    {thumbnailHook.isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              {thumbnailHook.isGenerating && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating thumbnail...
                </p>
              )}
              {formData.thumbnail_url && (
                <div className="mt-2">
                  <p className="text-xs text-foreground-muted mb-1">Preview:</p>
                  <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-black border border-border">
                    <img
                      src={formData.thumbnail_url}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as Enums<"content_status"> })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !formData.title || uploadHook.isUploading}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || !canPublish}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Upload className="w-4 h-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>
    </CreatorLayout>
  );
}
