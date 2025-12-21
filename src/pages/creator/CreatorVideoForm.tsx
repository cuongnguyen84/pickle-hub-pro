import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import {
  useCreatorVideo,
  useVideoMutations,
  useCreatorTournaments,
} from "@/hooks/useCreatorData";
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
import { ChevronLeft, Save, Upload, Loader2 } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

export default function CreatorVideoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organizationId } = useCreatorAuth();
  const isEditing = !!id;

  const { data: video, isLoading: videoLoading } = useCreatorVideo(id, organizationId);
  const { data: tournaments } = useCreatorTournaments();
  const { createVideo, updateVideo } = useVideoMutations(organizationId);

  const [formData, setFormData] = useState({
    type: "long" as Enums<"video_type">,
    title: "",
    description: "",
    tags: "",
    tournament_id: "",
    thumbnail_url: "",
    status: "draft" as Enums<"content_status">,
    mux_asset_id: "",
    mux_playback_id: "",
  });

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
        mux_asset_id: video.mux_asset_id ?? "",
        mux_playback_id: video.mux_playback_id ?? "",
      });
    }
  }, [video]);

  const handleSubmit = async (publish: boolean = false) => {
    const tagsArray = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      type: formData.type,
      title: formData.title,
      description: formData.description || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      tournament_id: formData.tournament_id || null,
      thumbnail_url: formData.thumbnail_url || null,
      status: publish ? "published" as const : formData.status,
      mux_asset_id: formData.mux_asset_id || null,
      mux_playback_id: formData.mux_playback_id || null,
      published_at: publish ? new Date().toISOString() : (isEditing ? video?.published_at : null),
    };

    if (isEditing && id) {
      await updateVideo.mutateAsync({ id, ...payload });
    } else {
      await createVideo.mutateAsync(payload);
    }
    navigate("/creator/videos");
  };

  const isSubmitting = createVideo.isPending || updateVideo.isPending;

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

            {/* Thumbnail URL */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
              <Input
                id="thumbnail_url"
                value={formData.thumbnail_url}
                onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                placeholder="https://..."
              />
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

        {/* Mux Settings */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle>Mux Settings (MVP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground-secondary">
              Enter Mux IDs manually for MVP. Real upload integration coming soon.
            </p>
            <div className="space-y-2">
              <Label htmlFor="mux_asset_id">Mux Asset ID</Label>
              <Input
                id="mux_asset_id"
                value={formData.mux_asset_id}
                onChange={(e) => setFormData({ ...formData, mux_asset_id: e.target.value })}
                placeholder="asset_id..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mux_playback_id">Mux Playback ID</Label>
              <Input
                id="mux_playback_id"
                value={formData.mux_playback_id}
                onChange={(e) => setFormData({ ...formData, mux_playback_id: e.target.value })}
                placeholder="playback_id..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !formData.title}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || !formData.title}
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
